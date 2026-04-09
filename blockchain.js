/**
 * blockchain.js
 * A simple append-only blockchain used to store honeypot intrusion logs
 * in a tamper-evident, ordered structure.
 *
 * Key properties:
 *  - Each block contains a SHA-256 hash of its own contents.
 *  - Each block stores the previous block's hash, chaining them together.
 *  - Proof-of-Work (difficulty = 2) prevents trivial block substitution.
 *  - isChainValid() detects any retrospective tampering.
 */

const Block = require('./block');

class Blockchain {
  constructor() {
    this.chain      = [this._createGenesisBlock()];
    this.difficulty = 2;   // Number of leading zeros required in a valid hash
  }

  /** The very first block — hardcoded "previous hash" of "0". */
  _createGenesisBlock() {
    return new Block(0, new Date().toISOString(), ['Genesis Block'], '0');
  }

  /** Returns the most recently added block. */
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Appends a new block to the chain.
   * Sets previousHash, mines it, then pushes it onto the chain.
   */
  addBlock(newBlock) {
    newBlock.previousHash = this.getLatestBlock().hash;
    newBlock.mineBlock(this.difficulty);
    this.chain.push(newBlock);
  }

  /**
   * Validates every block in the chain:
   *  1. Re-computes its hash and compares to the stored value.
   *  2. Verifies the previousHash link to the block before it.
   *
   * Returns true only if the entire chain is intact.
   */
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current  = this.chain[i];
      const previous = this.chain[i - 1];

      // Detect tampered data
      if (current.hash !== current.calculateHash()) {
        console.warn(`  ❌ Block #${i} has an invalid hash`);
        return false;
      }

      // Detect broken link
      if (current.previousHash !== previous.hash) {
        console.warn(`  ❌ Block #${i} is not linked to block #${i - 1}`);
        return false;
      }
    }
    return true;
  }

  /** Summary statistics — useful for the /stats endpoint. */
  getStats() {
    return {
      totalBlocks : this.chain.length,
      isValid     : this.isChainValid(),
      latestHash  : this.getLatestBlock().hash,
      difficulty  : this.difficulty,
    };
  }
}

module.exports = Blockchain;
