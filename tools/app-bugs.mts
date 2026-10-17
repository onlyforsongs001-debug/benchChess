/**
 * Kiểm tra các lỗi logic ở tầng ứng dụng (không liên quan tới engine).
 */
import { Chess } from 'chess.js';
import { calculateMaterial, getChessStateInfo } from '../src/utils/rules.ts';

console.log('=== 1. calculateMaterial với quân phong cấp ===');
{
  // Vị trí sau khi tốt trắng phong cấp lên hậu (đếm quân bị bắt sai)
  const fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
  const chess = new Chess(fen);
  const m = calculateMaterial(chess);
  console.log('  FEN sau phong cấp:', fen);
  console.log(`  whiteScore=${m.whiteScore} blackScore=${m.blackScore} balance=${m.balance}`);
  console.log(`  capturedByWhite=${JSON.stringify(m.capturedByWhite)} capturedByBlack=${JSON.stringify(m.capturedByBlack)}`);
  console.log('  => Đúng ra: balance = +8 (1 tốt -> hậu), capturedByBlack phải RỖNG');
}

console.log('\n=== 2. Tính vật chất khi bắt quân bình thường (đối chiếu) ===');
{
  const chess = new Chess();
  chess.move('e4'); chess.move('d5'); chess.move('exd5');
  const m = calculateMaterial(chess);
  console.log(`  sau 1.e4 d5 2.exd5 → balance=${m.balance} (đúng = 1), capturedByWhite=${JSON.stringify(m.capturedByWhite)}`);
}

console.log('\n=== 3. getChessStateInfo: fullMoves / halfMoves ===');
{
  const chess = new Chess();
  console.log('  thế mở đầu:', JSON.stringify({
    halfMoves: getChessStateInfo(chess).halfMoves,
    fullMoves: getChessStateInfo(chess).fullMoves,
  }));
  chess.move('e4'); chess.move('e5');
  console.log('  sau 1.e4 e5:', JSON.stringify({
    halfMoves: getChessStateInfo(chess).halfMoves,
    fullMoves: getChessStateInfo(chess).fullMoves,
  }));
}

console.log('\n=== 4. PGN khi tua ván (App.tsx dùng chessRef.current.pgn()) ===');
{
  const chess = new Chess();
  chess.move('e4'); chess.move('e5'); chess.move('Nf3');
  const snapshot = new Chess(chess.fen());
  console.log('  PGN hiện tại        :', JSON.stringify(chess.pgn()));
  snapshot.move('Nc6');
  console.log('  PGN sau khi tua tiếp:', JSON.stringify(snapshot.pgn()));
  console.log('  => PGN luôn lấy từ chessRef hiện tại, không theo vị trí đang xem trong lịch sử');
}

console.log('\n=== 5. Phát hiện hòa: 50 nước / lặp thế / thiếu quân ===');
{
  const chess = new Chess('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1');
  console.log('  K+P vs K, thiếu quân? isInsufficientMaterial =', chess.isInsufficientMaterial(), '→ hòa');
}
