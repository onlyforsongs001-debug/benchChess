/**
 * Kiểm thử logic sandbox worker (mô phỏng môi trường Web Worker trong Node).
 */
const received = [];
globalThis.self = globalThis;
globalThis.postMessage = (msg) => received.push(msg);

await import('../src/workers/bot.worker.ts');

const send = (data) => globalThis.onmessage({ data });

console.log('=== 1. Khởi tạo với script hợp lệ ===');
send({
  type: 'init',
  code: `
    let calls = 0;
    function getMove(fen, legalMoves, chessState) {
      calls++;
      // ghi lại số lần gọi để chứng minh state sống suốt phiên
      globalThis.__calls = calls;
      return legalMoves.find(m => m.san === 'e4') || legalMoves[0];
    }
  `,
});
console.log('  phản hồi:', JSON.stringify(received.pop()));

console.log('\n=== 2. Gọi nước đi (state phải được giữ qua các lượt) ===');
send({ type: 'move', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', legalMoves: [{ from: 'e2', to: 'e4', san: 'e4' }], chessState: {} });
console.log('  lượt 1:', JSON.stringify(received.pop()));
send({ type: 'move', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', legalMoves: [{ from: 'e2', to: 'e4', san: 'e4' }], chessState: {} });
console.log('  lượt 2:', JSON.stringify(received.pop()));

console.log('\n=== 3. Script thiếu hàm getMove ===');
send({ type: 'init', code: 'function khac(){ return 1; }' });
console.log('  phản hồi:', JSON.stringify(received.pop()));

console.log('\n=== 4. Script có lỗi cú pháp ===');
send({ type: 'init', code: 'function getMove( { ' });
console.log('  phản hồi:', JSON.stringify(received.pop()));

console.log('\n=== 5. Bot ném lỗi khi chạy ===');
send({ type: 'init', code: 'function getMove(){ throw new Error("boom"); }' });
console.log('  init:', JSON.stringify(received.pop()));
send({ type: 'move', fen: 'x', legalMoves: [], chessState: {} });
console.log('  move:', JSON.stringify(received.pop()));

console.log('\n=== 6. Bot truy cập DOM (sandbox phải chặn) ===');
send({ type: 'init', code: 'function getMove(){ return document.cookie; }' });
console.log('  init:', JSON.stringify(received.pop()));
send({ type: 'move', fen: 'x', legalMoves: [{}], chessState: {} });
console.log('  move:', JSON.stringify(received.pop()));
