# 🍯 Honeypot — Blockchain Intrusion Logger

A cybersecurity project I built to understand how attackers behave when 
they try to break into systems. It's a fake bank login page that looks 
real — but behind the scenes, it records everything the attacker does.

What makes it different from a normal log file is that I store all the 
captured data in a **custom blockchain I built from scratch**. This means 
even if someone breaks in and tries to delete the evidence — they can't, 
because tampering with any record breaks the entire chain and gets detected 
immediately.

![Honeypot Login Page](screenshots:login.png)

---

## Why I Built This

I wanted to understand two things practically:
1. How do real attackers probe and attack web systems?
2. How does blockchain actually work at the code level — not just theory?

This project combines both. It's not just a toy — honeypots are actually 
used by banks, government agencies, and security researchers in the real world.

---

## What It Does

When someone visits `/login` they see a convincing bank login page 
(SecureNet Banking). The moment they type credentials and hit Sign In:

- Their **username and password** are captured
- Their **IP address** is recorded
- Their **location** is looked up (country, city, coordinates) using GeoIP
- Their **browser, OS, and all HTTP headers** are saved
- A **new block is mined** and added to the blockchain
- They get redirected to a fake bank dashboard — they think they're in 😄

Even if someone just visits a random URL like `/admin` or `/.env` — that 
probe is also captured and logged. Automated scanners don't get away either.

---

## Project Structure
honey/
├── server.js         → Express server, all routes and logic
├── block.js          → Block class with SHA-256 hashing + Proof of Work
├── blockchain.js     → Chain management, validation, stats
├── package.json
└── public/
├── login.html    → Fake bank login page
├── bank.html     → Fake dashboard (shown after login)
└── script.js     → Minimal client JS

---

## The Blockchain Part

I didn't use any blockchain library — I built it from scratch using 
Node's built-in `crypto` module.

Each **Block** stores:
- The captured attack data
- A SHA-256 hash of all its contents
- The previous block's hash (this is what links them)
- A nonce (used during mining)

**Proof of Work:** Before a block gets added, it has to be *mined* — 
meaning the computer keeps hashing with an incrementing nonce until 
the hash starts with `"00"`. This makes replacing old blocks expensive.

**Tamper detection:** `isChainValid()` re-hashes every block and checks 
every link. Change even one character in an old log entry — the hash 
breaks, the chain breaks, tamper is detected instantly.

---

## How to Run

```bash
cd honey
npm install
node server.js
```

Then open: `http://localhost:3000/login`

| Endpoint | What it shows |
|----------|---------------|
| `/login` | Fake bank login (the lure) |
| `/bank` | Fake dashboard |
| `/chain` | Full blockchain data |
| `/validate` | Is the chain tampered? |
| `/stats` | Total attacks, top IPs |
| `/logs` | Recent login attempts |

---

## Tech Stack

- **Node.js + Express** — server
- **SHA-256 (crypto module)** — hashing
- **Proof of Work** — block mining
- **geoip-lite** — offline IP geolocation
- **Helmet.js** — HTTP security headers
- **Morgan** — HTTP request logging

---

## What I Learned

- How honeypots work and why they're used in real security operations
- Blockchain internals — hashing, linking, Proof of Work — all from scratch
- How attackers behave: credential stuffing, path probing, scanner patterns
- Node.js middleware architecture and Express routing
- Forensic data collection: GeoIP, HTTP headers, browser fingerprinting

---

## Disclaimer

This is built for **learning and research purposes only**. 
Run it only on your own machine or systems you have permission to monitor.
Never deploy this to capture credentials from real users.