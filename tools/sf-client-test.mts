/**
 * Kiểm thử luồng UCI của StockfishClient (chạy ngoài trình duyệt).
 *
 * Dùng đúng file engine public/stockfish.js, chạy trong worker Node, nối vào
 * client qua workerFactory để kiểm tra: uci → isready → position/go → parse info.
 */
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StockfishClient, evalToCp, moveQualityLabel, type WorkerLike } from '../src/utils/stockfishClient.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeWorker(): WorkerLike {
  const w = new Worker(path.resolve(__dirname, 'sf-worker.mjs'));
  const shim: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: (m: string) => w.postMessage(m),
    terminate: () => {
      void w.terminate();
    },
  };
  w.on('message', (data) => shim.onmessage?.({ data }));
  w.on('error', (err) => shim.onerror?.({ message: err.message }));
  return shim;
}

const client = new StockfishClient(makeWorker);

console.log('=== 1. Khởi động engine (uci + isready) ===');
const t0 = Date.now();
await client.ready();
console.log(`  engine sẵn sàng sau ${Date.now() - t0}ms`);

console.log('\n=== 2. Phân tích thế mở đầu ===');
const start = await client.analyse('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 800);
console.log('  bestmove:', start.bestmove, '| depth:', start.depth, '| cp:', start.scoreCp, '| pv:', start.pv.join(' '));

console.log('\n=== 3. Phân tích thế trung cuộc (có nước đi tốt nhất rõ ràng) ===');
const mid = await client.analyse('r1bq1rk1/pp2ppbp/2np1np1/2p5/2P1P3/2NP1N1P/PP2BPP1/R1BQ1RK1 w - - 0 9', 900);
console.log('  bestmove:', mid.bestmove, '| depth:', mid.depth, '| cp:', mid.scoreCp, '| mate:', mid.mate);
console.log('  pv:', mid.pv.join(' '));
console.log('  nps:', mid.nps, '| nodes:', mid.nodes);

console.log('\n=== 4. Yêu cầu mới phải ngắt yêu cầu đang chạy ===');
const t1 = Date.now();
const [a, b] = await Promise.all([
  client.analyse('8/8/8/4k3/8/4P3/4K3/8 w - - 0 1', 3000),
  client.analyse('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 400),
]);
console.log(`  2 yêu cầu song song xong sau ${Date.now() - t1}ms (yêu cầu 2 phải được ưu tiên)`);
console.log('  kết quả A:', a.bestmove, 'depth', a.depth, '| kết quả B:', b.bestmove, 'depth', b.depth);

console.log('\n=== 5. Hàm chuyển điểm & nhãn chất lượng ===');
console.log('  evalToCp({scoreCp: 125}) =', evalToCp({ scoreCp: 125, mate: null }));
console.log('  evalToCp({mate: 3}) =', evalToCp({ scoreCp: null, mate: 3 }));
for (const loss of [0, 30, 80, 150, 500]) {
  const q = moveQualityLabel(loss);
  console.log(`  mất ${String(loss).padStart(3)}cp -> ${q.label} (${q.tone})`);
}

client.dispose();
console.log('\nHoàn tất ✅');
