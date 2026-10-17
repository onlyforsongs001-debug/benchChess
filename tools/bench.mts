/**
 * Chess Arena benchmark harness.
 *
 *   Phase 1 — Tournament: every in-app bot plays every other bot head-to-head,
 *             from a set of opening / middlegame / endgame start positions and
 *             with both colour assignments (to cancel the first-move advantage).
 *
 *   Phase 2 — Move quality: every position is replayed against Stockfish
 *             (public/stockfish.js) to measure the centipawn loss of the move
 *             the bot actually played, and how often that move is the engine's
 *             top choice.
 *
 * Usage:
 *   node --experimental-strip-types tools/bench.mts [--games-per-pos 1] [--out FILE]
 */
import { Chess } from 'chess.js';
import { writeFileSync, readFileSync } from 'node:fs';
import { DEFAULT_BOTS, executeBotScript } from '../src/utils/rules.ts';
import type { ChessBot } from '../src/types/chess.ts';

const args = process.argv.slice(2);
const argOf = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = argOf('--out', '/tmp/chess-arena-bench.json');
const SF_MOVETIME = parseInt(argOf('--sf-movetime', '600'), 10);
const MAX_PLIES = 300;
/** Re-use a previous run's games and only redo the Stockfish quality pass. */
const REUSE = args.includes('--reuse-games') ? argOf('--games', '/tmp/chess-arena-games.json') : null;

/* ------------------------------------------------------------------ *
 * Start positions: opening lines + middlegames + endgames
 * ------------------------------------------------------------------ */
