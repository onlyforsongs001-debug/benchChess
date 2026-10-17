import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import {
  Swords,
  Sparkles,
  Bot,
  RotateCcw,
  Volume2,
  VolumeX,
  Share2,
  Tv,
  HelpCircle,
  ExternalLink,
  Trophy,
} from 'lucide-react';

import type { ChessBot, GameMode, GameStatus, MoveRecord } from './types/chess';
import {
  DEFAULT_BOTS,
  calculateMaterial,
  getChessStateInfo,
  getDetailedLegalMoves,
} from './utils/rules';
import { runBotMove, disposeBotSession } from './utils/sandbox';

import { ChessBoard, type BoardTheme } from './components/ChessBoard';
import { PlayerCard } from './components/PlayerCard';
import { ControlBar } from './components/ControlBar';
import { MoveHistory } from './components/MoveHistory';
import { EvalBar } from './components/EvalBar';
import { BotManagerModal } from './components/BotManagerModal';
import { MatchStatsModal } from './components/MatchStatsModal';
import { PromotionModal } from './components/PromotionModal';
import { BenchmarkModal } from './components/BenchmarkModal';

const STORAGE_KEY_BOTS = 'chess_arena_user_bots_v5';

export default function App() {
  // Load bots from localStorage or DEFAULT_BOTS (Gemini 3.8 Flash, DeepSeek V4.1 Flash, Claude Sonnet 5.5)
  const [bots, setBots] = useState<ChessBot[]>(() => {
    try {
      localStorage.removeItem('chess_arena_user_bots_v1');
      localStorage.removeItem('chess_arena_user_bots_v2');
      localStorage.removeItem('chess_arena_user_bots_v3');
      localStorage.removeItem('chess_arena_user_bots_v4');
      const saved = localStorage.getItem(STORAGE_KEY_BOTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_BOTS;
  });

  const [whiteBotId, setWhiteBotId] = useState<string>('gemini-38-flash');
  const [blackBotId, setBlackBotId] = useState<string>('deepseek-v41-flash');

  // Keep whiteBotId and blackBotId synced with available bots
  useEffect(() => {
    if (bots.length > 0) {
      if (!whiteBotId || !bots.some(b => b.id === whiteBotId)) {
        setWhiteBotId(bots[0].id);
      }
      if (!blackBotId || !bots.some(b => b.id === blackBotId)) {
        setBlackBotId(bots[1]?.id || bots[0].id);
      }
    }
  }, [bots, whiteBotId, blackBotId]);

  // Match and Game State
  const [mode, setMode] = useState<GameMode>('bot_vs_bot');
  const [status, setStatus] = useState<GameStatus>('idle');
  const [speed, setSpeed] = useState<number>(1000); // 1s per move default
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('emerald');
  const [flipped, setFlipped] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Active Chess Game Core
  const chessRef = useRef<Chess>(new Chess());
  const [fen, setFen] = useState<string>(chessRef.current.fen());
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [moveSnapshots, setMoveSnapshots] = useState<string[]>([chessRef.current.fen()]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Player interaction state
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  // Thinking and timing
  const [isThinking, setIsThinking] = useState(false);
  const [lastWhiteThinkingMs, setLastWhiteThinkingMs] = useState<number>(0);
  const [lastBlackThinkingMs, setLastBlackThinkingMs] = useState<number>(0);
  const [whiteClockMs, setWhiteClockMs] = useState<number>(10 * 60 * 1000);
  const [blackClockMs, setBlackClockMs] = useState<number>(10 * 60 * 1000);

  // Results & Stats
  const [winner, setWinner] = useState<'w' | 'b' | 'draw' | null>(null);
  const [seriesScore, setSeriesScore] = useState({ whiteWins: 0, blackWins: 0, draws: 0 });

  // Modals
  const [isBotManagerOpen, setIsBotManagerOpen] = useState(false);
  const [isMatchStatsOpen, setIsMatchStatsOpen] = useState(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);

  // Save bots to localStorage on update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BOTS, JSON.stringify(bots));
    } catch (e) {
      console.error(e);
    }
  }, [bots]);

  const whiteBot = bots.find(b => b.id === whiteBotId) || null;
  const blackBot = bots.find(b => b.id === blackBotId) || null;

  const isWhiteHuman = mode === 'human_vs_bot' || mode === 'human_vs_human';
  const isBlackHuman = mode === 'human_vs_human';

  // Current board state calculations
  const currentChess = chessRef.current;
  const currentTurn = currentChess.turn();
  const materialInfo = calculateMaterial(currentChess);
  const isCheck = currentChess.inCheck();

  // Find King square if in check
  let inCheckKingSquare: string | null = null;
  if (isCheck) {
    const board = currentChess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === currentTurn) {
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
          inCheckKingSquare = `${files[c]}${ranks[r]}`;
        }
      }
    }
  }

  // Legal targets for the selected piece
  const legalTargets = selectedSquare
    ? getDetailedLegalMoves(currentChess).filter(m => m.from === selectedSquare)
    : [];

  // Play Sound helper using Web Audio API synthesis
  const playSoundEffect = useCallback((type: 'move' | 'capture' | 'check' | 'gameover') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'move') {
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'capture') {
        osc.frequency.setValueAtTime(540, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } else if (type === 'check') {
        osc.frequency.setValueAtTime(680, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'gameover') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // AudioContext may be restricted before user gesture
    }
  }, [soundEnabled]);

  // Execute a move on the board
  const applyMove = useCallback((
    moveInput: { from: string; to: string; promotion?: string },
    thinkingMs: number = 0
  ) => {
    const chess = chessRef.current;
    const turnBefore = chess.turn();

    try {
      const moveResult = chess.move(moveInput);
      if (!moveResult) return false;

      const newFen = chess.fen();
      setFen(newFen);
      setLastMove({ from: moveInput.from, to: moveInput.to });
      setSelectedSquare(null);

      // Sound
      if (chess.isGameOver()) {
        playSoundEffect('gameover');
      } else if (chess.inCheck()) {
        playSoundEffect('check');
      } else if (moveResult.captured) {
        playSoundEffect('capture');
      } else {
        playSoundEffect('move');
      }

      // Update Move Record in history
      setMoveHistory(prev => {
        const next = [...prev];
        if (turnBefore === 'w') {
          next.push({
            moveNumber: next.length + 1,
            white: {
              san: moveResult.san,
              from: moveResult.from,
              to: moveResult.to,
              thinkingTimeMs: thinkingMs,
              fenAfter: newFen,
            },
          });
        } else {
          const lastRecord = next[next.length - 1];
          if (lastRecord) {
            lastRecord.black = {
              san: moveResult.san,
              from: moveResult.from,
              to: moveResult.to,
              thinkingTimeMs: thinkingMs,
              fenAfter: newFen,
            };
          }
        }
        return next;
      });

      // Update Snapshots
      setMoveSnapshots(prev => {
        const next = [...prev, newFen];
        setCurrentMoveIndex(next.length - 1);
        return next;
      });

      // Record thinking time
      if (turnBefore === 'w') {
        setLastWhiteThinkingMs(thinkingMs);
        setWhiteClockMs(t => Math.max(0, t - thinkingMs));
      } else {
        setLastBlackThinkingMs(thinkingMs);
        setBlackClockMs(t => Math.max(0, t - thinkingMs));
      }

      // Check Game Over conditions
      if (chess.isGameOver()) {
        setStatus('game_over');
        let winColor: 'w' | 'b' | 'draw' | null = null;
        if (chess.isCheckmate()) {
          winColor = turnBefore; // Person who just moved wins
          setStatus('checkmate');
          setSeriesScore(s => ({
            ...s,
            whiteWins: winColor === 'w' ? s.whiteWins + 1 : s.whiteWins,
            blackWins: winColor === 'b' ? s.blackWins + 1 : s.blackWins,
          }));
        } else {
          winColor = 'draw';
          setStatus(chess.isStalemate() ? 'stalemate' : 'draw');
          setSeriesScore(s => ({ ...s, draws: s.draws + 1 }));
        }
        setWinner(winColor);
        setTimeout(() => setIsMatchStatsOpen(true), 600);
        return true;
      }

      return true;
    } catch (err) {
      console.error('Error applying move:', err);
      return false;
    }
  }, [playSoundEffect]);

  // Handle Human Click on square
  const handleSquareClick = (square: string) => {
    // If not human's turn or game is over, ignore
    if (status === 'game_over' || status === 'checkmate' || status === 'draw') return;

    const turn = chessRef.current.turn();
    const isCurrentPlayerHuman = (turn === 'w' && isWhiteHuman) || (turn === 'b' && isBlackHuman);
    if (!isCurrentPlayerHuman) return;

    // If reviewing history, jump to latest first
    if (currentMoveIndex < moveSnapshots.length - 1) {
      jumpToLatest();
    }

    if (!selectedSquare) {
      const piece = chessRef.current.get(square as any);
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
      }
    } else {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      // Check if clicking another of own pieces
      const piece = chessRef.current.get(square as any);
      if (piece && piece.color === turn) {
        setSelectedSquare(square);
        return;
      }

      // Check promotion requirement
      const selectedPiece = chessRef.current.get(selectedSquare as any);
      const isPawnPromotion =
        selectedPiece?.type === 'p' &&
        ((selectedPiece.color === 'w' && square[1] === '8') ||
          (selectedPiece.color === 'b' && square[1] === '1'));

      if (isPawnPromotion) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      // Attempt normal move
      const success = applyMove({ from: selectedSquare, to: square });
      if (!success) {
        setSelectedSquare(null);
      }
    }
  };

  const handlePromotionSelect = (promotionPiece: 'q' | 'r' | 'b' | 'n') => {
    if (pendingPromotion) {
      applyMove({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: promotionPiece,
      });
      setPendingPromotion(null);
    }
  };

  // Bot Turn Orchestration Loop
  // Bot chạy trong Web Worker sandbox (timeout cứng, không kẹn UI) và giữ
  // engine sống suốt ván để bảng transposition/killer/history được tái sử dụng.
  useEffect(() => {
    if (status !== 'playing') return;

    const chess = chessRef.current;
    if (chess.isGameOver()) return;

    const turn = chess.turn();
    const isBotTurn = (turn === 'w' && !isWhiteHuman) || (turn === 'b' && !isBlackHuman);

    if (!isBotTurn) return;

    const activeBot = turn === 'w' ? whiteBot : blackBot;
    if (!activeBot) return;
    setIsThinking(true);

    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        const currentBoardFen = chessRef.current.fen();
        const result = await runBotMove(activeBot.id, activeBot.code, currentBoardFen, 2000);

        if (cancelled) return;
        setIsThinking(false);

        if (result.success && result.move) {
          applyMove(result.move, result.thinkingTimeMs);
        } else {
          console.warn(`Bot ${activeBot.name} returned error:`, result.error);
          // Fallback: pick best capture or random legal move so game continues smoothly
          const legal = getDetailedLegalMoves(chessRef.current);
          if (legal.length > 0) {
            const fallback = legal.find(m => m.captured) || legal[0];
            applyMove({ from: fallback.from, to: fallback.to, promotion: fallback.promotion }, result.thinkingTimeMs || 10);
          }
        }
      })();
    }, Math.max(80, speed));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, fen, speed, isWhiteHuman, isBlackHuman, whiteBot, blackBot, applyMove]);

  // Jump to specific move in history (Spectator review)
  const jumpToMoveIndex = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= moveSnapshots.length) return;
    setCurrentMoveIndex(targetIdx);
    setFen(moveSnapshots[targetIdx]);
    chessRef.current = new Chess(moveSnapshots[targetIdx]);
  };

  const jumpToLatest = () => {
    jumpToMoveIndex(moveSnapshots.length - 1);
  };

  const handleStepBack = () => {
    if (currentMoveIndex > 0) {
      if (status === 'playing') setStatus('paused');
      jumpToMoveIndex(currentMoveIndex - 1);
    }
  };

  const handleStepForward = () => {
    if (currentMoveIndex < moveSnapshots.length - 1) {
      jumpToMoveIndex(currentMoveIndex + 1);
    }
  };

  const handleResetGame = () => {
    const newChess = new Chess();
    chessRef.current = newChess;
    setFen(newChess.fen());
    setMoveHistory([]);
    setMoveSnapshots([newChess.fen()]);
    setCurrentMoveIndex(0);
    setLastMove(null);
    setSelectedSquare(null);
    setWinner(null);
    setIsThinking(false);
    setStatus('idle');
    setWhiteClockMs(10 * 60 * 1000);
    setBlackClockMs(10 * 60 * 1000);
  };

  const handleSwapSides = () => {
    const temp = whiteBotId;
    setWhiteBotId(blackBotId);
    setBlackBotId(temp);
    setIsMatchStatsOpen(false);
    handleResetGame();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (status === 'playing') {
          setStatus('paused');
        } else {
          // Đang xem lại thế cờ cũ: phải nhảy về nước mới nhất trước khi chạy tiếp,
          // nếu không bot sẽ đánh trên bàn đã tua và làm hỏng biên bản nước đi.
          if (currentMoveIndex < moveSnapshots.length - 1) {
            jumpToLatest();
          }
          setStatus('playing');
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStepBack();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStepForward();
      } else if (e.code === 'KeyF') {
        setFlipped(f => !f);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIndex, moveSnapshots.length, status]);

  // Bot Manager Callbacks
  const handleSaveBot = (updatedBot: ChessBot) => {
    setBots(prev => {
      const idx = prev.findIndex(b => b.id === updatedBot.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedBot;
        return next;
      }
      return [...prev, updatedBot];
    });
  };

  const handleDeleteBot = (botId: string) => {
    setBots(prev => prev.filter(b => b.id !== botId));
    disposeBotSession(botId);
    if (whiteBotId === botId) setWhiteBotId(DEFAULT_BOTS[0].id);
    if (blackBotId === botId) setBlackBotId(DEFAULT_BOTS[1].id);
  };

  // Thêm bot mới từ giao diện (script do người dùng/AI soạn)
  const handleAddBot = (bot: ChessBot) => {
    setBots(prev => {
      const idx = prev.findIndex(b => b.id === bot.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = bot;
        return next;
      }
      return [...prev, bot];
    });
  };

  const handleResetToDefaults = () => {
    setBots(DEFAULT_BOTS);
    setWhiteBotId(DEFAULT_BOTS[0].id);
    setBlackBotId(DEFAULT_BOTS[1].id);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-indigo-950/50 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Swords className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
                  CHESS ARENA
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    AI BATTLEGROUND
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Môi trường quan sát cờ vua & Đấu trường Bot AI tùy chỉnh
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Benchmark / Leaderboard */}
            <button
              type="button"
              onClick={() => setIsBenchmarkOpen(true)}
              title="Xem kết quả benchmark đo thật giữa các bot"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs border border-amber-500/30 transition cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xếp Hạng</span>
            </button>

            {/* Manage Bots */}
            <button
              type="button"
              onClick={() => setIsBotManagerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Danh Sách Bot ({bots.length})</span>
            </button>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(s => !s)}
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Arena Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-4">
        {/* Arena Status Banner */}
        {bots.length === 0 ? (
          <div className="bg-gradient-to-r from-purple-950/60 via-indigo-950/70 to-slate-900 border border-purple-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600/30 border border-purple-500/50 text-purple-300">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Đang đợi bạn gửi Bot AI vào chat
                </h3>
                <p className="text-xs text-slate-300">
                  Hãy gửi <strong>Tên Bot</strong> và <strong>Script do AI viết</strong> vào khung chat, mình sẽ nạp trực tiếp vào sàn đấu cho bạn ngay lập tức!
                </p>
              </div>
            </div>
          </div>
        ) : bots.length === 1 ? (
          <div className="bg-gradient-to-r from-emerald-950/60 via-indigo-950/70 to-slate-900 border border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 shadow-xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-300">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Đã nạp thành công:</span>
                  <span className="text-emerald-400 font-bold">{bots[0].name}</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Bấm <strong className="text-white">Bắt đầu</strong> để xem Gemini 3.8 Flash tự đấu đối kháng (Self-Play), hoặc gửi thêm Bot thứ 2 để 2 Model đại chiến!
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-indigo-950/70 via-purple-950/60 to-slate-900 border border-indigo-500/40 rounded-2xl p-3.5 sm:p-4 shadow-xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-300">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Trận Đấu Đỉnh Cao:</span>
                  <span className="text-emerald-400 font-bold">{whiteBot?.name}</span>
                  <span className="text-slate-500 text-xs font-normal">vs</span>
                  <span className="text-purple-400 font-bold">{blackBot?.name}</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Đã có {bots.length} mô hình AI sẵn sàng (Gemini 3.8 Flash, DeepSeek V4.1 Flash, Claude Sonnet 5.5). Bấm <strong className="text-emerald-400">Bắt đầu</strong> để đấu đối kháng, hoặc gửi thêm Bot vào chat bất cứ lúc nào!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSwapSides}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Đổi bên Trắng ⇄ Đen
              </button>
            </div>
          </div>
        )}

        {/* Arena Matchup Banner */}
        <div className="bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <Tv className="w-4 h-4" />
              Chế độ quan sát:
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-200">
              {mode === 'bot_vs_bot' && (
                <span className="flex items-center gap-1.5">
                  <strong className="text-white">{whiteBot?.name || 'Đang chờ Bot Trắng'}</strong>
                  <span className="text-slate-500">vs</span>
                  <strong className="text-white">{blackBot?.name || 'Đang chờ Bot Đen'}</strong>
                </span>
              )}
              {mode === 'human_vs_bot' && (
                <span className="flex items-center gap-1.5">
                  <strong className="text-white">Bạn</strong>
                  <span className="text-slate-500">vs</span>
                  <strong className="text-white">{blackBot?.name || 'Đang chờ Bot AI'}</strong>
                </span>
              )}
              {mode === 'human_vs_human' && 'Đấu cờ người vs người tại chỗ'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Tỉ số giải đấu:</span>
              <span className="font-mono font-bold text-emerald-400">{seriesScore.whiteWins}W</span>
              <span className="text-slate-500">-</span>
              <span className="font-mono font-bold text-slate-400">{seriesScore.draws}D</span>
              <span className="text-slate-500">-</span>
              <span className="font-mono font-bold text-indigo-400">{seriesScore.blackWins}W</span>
            </div>

            <button
              type="button"
              onClick={handleSwapSides}
              title="Đổi màu quân cho 2 bot"
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Đổi bên</span>
            </button>
          </div>
        </div>

        {/* Central Grid: Evaluation Bar + Chess Board + History & Spectator Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-4">
          {/* Left Column: Board and Player Cards */}
          <div className="flex flex-col gap-3">
            {/* Top Player (Black by default, or White if flipped) */}
            <PlayerCard
              color={flipped ? 'w' : 'b'}
              isHuman={flipped ? isWhiteHuman : isBlackHuman}
              bot={flipped ? whiteBot : blackBot}
              availableBots={bots}
              onSelectBot={id => {
                if (flipped) setWhiteBotId(id);
                else setBlackBotId(id);
                handleResetGame();
              }}
              isTurn={currentTurn === (flipped ? 'w' : 'b')}
              isThinking={isThinking && currentTurn === (flipped ? 'w' : 'b')}
              timeMs={flipped ? whiteClockMs : blackClockMs}
              lastThinkingMs={flipped ? lastWhiteThinkingMs : lastBlackThinkingMs}
              capturedPieces={flipped ? materialInfo.capturedByWhite : materialInfo.capturedByBlack}
              materialAdvantage={
                flipped
                  ? Math.max(0, materialInfo.balance)
                  : Math.max(0, -materialInfo.balance)
              }
              isCheck={isCheck && currentTurn === (flipped ? 'w' : 'b')}
            />

            {/* Chess Board Area with Eval Bar on the left */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
              {/* Dynamic Evaluation Bar */}
              <div className="h-[280px] sm:h-[480px] flex items-center">
                <EvalBar score={materialInfo.balance} flipped={flipped} />
              </div>

              {/* Main Interactive & Spectator Chess Board */}
              <div className="flex-1 flex justify-center">
                <ChessBoard
                  fen={fen}
                  flipped={flipped}
                  theme={boardTheme}
                  lastMove={lastMove}
                  selectedSquare={selectedSquare}
                  legalTargets={legalTargets}
                  inCheckKingSquare={inCheckKingSquare}
                  onSquareClick={handleSquareClick}
                  interactive={true}
                />
              </div>
            </div>

            {/* Bottom Player (White by default, or Black if flipped) */}
            <PlayerCard
              color={flipped ? 'b' : 'w'}
              isHuman={flipped ? isBlackHuman : isWhiteHuman}
              bot={flipped ? blackBot : whiteBot}
              availableBots={bots}
              onSelectBot={id => {
                if (flipped) setBlackBotId(id);
                else setWhiteBotId(id);
                handleResetGame();
              }}
              isTurn={currentTurn === (flipped ? 'b' : 'w')}
              isThinking={isThinking && currentTurn === (flipped ? 'b' : 'w')}
              timeMs={flipped ? blackClockMs : whiteClockMs}
              lastThinkingMs={flipped ? lastBlackThinkingMs : lastWhiteThinkingMs}
              capturedPieces={flipped ? materialInfo.capturedByBlack : materialInfo.capturedByWhite}
              materialAdvantage={
                flipped
                  ? Math.max(0, -materialInfo.balance)
                  : Math.max(0, materialInfo.balance)
              }
              isCheck={isCheck && currentTurn === (flipped ? 'b' : 'w')}
            />

            {/* Playback Control Bar */}
            <ControlBar
              status={status}
              mode={mode}
              speed={speed}
              theme={boardTheme}
              canStepBack={currentMoveIndex > 0}
              canStepForward={currentMoveIndex < moveSnapshots.length - 1}
              onTogglePlay={() => {
                if (status === 'playing') {
                  setStatus('paused');
                } else {
                  if (currentMoveIndex < moveSnapshots.length - 1) {
                    jumpToLatest();
                  }
                  setStatus('playing');
                }
              }}
              onStepBack={handleStepBack}
              onStepForward={handleStepForward}
              onJumpStart={() => jumpToMoveIndex(0)}
              onJumpEnd={jumpToLatest}
              onReset={handleResetGame}
              onSpeedChange={setSpeed}
              onModeChange={newMode => {
                setMode(newMode);
                handleResetGame();
              }}
              onFlipBoard={() => setFlipped(f => !f)}
              onThemeChange={setBoardTheme}
              onOpenBotManager={() => setIsBotManagerOpen(true)}
            />
          </div>

          {/* Right Column: Move History, PGN & Quick Guides */}
          <div className="flex flex-col gap-3">
            {/* Move History Component */}
            <div className="h-[360px] sm:h-[420px]">
              <MoveHistory
                history={moveHistory}
                currentMoveIndex={currentMoveIndex}
                fen={fen}
                pgn={chessRef.current.pgn()}
                onSelectMove={halfMoveIdx => jumpToMoveIndex(halfMoveIdx + 1)}
              />
            </div>

            {/* Arena Info Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-2.5">
              <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Môi Trường Thi Đấu & Quan Sát Cờ Vua
              </h4>
              <ul className="space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
                <li>• <strong>AI vs AI</strong>: Quan sát hai mô hình AI do bạn gửi vào thi đấu đối kháng trực tiếp.</li>
                <li>• <strong>Người vs AI</strong>: Thử thách kỹ năng của bạn trước thuật toán của các mô hình AI.</li>
                <li>• <strong>Phím tắt</strong>: Nhấn <code>[Space]</code> để Dừng/Chạy, <code>[← / →]</code> để tua nước đi.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Promotion Selector Modal */}
      <PromotionModal
        isOpen={Boolean(pendingPromotion)}
        color={chessRef.current.turn()}
        onSelect={handlePromotionSelect}
        onCancel={() => setPendingPromotion(null)}
      />

      {/* Bot Manager Modal */}
      <BotManagerModal
        isOpen={isBotManagerOpen}
        onClose={() => setIsBotManagerOpen(false)}
        bots={bots}
        whiteBotId={whiteBotId}
        blackBotId={blackBotId}
        onSelectWhiteBot={id => setWhiteBotId(id)}
        onSelectBlackBot={id => setBlackBotId(id)}
        onDeleteBot={handleDeleteBot}
        onAddBot={handleAddBot}
      />

      {/* Benchmark / Leaderboard Modal */}
      <BenchmarkModal isOpen={isBenchmarkOpen} onClose={() => setIsBenchmarkOpen(false)} />

      {/* Match Stats / Victory Modal */}
      <MatchStatsModal
        isOpen={isMatchStatsOpen}
        onClose={() => setIsMatchStatsOpen(false)}
        status={status}
        winner={winner}
        whiteBot={whiteBot}
        blackBot={blackBot}
        isWhiteHuman={isWhiteHuman}
        isBlackHuman={isBlackHuman}
        fullMoves={getChessStateInfo(chessRef.current).fullMoves}
        seriesScore={seriesScore}
        onRematch={() => {
          setIsMatchStatsOpen(false);
          handleResetGame();
          setStatus('playing');
        }}
        onSwapSides={() => {
          handleSwapSides();
          setStatus('playing');
        }}
      />
    </div>
  );
}
