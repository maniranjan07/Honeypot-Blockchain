# 🍯 Honeypot v2 — Blockchain-Backed Intrusion Logger

A Node.js honeypot server that masquerades as a bank login portal, captures every credential attempt and probe in a **tamper-evident blockchain**, and exposes several analysis endpoints for defenders.

---

## Project Structure

```
honeypot-v2/
├── server.js           ← Express app — main entry point
├── block.js            ← Block class (SHA-256, Proof-of-Work)
├── blockchain.js       ← Blockchain class (append, validate, stats)
├── package.json
├── honeypot.log        ← Runtime: raw NDJSON log (auto-created)
├── honeypot_chain.json ← Runtime: persisted blockchain (auto-created)
└── public/
    ├── login.html      ← Fake bank login page (lure)
    ├── bank.html       ← Fake bank dashboard (shown after login)
    └── script.js       ← Minimal client JS
```

---

## How It Works

### 1. The Lure (`/login`)
A convincing bank login page (SecureNet Banking) is served. No real authentication ever occurs.

### 2. Capture (`POST /login`)
When an attacker submits credentials, the server captures:
- Username and password typed
- Client IP address (with proxy-header support)
- Full HTTP request headers
- GeoIP data (country, city, region, timezone, lat/long)
- Timestamp

### 3. Dual Logging
Every captured event is written to **two** places:
- `honeypot.log` — a flat NDJSON file for quick `grep`/`jq` analysis
- The **blockchain** — each event is mined into a new block, then persisted to `honeypot_chain.json`

### 4. Catch-All Probe Logging
Any request to an unrecognised path (e.g. `GET /.env`, `GET /admin`) is also captured and logged as a **probe** event, revealing automated scanner behaviour.

### 5. Analysis Endpoints (for the defender)

| Endpoint      | Description                                  |
|---------------|----------------------------------------------|
| `GET /chain`  | Full blockchain as JSON                      |
| `GET /validate` | Returns whether the chain is intact        |
| `GET /stats`  | Block count, top attacker IPs, login count   |
| `GET /logs?limit=N` | Last N login attempts (newest first)   |

---

## Blockchain Design

### `block.js`
Each `Block` contains:
- `index` — position in chain
- `timestamp` — ISO-8601 creation time
- `data` — array of log entries
- `previousHash` — SHA-256 hash of the previous block
- `nonce` — incremented during Proof-of-Work mining
- `hash` — SHA-256 of all above fields

**Proof-of-Work:** `mineBlock(difficulty)` increments the nonce until the hash starts with `difficulty` zero characters (default: 2). This prevents trivial block substitution.

### `blockchain.js`
- Genesis block is created automatically on startup
- `addBlock(block)` links the new block to the chain tip, mines it, then pushes it
- `isChainValid()` re-computes every block's hash and checks each `previousHash` link — any tampering is detected immediately
- `getStats()` returns a summary object

---

## Setup & Running

```bash
cd honeypot-v2
npm install
npm start
```

Then visit `http://localhost:3000/login`.

---

## Improvements Over v1

| Feature | v1 | v2 |
|---------|----|----|
| Security headers | ❌ | ✅ helmet |
| Real IP extraction (proxy-aware) | ❌ | ✅ |
| Probe logging (all unknown paths) | ✅ | ✅ (with event type) |
| Blockchain field name | `logs` | `data` (clearer) |
| Stats endpoint | ❌ | ✅ `/stats` |
| Logs endpoint | ❌ | ✅ `/logs?limit=N` |
| Validate returns JSON | ❌ | ✅ |
| Code comments | Sparse | Full JSDoc |
| Login page design | Basic | Convincing bank UI |
| Dashboard design | Basic | Polished cards + table |

---

## Disclaimer

This tool is intended for **educational purposes and authorised security research only**. Deploy it only on systems you own or have explicit permission to monitor. Never use it to capture credentials from real, unsuspecting users.
