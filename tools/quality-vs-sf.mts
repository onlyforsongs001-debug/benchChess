/**
 * Đo chất lượng nước đi của cả 3 bot TRÊN CÙNG BỘ VỊ TRÍ.
 *
 * Với mỗi vị trí:
 *   1. Stockfish (public/stockfish.js) đưa ra nước đi tốt nhất + điểm.
 *   2. Cả 3 bot lần lượt chọn nước đi trong đúng vị trí đó.
 *   3. Điểm sau khi bot đi được đánh giá lại bằng Stockfish -> cp loss.
 *
 * cp loss = điểm sau nước đi của bot - điểm nước đi tốt nhất (đều theo góc nhìn bên đi).
 * cp loss = 0  => nước đi tốt nhất
 * 20-50cp    => lỗi nhỏ
 * 50-100cp   => bất đắc kỳ
 * >100cp     => sai lầm (blunder)
 * >300cp     => thảm họa
 */
import { Chess } from 'chess.js';
import { DEFAULT_BOTS, executeBotScript, getDetailedLegalMoves, getChessStateInfo } from '../src/utils/rules.ts';
import { Stockfish } from './stockfish.mjs';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const argOf = (n: string, d: string) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const LIMIT = parseInt(argOf('--positions', '100'), 10);
const MOVETIME = parseInt(argOf('--sf-movetime', '600'), 10);
const MATE = 30000;

interface Pos { fen: string; tag: string }
const positions: Pos[] = [];

/* Lấy vị trí từ các ván đã đấu (nếu có), bổ sung thêm thế mở chuẩn */
const gamesFile = argOf('--games', '/tmp/chess-arena-games.json');
try {
  const games = JSON.parse(readFileSync(gamesFile, 'utf8'));
  const seen = new Set<string>();
  const pool: Pos[] = [];
  for (const g of games) {
    for (const m of g.moves) {
      if (seen.has(m.fen)) continue;
      seen.add(m.fen);
      pool.push({ fen: m.fen, tag: g.startName });
    }
  }
  // Lấy đều các thế mở khác nhau
  const byTag = new Map<string, Pos[]>();
  for (const p of pool) {
    const arr = byTag.get(p.tag) ?? [];
    arr.push(p);
    byTag.set(p.tag, arr);
  }
  const tags = [...byTag.keys()];
  let i = 0;
  while (positions.length < LIMIT && i < 500) {
    for (const t of tags) {
      const arr = byTag.get(t)!;
      const p = arr[i % arr.length];
      if (p && !positions.includes(p)) positions.push(p);
      if (positions.length >= LIMIT) break;
    }
    i++;
  }
} catch {
  positions.push({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', tag: 'chuẩn' });
}

console.log(`Đo trên ${positions.length} vị trí (mỗi bot cùng điều kiện, Stockfish movetime ${MOVETIME}ms)`);

const sf = new Stockfish();
await sf.uci();
await sf.isready();

const toCp = (r: { scoreCp: number | null; mate: number | null }) => {
  if (r.mate !== null && r.mate !== undefined) return r.mate > 0 ? MATE - r.mate * 100 : -MATE - r.mate * 100;
  return r.scoreCp ?? 0;
};

interface Stat {
  n: number; exact: number; lossSum: number; lossMax: number; lossMaxMove: string;
  blunder: number; inacc: number; good: number; best: number; mateMiss: number; mateFound: number;
  timeSum: number; timeMax: number;
  worst: { san: string; fen: string; loss: number; engine: string; bestMove: string }[];
}
const stats: Record<string, Stat> = {};
for (const b of DEFAULT_BOTS) {
  stats[b.id] = { n: 0, exact: 0, lossSum: 0, lossMax: 0, lossMaxMove: '', blunder: 0, inacc: 0, good: 0, best: 0, mateMiss: 0, mateFound: 0, timeSum: 0, timeMax: 0, worst: [] };
}

/* Bảng kết quả SF cho mỗi vị trí (dùng lại cho cả 3 bot) */
const sfCache = new Map<string, { bestmove: string; cp: number; mate: number | null }>();
let done = 0;
for (const p of positions) {
  let ref = sfCache.get(p.fen);
  if (!ref) {
    const r = await sf.analyse(p.fen, { movetime: MOVETIME });
    ref = { bestmove: r.bestmove ?? '', cp: toCp(r), mate: r.mate };
    sfCache.set(p.fen, ref);
  }

  for (const bot of DEFAULT_BOTS) {
    const st = stats[bot.id];
    const t0 = Date.now();
    const res = executeBotScript(bot.code, p.fen, 2000);
    const dt = Date.now() - t0;
    st.timeSum += dt;
    st.timeMax = Math.max(st.timeMax, dt);
    if (!res.success || !res.move) continue;

    // Điểm sau nước đi của bot
    let playedCp = ref.cp;
    const chess = new Chess(p.fen);
    try {
      const m = chess.move({ from: res.move.from, to: res.move.to, promotion: res.move.promotion as any });
      if (m) {
        const after = await sf.analyse(chess.fen(), { movetime: MOVETIME });
        playedCp = -toCp(after);
      }
    } catch {
      playedCp = ref.cp;
    }

    const loss = Math.max(0, playedCp - ref.cp);
    st.n++;
    st.lossSum += loss;
    if (loss > st.lossMax) { st.lossMax = loss; st.lossMaxMove = res.san ?? ''; }
    if (res.move.from + res.move.to === ref.bestmove.slice(0, 4)) { st.exact++; st.best++; }
    if (ref.mate !== null && ref.mate > 0) {
      st.mateFound++;
      if (loss > 0) st.mateMiss++;
    }
    if (loss >= 300) st.blunder++;
    else if (loss >= 100) st.inacc++;
    else if (loss >= 20) st.good++;
    st.worst.push({ san: res.san ?? '', fen: p.fen, loss, engine: bot.name, bestMove: ref.bestmove });
  }

  done++;
  if (done % 20 === 0) console.log(`  … ${done}/${positions.length}`);
}
await sf.quit();

console.log('\n================= CHẤT LƯỢNG NƯỚC ĐI (cùng vị trí, so với Stockfish) =================');
const nameOf = (id: string) => DEFAULT_BOTS.find(b => b.id === id)!.name;
for (const b of DEFAULT_BOTS) {
  const s = stats[b.id];
  if (!s.n) continue;
  const avg = s.lossSum / s.n;
  console.log(
    `${nameOf(b.id).padEnd(22)} n=${String(s.n).padStart(3)}  ` +
      `khớp nước tốt nhất ${String(Math.round((s.exact / s.n) * 100)).padStart(3)}%  |  ` +
      `cp loss TB ${avg.toFixed(1).padStart(6)}  median-ish  |  ` +
      `sai lầm ${String(s.blunder).padStart(2)}  bất đắc kỳ ${String(s.inacc).padStart(2)}  ` +
      `bỏ lỡ chiếu hết ${s.mateMiss}/${s.mateFound}  |  ` +
      `thời gian TB ${(s.timeSum / s.n).toFixed(0)}ms`
  );
  const worst = s.worst.sort((a, b) => b.loss - a.loss).slice(0, 4);
  for (const w of worst) {
    if (w.loss < 100) break;
    console.log(`      ↳ tệ nhất: ${w.san} (mất ${w.loss}cp) · SF chọn ${w.bestMove} · ${w.fen}`);
  }
}