const START_POSITIONS: { name: string; fen: string }[] = [
  { name: 'Vị trí chuẩn', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  { name: 'Italy (2.Bc4 Nc6 3.Nf3)', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
  { name: 'Sicilian Najdorf', fen: 'r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P4/2N1PN2/PPQ1BPPP/R1B1K2R w KQkq - 0 6' },
  { name: 'French Defense', fen: 'rnbqkb1r/pppp1ppp/4pn2/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
  { name: "King's Indian", fen: 'rnbq1rk1/pp2ppbp/3p1n2/2p1p3/2P1P3/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 7' },
  { name: "Queen's Gambit", fen: 'rnbqkb1r/pp2pppp/3p4/2p5/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 4' },
  { name: 'Caro-Kann', fen: 'rnbqkb1r/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 4' },
  { name: 'Slav Defense', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4' },
  { name: 'Ruy Lopez (chiếu thuật)', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
  { name: 'Trung cuộc mở', fen: 'r1bq1rk1/pp2ppbp/2np1np1/2p5/2P1P3/2NP1N1P/PP2BPP1/R1BQ1RK1 w - - 0 9' },
  { name: 'Cua cuộc K+P', fen: '8/8/8/4k3/8/4P3/4K3/8 w - - 0 1' },
  { name: 'Cua cuộc Xe', fen: '8/8/8/8/8/4k3/4p3/4K3 w - - 0 1' },
];

type Side = 'w' | 'b';

interface GameResult {
  white: string;
  black: string;
  startName: string;
  startFen: string;
  result: 'w' | 'b' | 'draw';
  reason: string;
  plies: number;
  moves: { fen: string; san: string; uci: string; bot: string; ms: number }[];
  errors: string[];
}

/* ------------------------------------------------------------------ *
 * Game runner
 * ------------------------------------------------------------------ */
function playGame(startFen: string, whiteBot: ChessBot, blackBot: ChessBot): GameResult {
  const chess = new Chess(startFen);
  const moves: GameResult['moves'] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();
  const bump = (k: string) => seen.set(k, (seen.get(k) ?? 0) + 1);

  bump(chess.fen().split(' ').slice(0, 4).join(' '));

  let result: GameResult['result'] = 'draw';
  let reason = 'Đạt giới hạn nước đi';
  let plies = 0;

  while (plies < MAX_PLIES) {
    if (chess.isGameOver()) break;

    const bot = chess.turn() === 'w' ? whiteBot : blackBot;
    const fenBefore = chess.fen();
    const t0 = Date.now();
    const res = executeBotScript(bot.code, fenBefore, 2000);
    const ms = Date.now() - t0;

    let move = res.move;
    if (!res.success || !move) {
      errors.push(`[${bot.name}] ${res.error ?? 'no move'}`);
      // Fallback identical to the app: first capture, else first legal move.
      const legal = chess.moves({ verbose: true });
      if (legal.length === 0) break;
      const pick = legal.find(m => m.captured) ?? legal[0];
      move = { from: pick.from, to: pick.to, promotion: pick.promotion };
    }

    let applied;
    try {
      applied = chess.move({ from: move.from, to: move.to, promotion: move.promotion as any });
    } catch (err: any) {
      errors.push(`[${bot.name}] illegal move ${move.from}${move.to}: ${err.message}`);
      const legal = chess.moves({ verbose: true });
      if (legal.length === 0) break;
      const pick = legal.find(m => m.captured) ?? legal[0];
      applied = chess.move({ from: pick.from, to: pick.to, promotion: pick.promotion as any });
    }

    moves.push({ fen: fenBefore, san: applied.san, uci: `${applied.from}${applied.to}`, bot: bot.id, ms });
    plies++;

    const key = chess.fen().split(' ').slice(0, 4).join(' ');
    bump(key);
    if ((seen.get(key) ?? 0) >= 3) {
      result = 'draw';
      reason = 'Lặp thế 3 lần';
      break;
    }
  }

  if (result === 'draw' && reason === 'Đạt giới hạn nước đi') {
    if (chess.isCheckmate()) {
      result = chess.turn() === 'w' ? 'b' : 'w';
      reason = 'Chiếu hết';
    } else if (chess.isStalemate()) {
      reason = 'Hòa do hết nước đi';
    } else if (chess.isInsufficientMaterial()) {
      reason = 'Hòa do thiếu quân';
    } else if (chess.isThreefoldRepetition?.()) {
      reason = 'Lặp thế 3 lần';
    } else if (chess.isDraw()) {
      reason = 'Hòa (luật 50 nước)';
    }
  }

  return {
    white: whiteBot.id,
    black: blackBot.id,
    startName: '',
    startFen: startFen,
    result,
    reason,
    plies,
    moves,
    errors,
  };
}

/* ------------------------------------------------------------------ *
 * Phase 1 — tournament
 * ------------------------------------------------------------------ */
function tournament() {
  const bots = DEFAULT_BOTS;
  const results: GameResult[] = [];
  const t0 = Date.now();

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      for (const pos of START_POSITIONS) {
        for (const swap of [false, true]) {
          const w = swap ? bots[j] : bots[i];
          const b = swap ? bots[i] : bots[j];
          const g = playGame(pos.fen, w, b);
          g.startName = pos.name;
          results.push(g);
          const mins = ((Date.now() - t0) / 60000).toFixed(1);
          console.log(
            `[${mins}m] ${w.name} (Trắng) vs ${b.name} (Đen) · ${pos.name} → ` +
              `${g.result === 'w' ? w.name : g.result === 'b' ? b.name : 'Hòa'} (${g.reason}, ${g.plies} ply)` +
              (g.errors.length ? ` ⚠ ${g.errors.length} lỗi` : '')
          );
        }
      }
    }
  }
  return results;
}

/* ------------------------------------------------------------------ *
 * Phase 2 — move quality vs Stockfish
 * ------------------------------------------------------------------ */
async function qualityReport(games: GameResult[]) {
  const { Stockfish } = await import('./stockfish.mjs');
  let sf = new Stockfish();
  await sf.uci();
  await sf.isready();

  const MAX_PER_BOT = parseInt(argOf('--max-per-bot', '120'), 10);

  const pool: { bot: string; fen: string; uci: string; san: string }[] = [];
  const seenKey = new Set<string>();
  for (const g of games) {
    for (const m of g.moves) {
      const key = `${m.bot}|${m.fen}`;
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      pool.push({ bot: m.bot, fen: m.fen, uci: m.uci, san: m.san });
    }
  }

  // Evenly spread the sample over the game pool so every opening is represented.
  const sample: typeof pool = [];
  for (const bot of DEFAULT_BOTS) {
    const mine = pool.filter(p => p.bot === bot.id);
    if (mine.length === 0) continue;
    const step = Math.max(1, Math.floor(mine.length / MAX_PER_BOT));
    for (let i = 0; i < mine.length && sample.length < mine.length; i += step) {
      sample.push(mine[i]);
      if (mine.filter(x => sample.includes(x)).length >= MAX_PER_BOT) break;
    }
  }
  console.log(`  Chấm ${sample.length} nước đi (tối đa ${MAX_PER_BOT}/bot)`);

  const byBot: Record<
    string,
    {
      n: number;
      exact: number;
      cpLossSum: number;
      cpLossMax: number;
      blunders: number;
      inaccuracies: number;
      good: number;
      best: number;
      mateMissed: number;
      blunderList: { san: string; fen: string; loss: number }[];
    }
  > = {};

  const MATE = 30000;
  const toCp = (r: { scoreCp: number | null; mate: number | null }) => {
    if (r.mate !== null && r.mate !== undefined) return r.mate > 0 ? MATE - r.mate * 10 : -MATE - r.mate * 10;
    return r.scoreCp ?? 0;
  };

  let done = 0;
  for (const s of sample) {
    let before: any;
    try {
      before = await sf.analyse(s.fen, { movetime: SF_MOVETIME });
    } catch (err) {
      // The engine occasionally stalls – restart it and skip this position.
      console.log(`  ⚠ Stockfish treo tại ${s.fen} – khởi động lại`);
      await sf.quit().catch(() => {});
      sf = new Stockfish();
      await sf.uci();
      await sf.isready();
      continue;
    }
    const bestCp = toCp(before);

    // Apply the bot's move, then re-evaluate the resulting position.
    const chess = new Chess(s.fen);
    let afterFen: string | null = null;
    try {
      const m = chess.move({ from: s.uci.slice(0, 2), to: s.uci.slice(2, 4) } as any);
      if (m) afterFen = chess.fen();
    } catch {
      afterFen = null;
    }

    let playedCp = bestCp;
    if (afterFen) {
      try {
        const after = await sf.analyse(afterFen, { movetime: SF_MOVETIME });
        // `after` is from the opponent's point of view -> flip back to the mover's POV.
        playedCp = -toCp(after);
      } catch {
        playedCp = bestCp;
      }
    }

    const loss = Math.max(0, playedCp - bestCp);
    const isBestUci = before.bestmove && before.bestmove.slice(0, 4) === s.uci.slice(0, 4);

    const b = (byBot[s.bot] ??= {
      n: 0, exact: 0, cpLossSum: 0, cpLossMax: 0, blunders: 0, inaccuracies: 0, good: 0, best: 0,
      mateMissed: 0, blunderList: [],
    });
    b.n++;
    b.cpLossSum += loss;
    b.cpLossMax = Math.max(b.cpLossMax, loss);
    if (isBestUci) { b.exact++; b.best++; }
    if (loss >= 300) b.blunders++;
    else if (loss >= 100) b.inaccuracies++;
    else if (loss >= 20) b.good++;
    if (before.mate !== null && before.mate > 0 && loss > 0) b.mateMissed++;

    done++;
    if (done % 25 === 0) console.log(`  … đã chấm ${done}/${sample.length} nước đi`);
  }

  await sf.quit();
  return byBot;
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
function report(games: GameResult[]) {
  const bots = DEFAULT_BOTS;
  const nameOf = (id: string) => bots.find(b => b.id === id)?.name ?? id;

  // Overall score per bot
  const overall: Record<string, { w: number; d: number; l: number; pts: number; games: number }> = {};
  for (const b of bots) overall[b.id] = { w: 0, d: 0, l: 0, pts: 0, games: 0 };

  // Per pair
  const pairs: Record<string, { a: string; b: string; aw: number; ad: number; al: number; bw: number; bd: number; bl: number }> = {};

  for (const g of games) {
    const w = overall[g.white];
    const b = overall[g.black];
    w.games++; b.games++;
    const key = [g.white, g.black].sort().join('|');
    const p = (pairs[key] ??= {
      a: key.split('|')[0], b: key.split('|')[1], aw: 0, ad: 0, al: 0, bw: 0, bd: 0, bl: 0,
    });
    const winner = g.result === 'w' ? g.white : g.result === 'b' ? g.black : null;
    if (winner === null) {
      w.d++; w.pts += 0.5; b.d++; b.pts += 0.5;
      p.ad++; p.bd++;
    } else if (winner === p.a) {
      w.w++; w.pts += 1; b.l++;
      p.aw++; p.bl++;
    } else {
      b.w++; b.pts += 1; w.l++;
      p.bw++; p.al++;
    }
  }

  console.log('\n================= TỔNG KẾT GIẢI =================');
  const rows = bots.map(b => ({ b, s: overall[b.id] }));
  rows.sort((x, y) => y.s.pts - x.s.pts);
  for (const r of rows) {
    const pct = r.s.games ? (r.s.pts / r.s.games) * 100 : 0;
    console.log(
      `${r.b.name.padEnd(22)} thắng ${String(r.s.w).padStart(3)} | hòa ${String(r.s.d).padStart(3)} | thua ${String(r.s.l).padStart(3)}` +
        `  =>  ${pct.toFixed(1)}% điểm (${r.s.pts}/${r.s.games})`
    );
  }

  console.log('\n----------------- ĐỐI ĐẦU TỪNG CẶP -----------------');
  for (const key of Object.keys(pairs)) {
    const p = pairs[key];
    const a = nameOf(p.a);
    const b = nameOf(p.b);
    const games = p.aw + p.ad + p.al + p.bw + p.bd + p.bl;
    const aPts = p.aw + p.ad * 0.5;
    const bPts = p.bw + p.bd * 0.5;
    const elo = games ? -400 * Math.log10(1 / (aPts / games) - 1) : 0;
    console.log(
      `${a.padEnd(22)} ${String(p.aw).padStart(3)} - ${String(p.ad).padStart(2)} - ${String(p.al).padStart(3)}  ` +
        `${b.padEnd(22)}   (${aPts}/${games} vs ${bPts}/${games})  ⇒  chênh lệch Elo ~ ${elo >= 0 ? '+' : ''}${elo.toFixed(0)}`
    );
  }

  // Thống kê phong cách
  console.log('\n----------------- THỐNG KÊ VÁN ĐẤU -----------------');
  const byOpening: Record<string, Record<string, number>> = {};
  for (const g of games) {
    const row = (byOpening[g.startName] ??= {});
    const wName = nameOf(g.white), bName = nameOf(g.black);
    if (g.result === 'w') row[wName] = (row[wName] ?? 0) + 1;
    else if (g.result === 'b') row[bName] = (row[bName] ?? 0) + 1;
    else { row['Hòa'] = (row['Hòa'] ?? 0) + 1; }
  }
  for (const [k, v] of Object.entries(byOpening)) {
    console.log(`  ${k.padEnd(24)} ${Object.entries(v).map(([n, c]) => `${n}:${c}`).join('  ')}`);
  }

  const errs = games.flatMap(g => g.errors);
  console.log(`\n  Lỗi bot: ${errs.length}`, errs.length ? `\n    ${errs.slice(0, 10).join('\n    ')}` : '');
  const avgPly = games.reduce((s, g) => s + g.plies, 0) / games.length;
  console.log(`  Trung bình ${avgPly.toFixed(0)} ply/ván · tổng ${games.length} ván`);
  return { overall, pairs };
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */
const t0 = Date.now();
let games: GameResult[];
if (REUSE) {
  console.log(`=== PHASE 1: TÁI SỬ DỤNG ${REUSE} ===`);
  games = JSON.parse(readFileSync(REUSE, 'utf8'));
} else {
  console.log('=== PHASE 1: TOURNAMENT ===');
  games = tournament();
  // Persist immediately so a crash in phase 2 never loses the games.
  writeFileSync('/tmp/chess-arena-games.json', JSON.stringify(games, null, 2));
}
console.log('\n=== PHASE 2: CHẤM CHẤT LƯỢNG NƯỚC ĐI (STOCKFISH) ===');
const quality = await qualityReport(games);

console.log('\n============== CHẤT LƯỢNG NƯỚC ĐI (so với Stockfish) ==============');
for (const b of DEFAULT_BOTS) {
  const q = quality[b.id];
  if (!q) continue;
  console.log(
    `${b.name.padEnd(22)} n=${String(q.n).padStart(4)}  khớp nước tốt nhất ${String(Math.round((q.exact / q.n) * 100)).padStart(3)}%  ` +
      ` (cp loss TB ${(q.cpLossSum / q.n).toFixed(1)}, max ${q.cpLossMax})  ` +
      `sai lầm ${q.blunders}  bất đắc kỳ ${q.inaccuracies}  bỏ lỡ chiếu hết ${q.mateMissed}`
  );
  if (q.blunderList.length) {
    for (const bl of q.blunderList.slice(0, 5)) console.log(`     ↳ ${bl.san} (${bl.fen}) mất ${bl.loss}cp`);
  }
}

const summary = report(games);
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      positions: START_POSITIONS,
      quality,
      summary,
      games: games.map(g => ({ ...g, moves: g.moves })),
    },
    null,
    2
  )
);
console.log(`\nĐã lưu kết quả: ${OUT}`);
