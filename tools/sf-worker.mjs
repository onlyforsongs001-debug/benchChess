/**
 * Node worker wrapper for the classic asm.js Stockfish build in public/stockfish.js.
 *
 * The build expects a browser-ish worker environment:
 *   - global `postMessage(str)`  -> sends UCI output back to the parent thread
 *   - global `onmessage(evt)`    -> receives UCI commands ({ data: 'uci' })
 *
 * The file assigns its own global `onmessage` handler during evaluation, so we
 * grab a reference to it after loading and forward every parent message to it.
 */
import { parentPort } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.resolve(__dirname, '..', 'public', 'stockfish.js');

// Bridge engine output -> parent thread
globalThis.postMessage = (msg) => {
  parentPort.postMessage(msg);
};

// The Emscripten build references __dirname/__filename (Node path support).
globalThis.__dirname = path.dirname(enginePath);
globalThis.__filename = enginePath;

// ...and `require` (Emscripten node environment detection).
globalThis.require = createRequire(import.meta.url);

// Load the engine (it defines globalThis.onmessage itself)
const code = readFileSync(enginePath, 'utf8');
// eslint-disable-next-line no-new-func
(0, eval)(code);

const engineOnMessage = globalThis.onmessage;
if (typeof engineOnMessage !== 'function') {
  throw new Error('stockfish.js did not install a global onmessage handler');
}

parentPort.on('message', (data) => {
  try {
    engineOnMessage({ data: String(data) });
  } catch (err) {
    parentPort.postMessage(`__error__ ${err && err.message}`);
  }
});

parentPort.postMessage('__ready__');
