import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  Gauge,
  ArrowLeftRight,
  Swords,
  Sparkles,
  Palette,
  Bot,
} from 'lucide-react';
import type { GameMode, GameStatus } from '../types/chess';
import type { BoardTheme } from './ChessBoard';

interface ControlBarProps {
  status: GameStatus;
  mode: GameMode;
  speed: number;
  theme: BoardTheme;
  canStepBack: boolean;
  canStepForward: boolean;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onJumpStart: () => void;
  onJumpEnd: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onModeChange: (mode: GameMode) => void;
  onFlipBoard: () => void;
  onThemeChange: (theme: BoardTheme) => void;
  onOpenBotManager: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  status,
  mode,
  speed,
  theme,
  canStepBack,
  canStepForward,
  onTogglePlay,
  onStepBack,
  onStepForward,
  onJumpStart,
  onJumpEnd,
  onReset,
  onSpeedChange,
  onModeChange,
  onFlipBoard,
  onThemeChange,
  onOpenBotManager,
}) => {
  const isPlaying = status === 'playing';

  const speedOptions = [
    { label: '0.5x', value: 2000 },
    { label: '1x', value: 1000 },
    { label: '2x', value: 500 },
    { label: '5x', value: 200 },
    { label: 'Instant', value: 50 },
  ];

  return (
    <div className="flex flex-col gap-3 bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-xl shadow-lg backdrop-blur">
      {/* Top Action Row: Play/Pause, Step Navigation, Reset */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Playback Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Jump Start */}
          <button
            type="button"
            onClick={onJumpStart}
            disabled={!canStepBack}
            aria-label="Về đầu ván đấu"
            title="Về đầu ván đấu"
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
          >
            <ChevronsLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Step Back */}
          <button
            type="button"
            onClick={onStepBack}
            disabled={!canStepBack}
            aria-label="Lùi một nước"
            title="Lùi một nước"
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Main Play / Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Tạm dừng ván đấu' : 'Tiếp tục / Bắt đầu ván đấu'}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm sm:text-base shadow-md transition cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{status === 'idle' ? 'Bắt đầu' : 'Tiếp tục'}</span>
              </>
            )}
          </button>

          {/* Step Forward */}
          <button
            type="button"
            onClick={onStepForward}
            disabled={!canStepForward}
            aria-label="Tiến một nước"
            title="Tiến một nước"
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Jump End */}
          <button
            type="button"
            onClick={onJumpEnd}
            disabled={!canStepForward}
            aria-label="Đến nước mới nhất"
            title="Đến nước mới nhất"
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
          >
            <ChevronsRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Reset / New Game */}
          <button
            type="button"
            onClick={onReset}
            aria-label="Ván mới"
            title="Ván mới"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Ván mới</span>
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-lg border border-slate-800 text-xs">
          <Gauge className="w-3.5 h-3.5 text-slate-400 ml-1.5 hidden xs:inline" />
          <span className="text-[11px] text-slate-400 hidden xs:inline">Tốc độ:</span>
          {speedOptions.map(opt => (
            <button
              key={opt.label}
              type="button"
              onClick={() => onSpeedChange(opt.value)}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                speed === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Row: Mode Select, Flip Board, Theme, Bot Manager & Prompt button */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-800/80">
        {/* Game Mode Selector */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onModeChange('bot_vs_bot')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              mode === 'bot_vs_bot'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>AI vs AI</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange('human_vs_bot')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              mode === 'human_vs_bot'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Người vs AI</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange('human_vs_human')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              mode === 'human_vs_human'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>2 Người</span>
          </button>
        </div>

        {/* Board Customization & AI Tools */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Flip Board */}
          <button
            type="button"
            onClick={onFlipBoard}
            aria-label="Xoay bàn cờ"
            title="Đổi góc nhìn (Xoay bàn cờ)"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Xoay</span>
          </button>

          {/* Theme Selector */}
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            <Palette className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={theme}
              onChange={e => onThemeChange(e.target.value as BoardTheme)}
              aria-label="Chọn màu bàn cờ"
              className="bg-transparent text-slate-300 text-[11px] font-medium outline-none cursor-pointer"
            >
              <option value="emerald" className="bg-slate-900">Màu Xanh Cổ điển</option>
              <option value="wood" className="bg-slate-900">Màu Gỗ Tự nhiên</option>
              <option value="dark" className="bg-slate-900">Màu Xám Đen Sang trọng</option>
              <option value="neon" className="bg-slate-900">Màu Cyber Neon</option>
            </select>
          </div>

          {/* Bot Roster & Matchup Button */}
          <button
            type="button"
            onClick={onOpenBotManager}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Danh Sách Bot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
