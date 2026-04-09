/**
 * block.js
 * Represents a single block in the honeypot blockchain.
 * Each block stores one or more captured intrusion log entries,
 * linked to the previous block via its hash (tamper-evident chain).
 */

const crypto = require('crypto');

class Block {
  /**
   * @param {number}   index        - Position in the chain (0 = genesis)
   * @param {string}   timestamp    - ISO-8601 creation time
   * @param {Array}    data         - Array of log objects stored in this block
   * @param {string}   previousHash - Hash of the preceding block
   */
  constructor(index, timestamp, data, previousHash = '') {
    this.index        = index;
    this.timestamp    = timestamp;
    this.data         = data;           // renamed from "logs" for clarity
    this.previousHash = previousHash;
    this.nonce        = 0;
    this.hash         = this.calculateHash();
  }

  /**
   * SHA-256 hash of all block fields (including nonce).
   * Changing ANY field invalidates the hash and breaks the chain.
   */
  calculateHash() {
    const payload = `${this.index}${this.timestamp}${JSON.stringify(this.data)}${this.previousHash}${this.nonce}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Proof-of-Work: increment nonce until hash begins with `difficulty` zeros.
   * Difficulty 2 ⟹ hash must start with "00".
   */
  mineBlock(difficulty) {
    const target = '0'.repeat(difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log(`  ⛏  Block #${this.index} mined — nonce: ${this.nonce}, hash: ${this.hash}`);
  }
}

module.exports = Block;
