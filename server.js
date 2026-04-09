/**
 * server.js — Honeypot Server (v2)
 *
 * FOLDER STRUCTURE REQUIRED:
 *   honey/
 *   ├── server.js          ← this file
 *   ├── block.js
 *   ├── blockchain.js
 *   ├── package.json
 *   └── public/
 *       ├── login.html
 *       ├── bank.html
 *       └── script.js
 *
 * HOW TO RUN:
 *   cd honey
 *   npm install
 *   node server.js
 *
 * ENDPOINTS:
 *   http://localhost:3000/login    ← fake login page (lure)
 *   http://localhost:3000/chain    ← full blockchain JSON
 *   http://localhost:3000/validate ← tamper check
 *   http://localhost:3000/stats    ← summary statistics
 *   http://localhost:3000/logs     ← recent login attempts
 */

'use strict';

const express   = require('express');
const fs        = require('fs');
const path      = require('path');
const morgan    = require('morgan');
const helmet    = require('helmet');
const geoip     = require('geoip-lite');

const Block      = require('./block');
const Blockchain = require('./blockchain');

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT          = process.env.PORT || 3000;
const LOG_FILE      = path.join(__dirname, 'honeypot.log');
const CHAIN_FILE    = path.join(__dirname, 'honeypot_chain.json');
const PUBLIC_DIR    = path.join(__dirname, 'public');   // ← single source of truth for paths
const MAX_BODY_SIZE = '10kb';

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

// Helmet: secure HTTP response headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc : ["'self'"],
      styleSrc   : ["'self'", "'unsafe-inline'"],
      scriptSrc  : ["'self'"],
    },
  },
}));

// Body parsers
app.use(express.urlencoded({ extended: true, limit: MAX_BODY_SIZE }));
app.use(express.json({ limit: MAX_BODY_SIZE }));

// Serve static files from the public/ folder
app.use(express.static(PUBLIC_DIR));

// HTTP access log → written to honeypot.log
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
app.use(morgan('combined', { stream: logStream }));

// ─── Blockchain initialisation ────────────────────────────────────────────────

const honeypotChain = new Blockchain();
console.log('✅ Blockchain initialised. Genesis hash:', honeypotChain.getLatestBlock().hash);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get real client IP — handles proxies / load balancers */
function getClientIP(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/** Build a rich log entry from a request */
function buildLogEntry(req, extra = {}) {
  const ip  = getClientIP(req);
  const geo = geoip.lookup(ip) || {};

  return {
    timestamp : new Date().toISOString(),
    ip,
    port      : req.socket.remotePort,
    method    : req.method,
    path      : req.originalUrl,
    userAgent : req.headers['user-agent'] || 'unknown',
    referer   : req.headers['referer']    || null,
    headers   : req.headers,
    geo: {
      country  : geo.country  || null,
      region   : geo.region   || null,
      city     : geo.city     || null,
      ll       : geo.ll       || null,      // [lat, lng]
      timezone : geo.timezone || null,
    },
    ...extra,
  };
}

/** Write entry to flat log + blockchain, persist chain to disk */
function recordEvent(entry) {
  // 1. Flat NDJSON log
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');

  // 2. Mine a new block
  const block = new Block(
    honeypotChain.chain.length,
    entry.timestamp,
    [entry],
    ''   // previousHash set inside addBlock()
  );
  honeypotChain.addBlock(block);

  // 3. Persist chain to disk
  fs.writeFileSync(CHAIN_FILE, JSON.stringify(honeypotChain.chain, null, 2), 'utf8');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Root → redirect to login
app.get('/', (_req, res) => res.redirect('/login'));

// ── Serve login page ──────────────────────────────────────────────────────────
app.get('/login', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

// ── Capture login attempt ─────────────────────────────────────────────────────
app.post('/login', (req, res) => {
  const entry = buildLogEntry(req, {
    type     : 'login_attempt',
    username : req.body.username || '',
    password : req.body.password || '',
  });

  recordEvent(entry);

  console.log(
    `🚨 LOGIN ATTEMPT | IP: ${entry.ip} | ` +
    `User: "${entry.username}" | Pass: "${entry.password}" | ` +
    `Location: ${entry.geo.city || 'unknown'}, ${entry.geo.country || 'unknown'}`
  );

  // Redirect to fake dashboard — makes attacker think login succeeded
  res.redirect('/bank');
});

// ── Fake bank dashboard ───────────────────────────────────────────────────────
app.get('/bank', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'bank.html'));
});

// ── Analysis endpoints ────────────────────────────────────────────────────────

/** Full blockchain */
app.get('/chain', (_req, res) => {
  res.json(honeypotChain.chain);
});

/** Tamper check */
app.get('/validate', (_req, res) => {
  const valid = honeypotChain.isChainValid();
  res.json({
    valid,
    message: valid ? 'Blockchain is intact ✅' : 'Blockchain has been tampered with ❌',
  });
});

/** Summary stats */
app.get('/stats', (_req, res) => {
  const stats        = honeypotChain.getStats();
  let loginAttempts  = 0;
  const ipCounts     = {};

  honeypotChain.chain.forEach(block => {
    if (!Array.isArray(block.data)) return;
    block.data.forEach(entry => {
      if (!entry) return;
      if (entry.type === 'login_attempt') loginAttempts++;
      if (entry.ip) ipCounts[entry.ip] = (ipCounts[entry.ip] || 0) + 1;
    });
  });

  const topIPs = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  res.json({ ...stats, loginAttempts, topIPs });
});

/** Recent login attempts */
app.get('/logs', (req, res) => {
  const limit   = Math.min(parseInt(req.query.limit, 10) || 20, 200);
  const entries = [];

  honeypotChain.chain.forEach(block => {
    if (!Array.isArray(block.data)) return;
    block.data.forEach(entry => {
      if (entry && entry.type === 'login_attempt') entries.push(entry);
    });
  });

  res.json(entries.slice(-limit).reverse());
});

// ─── Catch-all: log every unknown probe ───────────────────────────────────────
app.use((req, res) => {
  const entry = buildLogEntry(req, { type: 'probe' });
  recordEvent(entry);
  console.log(`⚠  PROBE | ${req.method} ${req.originalUrl} from ${entry.ip}`);
  res.status(404).send('<h3>404 Not Found</h3>');
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🍯 Honeypot running → http://localhost:${PORT}`);
  console.log(`   Login  : http://localhost:${PORT}/login`);
  console.log(`   Chain  : http://localhost:${PORT}/chain`);
  console.log(`   Stats  : http://localhost:${PORT}/stats`);
  console.log(`   Logs   : http://localhost:${PORT}/logs\n`);
});
