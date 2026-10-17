import { Chess } from 'chess.js';
import type { ChessBot, ChessStateInfo, BotExecutionResult } from '../types/chess';

// Standard piece values
export const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3.25,
  r: 5,
  q: 9,
  k: 0,
};

// Calculate material score and captured pieces from a chess.js instance
export function calculateMaterial(chess: Chess) {
  const board = chess.board();
  let whiteScore = 0;
  let blackScore = 0;
  const currentPieces: Record<string, number> = {
    wp: 0, wn: 0, wb: 0, wr: 0, wq: 0,
    bp: 0, bn: 0, bb: 0, br: 0, bq: 0,
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type !== 'k') {
        const key = p.color + p.type;
        currentPieces[key] = (currentPieces[key] || 0) + 1;
        const val = PIECE_VALUES[p.type] || 0;
        if (p.color === 'w') whiteScore += val;
        else blackScore += val;
      }
    }
  }

  // Standard initial army
  const starting = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];

  for (const [type, count] of Object.entries(starting)) {
    // Pieces black lost (captured by white)
    const lostByBlack = count - (currentPieces['b' + type] || 0);
    for (let i = 0; i < lostByBlack; i++) capturedByWhite.push(type);

    // Pieces white lost (captured by black)
    const lostByWhite = count - (currentPieces['w' + type] || 0);
    for (let i = 0; i < lostByWhite; i++) capturedByBlack.push(type);
  }

  // Một tốt được phong cấp thành quân khác là KHÔNG phải quân bị bắt.
  // Số quân dư ra so với quân số ban đầu chính là số lần phong cấp →
  // loại bỏ tương ứng khỏi danh sách "quân bị bắt" (ưu tiên trừ tốt trước).
  const stripPromotions = (list: string[], side: 'w' | 'b') => {
    let promotions = 0;
    for (const [type, count] of Object.entries(starting)) {
      const cur = currentPieces[side + type] || 0;
      if (cur > count) promotions += cur - count;
    }
    for (const type of ['p', 'n', 'b', 'r', 'q']) {
      while (promotions > 0) {
        const idx = list.lastIndexOf(type);
        if (idx < 0) break;
        list.splice(idx, 1);
        promotions--;
      }
    }
  };
  stripPromotions(capturedByBlack, 'w'); // tốt trắng phong cấp không phải "bị đen bắt"
  stripPromotions(capturedByWhite, 'b');

  return {
    whiteScore: Number(whiteScore.toFixed(2)),
    blackScore: Number(blackScore.toFixed(2)),
    balance: Number((whiteScore - blackScore).toFixed(2)),
    capturedByWhite,
    capturedByBlack,
  };
}

export function getChessStateInfo(chess: Chess): ChessStateInfo {
  return {
    turn: chess.turn(),
    fen: chess.fen(),
    isCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
    isStalemate: chess.isStalemate(),
    halfMoves: chess.history().length,
    fullMoves: Math.floor(chess.history().length / 2) + 1,
    material: calculateMaterial(chess),
  };
}

export interface LegalMoveObj {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  piece: string;
  captured?: string;
}

export function getDetailedLegalMoves(chess: Chess): LegalMoveObj[] {
  const verboseMoves = chess.moves({ verbose: true });
  return verboseMoves.map(m => ({
    from: m.from,
    to: m.to,
    promotion: m.promotion,
    san: m.san,
    piece: m.piece,
    captured: m.captured,
  }));
}

/**
 * Normalizes any output from a bot into a standard { from, to, promotion } move object
 */
export function normalizeBotMoveOutput(
  rawMove: any,
  legalMoves: LegalMoveObj[]
): { from: string; to: string; promotion?: string; san: string } | null {
  if (!rawMove) return null;

  // Case 1: String like 'e2e4' or 'e7e8q' or SAN like 'Nf3', 'e4', 'O-O'
  if (typeof rawMove === 'string') {
    const cleaned = rawMove.trim();
    // Check if it matches UCI 4-5 chars e.g. e2e4 or e7e8q
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(cleaned)) {
      const from = cleaned.slice(0, 2).toLowerCase();
      const to = cleaned.slice(2, 4).toLowerCase();
      const promotion = cleaned.length === 5 ? cleaned[4].toLowerCase() : undefined;
      const found = legalMoves.find(
        m => m.from === from && m.to === to && (!promotion || m.promotion === promotion)
      );
      if (found) return { from: found.from, to: found.to, promotion: found.promotion, san: found.san };
    }

    // Check if it's a SAN move matching one in legalMoves
    const sanFound = legalMoves.find(m => m.san.toLowerCase() === cleaned.toLowerCase());
    if (sanFound) {
      return { from: sanFound.from, to: sanFound.to, promotion: sanFound.promotion, san: sanFound.san };
    }
  }

  // Case 2: Object { from: 'e2', to: 'e4', promotion?: 'q' }
  if (typeof rawMove === 'object' && rawMove !== null) {
    const from = String(rawMove.from || '').toLowerCase().trim();
    const to = String(rawMove.to || '').toLowerCase().trim();
    const promo = rawMove.promotion ? String(rawMove.promotion).toLowerCase().trim() : undefined;

    const found = legalMoves.find(
      m => m.from === from && m.to === to && (!promo || m.promotion === promo)
    );
    if (found) {
      return { from: found.from, to: found.to, promotion: found.promotion, san: found.san };
    }

    // Also check if rawMove has .san or .uci
    if (rawMove.san) {
      const sanMatch = legalMoves.find(m => m.san === rawMove.san);
      if (sanMatch) return { from: sanMatch.from, to: sanMatch.to, promotion: sanMatch.promotion, san: sanMatch.san };
    }
    if (rawMove.uci) {
      return normalizeBotMoveOutput(rawMove.uci, legalMoves);
    }
  }

  return null;
}

/**
 * Execute a bot script safely against a given board state
 */
export function executeBotScript(
  botCode: string,
  fen: string,
  timeoutMs: number = 2000
): BotExecutionResult {
  const startTime = performance.now();
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch (e: any) {
    return {
      success: false,
      thinkingTimeMs: 0,
      error: `FEN không hợp lệ: ${e.message}`,
    };
  }

  const legalMoves = getDetailedLegalMoves(chess);
  if (legalMoves.length === 0) {
    return {
      success: false,
      thinkingTimeMs: 0,
      error: 'Không còn nước đi hợp lệ (Hết cờ hoặc hòa).',
    };
  }

  const chessState = getChessStateInfo(chess);

  try {
    const wrappedCode = botCode.trim();

    // Direct clean function definition
    const functionBody = `
      "use strict";
      const PIECE_VALS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
      
      ${wrappedCode}
      
      let userFn = null;
      if (typeof getMove === 'function') {
        userFn = getMove;
      } else if (typeof chooseMove === 'function') {
        userFn = chooseMove;
      } else if (typeof botMove === 'function') {
        userFn = botMove;
      }

      if (!userFn) {
        throw new Error("Không tìm thấy hàm getMove(fen, legalMoves, chessState) trong script bot.");
      }

      return userFn(fen, legalMoves, chessState);
    `;

    const runner = new Function('fen', 'legalMoves', 'chessState', functionBody);
    const rawResult = runner(fen, legalMoves, chessState);
    const thinkingTimeMs = Math.round(performance.now() - startTime);

    const validMove = normalizeBotMoveOutput(rawResult, legalMoves);

    if (!validMove) {
      return {
        success: false,
        thinkingTimeMs,
        error: `Bot trả về nước đi không hợp lệ (${JSON.stringify(rawResult)}). Các nước đi hợp lệ gồm: ${legalMoves.slice(0, 5).map(m => m.san).join(', ')}...`,
      };
    }

    return {
      success: true,
      move: {
        from: validMove.from,
        to: validMove.to,
        promotion: validMove.promotion,
      },
      san: validMove.san,
      thinkingTimeMs,
    };
  } catch (err: any) {
    const thinkingTimeMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      thinkingTimeMs,
      error: `Lỗi thực thi bot: ${err.message}`,
    };
  }
}

/**
 * Roster of AI bots.
 */
