import React from 'react';
import { X, Trophy, Swords, Target, Timer, BrainCircuit, Info } from 'lucide-react';

/**
 * Bảng xếp hạng & kết quả benchmark đo thật.
 *
 * Số liệu được sinh bằng `tools/bench.mts`, `tools/quality-vs-sf.mts` và
 * `tools/tactics.mts` (72 ván đấu thật + đối chiếu Stockfish).
 */
interface BotRow {
  id: string;
  name: string;
  color: string;
  wins: number;
  draws: number;
  losses: number;
  points: string;
  winRate: number;
  bestMoveMatch: number;
  tacticSolve: number;
  avgThinkMs: number;
  eloDiffVsGemini: number;
}

const ROWS: BotRow[] = [
  {
    id: 'claude-sonnet-55',
    name: 'Claude Sonnet 5.5',
    color: 'from-amber-500 to-orange-700',
    wins: 38, draws: 10, losses: 0,
    points: '43/48', winRate: 89.6,
    bestMoveMatch: 42, tacticSolve: 37,
    avgThinkMs: 590, eloDiffVsGemini: 417,
  },
  {
    id: 'deepseek-v41-flash',
    name: 'DeepSeek V4.1 Flash',
    color: 'from-purple-600 to-indigo-800',
    wins: 18, draws: 12, losses: 18,
    points: '24/48', winRate: 50.0,
    bestMoveMatch: 24, tacticSolve: 27,
    avgThinkMs: 249, eloDiffVsGemini: 338,
  },
  {
    id: 'gemini-38-flash',
    name: 'Gemini 3.8 Flash',
    color: 'from-blue-600 to-indigo-800',
    wins: 0, draws: 10, losses: 38,
    points: '5/48', winRate: 10.4,
    bestMoveMatch: 26, tacticSolve: 7,
    avgThinkMs: 5, eloDiffVsGemini: 0,
  },
];

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="benchmark-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 id="benchmark-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Bảng Xếp Hạng & Benchmark
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ĐO THẬT
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                72 ván đấu thật giữa các bot • đối chiếu nước đi bằng Stockfish
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Bảng xếp hạng */}
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 sm:px-4 py-2.5 bg-slate-950/70 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <span>Bot</span>
              <span className="text-right">T-D-B</span>
              <span className="text-right">Tỷ lệ thắng</span>
              <span className="text-right hidden sm:block">Giải chiến thuật</span>
              <span className="text-right hidden sm:block">Thời gian</span>
            </div>
            {ROWS.map((r, i) => (
              <div
                key={r.id}
                className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 sm:px-4 py-3 items-center ${
                  i % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-950/20'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${r.color} flex items-center justify-center text-[11px] font-black text-white shrink-0`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-100 truncate">{r.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{r.points} điểm</div>
                  </div>
                </div>
                <span className="text-right text-xs font-mono text-slate-300">
                  {r.wins}-{r.draws}-{r.losses}
                </span>
                <span className="text-right">
                  <span
                    className={`text-sm font-black font-mono ${
                      r.winRate >= 80 ? 'text-emerald-400' : r.winRate >= 45 ? 'text-amber-400' : 'text-rose-400'
                    }`}
                  >
                    {r.winRate.toFixed(1)}%
                  </span>
                </span>
                <span className="text-right text-xs font-mono text-slate-400 hidden sm:block">
                  {r.tacticSolve}%
                </span>
                <span className="text-right text-xs font-mono text-slate-400 hidden sm:block">
                  {r.avgThinkMs}ms
                </span>
              </div>
            ))}
          </div>

          {/* Đối đầu */}
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-100 mb-2.5">
              <Swords className="w-4 h-4 text-indigo-400" /> Đối đầu trực tiếp (đã đổi cả hai màu)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { a: 'Claude', b: 'Gemini', r: '20T – 4H – 0B', pct: '91,7% : 8,3%', elo: '+417' },
                { a: 'Claude', b: 'DeepSeek', r: '18T – 6H – 0B', pct: '87,5% : 12,5%', elo: '+338' },
                { a: 'DeepSeek', b: 'Gemini', r: '18T – 6H – 0B', pct: '87,5% : 12,5%', elo: '+338' },
              ].map(x => (
                <div key={x.a + x.b} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs font-bold text-slate-200">
                    {x.a} <span className="text-slate-600">vs</span> {x.b}
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-100 mt-1">{x.r}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{x.pct}</div>
                  <div className="text-[11px] text-emerald-400 font-mono mt-1">Elo {x.elo}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chỉ số chất lượng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Target className="w-3.5 h-3.5 text-emerald-400" /> Khớp nước tốt nhất
              </div>
              <div className="text-[11px] text-slate-500 mt-1 mb-2">so với Stockfish trên cùng 90 vị trí</div>
              {ROWS.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-[11px] mb-1">
                  <span className="text-slate-400 w-28 truncate">{r.name.split(' ')[0]}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${r.bestMoveMatch}%` }} />
                  </div>
                  <span className="font-mono text-slate-300 w-9 text-right">{r.bestMoveMatch}%</span>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <BrainCircuit className="w-3.5 h-3.5 text-amber-400" /> Giải vị trí chiến thuật
              </div>
              <div className="text-[11px] text-slate-500 mt-1 mb-2">30 vị trí có nước thắng ≥ 2 quân</div>
              {ROWS.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-[11px] mb-1">
                  <span className="text-slate-400 w-28 truncate">{r.name.split(' ')[0]}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${r.tacticSolve}%` }} />
                  </div>
                  <span className="font-mono text-slate-300 w-9 text-right">{r.tacticSolve}%</span>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Timer className="w-3.5 h-3.5 text-indigo-400" /> Thời gian mỗi nước đi
              </div>
              <div className="text-[11px] text-slate-500 mt-1 mb-2">trung bình khi đấu</div>
              {ROWS.map(r => (
                <div key={r.id} className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-400">{r.name.split(' ')[0]}</span>
                  <span className="font-mono text-slate-300">{r.avgThinkMs}ms</span>
                </div>
              ))}
              <div className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Gemini là heuristic 1 ply nên gần như tức thì; Claude chạy alpha-beta
                0x88 có bảng transposition.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/25 text-[11px] text-slate-300 leading-relaxed">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              Phương pháp: 12 thế mở (khai cuộc, trung cuộc, cuộc cuộc) × 3 cặp bot × 2 màu
              = <strong className="text-white">72 ván</strong>, luật 3 lần lặp thế, giới hạn 300 ply.
              Nước đi được chấm bằng Stockfish (mỗi vị trí 600ms). Chạy lại bằng
              <code className="mx-1 px-1 py-0.5 rounded bg-slate-950 text-emerald-300">node --experimental-strip-types tools/bench.mts</code>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
