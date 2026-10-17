export type GameMode = 'bot_vs_bot' | 'human_vs_bot' | 'human_vs_human';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'checkmate' | 'draw' | 'stalemate' | 'resigned' | 'game_over';

export interface ChessMoveDetails {
  from: string;
  to: string;
  promotion?: string;
  san?: string;
  piece?: string;
  captured?: string;
  color?: 'w' | 'b';
  flags?: string;
}

export interface MoveRecord {
  moveNumber: number;
  white?: {
    san: string;
    from: string;
    to: string;
    thinkingTimeMs?: number;
    fenAfter: string;
  };
  black?: {
    san: string;
    from: string;
    to: string;
    thinkingTimeMs?: number;
    fenAfter: string;
  };
}

export interface ChessBot {
  id: string;
  name: string;
  modelName: string; // e.g. "GPT-4o", "Claude 3.5 Sonnet", "DeepSeek-V3", "Gemini 1.5 Pro"
  description: string;
  avatar: string;
  colorTheme: string;
  eloEstimate: number;
  code: string; // JavaScript implementation: function getMove(fen, legalMoves, chessState) { ... }
  isBuiltIn: boolean;
  wins: number;
  draws: number;
  losses: number;
}

export interface ChessStateInfo {
  turn: 'w' | 'b';
  fen: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  halfMoves: number;
  fullMoves: number;
  material: {
    whiteScore: number;
    blackScore: number;
    balance: number; // positive = white ahead, negative = black ahead
    capturedByWhite: string[];
    capturedByBlack: string[];
  };
}

export interface BotExecutionResult {
  success: boolean;
  move?: {
    from: string;
    to: string;
    promotion?: string;
  };
  san?: string;
  thinkingTimeMs: number;
  error?: string;
  log?: string;
}
