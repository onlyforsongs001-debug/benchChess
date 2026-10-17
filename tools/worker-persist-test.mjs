/** Chứng minh: trong worker, engine của bot SỐNG SUỐT các nước đi (TT/killer/history được tái sử dụng). */
import { readFileSync } from 'node:fs';
import { DEFAULT_BOTS, executeBotScript } from '../src/utils/rules.ts';

const received = [];
globalThis.self = globalThis;
globalThis.postMessage = (m) => received.push(m);
await import('../src/workers/bot.worker.ts');
const send = (d) => globalThis.onmessage({ data: d });

const claude = DEFAULT_BOTS.find(b => b.id === 'claude-sonnet-55');
// Gắn mã định danh cho mỗi engine được tạo ra + bọc lại getMove để ghi lại id
const instrumented = claude.code
  .replace('return { think: think };', 'return { think: think, __id: (globalThis.__seq = (globalThis.__seq||0)+1) };')
  .replace('if (!engine) engine = getMove._engine = createEngine();', 'if (!engine) { engine = getMove._engine = createEngine(); globalThis.__ids = (globalThis.__ids||[]); globalThis.__ids.push(getMove._engine.__id); }');

send({ type: 'init', code: instrumented });
console.log('init ->', JSON.stringify(received.pop()));

const fen = 'r1bq1rk1/pp2ppbp/2np1np1/2p5/2P1P3/2NP1N1P/PP2BPP1/R1BQ1RK1 w - - 0 9';
for (let i = 0; i < 3; i++) {
  send({ type: 'move', fen, legalMoves: [{ from: 'c1', to: 'g5', san: 'Bg5' }, { from: 'c1', to: 'e3', san: 'Be3' }], chessState: {} });
  const r = received.pop();
  console.log(`  lượt ${i + 1}:`, r.type, r.type === 'move-error' ? r.message : 'OK');
}
console.log('\nID engine đã tạo trong worker:', JSON.stringify(globalThis.__ids));
console.log(globalThis.__ids.length === 1
  ? '=> 1 engine duy nhất cho cả 3 nước đi: bảng transposition/killer/history ĐƯỢC TÁI SỬ DỤNG ✅'
  : '=> VẪN TẠO LẠI ENGINE ❌');
