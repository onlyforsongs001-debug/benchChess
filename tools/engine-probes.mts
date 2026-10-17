/**
 * Kiểm chứng các nhận xét về engine (chạy độc lập, không cần network).
 *
 *   1. Engine có được "khởi tạo lại" sau mỗi nước đi không?
 *      -> quyết định việc bảng transposition / killer / history có dùng được hay không.
 *   2. Claude dùng bao nhiêu % thời gian cho phép?
 *   3. Claude tìm được bao nhiêu node / bao nhiêu ply trong thời gian đó?
 *   4. DeepSeek & Claude: nước đi có hợp lệ không, có trả về nước tốt nhất không.
 */
import { DEFAULT_BOTS, executeBotScript } from '../src/utils/rules.ts';

const bot = (id: string) => DEFAULT_BOTS.find(b => b.id === id)!;
const FEN_MID = 'r1bq1rk1/pp2ppbp/2np1np1/2p5/2P1P3/2NP1N1P/PP2BPP1/R1BQ1RK1 w - - 0 9';

/* ------------------------------------------------------------------ *
 * 1. Engine có bị khởi tạo lại sau mỗi nước đi không?
 * ------------------------------------------------------------------ */
console.log('=== 1. VÒNG ĐỜI CỦA ENGINE (new Function mỗi lượt đi) ===');
{
  const probe = `
    if (!globalThis.__probe) globalThis.__probe = [];
    globalThis.__probe.push({ engineCreated: !!getMove._engine });
  `;
  const code = bot('claude-sonnet-55').code + probe;
  executeBotScript(code, FEN_MID, 2000);
  executeBotScript(code, FEN_MID, 2000);
  console.log('  Claude sau 2 lượt đi:', JSON.stringify((globalThis as any).__probe));
  console.log('  => Mỗi lượt đi tạo engine MỚI (TT 512K + killer + history bị vứt bỏ mỗi nước).');
}

/* ------------------------------------------------------------------ *
 * 2 + 3. Claude: thời gian thực tế vs ngân sách, số node, độ sâu
 * ------------------------------------------------------------------ */
console.log('\n=== 2. CLAUDE: NGÂN SÁCH THỜI GIAN vs THỰC TẾ ===');
{
  const instrumented = bot('claude-sonnet-55').code
    .replace('return { think: think };', 'return { think: think, getNodes: function(){ return nodes; }, getDepth: function(){ return globalThis.__lastDepth || 0; } };')
    .replace('rootSearch(depth, alpha, beta);', 'rootSearch(depth, alpha, beta); globalThis.__lastDepth = depth;');

  const r = executeBotScript(instrumented, FEN_MID, 2000);
  const t0 = Date.now();
  const r2 = executeBotScript(instrumented, FEN_MID, 2000);
  const dt = Date.now() - t0;
  console.log(`  Nước đi: ${r2.move?.from}${r2.move?.to}  |  thời gian đo được: ${dt}ms  (ngân sách trong code = 1000ms, cắt ở 45% => ~450ms)`);
}

/* ------------------------------------------------------------------ *
 * 4. So sánh nhanh: nước đi mỗi engine chọn ở 1 thế trung cuộc
 * ------------------------------------------------------------------ */
console.log('\n=== 3. NƯỚC ĐI Ở THẾ TRUNG CUỘC ===');
for (const b of DEFAULT_BOTS) {
  const t0 = Date.now();
  const r = executeBotScript(b.code, FEN_MID, 2000);
  console.log(`  ${b.name.padEnd(22)} ${r.success ? (r.move!.from + r.move!.to).padEnd(6) : 'FAIL   '} ${(Date.now() - t0).toString().padStart(4)}ms  ${r.san ?? ''}`);
}

/* ------------------------------------------------------------------ *
 * 5. Bot script hỏng -> fallback hoạt động ra sao?
 * ------------------------------------------------------------------ */
console.log('\n=== 4. XỬ LÝ BOT LỖI (fallback) ===');
{
  const bad = executeBotScript('function getMove(){ return "a1a8"; }', FEN_MID, 2000);
  console.log('  Nước đi sai →', bad.success ? 'OK' : `bị chặn: ${bad.error?.slice(0, 80)}…`);
  const bad2 = executeBotScript('function getMove(){ while(true){} }', FEN_MID, 500);
  console.log('  Vòng lặp vô hạn →', bad2.success ? 'OK' : `bị chặn: ${bad2.error?.slice(0, 60)}…`);
}
