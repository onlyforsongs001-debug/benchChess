import React from 'react';
import { Bot, User, BrainCircuit, Zap, ShieldAlert } from 'lucide-react';
import { ChessPiece } from './ChessPieces';
import type { ChessBot } from '../types/chess';

interface PlayerCardProps {
  color: 'w' | 'b';
  isHuman: boolean;
  bot?: ChessBot | null;
  availableBots?: ChessBot[];
  onSelectBot?: (botId: string) => void;
  isTurn: boolean;
  isThinking: boolean;
  timeMs: number;
  lastThinkingMs?: number;
  capturedPieces: string[];
  materialAdvantage: number;
  isCheck?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  color,
  isHuman,
  bot,
  availableBots,
  onSelectBot,
  isTurn,
  isThinking,
  timeMs,
  lastThinkingMs,
  capturedPieces,
  materialAdvantage,
  isCheck = false,
}) => {
  const isWhite = color === 'w';

  // Format time (mm:ss)
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div
      className={`relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all duration-200 ${
        isTurn
          ? 'bg-slate-800/90 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
          : 'bg-slate-900/60 border-slate-800/80'
      }`}
    >
      {/* Player info & avatar */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center overflow-hidden border-2 shadow-inner ${
              isWhite
                ? 'bg-slate-100 border-white text-slate-900'
                : 'bg-slate-950 border-slate-700 text-slate-100'
            }`}
          >
            {isHuman ? (
              <User className="w-6 h-6 text-slate-700" />
            ) : bot?.avatar ? (
              <img
                src={bot.avatar}
                alt={bot.name}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Bot className="w-6 h-6 text-indigo-400" />
            )}
          </div>

          {/* Color Indicator Badge */}
          <div
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
              isWhite ? 'bg-white' : 'bg-slate-900 ring-1 ring-slate-600'
            }`}
            title={isWhite ? 'Quân Trắng (White)' : 'Quân Đen (Black)'}
          />
        </div>

        <div>
          <div className="flex items-center gap-2">
            {!isHuman && availableBots && availableBots.length > 1 && onSelectBot ? (
              <select
                value={bot?.id || ''}
                onChange={e => onSelectBot(e.target.value)}
                aria-label={`Chọn bot cho phe ${isWhite ? 'Trắng' : 'Đen'}`}
                className="bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 font-bold text-xs sm:text-sm rounded-lg px-2 py-1 border border-slate-700 outline-none cursor-pointer"
              >
                {availableBots.map(b => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-slate-100">
                    {b.name} (~{b.eloEstimate})
                  </option>
                ))}
              </select>
            ) : (
              <h3 className="font-bold text-sm sm:text-base text-slate-100 leading-tight">
                {isHuman ? 'Người chơi (Bạn)' : bot?.name || 'Đang chờ nạp Bot AI'}
              </h3>
            )}
            {isCheck && (
              <span className="flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                <ShieldAlert className="w-3 h-3" />
                CHIẾU
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              {isHuman ? (
                <span>Người thật</span>
              ) : (
                <>
                  <BrainCircuit className="w-3 h-3 text-indigo-400" />
                  <span className="font-medium text-slate-300">{bot?.modelName || 'Gửi script trong chat'}</span>
                </>
              )}
            </span>
            <span>•</span>
            <span className="font-mono text-amber-400 font-semibold">
              ELO {isHuman ? '~1500' : bot?.eloEstimate ? `~${bot.eloEstimate}` : 'Chưa có'}
            </span>
          </div>

          {/* Captured pieces display & Material Advantage */}
          <div className="flex items-center gap-1 mt-1.5 min-h-[20px]">
            <div className="flex items-center -space-x-1">
              {capturedPieces.map((type, idx) => (
                <div key={idx} className="w-4 h-4 opacity-80" title={`Bắt được ${type.toUpperCase()}`}>
                  <ChessPiece type={type} color={isWhite ? 'b' : 'w'} />
                </div>
              ))}
            </div>
            {materialAdvantage > 0 && (
              <span className="ml-1 text-[11px] font-bold text-emerald-400 font-mono">
                +{materialAdvantage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Clock & Status */}
      <div className="flex flex-col items-end gap-1">
        {/* Timer Box */}
        <div
          className={`px-3 py-1.5 rounded-lg font-mono font-bold text-base sm:text-lg border ${
            isTurn
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/40'
              : 'bg-slate-950/80 text-slate-400 border-slate-800'
          }`}
        >
          {timeFormatted}
        </div>

        {/* Thinking Indicator */}
        <div className="h-4 flex items-center">
          {isThinking ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 animate-pulse">
              <Zap className="w-3 h-3 animate-spin" />
              Đang tính toán...
            </span>
          ) : lastThinkingMs !== undefined && lastThinkingMs > 0 ? (
            <span className="text-[11px] text-slate-400">
              Nước trước: <span className="font-mono text-slate-300 font-semibold">{lastThinkingMs}ms</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
