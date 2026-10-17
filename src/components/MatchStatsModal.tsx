import React from 'react';
import { Trophy, RotateCcw, ArrowLeftRight, Eye, Sparkles } from 'lucide-react';
import type { ChessBot, GameStatus } from '../types/chess';

interface MatchStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: GameStatus;
  winner: 'w' | 'b' | 'draw' | null;
  whiteBot?: ChessBot | null;
  blackBot?: ChessBot | null;
  isWhiteHuman: boolean;
  isBlackHuman: boolean;
  fullMoves: number;
  seriesScore: { whiteWins: number; blackWins: number; draws: number };
  onRematch: () => void;
  onSwapSides: () => void;
}

export const MatchStatsModal: React.FC<MatchStatsModalProps> = ({
  isOpen,
  onClose,
  status,
  winner,
  whiteBot,
  blackBot,
  isWhiteHuman,
  isBlackHuman,
  fullMoves,
  seriesScore,
  onRematch,
  onSwapSides,
}) => {
  if (!isOpen) return null;

  const isWhiteWin = winner === 'w';
  const isBlackWin = winner === 'b';
  const isDraw = winner === 'draw' || status === 'draw' || status === 'stalemate';

  const winnerName = isWhiteWin
    ? isWhiteHuman ? 'Người chơi (Trắng)' : whiteBot?.name || 'Bot Trắng'
    : isBlackWin
    ? isBlackHuman ? 'Người chơi (Đen)' : blackBot?.name || 'Bot Đen'
    : 'Hòa cờ';

  const winnerModel = isWhiteWin
    ? isWhiteHuman ? 'Bạn' : whiteBot?.modelName
    : isBlackWin
    ? isBlackHuman ? 'Bạn' : blackBot?.modelName
    : 'Cân tài cân sức';

  const statusTitle = isDraw
    ? status === 'stalemate'
      ? 'Hòa do hết nước đi hợp lệ (Stalemate)!'
      : 'Ván cờ kết thúc Hòa!'
    : `Chiếu Hết (Checkmate)! ${winnerName} Chiến Thắng!`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-stats-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-center text-slate-100 flex flex-col items-center">
        {/* Trophy / Result Icon */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-xl ${
            isDraw
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}
        >
          {isDraw ? (
            <Sparkles className="w-8 h-8" />
          ) : (
            <Trophy className="w-8 h-8 animate-bounce" />
          )}
        </div>

        <h3 id="match-stats-title" className="text-xl font-extrabold text-white mb-1">
          {statusTitle}
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          {isDraw
            ? 'Cả hai đấu thủ đều thi đấu xuất sắc'
            : `Mô hình AI: ${winnerModel} giành chiến thắng thuyết phục`}
        </p>

        {/* Head-to-Head Series Score Card */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 mb-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Tỉ Số Đối Đầu (Head-to-Head Series)
          </span>

          <div className="flex items-center justify-between">
            <div className="flex-1 text-left">
              <div className="text-xs font-bold text-slate-200 truncate">
                {isWhiteHuman ? 'Bạn (Trắng)' : whiteBot?.name}
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                {seriesScore.whiteWins}
              </div>
            </div>

            <div className="px-3 text-xs font-semibold text-slate-500">
              <span className="text-slate-400 font-bold">{seriesScore.draws}</span> hòa
            </div>

            <div className="flex-1 text-right">
              <div className="text-xs font-bold text-slate-200 truncate">
                {isBlackHuman ? 'Bạn (Đen)' : blackBot?.name}
              </div>
              <div className="text-2xl font-black text-indigo-400 font-mono mt-0.5">
                {seriesScore.blackWins}
              </div>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-slate-500">
            Tổng cộng: {fullMoves} nước đi
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={onRematch}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Đấu Ván Mới (Rematch)</span>
          </button>

          <button
            type="button"
            onClick={onSwapSides}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Đổi Bên Cầm Quân (Trắng ⇄ Đen)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Xem lại thế cờ trên bàn</span>
          </button>
        </div>
      </div>
    </div>
  );
};
