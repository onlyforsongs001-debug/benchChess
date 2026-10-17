import React, { useMemo } from 'react';
import { Chess } from 'chess.js';
import { Cpu, ChevronDown, ChevronUp, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { evalToCp } from '../utils/stockfishClient';
import type { LastMoveReview, StockfishStatus } from '../hooks/useStockfish';
import type { StockfishEval } from '../utils/stockfishClient';

interface StockfishPanelProps {
  fen: string | null;
  evalInfo: StockfishEval | null;
  status: StockfishStatus;
  lastMove: LastMoveReview | null;
  enabled: boolean;
  onToggle: () => void;
  /** 'w' | 'b' = cố định theo phe người chơi, 'turn' = theo bên đang đi */
  perspective: 'w' | 'b' | 'turn';
  forced?: boolean;
}

/** Chuyển dãy nước đi UCI của Stockfish sang SAN cho dễ đọc. */
function pvToSan(fen: string, pv: string[]): string[] {
  if (!fen || pv.length === 0) return [];
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, 10)) {
    if (uci.length < 4) break;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    try {
      const m = chess.move({ from, to, promotion: promotion as any });
      if (!m) break;
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out;
}

const TONE_CLASS: Record<LastMoveReview['tone'], string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  lime: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  orange: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export const StockfishPanel: React.FC<StockfishPanelProps> = ({
  fen,
  evalInfo,
  status,
  lastMove,
  enabled,
  onToggle,
  perspective,
  forced = false,
}) => {
  const sanLine = useMemo(
    () => (fen && evalInfo ? pvToSan(fen, evalInfo.pv) : []),
    [fen, evalInfo]
  );

  // Điểm theo góc nhìn hiển thị.
  // evalInfo luôn theo góc nhìn BÊN ĐANG ĐI trong thế cờ hiện tại.
  const turn = fen ? fen.split(' ')[1] : 'w';
  let scoreCp = 0;
  let isMate = false;
  let mateIn: number | null = null;
  let fromWhite = 0;
  if (evalInfo) {
    const raw = evalToCp(evalInfo);
    isMate = evalInfo.mate !== null;
    mateIn = evalInfo.mate;
    fromWhite = turn === 'w' ? raw : -raw; // luôn quy về góc nhìn quân Trắng
    scoreCp = perspective === 'w' ? fromWhite : perspective === 'b' ? -fromWhite : raw;
  }

  // % diện tích dành cho quân Trắng (luôn tính theo góc nhìn Trắng)
  const pctWhite = Math.max(4, Math.min(96, 50 + (2 / (1 + Math.exp(-0.4 * fromWhite)) - 1) * 50));
  // Quân ở đáy thanh là phe đang xem
  const bottomIsWhite =
    perspective === 'b' ? false : perspective === 'turn' ? turn === 'w' : true;
  const displayWhite = bottomIsWhite ? pctWhite : 100 - pctWhite;

  const scoreText = isMate
    ? `${mateIn! > 0 ? 'M' : '-M'}${Math.abs(mateIn!)}`
    : `${scoreCp > 0 ? '+' : ''}${(scoreCp / 100).toFixed(2)}`;

  const scoreTone =
    isMate || scoreCp > 100
      ? 'text-emerald-400'
      : scoreCp < -100
        ? 'text-rose-400'
        : 'text-slate-200';

  const perspectiveLabel =
    perspective === 'w' ? 'theo phe Trắng' : perspective === 'b' ? 'theo phe Đen' : 'theo bên đang đi';

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span>Stockfish</span>
          {status === 'ready' && evalInfo && (
            <span className="text-[10px] font-mono text-slate-500">
              depth {evalInfo.depth}
              {evalInfo.nps > 0 ? ` · ${(evalInfo.nps / 1000).toFixed(0)}k nps` : ''}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          disabled={forced}
          title={forced ? 'Luôn bật khi đánh vs AI' : 'Bật/tắt đánh giá Stockfish'}
          aria-pressed={enabled}
          className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
            enabled ? 'bg-cyan-600' : 'bg-slate-700'
          } ${forced ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {!enabled ? (
        <div className="px-3.5 py-6 text-center text-xs text-slate-500">
          <AlertTriangle className="w-4 h-4 mx-auto mb-1.5 text-slate-600" />
          Đánh giá Stockfish đang tắt
        </div>
      ) : status === 'loading' && !evalInfo ? (
        <div className="px-3.5 py-6 text-center text-xs text-slate-400">
          <Loader2 className="w-4 h-4 mx-auto mb-1.5 animate-spin text-cyan-400" />
          Đang tải & phân tích...
        </div>
      ) : (
        <div className="p-3.5 space-y-3">
          {/* Điểm số + thanh đánh giá */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black font-mono ${scoreTone}`}>{scoreText}</span>
                <span className="text-[10px] text-slate-500">{perspectiveLabel}</span>
              </div>

              <div className="mt-2 h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-slate-200 transition-all duration-500 ease-out"
                  style={{ width: `${displayWhite}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>Trắng</span>
                <span>Đen</span>
              </div>
            </div>
          </div>

          {/* Nước đi tốt nhất */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1">
              <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
              Nước đi tốt nhất
            </div>
            {sanLine.length > 0 ? (
              <div className="font-mono text-[11px] text-slate-200 leading-relaxed bg-slate-950/70 border border-slate-800/70 rounded-lg px-2.5 py-2">
                {sanLine.map((san, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-slate-600"> {i % 2 === 0 ? '.' : '…'} </span>}
                    <span className={i === 0 ? 'text-cyan-300 font-bold' : 'text-slate-300'}>{san}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">—</div>
            )}
          </div>

          {/* Đánh giá nước đi vừa rồi */}
          {lastMove && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-[11px] text-slate-400 truncate">
                  Nước <span className="font-mono font-bold text-slate-200">{lastMove.san}</span>
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${TONE_CLASS[lastMove.tone]}`}
              >
                {lastMove.label} {lastMove.loss > 0 ? `−${(lastMove.loss / 100).toFixed(2)}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
