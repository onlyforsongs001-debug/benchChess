/** Kiểm tra logic chấm nước đi (cp loss) của hook useStockfish. */
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { StockfishClient, evalToCp, moveQualityLabel, type WorkerLike } from '../src/utils/stockfishClient.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function makeWorker(): WorkerLike {
  const w = new Worker(path.resolve(__dirname, 'sf-worker.mjs'));
  const shim: WorkerLike = { onmessage: null, onerror: null,
    postMessage: (m: string) => w.postMessage(m), terminate: () => { void w.terminate(); } };
  w.on('message', (data) => shim.onmessage?.({ data }));
  return shim;
}

const client = new StockfishClient(makeWorker);
const cache = new Map<string, any>();

// 1. Phân tích thế trước nước đi (bên đang đi = người chơi)
const beforeFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const before = await client.analyse(beforeFen, 700);
cache.set(beforeFen, before);
console.log('Trước nước đi: cp(bên đi) =', before.scoreCp, '| nước tốt nhất:', before.bestmove);

// 2. Người chơi đi một nước KHÁC nước tốt nhất (vd: 1.f4 thay vì 1.e4)
const chess = new Chess(beforeFen);
const move = chess.move('f4');
const afterFen = chess.fen();
const after = await client.analyse(afterFen, 700);
cache.set(afterFen, after);
console.log('Sau nước đi f4: cp(bên đi) =', after.scoreCp, '| nước tốt nhất tiếp theo:', after.bestmove);

// 3. Tính cp loss đúng như hook
const beforeCp = evalToCp(cache.get(beforeFen));  // góc nhìn người đi
const afterCpMover = -evalToCp(cache.get(afterFen)); // đổi góc nhìn về người đi
const loss = Math.max(0, beforeCp - afterCpMover);
const q = moveQualityLabel(loss);
console.log(`\nNước đi "${move.san}": mất ${(loss/100).toFixed(2)} quân => ${q.label} (${q.tone})`);
console.log('(Trước: ' + (beforeCp/100).toFixed(2) + ' → Sau: ' + (afterCpMover/100).toFixed(2) + ')');
client.dispose();
