/**
 * Bộ test chiến thuật: lấy các vị trí QUAN TRỌNG ngay trong các ván đã đấu
 * (nơi Stockfish thấy nước đi thắng chắc: chiếu hết hoặc thắng quân),
 * rồi hỏi cả 3 bot xem có tìm ra nước đi đó không.
 *
 * Cách đo: sau khi bot đi, Stockfish đánh giá lại thế cứu. Nếu điểm sau nước đi
 * của bot không kém hơn nước đi tốt nhất quá 30cp => bot đã "giải" được vị trí.
 */
import { Chess } from 'chess.js';
import { DEFAULT_BOTS, executeBotScript } from '../src/utils/rules.ts';
import { Stockfish } from './stockfish.mjs';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const argOf = (n: string, d: string) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const WANT = parseInt(argOf('--critical', '30'), 10);
const SCAN_LIMIT = parseInt(argOf('--scan', '220'), 10);
const MOVETIME = parseInt(argOf('--sf-movetime', '500'), 10);
const TOLERANCE = 30;
const MATE = 30000;

const games = JSON.parse(readFileSync(argOf('--games', '/tmp/chess-arena-games.json'), 'utf8'));

// Gom vị trí, ưu tiên trải đều qua các ván và các giai đoạn
const seen = new Set<string>();
const pool: string[] = [];
for (const g of games) {
  for (const m of g.moves) {
    if (seen.has(m.fen)) continue;
    seen.add(m.fen);
    pool.push(m.fen);
  }
}
const step = Math.max(1, Math.floor(pool.length / SCAN_LIMIT));
const candidates = pool.filter((_, i) => i % step === 0).slice(0, SCAN_LIMIT);

const sf = new Stockfish();
await sf.uci();
await sf.isready();

const toCp = (r: { scoreCp: number | null; mate: number | null }) =>
  r.mate !== null && r.mate !== undefined ? (r.mate > 0 ? MATE - r.mate * 100 : -MATE - r.mate * 100) : r.scoreCp ?? 0;

console.log(`Quét ${candidates.length} vị trí để tìm vị trí chiến thuật (Stockfish movetime ${MOVETIME}ms)...`);

interface Critical {
  fen: string;
  best: string;
  bestCp: number;
  mate: number | null;
  gain: number;
  kind: string;
}
const critical: Critical[] = [];

for (const fen of candidates) {
  if (critical.length >= WANT) break;
  const r = await sf.analyse(fen, { movetime: MOVETIME });
  if (!r.bestmove) continue;
  const cp = toCp(r);
  const gain = Math.abs(cp);
  const isMate = r.mate !== null && r.mate > 0;
  if (!isMate && gain < 200) continue; // không phải nước đi quyết định
  critical.push({
    fen,
    best: r.bestmove,
    bestCp: cp,
    mate: r.mate,
    gain,
    kind: isMate ? `chiếu hết ${r.mate}` : `thắng ${(gain / 100).toFixed(1)} quân`,
  });
}
console.log(`Tìm được ${critical.length} vị trí chiến thuật.`);

const solved: Record<string, { solved: number; tried: number; missList: string[]; timeSum: number }> = {};
for (const b of DEFAULT_BOTS) solved[b.id] = { solved: 0, tried: 0, missList: [], timeSum: 0 };

for (const c of critical) {
  for (const bot of DEFAULT_BOTS) {
    const t0 = Date.now();
    const res = executeBotScript(bot.code, c.fen, 2000);
    const dt = Date.now() - t0;
    const st = solved[bot.id];
    st.timeSum += dt;
    st.tried++;
    if (!res.success || !res.move) {
      st.missList.push(`${c.kind}: bot lỗi (${res.error?.slice(0, 40)})`);
      continue;
    }
    // Đánh giá lại sau nước đi của bot
    let afterCp = c.bestCp;
    const chess = new Chess(c.fen);
    try {
      const m = chess.move({ from: res.move.from, to: res.move.to, promotion: res.move.promotion as any });
      if (m) {
        const after = await sf.analyse(chess.fen(), { movetime: MOVETIME });
        afterCp = -toCp(after);
      }
    } catch {
      afterCp = -99999;
    }
    if (afterCp >= c.bestCp - TOLERANCE) st.solved++;
    else st.missList.push(`${c.kind} tại ${c.fen} → bot đi ${res.san} (còn ${((c.bestCp - afterCp) / 100).toFixed(1)} quân)`);
  }
}

console.log('\n================= TỈ LỆ GIẢI VỊ TRÍ CHIẾN THUẬT =================');
for (const b of DEFAULT_BOTS) {
  const s = solved[b.id];
  console.log(
    `${b.name.padEnd(22)} giải ${String(s.solved).padStart(2)}/${s.tried}  (${String(Math.round((s.solved / s.tried) * 100)).padStart(3)}%)  ` +
      `TB ${(s.timeSum / s.tried).toFixed(0)}ms`
  );
  for (const m of s.missList.slice(0, 6)) console.log(`      ↳ bỏ lỡ ${m}`);
  if (s.missList.length > 6) console.log(`      ↳ … và ${s.missList.length - 6} lần bỏ lỡ khác`);
}

console.log('\n================= CHIẾU HẾT: BOT CÓ TÌM THẤY KHÔNG? =================');
for (const c of critical.filter(c => c.mate !== null && c.mate > 0)) {
  const line = DEFAULT_BOTS.map(b => {
    const res = executeBotScript(b.code, c.fen, 2000);
    return `${b.name.split(' ')[0]}:${res.san ?? 'x'}`;
  }).join('  ');
  console.log(`  mate in ${c.mate} @ ${c.fen.padEnd(50)} ${line}`);
}
await sf.quit();