export const DEFAULT_BOTS: ChessBot[] = [
  {
    id: 'gemini-38-flash',
    name: 'Gemini 3.8 Flash',
    modelName: 'Google Gemini 3.8 Flash',
    description: 'Bot do Gemini 3.8 Flash sáng tạo: Quét tia ô bị đe dọa (Raycaster), MVV-LVA, né Blunder, PST toán học và an toàn vua.',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
    colorTheme: 'from-blue-600 to-indigo-800',
    eloEstimate: 1920,
    isBuiltIn: false,
    wins: 0,
    draws: 0,
    losses: 0,
    code: `function getMove(fen, legalMoves, chessState) {
  if (!legalMoves || legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  // 1. BẢNG GIÁ TRỊ QUÂN CỜ
  const PIECE_VALS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

  // 2. PARSE FEN THÀNH MẢNG 64 Ô (0: a8, ..., 63: h1)
  const board = new Array(64).fill(null);
  const rows = fen.split(' ')[0].split('/');
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') c += parseInt(ch, 10);
      else {
        board[r * 8 + c] = ch;
        c++;
      }
    }
  }

  const myColor = chessState.turn; // 'w' hoặc 'b'
  const enemyColor = myColor === 'w' ? 'b' : 'w';

  // Chuyển ký hiệu ô ('e4') -> chỉ số mảng (0..63)
  function sqToIdx(sq) {
    return (8 - parseInt(sq[1], 10)) * 8 + (sq.charCodeAt(0) - 97);
  }

  // 3. HÀM KIỂM TRA MỘT Ô CÓ BỊ TẤN CÔNG BỞI MÀU 'byColor' HAY KHÔNG
  function isSquareAttacked(sq, byColor, b) {
    const r = sq >> 3, c = sq & 7;

    // Tốt tấn công
    const pPawn = byColor === 'w' ? 'P' : 'p';
    const pawnRow = byColor === 'w' ? r + 1 : r - 1;
    if (pawnRow >= 0 && pawnRow < 8) {
      if (c > 0 && b[pawnRow * 8 + (c - 1)] === pPawn) return true;
      if (c < 7 && b[pawnRow * 8 + (c + 1)] === pPawn) return true;
    }

    // Mã tấn công
    const pKnight = byColor === 'w' ? 'N' : 'n';
    const kOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (let i = 0; i < 8; i++) {
      const nr = r + kOffsets[i][0], nc = c + kOffsets[i][1];
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        if (b[nr * 8 + nc] === pKnight) return true;
      }
    }

    // Vua tấn công
    const pKing = byColor === 'w' ? 'K' : 'k';
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (b[nr * 8 + nc] === pKing) return true;
        }
      }
    }

    // Xe + Hậu (Đường thẳng)
    const pRook = byColor === 'w' ? 'R' : 'r';
    const pQueen = byColor === 'w' ? 'Q' : 'q';
    const orthDirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (let d = 0; d < 4; d++) {
      let nr = r + orthDirs[d][0], nc = c + orthDirs[d][1];
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = b[nr * 8 + nc];
        if (p) {
          if (p === pRook || p === pQueen) return true;
          break;
        }
        nr += orthDirs[d][0]; nc += orthDirs[d][1];
      }
    }

    // Tượng + Hậu (Đường chéo)
    const pBishop = byColor === 'w' ? 'B' : 'b';
    const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (let d = 0; d < 4; d++) {
      let nr = r + diagDirs[d][0], nc = c + diagDirs[d][1];
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = b[nr * 8 + nc];
        if (p) {
          if (p === pBishop || p === pQueen) return true;
          break;
        }
        nr += diagDirs[d][0]; nc += diagDirs[d][1];
      }
    }

    return false;
  }

  // 4. BẢNG TÍNH ĐIỂM VỊ TRÍ CHIẾN LƯỢC (PST MATHEMATICAL FORMULA)
  function getPositionalScore(piece, sq, color) {
    const p = piece.toLowerCase();
    const rank = color === 'w' ? (7 - (sq >> 3)) : (sq >> 3); // 0 (hàng đầu) -> 7 (hàng cuối)
    const file = sq & 7;
    const centerDist = Math.abs(file - 3.5) + Math.abs(rank - 3.5);

    if (p === 'p') {
      // Tốt: Thưởng khi tiến xa và chiếm cột trung tâm
      return rank * 12 + (3.5 - Math.abs(file - 3.5)) * 6;
    }
    if (p === 'n') {
      // Mã: Thích ở trung tâm, cực ghét đứng góc
      return (7 - centerDist) * 7;
    }
    if (p === 'b') {
      // Tượng: Hoạt động mạnh ở đường chéo thoáng
      return (7 - centerDist) * 4;
    }
    if (p === 'r') {
      // Xe: Thích hàng 7 (rank 6) và cột trung tâm
      return (rank === 6 ? 25 : 0) + (3.5 - Math.abs(file - 3.5)) * 3;
    }
    if (p === 'q') {
      return (7 - centerDist) * 2;
    }
    if (p === 'k') {
      // Vua: Đầu/giữa trận nên ẩn nấp ở góc, tàn cuộc mới ra trung tâm
      return chessState.fullMoves > 30 ? (7 - centerDist) * 6 : -rank * 15;
    }
    return 0;
  }

  // 5. ĐÁNH GIÁ VÀ CHẤM ĐIỂM TỪNG NƯỚC ĐI HỢP LỆ
  let bestScore = -Infinity;
  let bestMove = legalMoves[0];

  for (let i = 0; i < legalMoves.length; i++) {
    const m = legalMoves[i];
    let score = 0;

    // CHIẾU HẾT: Thực hiện ngay lập tức
    if (m.san.includes('#')) return m;

    const fromIdx = sqToIdx(m.from);
    const toIdx = sqToIdx(m.to);
    const movingPiece = m.piece.toLowerCase();
    const myPieceVal = PIECE_VALS[movingPiece];

    // Mô phỏng nước đi để kiểm tra an toàn
    const nextBoard = board.slice();
    nextBoard[toIdx] = nextBoard[fromIdx];
    nextBoard[fromIdx] = null;

    const isToAttacked = isSquareAttacked(toIdx, enemyColor, nextBoard);
    const isToDefended = isSquareAttacked(toIdx, myColor, nextBoard);
    const wasFromAttacked = isSquareAttacked(fromIdx, enemyColor, board);

    // a. ĐÁNH GIÁ ĂN QUÂN (MVV-LVA)
    if (m.captured) {
      const capturedVal = PIECE_VALS[m.captured.toLowerCase()];
      if (!isToAttacked) {
        // Ăn quân tự do (free piece)
        score += capturedVal * 12;
      } else if (isToDefended) {
        // Đổi quân có bảo vệ (Exchange)
        score += (capturedVal - myPieceVal) * 10 + 40;
      } else {
        // Đổi quân cảm tử (không ai bảo kê)
        score += (capturedVal - myPieceVal) * 10 - 60;
      }
    } else {
      // Nước đi không bắt quân
      if (isToAttacked && !isToDefended) {
        // Blunder: Đi vào ô bị đối phương nhắm mà không có bảo vệ
        score -= myPieceVal * 10;
      } else if (isToAttacked && isToDefended) {
        // Đi vào ô tranh chấp: Quân to không nên vào
        if (myPieceVal > 100) score -= (myPieceVal - 100) * 2;
      }
    }

    // b. BẢO VỆ / THOÁT THÂN CHO QUÂN BỊ ĐE DỌA
    if (wasFromAttacked && !isToAttacked) {
      score += myPieceVal * 8; // Điểm cộng lớn vì giữ được quân
    }

    // c. PHONG CẤP (PROMOTION)
    if (m.promotion) {
      if (m.promotion === 'q') score += 850;
      else if (m.promotion === 'n') score += 250;
    }

    // d. CHIẾU TƯỚNG (CHECK)
    if (m.san.includes('+')) {
      score += isToAttacked ? -20 : 35;
    }

    // e. NHẬP THÀNH (CASTLING)
    if (m.san.startsWith('O-O')) {
      score += 75;
    }

    // f. NGUYÊN TẮC KHAI CUỘC (10 NƯỚC ĐẦU)
    if (chessState.fullMoves <= 10) {
      // Xuất Mã, Tượng sớm
      if (movingPiece === 'n' || movingPiece === 'b') score += 25;
      // Đẩy tốt chiếm tâm (e4/d4/e5/d5)
      if (movingPiece === 'p' && ['e4', 'd4', 'e5', 'd5'].includes(m.to)) score += 35;
      // Phạt nếu vác Hậu đi lung tung quá sớm
      if (movingPiece === 'q') score -= 60;
    }

    // g. ĐIỂM VỊ TRÍ ĐẾN & ĐI
    score += getPositionalScore(movingPiece, toIdx, myColor) - 
             getPositionalScore(movingPiece, fromIdx, myColor);

    // Thêm một chút dao động ngẫu nhiên nhẹ (±2 điểm) để Bot không đánh đơn điệu lặp lại
    score += (Math.random() - 0.5) * 4;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return bestMove;
}`,
  },
  {
    id: 'deepseek-v41-flash',
    name: 'DeepSeek V4.1 Flash',
    modelName: 'DeepSeek V4.1 Flash',
    description: 'Engine tìm kiếm NegaMax với Iterative Deepening (Độ sâu 1-5), Quiescence Search, Bảng Killer Moves và Lịch sử Heuristic.',
    avatar: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=120&auto=format&fit=crop&q=80',
    colorTheme: 'from-purple-600 to-indigo-800',
    eloEstimate: 1950,
    isBuiltIn: false,
    wins: 0,
    draws: 0,
    losses: 0,
    code: `function getMove(fen, legalMoves, chessState) {
  if (!legalMoves || legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  // Ưu tiên tuyệt đối nếu có nước chiếu hết ngay theo SAN
  for (let i = 0; i < legalMoves.length; i++) {
    const san = legalMoves[i] && legalMoves[i].san;
    if (san && san.indexOf("#") >= 0) return legalMoves[i];
  }

  const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  const VALUE = [0, 100, 320, 330, 500, 900, 20000];
  const INF = 1000000;
  const MATE = 900000;

  const CHAR_TO_PIECE = {
    p: PAWN,
    n: KNIGHT,
    b: BISHOP,
    r: ROOK,
    q: QUEEN,
    k: KING
  };

  function parseSq(s) {
    const file = s.charCodeAt(0) - 97;
    const rank = s.charCodeAt(1) - 48;
    const row = 8 - rank;
    return row * 8 + file;
  }

  function parseFen(fenStr) {
    const parts = fenStr.trim().split(/\\s+/);
    const b = new Array(64).fill(0);
    const placement = parts[0];

    let sq = 0;
    for (let i = 0; i < placement.length; i++) {
      const ch = placement[i];
      if (ch === "/") continue;

      if (ch >= "1" && ch <= "9") {
        sq += ch.charCodeAt(0) - 48;
      } else {
        const isWhite = ch === ch.toUpperCase();
        const type = CHAR_TO_PIECE[ch.toLowerCase()] || 0;
        b[sq] = isWhite ? type : -type;
        sq++;
      }
    }

    const turn = parts[1] === "b" ? -1 : 1;

    let castling = 0;
    const cstr = parts[2] || "-";
    if (cstr.indexOf("K") >= 0) castling |= 1; // White kingside
    if (cstr.indexOf("Q") >= 0) castling |= 2; // White queenside
    if (cstr.indexOf("k") >= 0) castling |= 4; // Black kingside
    if (cstr.indexOf("q") >= 0) castling |= 8; // Black queenside

    const ep = parts[3] && parts[3] !== "-" ? parseSq(parts[3]) : -1;

    let halfmove = parseInt(parts[4] || "0", 10);
    if (isNaN(halfmove)) halfmove = 0;

    let fullmove = parseInt(parts[5] || "1", 10);
    if (isNaN(fullmove)) fullmove = 1;

    let kingW = -1;
    let kingB = -1;

    for (let i = 0; i < 64; i++) {
      if (b[i] === KING) kingW = i;
      else if (b[i] === -KING) kingB = i;
    }

    return {
      b,
      turn,
      castling,
      ep,
      halfmove,
      fullmove,
      kingW,
      kingB
    };
  }

  function isAttacked(st, sq, byColor) {
    const b = st.b;
    const r = sq >> 3;
    const c = sq & 7;

    // Pawn attacks
    const pawnRow = byColor === 1 ? r + 1 : r - 1;
    if (pawnRow >= 0 && pawnRow < 8) {
      const base = pawnRow * 8;
      if (c > 0 && b[base + c - 1] === byColor * PAWN) return true;
      if (c < 7 && b[base + c + 1] === byColor * PAWN) return true;
    }

    // Knight attacks
    const knightDr = [-2, -2, -1, -1, 1, 1, 2, 2];
    const knightDc = [-1, 1, -2, 2, -2, 2, -1, 1];

    for (let i = 0; i < 8; i++) {
      const rr = r + knightDr[i];
      const cc = c + knightDc[i];
      if (
        rr >= 0 && rr < 8 &&
        cc >= 0 && cc < 8 &&
        b[rr * 8 + cc] === byColor * KNIGHT
      ) {
        return true;
      }
    }

    // King attacks
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (
          rr >= 0 && rr < 8 &&
          cc >= 0 && cc < 8 &&
          b[rr * 8 + cc] === byColor * KING
        ) {
          return true;
        }
      }
    }

    // Rook / queen attacks
    const orth = [
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];

    for (let i = 0; i < 4; i++) {
      let rr = r + orth[i][0];
      let cc = c + orth[i][1];

      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const p = b[rr * 8 + cc];
        if (p !== 0) {
          if (p === byColor * ROOK || p === byColor * QUEEN) return true;
          break;
        }
        rr += orth[i][0];
        cc += orth[i][1];
      }
    }

    // Bishop / queen attacks
    const diag = [
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    for (let i = 0; i < 4; i++) {
      let rr = r + diag[i][0];
      let cc = c + diag[i][1];

      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const p = b[rr * 8 + cc];
        if (p !== 0) {
          if (p === byColor * BISHOP || p === byColor * QUEEN) return true;
          break;
        }
        rr += diag[i][0];
        cc += diag[i][1];
      }
    }

    return false;
  }

  function inCheck(st, color) {
    const kingSq = color === 1 ? st.kingW : st.kingB;
    if (kingSq < 0) return false;
    return isAttacked(st, kingSq, -color);
  }

  function makeMove(st, m) {
    const b = st.b;
    const from = m.from;
    const to = m.to;

    const undo = {
      changed: [],
      castling: st.castling,
      ep: st.ep,
      halfmove: st.halfmove,
      turn: st.turn,
      kingW: st.kingW,
      kingB: st.kingB
    };

    const piece = b[from];
    const color = piece > 0 ? 1 : -1;
    const type = piece > 0 ? piece : -piece;
    const oldEp = st.ep;

    let captureSq = to;
    if (
      type === PAWN &&
      to === oldEp &&
      b[to] === 0 &&
      ((to & 7) !== (from & 7))
    ) {
      captureSq = to + (color === 1 ? 8 : -8);
    }

    const isCapture = b[to] !== 0 || captureSq !== to;

    function setSq(sq, val) {
      undo.changed.push(sq, b[sq]);
      b[sq] = val;
    }

    if (captureSq !== to) setSq(captureSq, 0);

    setSq(from, 0);

    let placed = piece;

    if (
      type === PAWN &&
      (
        (color === 1 && to < 8) ||
        (color === -1 && to >= 56)
      )
    ) {
      const promo = m.promo || QUEEN;
      placed = color * promo;
    }

    setSq(to, placed);

    if (type === KING) {
      if (color === 1) st.kingW = to;
      else st.kingB = to;

      if (Math.abs(to - from) === 2) {
        if (color === 1) {
          if (to === 62) {
            setSq(63, 0);
            setSq(61, color * ROOK);
          } else if (to === 58) {
            setSq(56, 0);
            setSq(59, color * ROOK);
          }
        } else {
          if (to === 6) {
            setSq(7, 0);
            setSq(5, color * ROOK);
          } else if (to === 2) {
            setSq(0, 0);
            setSq(3, color * ROOK);
          }
        }
      }
    }

    let cr = st.castling;

    if (type === KING) {
      if (color === 1) cr &= ~3;
      else cr &= ~12;
    }

    if (from === 63) cr &= ~1;
    if (from === 56) cr &= ~2;
    if (from === 7) cr &= ~4;
    if (from === 0) cr &= ~8;

    if (to === 63) cr &= ~1;
    if (to === 56) cr &= ~2;
    if (to === 7) cr &= ~4;
    if (to === 0) cr &= ~8;

    if (captureSq === 63) cr &= ~1;
    if (captureSq === 56) cr &= ~2;
    if (captureSq === 7) cr &= ~4;
    if (captureSq === 0) cr &= ~8;

    st.castling = cr;

    if (type === PAWN && Math.abs(to - from) === 16) {
      st.ep = (from + to) >> 1;
    } else {
      st.ep = -1;
    }

    if (type === PAWN || isCapture) {
      st.halfmove = 0;
    } else {
      st.halfmove++;
    }

    st.turn = -st.turn;

    return undo;
  }

  function unmakeMove(st, undo) {
    const changed = undo.changed;

    for (let i = changed.length - 2; i >= 0; i -= 2) {
      st.b[changed[i]] = changed[i + 1];
    }

    st.castling = undo.castling;
    st.ep = undo.ep;
    st.halfmove = undo.halfmove;
    st.turn = undo.turn;
    st.kingW = undo.kingW;
    st.kingB = undo.kingB;
  }

  function addPromotions(from, to, moves) {
    moves.push({ from, to, promo: QUEEN });
    moves.push({ from, to, promo: KNIGHT });
    moves.push({ from, to, promo: ROOK });
    moves.push({ from, to, promo: BISHOP });
  }

  function generatePseudoMoves(st) {
    const b = st.b;
    const color = st.turn;
    const moves = [];

    const pawnDir = color === 1 ? -1 : 1;
    const startRow = color === 1 ? 6 : 1;
    const promotionRow = color === 1 ? 0 : 7;

    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (p === 0) continue;

      const pieceColor = p > 0 ? 1 : -1;
      if (pieceColor !== color) continue;

      const type = p > 0 ? p : -p;
      const r = sq >> 3;
      const c = sq & 7;

      if (type === PAWN) {
        const nr = r + pawnDir;

        if (nr >= 0 && nr < 8) {
          const oneSq = nr * 8 + c;

          if (b[oneSq] === 0) {
            if (nr === promotionRow) {
              addPromotions(sq, oneSq, moves);
            } else {
              moves.push({ from: sq, to: oneSq, promo: 0 });

              if (r === startRow) {
                const twoSq = (r + 2 * pawnDir) * 8 + c;
                if (b[twoSq] === 0) {
                  moves.push({ from: sq, to: twoSq, promo: 0 });
                }
              }
            }
          }
        }

        for (let dc = -1; dc <= 1; dc += 2) {
          const nc = c + dc;
          if (nc < 0 || nc >= 8) continue;

          const rr = r + pawnDir;
          if (rr < 0 || rr >= 8) continue;

          const targetSq = rr * 8 + nc;
          const target = b[targetSq];

          if (target !== 0 && (target > 0 ? 1 : -1) !== color) {
            if (rr === promotionRow) {
              addPromotions(sq, targetSq, moves);
            } else {
              moves.push({ from: sq, to: targetSq, promo: 0 });
            }
          } else if (targetSq === st.ep && target === 0) {
            moves.push({ from: sq, to: targetSq, promo: 0 });
          }
        }
      } else if (type === KNIGHT) {
        const dr = [-2, -2, -1, -1, 1, 1, 2, 2];
        const dc = [-1, 1, -2, 2, -2, 2, -1, 1];

        for (let i = 0; i < 8; i++) {
          const rr = r + dr[i];
          const cc = c + dc[i];

          if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8) continue;

          const targetSq = rr * 8 + cc;
          const target = b[targetSq];

          if (target === 0 || (target > 0 ? 1 : -1) !== color) {
            moves.push({ from: sq, to: targetSq, promo: 0 });
          }
        }
      } else if (type === KING) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            const rr = r + dr;
            const cc = c + dc;

            if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8) continue;

            const targetSq = rr * 8 + cc;
            const target = b[targetSq];

            if (target === 0 || (target > 0 ? 1 : -1) !== color) {
              moves.push({ from: sq, to: targetSq, promo: 0 });
            }
          }
        }

        if (color === 1 && sq === 60) {
          if (
            (st.castling & 1) !== 0 &&
            b[61] === 0 &&
            b[62] === 0 &&
            b[63] === ROOK &&
            !isAttacked(st, 60, -1) &&
            !isAttacked(st, 61, -1) &&
            !isAttacked(st, 62, -1)
          ) {
            moves.push({ from: 60, to: 62, promo: 0 });
          }

          if (
            (st.castling & 2) !== 0 &&
            b[59] === 0 &&
            b[58] === 0 &&
            b[57] === 0 &&
            b[56] === ROOK &&
            !isAttacked(st, 60, -1) &&
            !isAttacked(st, 59, -1) &&
            !isAttacked(st, 58, -1)
          ) {
            moves.push({ from: 60, to: 58, promo: 0 });
          }
        } else if (color === -1 && sq === 4) {
          if (
            (st.castling & 4) !== 0 &&
            b[5] === 0 &&
            b[6] === 0 &&
            b[7] === -ROOK &&
            !isAttacked(st, 4, 1) &&
            !isAttacked(st, 5, 1) &&
            !isAttacked(st, 6, 1)
          ) {
            moves.push({ from: 4, to: 6, promo: 0 });
          }

          if (
            (st.castling & 8) !== 0 &&
            b[3] === 0 &&
            b[2] === 0 &&
            b[1] === 0 &&
            b[0] === -ROOK &&
            !isAttacked(st, 4, 1) &&
            !isAttacked(st, 3, 1) &&
            !isAttacked(st, 2, 1)
          ) {
            moves.push({ from: 4, to: 2, promo: 0 });
          }
        }
      } else {
        let dirs;

        if (type === BISHOP) {
          dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        } else if (type === ROOK) {
          dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        } else if (type === QUEEN) {
          dirs = [
            [-1, -1], [-1, 1], [1, -1], [1, 1],
            [-1, 0], [1, 0], [0, -1], [0, 1]
          ];
        } else {
          continue;
        }

        for (let i = 0; i < dirs.length; i++) {
          let rr = r + dirs[i][0];
          let cc = c + dirs[i][1];

          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            const targetSq = rr * 8 + cc;
            const target = b[targetSq];

            if (target === 0) {
              moves.push({ from: sq, to: targetSq, promo: 0 });
            } else {
              if ((target > 0 ? 1 : -1) !== color) {
                moves.push({ from: sq, to: targetSq, promo: 0 });
              }
              break;
            }

            rr += dirs[i][0];
            cc += dirs[i][1];
          }
        }
      }
    }

    return moves;
  }

  function getLegalMoves(st) {
    const pseudo = generatePseudoMoves(st);
    const color = st.turn;
    const legal = [];

    for (let i = 0; i < pseudo.length; i++) {
      const m = pseudo[i];
      const undo = makeMove(st, m);

      if (!inCheck(st, color)) {
        legal.push(m);
      }

      unmakeMove(st, undo);
    }

    return legal;
  }

  function evaluateWhite(st) {
    const b = st.b;

    let score = 0;
    let whiteBishops = 0;
    let blackBishops = 0;
    let nonKingMaterial = 0;

    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (p === 0) continue;

      const color = p > 0 ? 1 : -1;
      const type = p > 0 ? p : -p;

      if (type === KING) continue;

      const val = VALUE[type];
      nonKingMaterial += val;
      score += color * val;

      const row = sq >> 3;
      const col = sq & 7;
      const ownRow = color === 1 ? 7 - row : row;
      const centerDist = Math.abs(row - 3.5) + Math.abs(col - 3.5);

      let positional = 0;

      if (type === PAWN) {
        positional = ownRow * 8;

        if (col === 3 || col === 4) positional += 6;
        else if (col === 2 || col === 5) positional += 2;
      } else if (type === KNIGHT) {
        positional = 36 - centerDist * 10;
      } else if (type === BISHOP) {
        positional = 24 - centerDist * 6;
        if (color === 1) whiteBishops++;
        else blackBishops++;
      } else if (type === ROOK) {
        positional = ownRow * 2;
        if (ownRow === 6) positional += 12;
      } else if (type === QUEEN) {
        positional = 18 - centerDist * 3;
      }

      score += color * positional;
    }

    if (whiteBishops >= 2) score += 25;
    if (blackBishops >= 2) score -= 25;

    const endgame = nonKingMaterial < 2400;

    function kingEval(sq, color) {
      if (sq < 0) return 0;

      const row = sq >> 3;
      const col = sq & 7;

      let s = 0;

      if (endgame) {
        const centerDist = Math.abs(row - 3.5) + Math.abs(col - 3.5);
        s += 40 - centerDist * 10;
      } else {
        const ownRow = color === 1 ? 7 - row : row;

        if (ownRow <= 1) s += 20;
        else if (ownRow <= 2) s += 5;
        else s -= 10;

        if (col === 6 || col === 2) s += 12;
        else if (col === 5 || col === 3) s += 4;
        else if (col <= 1 || col >= 7) s -= 4;

        const dir = color === 1 ? -1 : 1;
        const shieldRow = row + dir;

        if (shieldRow >= 0 && shieldRow < 8) {
          for (let dc = -1; dc <= 1; dc++) {
            const cc = col + dc;

            if (cc >= 0 && cc < 8) {
              if (b[shieldRow * 8 + cc] * color === PAWN) {
                s += 8;
              }
            }
          }
        }
      }

      return s;
    }

    score += kingEval(st.kingW, 1);
    score -= kingEval(st.kingB, -1);

    // Small tempo bonus
    score += st.turn * 10;

    return score;
  }

  function evaluateSide(st) {
    const e = evaluateWhite(st);
    return st.turn === 1 ? e : -e;
  }

  function captureValue(st, m) {
    const p = st.b[m.from];
    if (!p) return 0;

    const color = p > 0 ? 1 : -1;
    const type = p > 0 ? p : -p;

    let target = st.b[m.to];

    if (
      type === PAWN &&
      m.to === st.ep &&
      target === 0 &&
      ((m.to & 7) !== (m.from & 7))
    ) {
      const captureSq = m.to + (color === 1 ? 8 : -8);
      target = st.b[captureSq];
    }

    if (target !== 0 && (target > 0 ? 1 : -1) !== color) {
      const targetType = target > 0 ? target : -target;
      return VALUE[targetType] || 0;
    }

    return 0;
  }

  const killer1 = new Int32Array(64);
  const killer2 = new Int32Array(64);
  const history = new Int32Array(4096);

  function scoreMove(st, m, ply) {
    let score = 0;

    if (m.promo) {
      score += 80000 + (VALUE[m.promo] || 0) * 50;
    }

    const cap = captureValue(st, m);

    if (cap > 0) {
      const p = st.b[m.from];
      const attackerValue = p ? VALUE[Math.abs(p)] : 0;
      score += 100000 + cap * 10 - attackerValue;
    }

    const key = (m.from << 6) | m.to;

    if (ply >= 0 && ply < 64) {
      if (killer1[ply] === key) score += 7000;
      else if (killer2[ply] === key) score += 3500;
    }

    score += history[key] >> 2;

    return score;
  }

  function sortMoves(moves, st, ply) {
    for (let i = 0; i < moves.length; i++) {
      moves[i]._score = scoreMove(st, moves[i], ply);
    }

    moves.sort((a, b) => b._score - a._score);

    return moves;
  }

  let nodes = 0;
  let deadline = 0;
  const STOP = {};

  function quiesce(st, alpha, beta, ply) {
    nodes++;

    if ((nodes & 1023) === 0 && Date.now() > deadline) {
      throw STOP;
    }

    if (st.halfmove >= 100) return 0;

    const inChk = inCheck(st, st.turn);
    const moves = getLegalMoves(st);

    if (moves.length === 0) {
      return inChk ? -MATE + ply : 0;
    }

    const stand = evaluateSide(st);
    let best;

    if (!inChk) {
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      best = stand;
    } else {
      best = -INF;
    }

    if (ply >= 10) {
      return inChk ? stand : alpha;
    }

    sortMoves(moves, st, ply);

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];

      if (!inChk && !m.promo && captureValue(st, m) === 0) {
        continue;
      }

      const undo = makeMove(st, m);
      const score = -quiesce(st, -beta, -alpha, ply + 1);
      unmakeMove(st, undo);

      if (score > best) best = score;
      if (score > alpha) alpha = score;

      if (alpha >= beta) return alpha;
    }

    return best;
  }

  function negamax(st, depth, alpha, beta, ply) {
    nodes++;

    if ((nodes & 1023) === 0 && Date.now() > deadline) {
      throw STOP;
    }

    if (st.halfmove >= 100) return 0;

    if (depth <= 0) {
      return quiesce(st, alpha, beta, ply);
    }

    const color = st.turn;
    const moves = getLegalMoves(st);

    if (moves.length === 0) {
      return inCheck(st, color) ? -MATE + ply : 0;
    }

    sortMoves(moves, st, ply);

    let best = -INF;

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const key = (m.from << 6) | m.to;

      const undo = makeMove(st, m);
      const score = -negamax(st, depth - 1, -beta, -alpha, ply + 1);
      unmakeMove(st, undo);

      if (score > best) best = score;
      if (score > alpha) alpha = score;

      if (alpha >= beta) {
        const cap = captureValue(st, m);

        if (cap === 0 && !m.promo && ply >= 0 && ply < 64) {
          if (killer1[ply] !== key) {
            killer2[ply] = killer1[ply];
            killer1[ply] = key;
          }

          history[key] += depth * depth;
          if (history[key] > 1000000) history[key] = 1000000;
        }

        break;
      }
    }

    return best;
  }

  function convertMove(m) {
    if (!m || !m.from || !m.to) return null;

    let promo = 0;

    if (m.promotion) {
      const t = CHAR_TO_PIECE[(m.promotion + "").toLowerCase()];
      if (t) promo = t;
    } else if (m.promo) {
      const t = CHAR_TO_PIECE[(m.promo + "").toLowerCase()];
      if (t) promo = t;
    }

    return {
      from: parseSq(m.from),
      to: parseSq(m.to),
      promo
    };
  }

  const st = parseFen(fen);

  const candidates = [];

  for (let i = 0; i < legalMoves.length; i++) {
    const om = legalMoves[i];
    const im = convertMove(om);

    if (!im) continue;

    let sc = scoreMove(st, im, 0);

    if (om.san) {
      if (om.san.indexOf("+") >= 0) sc += 500;
    }

    candidates.push({
      orig: om,
      im,
      score: sc
    });
  }

  if (candidates.length === 0) return legalMoves[0];
  if (candidates.length === 1) return candidates[0].orig;

  candidates.sort((a, b) => b.score - a.score);

  let bestOrig = candidates[0].orig;

  nodes = 0;

  const timeLimit =
    chessState &&
    chessState.fullMoves &&
    chessState.fullMoves <= 10
      ? 260
      : 320;

  deadline = Date.now() + timeLimit;

  for (let depth = 1; depth <= 5; depth++) {
    let alpha = -INF;
    let localBest = null;
    let localScore = -INF;
    let completed = true;

    try {
      for (let i = 0; i < candidates.length; i++) {
        const cand = candidates[i];
        const movingColor = st.turn;

        const undo = makeMove(st, cand.im);

        if (inCheck(st, movingColor)) {
          unmakeMove(st, undo);
          continue;
        }

        const score = -negamax(
          st,
          depth - 1,
          -INF,
          -alpha,
          1
        );

        unmakeMove(st, undo);

        cand.score = score;

        if (score > localScore) {
          localScore = score;
          localBest = cand;
        }

        if (score > alpha) alpha = score;
      }
    } catch (err) {
      if (err !== STOP) throw err;
      completed = false;
    }

    if (completed && localBest) {
      bestOrig = localBest.orig;

      candidates.sort((a, b) => (b.score || 0) - (a.score || 0));

      const idx = candidates.indexOf(localBest);
      if (idx > 0) {
        candidates.splice(idx, 1);
        candidates.unshift(localBest);
      }
    } else {
      break;
    }

    if (localScore > MATE - 1000) break;
    if (Date.now() > deadline) break;
  }

  return bestOrig;
}`,
  },
  {
    id: 'claude-sonnet-55',
    name: 'Claude Sonnet 5.5',
    modelName: 'Anthropic Claude Sonnet',
    description: 'Engine 0x88 với Zobrist Hashing, Transposition Table 512K, Aspiration Windows, Null-Move Pruning, Cấu trúc tốt & Sách khai cuộc mini.',
    avatar: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=120&auto=format&fit=crop&q=80',
    colorTheme: 'from-amber-500 to-orange-700',
    eloEstimate: 2050,
    isBuiltIn: false,
    wins: 0,
    draws: 0,
    losses: 0,
    code: `function getMove(fen, legalMoves, chessState) {
  'use strict';

  /* ================== CẤU HÌNH ================== */
  var TIME_MS = 1000; // Thời gian suy nghĩ tối đa cho mỗi nước đi (mili-giây)

  var startTime = Date.now();
  var i;

  if (!legalMoves || legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  // 1) Chiếu hết ngay trong 1 nước -> đi luôn
  for (i = 0; i < legalMoves.length; i++) {
    var sanText = legalMoves[i].san;
    if (sanText && sanText.charAt(sanText.length - 1) === '#') return legalMoves[i];
  }

  // 2) Sách khai cuộc mini (tạo sự đa dạng ở nước đầu)
  var booked = bookMove();
  if (booked) return booked;

  // 3) Engine tìm kiếm alpha-beta
  try {
    var engine = getMove._engine;
    if (!engine) engine = getMove._engine = createEngine();
    var result = engine.think(fen, legalMoves, TIME_MS, startTime);
    if (result) return result;
  } catch (err) { /* rơi xuống phương án dự phòng */ }

  // 4) Dự phòng: chọn nước đi tham lam
  return fallbackMove();

  /* ------------------------------------------------------------------ */
  function bookMove() {
    if (typeof fen !== 'string') return null;
    var parts = fen.split(' ');
    var key = parts[0] + ' ' + parts[1];
    var BOOK = {
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': ['e4', 'd4', 'Nf3', 'c4'],
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': ['e5', 'c5', 'e6', 'c6'],
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b': ['d5', 'Nf6'],
      'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b': ['d5', 'Nf6'],
      'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b': ['e5', 'Nf6', 'c5']
    };
    var list = BOOK[key];
    if (!list) return null;
    var san = list[Math.floor(Math.random() * list.length)];
    for (var k = 0; k < legalMoves.length; k++) {
      if (legalMoves[k].san === san) return legalMoves[k];
    }
    return null;
  }

  function fallbackMove() {
    var V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    var best = legalMoves[0], bestScore = -1e9;
    for (var k = 0; k < legalMoves.length; k++) {
      var m = legalMoves[k];
      var s = Math.random();
      if (m.captured) s += 10 * V[m.captured] - V[m.piece];
      if (m.promotion) s += m.promotion === 'q' ? 80 : 5;
      if (m.san && m.san.indexOf('+') >= 0) s += 3;
      if (m.san && m.san.charAt(0) === 'O') s += 2;
      if (s > bestScore) { bestScore = s; best = m; }
    }
    return best;
  }

  /* ================================================================== */
  /*                     ENGINE (tạo một lần, dùng lại)                  */
  /* ================================================================== */
  function createEngine() {
    var INF = 32000, MATE = 30000, MATE_MAX = 29500, MAXPLY = 100;
    var TT_SIZE = 1 << 19, TT_MASK = TT_SIZE - 1;
    var MAX_DEPTH = 40;

    // Bàn cờ 0x88: ô = hàng*16 + cột, hàng 0 = hạng 8 (a8 = 0, h1 = 119)
    // Quân: trắng dương (1..6 = P N B R Q K), đen âm.
    var KN = [-33, -31, -18, -14, 14, 18, 31, 33];
    var KG = [-17, -16, -15, -1, 1, 15, 16, 17];
    var DB = [-17, -15, 15, 17];
    var DR = [-16, -1, 1, 16];
    var CVAL = [0, 100, 320, 330, 500, 900, 0];

    /* ---------- Bảng điểm vị trí (PST) ---------- */
    var PST = [null,
      [ 0,  0,  0,  0,  0,  0,  0,  0,
       50, 50, 50, 50, 50, 50, 50, 50,
       10, 10, 20, 30, 30, 20, 10, 10,
        5,  5, 10, 25, 25, 10,  5,  5,
        0,  0,  0, 20, 20,  0,  0,  0,
        5, -5,-10,  0,  0,-10, -5,  5,
        5, 10, 10,-20,-20, 10, 10,  5,
        0,  0,  0,  0,  0,  0,  0,  0],
      [-50,-40,-30,-30,-30,-30,-40,-50,
       -40,-20,  0,  0,  0,  0,-20,-40,
       -30,  0, 10, 15, 15, 10,  0,-30,
       -30,  5, 15, 20, 20, 15,  5,-30,
       -30,  0, 15, 20, 20, 15,  0,-30,
       -30,  5, 10, 15, 15, 10,  5,-30,
       -40,-20,  0,  5,  5,  0,-20,-40,
       -50,-40,-30,-30,-30,-30,-40,-50],
      [-20,-10,-10,-10,-10,-10,-10,-20,
       -10,  0,  0,  0,  0,  0,  0,-10,
       -10,  0,  5, 10, 10,  5,  0,-10,
       -10,  5,  5, 10, 10,  5,  5,-10,
       -10,  0, 10, 10, 10, 10,  0,-10,
       -10, 10, 10, 10, 10, 10, 10,-10,
       -10,  5,  0,  0,  0,  0,  5,-10,
       -20,-10,-10,-10,-10,-10,-10,-20],
      [  0,  0,  0,  0,  0,  0,  0,  0,
         5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
         0,  0,  0,  5,  5,  0,  0,  0],
      [-20,-10,-10, -5, -5,-10,-10,-20,
       -10,  0,  0,  0,  0,  0,  0,-10,
       -10,  0,  5,  5,  5,  5,  0,-10,
        -5,  0,  5,  5,  5,  5,  0, -5,
         0,  0,  5,  5,  5,  5,  0, -5,
       -10,  5,  5,  5,  5,  5,  0,-10,
       -10,  0,  5,  0,  0,  0,  0,-10,
       -20,-10,-10, -5, -5,-10,-10,-20],
      [-30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30,
       -30,-40,-40,-50,-50,-40,-40,-30,
       -20,-30,-30,-40,-40,-30,-30,-20,
       -10,-20,-20,-20,-20,-20,-20,-10,
        20, 20,  0,  0,  0,  0, 20, 20,
        20, 30, 10,  0,  0, 10, 30, 20]
    ];
    var KING_EG = [
      -50,-40,-30,-20,-20,-30,-40,-50,
      -30,-20,-10,  0,  0,-10,-20,-30,
      -30,-10, 20, 30, 30, 20,-10,-30,
      -30,-10, 30, 40, 40, 30,-10,-30,
      -30,-10, 30, 40, 40, 30,-10,-30,
      -30,-10, 20, 30, 30, 20,-10,-30,
      -30,-30,  0,  0,  0,  0,-30,-30,
      -50,-30,-30,-30,-30,-30,-30,-50];
    var VMG = [0, 100, 320, 330, 500, 900, 0];
    var VEG = [0, 120, 300, 320, 520, 920, 0];
    var PASS_MG = [0, 5, 10, 20, 35, 60, 0];
    var PASS_EG = [0, 10, 20, 40, 75, 120, 0];

    // Bảng điểm (góc nhìn trắng) theo [quân+6][ô]
    var mgT = new Int32Array(13 * 128), egT = new Int32Array(13 * 128);
    (function () {
      for (var t = 1; t <= 6; t++) {
        for (var sq = 0; sq < 128; sq++) {
          if (sq & 0x88) continue;
          var r = sq >> 4, f = sq & 7;
          var wi = r * 8 + f, bi = (7 - r) * 8 + f;
          var egTab = t === 6 ? KING_EG : PST[t];
          mgT[(t + 6) * 128 + sq] = VMG[t] + PST[t][wi];
          egT[(t + 6) * 128 + sq] = VEG[t] + egTab[wi];
          mgT[(6 - t) * 128 + sq] = -(VMG[t] + PST[t][bi]);
          egT[(6 - t) * 128 + sq] = -(VEG[t] + egTab[bi]);
        }
      }
    })();

    /* ---------- Zobrist ---------- */
    var seed = 0x2F6E2B1;
    function rnd() {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return seed | 0;
    }
    var zLo = new Int32Array(13 * 128), zHi = new Int32Array(13 * 128);
    var zCLo = new Int32Array(16), zCHi = new Int32Array(16);
    var zEpLo = new Int32Array(8), zEpHi = new Int32Array(8);
    var zSLo, zSHi, zi;
    for (zi = 0; zi < 20; zi++) rnd();
    for (zi = 0; zi < zLo.length; zi++) { zLo[zi] = rnd(); zHi[zi] = rnd(); }
    for (zi = 0; zi < 16; zi++) { zCLo[zi] = rnd(); zCHi[zi] = rnd(); }
    for (zi = 0; zi < 8; zi++) { zEpLo[zi] = rnd(); zEpHi[zi] = rnd(); }
    zSLo = rnd(); zSHi = rnd();

    /* ---------- Trạng thái ---------- */
    var b = new Int8Array(128);
    var kingSq = new Int32Array(2);
    var cnt = new Int8Array(13);
    var stm = 1, castle = 0, ep = -1, half = 0;
    var hLo = 0, hHi = 0, mg = 0, eg = 0;

    var STK = 512;
    var stCap = new Int8Array(STK), stCastle = new Uint8Array(STK), stEp = new Int16Array(STK);
    var stHalf = new Int16Array(STK), stLo = new Int32Array(STK), stHi = new Int32Array(STK);
    var stMg = new Int32Array(STK), stEg = new Int32Array(STK);
    var sp = 0;

    var cmask = new Uint8Array(128);
    cmask.fill(15);
    cmask[116] = 12; cmask[119] = 14; cmask[112] = 13;
    cmask[4] = 3; cmask[7] = 11; cmask[0] = 7;

    // Lịch sử ván đấu (các thế cờ đã gặp ở lượt của bot) để tránh/ nhận biết lặp thế
    var ghLo = new Int32Array(256), ghHi = new Int32Array(256), ghN = 0, ghUse = 0;

    // Bảng chuyển vị
    var ttHi = new Int32Array(TT_SIZE), ttMv = new Int32Array(TT_SIZE), ttSc = new Int32Array(TT_SIZE);
    var ttDp = new Int8Array(TT_SIZE), ttFl = new Uint8Array(TT_SIZE);

    var mvBuf = [], scBuf = [];
    for (zi = 0; zi < MAXPLY + 6; zi++) { mvBuf.push(new Int32Array(256)); scBuf.push(new Int32Array(256)); }
    var killers = new Int32Array((MAXPLY + 6) * 2);
    var history = new Int32Array(13 * 128);

    var nodes = 0, stopped = false, T0 = 0, tLimit = 0, contempt = 0;
    var rsMove = 0, rsScore = 0, rsFound = false;
    var rootMoves = [], rootN = 0;

    // bộ đệm cho evaluate
    var wC = new Int8Array(8), bC = new Int8Array(8), wMax = new Int8Array(8), bMin = new Int8Array(8);
    var wpSq = new Int32Array(64), bpSq = new Int32Array(64), wrSq = new Int32Array(64), brSq = new Int32Array(64);

    /* ---------- FEN & hash ---------- */
    function epHashed() {
      if (ep < 0) return false;
      if (stm > 0) return b[ep + 15] === 1 || b[ep + 17] === 1;
      return b[ep - 15] === -1 || b[ep - 17] === -1;
    }

    function computeHash() {
      var lo = 0, hi = 0, sq, p;
      for (sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        p = b[sq];
        if (p !== 0) { lo ^= zLo[((p + 6) << 7) + sq]; hi ^= zHi[((p + 6) << 7) + sq]; }
      }
      if (stm < 0) { lo ^= zSLo; hi ^= zSHi; }
      lo ^= zCLo[castle]; hi ^= zCHi[castle];
      hLo = lo; hHi = hi;
      if (ep >= 0 && epHashed()) { hLo ^= zEpLo[ep & 7]; hHi ^= zEpHi[ep & 7]; }
    }

    function setFen(fen) {
      var parts = fen.split(' ');
      var rows = parts[0].split('/');
      var r, f, k, ch, t, p, sq;
      b.fill(0); cnt.fill(0);
      mg = 0; eg = 0;
      for (r = 0; r < 8; r++) {
        var row = rows[r] || '';
        f = 0;
        for (k = 0; k < row.length; k++) {
          ch = row.charAt(k);
          if (ch >= '1' && ch <= '8') { f += (ch.charCodeAt(0) - 48); continue; }
          var lower = ch.toLowerCase();
          t = 'pnbrqk'.indexOf(lower) + 1;
          p = (ch === lower) ? -t : t;
          sq = r * 16 + f;
          b[sq] = p; cnt[p + 6]++;
          mg += mgT[((p + 6) << 7) + sq]; eg += egT[((p + 6) << 7) + sq];
          if (t === 6) kingSq[p > 0 ? 0 : 1] = sq;
          f++;
        }
      }
      stm = parts[1] === 'b' ? -1 : 1;
      var cs = parts[2] || '-';
      castle = 0;
      if (cs.indexOf('K') >= 0 && b[116] === 6 && b[119] === 4) castle |= 1;
      if (cs.indexOf('Q') >= 0 && b[116] === 6 && b[112] === 4) castle |= 2;
      if (cs.indexOf('k') >= 0 && b[4] === -6 && b[7] === -4) castle |= 4;
      if (cs.indexOf('q') >= 0 && b[4] === -6 && b[0] === -4) castle |= 8;
      ep = -1;
      if (parts[3] && parts[3] !== '-' && parts[3].length === 2) {
        ep = (8 - (parts[3].charCodeAt(1) - 48)) * 16 + (parts[3].charCodeAt(0) - 97);
      }
      half = parseInt(parts[4], 10) || 0;
      computeHash();
    }

    /* ---------- Tấn công / chiếu ---------- */
    function attacked(sq, by) {
      var i, t, d, p;
      if (by > 0) {
        t = sq + 15; if (!(t & 0x88) && b[t] === 1) return true;
        t = sq + 17; if (!(t & 0x88) && b[t] === 1) return true;
      } else {
        t = sq - 15; if (!(t & 0x88) && b[t] === -1) return true;
        t = sq - 17; if (!(t & 0x88) && b[t] === -1) return true;
      }
      var kn = by * 2, kg = by * 6;
      for (i = 0; i < 8; i++) {
        t = sq + KN[i]; if (!(t & 0x88) && b[t] === kn) return true;
        t = sq + KG[i]; if (!(t & 0x88) && b[t] === kg) return true;
      }
      var bi = by * 3, ro = by * 4, qu = by * 5;
      for (i = 0; i < 4; i++) {
        d = DB[i]; t = sq + d;
        while (!(t & 0x88)) {
          p = b[t];
          if (p !== 0) { if (p === bi || p === qu) return true; break; }
          t += d;
        }
        d = DR[i]; t = sq + d;
        while (!(t & 0x88)) {
          p = b[t];
          if (p !== 0) { if (p === ro || p === qu) return true; break; }
          t += d;
        }
      }
      return false;
    }

    function inCheckNow() { return attacked(kingSq[stm > 0 ? 0 : 1], -stm); }

    /* ---------- Sinh nước đi (giả hợp lệ) ----------
       Mã hoá: from | to<<7 | promo<<14 | flag<<17 | captured<<20
       flag: 1 = en passant, 2 = nhập thành, 3 = tốt đi 2 ô */
    function gen(ply, caps) {
      var list = mvBuf[ply], n = 0, side = stm;
      var sq, p, k, tt, v, d, fwd, to, offs, dirs, promoNext, row;
      for (sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        p = b[sq] * side;
        if (p <= 0) continue;
        if (p === 1) {
          fwd = side > 0 ? -16 : 16;
          row = sq >> 4;
          promoNext = side > 0 ? row === 1 : row === 6;
          to = sq + fwd;
          if (!(to & 0x88) && b[to] === 0) {
            if (promoNext) {
              list[n++] = sq | (to << 7) | (5 << 14);
              if (!caps) {
                list[n++] = sq | (to << 7) | (4 << 14);
                list[n++] = sq | (to << 7) | (3 << 14);
                list[n++] = sq | (to << 7) | (2 << 14);
              }
            } else if (!caps) {
              list[n++] = sq | (to << 7);
              if ((side > 0 ? row === 6 : row === 1) && b[to + fwd] === 0) {
                list[n++] = sq | ((to + fwd) << 7) | (3 << 17);
              }
            }
          }
          for (k = -1; k <= 1; k += 2) {
            tt = sq + fwd + k;
            if (tt & 0x88) continue;
            v = b[tt] * side;
            if (v < 0) {
              if (promoNext) {
                list[n++] = sq | (tt << 7) | (5 << 14) | ((-v) << 20);
                if (!caps) {
                  list[n++] = sq | (tt << 7) | (4 << 14) | ((-v) << 20);
                  list[n++] = sq | (tt << 7) | (3 << 14) | ((-v) << 20);
                  list[n++] = sq | (tt << 7) | (2 << 14) | ((-v) << 20);
                }
              } else {
                list[n++] = sq | (tt << 7) | ((-v) << 20);
              }
            } else if (v === 0 && tt === ep && b[tt - fwd] === -side) {
              list[n++] = sq | (tt << 7) | (1 << 17) | (1 << 20);
            }
          }
        } else if (p === 2 || p === 6) {
          offs = p === 2 ? KN : KG;
          for (k = 0; k < 8; k++) {
            tt = sq + offs[k];
            if (tt & 0x88) continue;
            v = b[tt] * side;
            if (v === 0) { if (!caps) list[n++] = sq | (tt << 7); }
            else if (v < 0) list[n++] = sq | (tt << 7) | ((-v) << 20);
          }
        } else {
          dirs = p === 3 ? DB : (p === 4 ? DR : KG);
          var nd = dirs.length;
          for (k = 0; k < nd; k++) {
            d = dirs[k]; tt = sq + d;
            while (!(tt & 0x88)) {
              v = b[tt] * side;
              if (v === 0) { if (!caps) list[n++] = sq | (tt << 7); }
              else { if (v < 0) list[n++] = sq | (tt << 7) | ((-v) << 20); break; }
              tt += d;
            }
          }
        }
      }
      if (!caps) {
        if (side > 0) {
          if ((castle & 1) && b[116] === 6 && b[119] === 4 && b[117] === 0 && b[118] === 0 &&
              !attacked(116, -1) && !attacked(117, -1) && !attacked(118, -1))
            list[n++] = 116 | (118 << 7) | (2 << 17);
          if ((castle & 2) && b[116] === 6 && b[112] === 4 && b[113] === 0 && b[114] === 0 && b[115] === 0 &&
              !attacked(116, -1) && !attacked(115, -1) && !attacked(114, -1))
            list[n++] = 116 | (114 << 7) | (2 << 17);
        } else {
          if ((castle & 4) && b[4] === -6 && b[7] === -4 && b[5] === 0 && b[6] === 0 &&
              !attacked(4, 1) && !attacked(5, 1) && !attacked(6, 1))
            list[n++] = 4 | (6 << 7) | (2 << 17);
          if ((castle & 8) && b[4] === -6 && b[0] === -4 && b[1] === 0 && b[2] === 0 && b[3] === 0 &&
              !attacked(4, 1) && !attacked(3, 1) && !attacked(2, 1))
            list[n++] = 4 | (2 << 7) | (2 << 17);
        }
      }
      return n;
    }

    /* ---------- Đi / hoàn tác ---------- */
    function makeMove(m) {
      var from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flag = (m >> 17) & 7;
      var side = stm, p = b[from], cap = b[to], ip, ic;
      stCap[sp] = cap; stCastle[sp] = castle; stEp[sp] = ep; stHalf[sp] = half;
      stLo[sp] = hLo; stHi[sp] = hHi; stMg[sp] = mg; stEg[sp] = eg;
      sp++;
      if (ep >= 0 && epHashed()) { hLo ^= zEpLo[ep & 7]; hHi ^= zEpHi[ep & 7]; }
      ip = (p + 6) << 7;
      hLo ^= zLo[ip + from]; hHi ^= zHi[ip + from];
      mg -= mgT[ip + from]; eg -= egT[ip + from];
      b[from] = 0;
      half++;
      if (cap !== 0) {
        ic = (cap + 6) << 7;
        hLo ^= zLo[ic + to]; hHi ^= zHi[ic + to];
        mg -= mgT[ic + to]; eg -= egT[ic + to];
        cnt[cap + 6]--;
        half = 0;
      } else if (flag === 1) {
        var cs = to + (side > 0 ? 16 : -16);
        var cp = b[cs];
        stCap[sp - 1] = cp;
        ic = (cp + 6) << 7;
        hLo ^= zLo[ic + cs]; hHi ^= zHi[ic + cs];
        mg -= mgT[ic + cs]; eg -= egT[ic + cs];
        cnt[cp + 6]--;
        b[cs] = 0;
        half = 0;
      }
      var np = p;
      if (promo !== 0) { np = side * promo; cnt[p + 6]--; cnt[np + 6]++; }
      ip = (np + 6) << 7;
      b[to] = np;
      hLo ^= zLo[ip + to]; hHi ^= zHi[ip + to];
      mg += mgT[ip + to]; eg += egT[ip + to];
      if (p === 1 || p === -1) half = 0;
      else if (p === 6) kingSq[0] = to;
      else if (p === -6) kingSq[1] = to;
      ep = -1;
      if (flag === 3) ep = (from + to) >> 1;
      else if (flag === 2) {
        var rf, rt;
        if (to === 118) { rf = 119; rt = 117; }
        else if (to === 114) { rf = 112; rt = 115; }
        else if (to === 6) { rf = 7; rt = 5; }
        else { rf = 0; rt = 3; }
        var rp = b[rf], irp = (rp + 6) << 7;
        b[rf] = 0; b[rt] = rp;
        hLo ^= zLo[irp + rf] ^ zLo[irp + rt]; hHi ^= zHi[irp + rf] ^ zHi[irp + rt];
        mg += mgT[irp + rt] - mgT[irp + rf]; eg += egT[irp + rt] - egT[irp + rf];
      }
      var nc = castle & cmask[from] & cmask[to];
      if (nc !== castle) {
        hLo ^= zCLo[castle] ^ zCLo[nc]; hHi ^= zCHi[castle] ^ zCHi[nc];
        castle = nc;
      }
      stm = -side;
      hLo ^= zSLo; hHi ^= zSHi;
      if (ep >= 0 && epHashed()) { hLo ^= zEpLo[ep & 7]; hHi ^= zEpHi[ep & 7]; }
      if (attacked(kingSq[side > 0 ? 0 : 1], stm)) { unmakeMove(m); return false; }
      return true;
    }

    function unmakeMove(m) {
      var from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flag = (m >> 17) & 7;
      sp--;
      stm = -stm;
      var side = stm, cap = stCap[sp], p;
      if (promo !== 0) { cnt[b[to] + 6]--; p = side; cnt[p + 6]++; }
      else p = b[to];
      b[from] = p;
      if (flag === 1) {
        b[to] = 0;
        b[to + (side > 0 ? 16 : -16)] = cap;
        cnt[cap + 6]++;
      } else {
        b[to] = cap;
        if (cap !== 0) cnt[cap + 6]++;
      }
      if (p === 6) kingSq[0] = from;
      else if (p === -6) kingSq[1] = from;
      if (flag === 2) {
        if (to === 118) { b[119] = b[117]; b[117] = 0; }
        else if (to === 114) { b[112] = b[115]; b[115] = 0; }
        else if (to === 6) { b[7] = b[5]; b[5] = 0; }
        else { b[0] = b[3]; b[3] = 0; }
      }
      castle = stCastle[sp]; ep = stEp[sp]; half = stHalf[sp];
      hLo = stLo[sp]; hHi = stHi[sp]; mg = stMg[sp]; eg = stEg[sp];
    }

    function makeNull() {
      stCap[sp] = 0; stCastle[sp] = castle; stEp[sp] = ep; stHalf[sp] = half;
      stLo[sp] = hLo; stHi[sp] = hHi; stMg[sp] = mg; stEg[sp] = eg;
      sp++;
      if (ep >= 0 && epHashed()) { hLo ^= zEpLo[ep & 7]; hHi ^= zEpHi[ep & 7]; }
      ep = -1; stm = -stm; half++;
      hLo ^= zSLo; hHi ^= zSHi;
    }

    function unmakeNull() {
      sp--;
      stm = -stm;
      castle = stCastle[sp]; ep = stEp[sp]; half = stHalf[sp];
      hLo = stLo[sp]; hHi = stHi[sp];
    }

    /* ---------- Đánh giá (góc nhìn bên đang đi) ---------- */
    function centerDist(sq) {
      var r = sq >> 4, f = sq & 7;
      return (r < 4 ? 3 - r : r - 4) + (f < 4 ? 3 - f : f - 4);
    }

    function evaluate() {
      var wn = cnt[8], wb = cnt[9], wr = cnt[10], wq = cnt[11], wpn = cnt[7];
      var bn = cnt[4], bb = cnt[3], br = cnt[2], bq = cnt[1], bpn = cnt[5];
      // Không đủ lực lượng chiếu hết -> hoà
      if (wpn + bpn + wr + br + wq + bq === 0 && wn + wb + bn + bb <= 1) return 0;

      var ph = wn + wb + bn + bb + 2 * (wr + br) + 4 * (wq + bq);
      if (ph > 24) ph = 24;
      var mgx = 0, egx = 0, sq, p, f, r, i, x, rel;

      if (wb >= 2) { mgx += 30; egx += 45; }
      if (bb >= 2) { mgx -= 30; egx -= 45; }

      for (f = 0; f < 8; f++) { wC[f] = 0; bC[f] = 0; wMax[f] = -1; bMin[f] = 8; }
      var nWP = 0, nBP = 0, nWR = 0, nBR = 0;
      for (sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        p = b[sq];
        if (p === 0) continue;
        if (p === 1) {
          f = sq & 7; r = sq >> 4; wC[f]++; if (r > wMax[f]) wMax[f] = r; wpSq[nWP++] = sq;
        } else if (p === -1) {
          f = sq & 7; r = sq >> 4; bC[f]++; if (r < bMin[f]) bMin[f] = r; bpSq[nBP++] = sq;
        } else if (p === 4) wrSq[nWR++] = sq;
        else if (p === -4) brSq[nBR++] = sq;
      }

      // Cấu trúc tốt
      for (f = 0; f < 8; f++) {
        if (wC[f] > 1) { mgx -= 10 * (wC[f] - 1); egx -= 20 * (wC[f] - 1); }
        if (bC[f] > 1) { mgx += 10 * (bC[f] - 1); egx += 20 * (bC[f] - 1); }
      }
      for (i = 0; i < nWP; i++) {
        sq = wpSq[i]; f = sq & 7; r = sq >> 4;
        var passed = true;
        for (x = f - 1; x <= f + 1; x++) {
          if (x < 0 || x > 7) continue;
          if (bMin[x] < r) { passed = false; break; }
        }
        if (passed) { rel = 6 - r; mgx += PASS_MG[rel]; egx += PASS_EG[rel]; }
        if ((f === 0 || wC[f - 1] === 0) && (f === 7 || wC[f + 1] === 0)) { mgx -= 10; egx -= 14; }
      }
      for (i = 0; i < nBP; i++) {
        sq = bpSq[i]; f = sq & 7; r = sq >> 4;
        var passedB = true;
        for (x = f - 1; x <= f + 1; x++) {
          if (x < 0 || x > 7) continue;
          if (wMax[x] > r) { passedB = false; break; }
        }
        if (passedB) { rel = r - 1; mgx -= PASS_MG[rel]; egx -= PASS_EG[rel]; }
        if ((f === 0 || bC[f - 1] === 0) && (f === 7 || bC[f + 1] === 0)) { mgx += 10; egx -= 14; }
      }

      // Xe trên cột mở / nửa mở / hàng 7
      for (i = 0; i < nWR; i++) {
        sq = wrSq[i]; f = sq & 7;
        if (wC[f] === 0) { if (bC[f] === 0) { mgx += 20; egx += 10; } else { mgx += 10; egx += 5; } }
        if ((sq >> 4) === 1) { mgx += 10; egx += 15; }
      }
      for (i = 0; i < nBR; i++) {
        sq = brSq[i]; f = sq & 7;
        if (bC[f] === 0) { if (wC[f] === 0) { mgx -= 20; egx -= 10; } else { mgx -= 10; egx -= 5; } }
        if ((sq >> 4) === 6) { mgx -= 10; egx -= 15; }
      }

      // An toàn của Vua (lá chắn tốt)
      var ks, kr, kf, ksw = 0, ksb = 0;
      ks = kingSq[0]; kr = ks >> 4; kf = ks & 7;
      if (kr >= 6) {
        for (x = kf - 1; x <= kf + 1; x++) {
          if (x < 0 || x > 7) continue;
          if (b[(kr - 1) * 16 + x] === 1) ksw += 10;
          else if (b[(kr - 2) * 16 + x] === 1) ksw += 5;
          else { ksw -= 12; if (wC[x] === 0) ksw -= 8; }
        }
        if (bq === 0) ksw >>= 1;
        mgx += ksw;
      }
      ks = kingSq[1]; kr = ks >> 4; kf = ks & 7;
      if (kr <= 1) {
        for (x = kf - 1; x <= kf + 1; x++) {
          if (x < 0 || x > 7) continue;
          if (b[(kr + 1) * 16 + x] === -1) ksb += 10;
          else if (b[(kr + 2) * 16 + x] === -1) ksb += 5;
          else { ksb -= 12; if (bC[x] === 0) ksb -= 8; }
        }
        if (wq === 0) ksb >>= 1;
        mgx -= ksb;
      }

      // Tàn cuộc: dồn Vua đối phương vào góc khi đang hơn rõ rệt
      if (ph <= 10) {
        var ev = eg + egx;
        var k0 = kingSq[0], k1 = kingSq[1];
        var dr = (k0 >> 4) - (k1 >> 4), df = (k0 & 7) - (k1 & 7);
        if (dr < 0) dr = -dr; if (df < 0) df = -df;
        var kd = dr > df ? dr : df;
        if (ev > 250) egx += centerDist(k1) * 10 + (7 - kd) * 4;
        else if (ev < -250) egx -= centerDist(k0) * 10 + (7 - kd) * 4;
      }

      var score = (((mg + mgx) * ph + (eg + egx) * (24 - ph)) / 24) | 0;
      return (stm > 0 ? score : -score) + 8;
    }

    /* ---------- Lặp thế ---------- */
    function isRep(ply) {
      var k, lim = half;
      if (lim > sp) lim = sp;
      for (k = 4; k <= lim; k += 2) {
        if (stLo[sp - k] === hLo && stHi[sp - k] === hHi) return true;
      }
      if (!(ply & 1) && half >= 4) {
        var lo = ghN - ghUse; if (lo < 0) lo = 0;
        for (k = ghN - 1; k >= lo; k--) {
          if (ghLo[k] === hLo && ghHi[k] === hHi) return true;
        }
      }
      return false;
    }

    function drawScore(ply) { return (ply & 1) ? contempt : -contempt; }

    /* ---------- Sắp xếp nước đi ---------- */
    function scoreMoves(ply, n, ttMove) {
      var list = mvBuf[ply], sc = scBuf[ply];
      var k1 = killers[ply * 2], k2 = killers[ply * 2 + 1];
      for (var i = 0; i < n; i++) {
        var m = list[i], s;
        var cap = (m >> 20) & 7, promo = (m >> 14) & 7;
        if (m === ttMove) s = 2000000;
        else if (cap !== 0) {
          var ap = b[m & 127]; if (ap < 0) ap = -ap;
          s = 1000000 + cap * 16 - ap + (promo === 5 ? 5000 : 0);
        } else if (promo !== 0) s = promo === 5 ? 950000 : 1;
        else if (m === k1) s = 900000;
        else if (m === k2) s = 890000;
        else s = history[((b[m & 127] + 6) << 7) + ((m >> 7) & 127)];
        sc[i] = s;
      }
    }

    /* ---------- Quiescence ---------- */
    function qsearch(alpha, beta, ply) {
      if ((++nodes & 1023) === 0 && Date.now() - T0 > tLimit) stopped = true;
      if (stopped) return 0;
      if (ply >= MAXPLY - 2) return evaluate();

      var inCheck = inCheckNow();
      var standPat = -INF, best = -INF;
      if (!inCheck) {
        standPat = evaluate();
        if (standPat >= beta) return standPat;
        if (standPat > alpha) alpha = standPat;
        best = standPat;
      }
      var n = gen(ply, !inCheck);
      scoreMoves(ply, n, 0);
      var list = mvBuf[ply], sc = scBuf[ply];
      var moveCount = 0;
      for (var i = 0; i < n; i++) {
        var bi = i, bs = sc[i], j;
        for (j = i + 1; j < n; j++) if (sc[j] > bs) { bs = sc[j]; bi = j; }
        if (bi !== i) {
          var tm = list[i]; list[i] = list[bi]; list[bi] = tm;
          var ts = sc[i]; sc[i] = sc[bi]; sc[bi] = ts;
        }
        var m = list[i];
        if (!inCheck) {
          var cap = (m >> 20) & 7;
          if (((m >> 14) & 7) === 0 && standPat + CVAL[cap] + 200 < alpha) continue;
        }
        if (!makeMove(m)) continue;
        moveCount++;
        var score = -qsearch(-beta, -alpha, ply + 1);
        unmakeMove(m);
        if (stopped) return 0;
        if (score > best) {
          best = score;
          if (score > alpha) { alpha = score; if (alpha >= beta) break; }
        }
      }
      if (inCheck && moveCount === 0) return -MATE + ply;
      return best;
    }

    /* ---------- Tìm kiếm chính (negamax + alpha-beta) ---------- */
    function search(depth, alpha, beta, ply, canNull) {
      if ((++nodes & 1023) === 0 && Date.now() - T0 > tLimit) stopped = true;
      if (stopped) return 0;

      var pv = beta - alpha > 1;
      var inCheck = inCheckNow();

      if (isRep(ply) || (half >= 100 && !inCheck)) return drawScore(ply);
      if (ply >= MAXPLY - 2) return evaluate();

      // Mate distance pruning
      var lowB = -MATE + ply; if (lowB > alpha) alpha = lowB;
      var highB = MATE - ply - 1; if (highB < beta) beta = highB;
      if (alpha >= beta) return alpha;

      if (inCheck) depth++;
      if (depth <= 0) return qsearch(alpha, beta, ply);

      // Tra bảng chuyển vị
      var idx = hLo & TT_MASK, ttMove = 0;
      if (ttFl[idx] !== 0 && ttHi[idx] === hHi) {
        ttMove = ttMv[idx];
        if (!pv && ttDp[idx] >= depth) {
          var tsc = ttSc[idx];
          if (tsc > MATE_MAX) tsc -= ply; else if (tsc < -MATE_MAX) tsc += ply;
          var tfl = ttFl[idx];
          if (tfl === 1) return tsc;
          if (tfl === 2 && tsc >= beta) return tsc;
          if (tfl === 3 && tsc <= alpha) return tsc;
        }
      }

      var staticEval = inCheck ? -INF : evaluate();

      if (!pv && !inCheck) {
        // Reverse futility pruning
        if (depth <= 3 && staticEval - 110 * depth >= beta && beta > -MATE_MAX && beta < MATE_MAX)
          return staticEval - 110 * depth;
        // Null move pruning
        if (canNull && depth >= 3 && staticEval >= beta &&
            (stm > 0 ? (cnt[8] + cnt[9] + cnt[10] + cnt[11]) : (cnt[4] + cnt[3] + cnt[2] + cnt[1])) > 0) {
          var R = depth > 6 ? 3 : 2;
          makeNull();
          var ns = -search(depth - 1 - R, -beta, -beta + 1, ply + 1, false);
          unmakeNull();
          if (stopped) return 0;
          if (ns >= beta) return ns >= MATE_MAX ? beta : ns;
        }
      }

      var n = gen(ply, false);
      scoreMoves(ply, n, ttMove);
      var list = mvBuf[ply], sc = scBuf[ply];
      var best = -INF, bestMove = 0, moveCount = 0, flag = 3, origAlpha = alpha;
      var k1 = killers[ply * 2], k2 = killers[ply * 2 + 1];

      for (var i = 0; i < n; i++) {
        var bi = i, bs = sc[i], j;
        for (j = i + 1; j < n; j++) if (sc[j] > bs) { bs = sc[j]; bi = j; }
        if (bi !== i) {
          var tm = list[i]; list[i] = list[bi]; list[bi] = tm;
          var ts = sc[i]; sc[i] = sc[bi]; sc[bi] = ts;
        }
        var m = list[i];
        var quiet = ((m >> 20) & 7) === 0 && ((m >> 14) & 7) === 0;
        var piece = b[m & 127], to = (m >> 7) & 127;

        if (!makeMove(m)) continue;
        moveCount++;
        var givesCheck = inCheckNow();

        if (!pv && !inCheck && !givesCheck && quiet && moveCount > 1 && best > -MATE_MAX) {
          if (depth <= 2 && staticEval + 100 + 120 * depth <= alpha) { unmakeMove(m); continue; }
          if (depth <= 3 && moveCount > 6 + depth * 4) { unmakeMove(m); continue; }
        }

        var score, newDepth = depth - 1;
        if (moveCount === 1) {
          score = -search(newDepth, -beta, -alpha, ply + 1, true);
        } else {
          var red = 0;
          if (depth >= 3 && quiet && !inCheck && !givesCheck && moveCount > 3) {
            red = 1 + (moveCount > 8 ? 1 : 0) + (depth > 7 ? 1 : 0);
            if (pv) red--;
            if (m === k1 || m === k2) red--;
            if (red < 0) red = 0;
            if (red > newDepth - 1) red = newDepth - 1;
          }
          score = -search(newDepth - red, -alpha - 1, -alpha, ply + 1, true);
          if (score > alpha && red > 0) score = -search(newDepth, -alpha - 1, -alpha, ply + 1, true);
          if (score > alpha && score < beta) score = -search(newDepth, -beta, -alpha, ply + 1, true);
        }
        unmakeMove(m);
        if (stopped) return 0;

        if (score > best) {
          best = score; bestMove = m;
          if (score > alpha) {
            alpha = score; flag = 1;
            if (alpha >= beta) {
              flag = 2;
              if (quiet) {
                if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
                var hi = ((piece + 6) << 7) + to;
                history[hi] += depth * depth;
                if (history[hi] > 600000) for (var h = 0; h < history.length; h++) history[h] >>= 1;
              }
              break;
            }
          }
        }
      }

      if (moveCount === 0) return inCheck ? -MATE + ply : 0;

      // Lưu bảng chuyển vị
      var sameKey = ttHi[idx] === hHi && ttFl[idx] !== 0;
      if (!sameKey || depth >= ttDp[idx] || flag === 1) {
        var store = best;
        if (store > MATE_MAX) store += ply; else if (store < -MATE_MAX) store -= ply;
        ttHi[idx] = hHi; ttSc[idx] = store; ttDp[idx] = depth > 127 ? 127 : depth; ttFl[idx] = flag;
        ttMv[idx] = bestMove !== 0 ? bestMove : (sameKey ? ttMv[idx] : 0);
      }
      return best;
    }

    /* ---------- Tìm kiếm ở gốc ---------- */
    function rootSearch(depth, alpha, beta) {
      var alpha0 = alpha, best = -INF, bm = 0, found = false;
      for (var i = 0; i < rootN; i++) {
        var m = rootMoves[i];
        if (!makeMove(m)) continue;
        var score;
        if (i === 0) score = -search(depth - 1, -beta, -alpha, 1, true);
        else {
          score = -search(depth - 1, -alpha - 1, -alpha, 1, true);
          if (score > alpha && score < beta) score = -search(depth - 1, -beta, -alpha, 1, true);
        }
        unmakeMove(m);
        if (stopped) break;
        if (score > best) {
          best = score; bm = m;
          if (score > alpha0) found = true;
          if (score > alpha) alpha = score;
          if (alpha >= beta) break;
        }
      }
      rsMove = bm; rsScore = best; rsFound = found;
    }

    function moveToFront(m) {
      var idx = rootMoves.indexOf(m);
      if (idx > 0) { rootMoves.splice(idx, 1); rootMoves.unshift(m); }
    }

    function sqNum(name) { return (8 - (name.charCodeAt(1) - 48)) * 16 + (name.charCodeAt(0) - 97); }
    function promoNum(p) { return p === 'n' ? 2 : p === 'b' ? 3 : p === 'r' ? 4 : p === 'q' ? 5 : 0; }

    /* ---------- Điểm vào của engine ---------- */
    function think(fenStr, legal, timeMs, startMs) {
      T0 = startMs; tLimit = timeMs; stopped = false; nodes = 0;
      setFen(fenStr);
      sp = 0;

      // Lịch sử thế cờ của ván
      if (half === 0) ghN = 0;
      ghUse = Math.min(ghN, (half >> 1) + 4);
      var rootLo = hLo, rootHi = hHi;

      // Ánh xạ nước đi hợp lệ do hệ thống cung cấp
      var map = {}, i, any = false;
      for (i = 0; i < legal.length; i++) {
        var lm = legal[i];
        if (!lm || !lm.from || !lm.to) continue;
        map[sqNum(lm.from) | (sqNum(lm.to) << 7) | (promoNum(lm.promotion) << 14)] = lm;
        any = true;
      }
      if (!any) return null;

      var n = gen(0, false);
      scoreMoves(0, n, 0);
      var cand = [];
      for (i = 0; i < n; i++) {
        var m = mvBuf[0][i];
        if (map[m & 0x1FFFF] === undefined) continue;
        if (!makeMove(m)) continue;
        unmakeMove(m);
        cand.push({ m: m, s: scBuf[0][i] });
      }
      if (cand.length === 0) return null;
      cand.sort(function (a, c) { return c.s - a.s; });
      rootMoves = [];
      for (i = 0; i < cand.length; i++) rootMoves.push(cand[i].m);
      rootN = rootMoves.length;

      var bestMove = rootMoves[0], bestScore = 0, lastScore = 0;
      if (rootN > 1) {
        var re = evaluate();
        contempt = re > 150 ? 40 : (re > -50 ? 10 : (re < -150 ? -15 : 0));
        killers.fill(0);
        for (i = 0; i < history.length; i++) history[i] >>= 2;

        for (var depth = 1; depth <= MAX_DEPTH; depth++) {
          var alpha = -INF, beta = INF;
          if (depth >= 5) { alpha = lastScore - 35; beta = lastScore + 35; }
          while (true) {
            rootSearch(depth, alpha, beta);
            if (stopped) {
              if (rsFound && rsMove !== 0) { bestMove = rsMove; bestScore = rsScore; }
              break;
            }
            if (rsScore <= alpha && alpha > -INF) { alpha = -INF; continue; }
            if (rsScore >= beta && beta < INF) {
              bestMove = rsMove; bestScore = rsScore; moveToFront(rsMove);
              beta = INF; continue;
            }
            bestMove = rsMove; bestScore = rsScore; moveToFront(rsMove);
            break;
          }
          if (stopped) break;
          lastScore = bestScore;
          if (Date.now() - T0 > tLimit * 0.85) break;
          if (bestScore > MATE_MAX && depth >= 4) break;
        }
      }

      // Cập nhật lịch sử thế cờ
      if (ghN >= 256) { ghLo.copyWithin(0, 128, 256); ghHi.copyWithin(0, 128, 256); ghN = 128; }
      ghLo[ghN] = rootLo; ghHi[ghN] = rootHi; ghN++;

      var chosen = map[bestMove & 0x1FFFF];
      return chosen !== undefined ? chosen : map[rootMoves[0] & 0x1FFFF];
    }

    return { think: think };
  }
}`,
  },
];


