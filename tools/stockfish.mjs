/**
 * Minimal UCI client for public/stockfish.js running in a Node worker thread.
 *
 * Used as the neutral "referee" for the bot benchmark:
 * every move produced by the in-app engines is scored against the best move
 * Stockfish finds in the same position.
 */
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Stockfish {
  constructor() {
    this.worker = new Worker(path.resolve(__dirname, 'sf-worker.mjs'));
    this.lines = [];
    this.waiters = [];
    this.buffer = [];
    this.ready = false;

    this.worker.on('message', (msg) => {
      if (msg === '__ready__') {
        this.ready = true;
        this._flush();
        return;
      }
      if (typeof msg !== 'string') return;
      this.buffer.push(msg);
      this._flush();
    });
  }

  _flush() {
    if (!this.ready) return;
    while (this.buffer.length > 0) {
      const line = this.buffer.shift();
      if (this.waiters.length > 0) {
        // Hand the line straight to the waiting reader – do NOT also queue it,
        // otherwise the same line is delivered twice and the UCI handshake
        // desynchronises (the engine then looks "stuck").
        const waiter = this.waiters.shift();
        waiter.resolve(line);
      } else {
        this.lines.push(line);
      }
    }
  }

  send(cmd) {
    this.worker.postMessage(cmd);
  }

  /** Read lines until `predicate(line)` is true. */
  async readUntil(predicate, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const line = await this.readLine(Math.max(1, deadline - Date.now()));
      if (line === null) throw new Error('stockfish: timeout while reading output');
      if (predicate(line)) return line;
    }
  }

  readLine(timeoutMs = 30000) {
    if (this.lines.length > 0) {
      return Promise.resolve(this.lines.shift());
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex(w => w.__timer === timer);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error('stockfish: timeout while reading output'));
      }, timeoutMs);
      this.waiters.push({
        __timer: timer,
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
      });
    });
  }

  async uci() {
    this.send('uci');
    await this.readUntil(l => l === 'uciok');
  }

  async isready() {
    this.send('isready');
    await this.readUntil(l => l === 'readyok');
  }

  /**
   * @param {string} fen
   * @param {{depth?: number, movetime?: number}} opts
   * @returns {Promise<{bestmove: string, scoreCp: number|null, mate: number|null, depth: number, pv: string[]}>}
   */
  async analyse(fen, opts = {}) {
    const { depth = 10, movetime = 2000 } = opts;
    this.send(`setoption name UCI_Elo value 2850`);
    this.send('isready');
    await this.readUntil(l => l === 'readyok');

    this.send(`position fen ${fen}`);
    this.send(movetime ? `go movetime ${movetime}` : `go depth ${depth}`);

    let scoreCp = null;
    let mate = null;
    let bestDepth = 0;
    let pv = [];

    for (;;) {
      const line = await this.readLine();
      if (line === null) throw new Error('stockfish: timeout during go');
      if (line.startsWith('info ') && line.includes(' pv ')) {
        const cp = / score cp (-?\d+)/.exec(line);
        const mt = / score mate (-?\d+)/.exec(line);
        const dp = / depth (\d+)/.exec(line);
        if (cp) scoreCp = parseInt(cp[1], 10);
        if (mt) mate = parseInt(mt[1], 10);
        if (dp) bestDepth = Math.max(bestDepth, parseInt(dp[1], 10));
        const pvIdx = line.indexOf(' pv ');
        if (pvIdx >= 0) pv = line.slice(pvIdx + 4).trim().split(/\s+/);
      }
      if (line.startsWith('bestmove')) {
        const parts = line.split(/\s+/);
        const bestmove = parts[1];
        if (bestmove === '(none)') {
          return { bestmove: null, scoreCp: null, mate: null, depth: bestDepth, pv: [] };
        }
        return { bestmove, scoreCp, mate, depth: bestDepth, pv };
      }
    }
  }

  async quit() {
    try {
      this.send('quit');
      await this.worker.terminate();
    } catch {
      /* ignore */
    }
  }
}
