/**
 * Probe 2: chứng minh engine bị khởi tạo lại mỗi nước đi + timeout không có tác dụng.
 */
import { DEFAULT_BOTS, executeBotScript } from '../src/utils/rules.ts';

const claude = DEFAULT_BOTS.find(b => b.id === 'claude-sonnet-55')!;
const FEN = 'r1bq1rk1/pp2ppbp/2np1np1/2p5/2P1P3/2NP1N1P/PP2BPP1/R1BQ1RK1 w - - 0 9';

console.log('=== A. MỖI LƯỢT ĐI CÓ TẠO ENGINE MỚI? ===');
{
  // Gắn mã định danh cho mỗi engine được tạo ra
  const tagged = claude.code.replace(
    'return { think: think };',
    'return { think: think, __id: (globalThis.__engineSeq = (globalThis.__engineSeq || 0) + 1) };'
  );
  // Bọc lại getMove để ghi lại engine sau khi nó được tạo
  const wrapped = `${tagged}
    const __orig = getMove;
    getMove = function (fen, legalMoves, chessState) {
      const r = __orig(fen, legalMoves, chessState);
      globalThis.__seen = globalThis.__seen || [];
      globalThis.__seen.push(getMove._engine ? getMove._engine.__id : 'none');
      return r;
    };
  `;

  executeBotScript(wrapped, FEN, 2000);
  executeBotScript(wrapped, FEN, 2000);
  executeBotScript(wrapped, FEN, 2000);
  console.log('  ID engine dùng cho 3 lượt đi:', JSON.stringify((globalThis as any).__seen));
  console.log('  => ID khác nhau => mỗi lượt đi tạo engine mới: bảng transposition 512K,');
  console.log('     killer moves, history heuristic và lịch sử lặp thế đều bị reset.');
}

console.log('\n=== B. timeoutMs CÓ THỰC SỰ CHẶN BOT KHÔNG? ===');
{
  const t0 = Date.now();
  const res = executeBotScript('function getMove(){ while(true){} }', FEN, 100);
  console.log(`  Kết quả sau ${Date.now() - t0}ms: ${res.success ? 'OK' : res.error}`);
  console.log('  (Nếu lệnh này in ra thì bot KHÔNG bị chặn => treo tab trình duyệt)');
}
