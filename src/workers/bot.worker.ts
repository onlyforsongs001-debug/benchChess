/**
 * Worker sandbox cho script bot cờ vua.
 *
 * Script được đánh giá (eval) đúng MỘT LẦN khi phiên mở, nên mọi state bên
 * trong script (bảng transposition, killer moves, history heuristic, engine
 * cache) tồn tại xuyên suốt ván đấu.
 *
 * Worker không có `window` / `document` / `localStorage` / `fetch`:
 * bot không thể chạm vào DOM hay dữ liệu người dùng.
 */

/// <reference lib="webworker" />

type BotFn = (fen: string, legalMoves: unknown[], chessState: unknown) => unknown;

let userFn: BotFn | null = null;
let initError: string | null = null;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent) => {
  const msg = event.data;

  if (msg?.type === 'init') {
    // Reset trạng thái của lần khởi tạo trước đó
    userFn = null;
    initError = null;
    try {
      const factory = new Function(
        `"use strict";
        ${msg.code}
        if (typeof getMove === 'function') return getMove;
        if (typeof chooseMove === 'function') return chooseMove;
        if (typeof botMove === 'function') return botMove;
        return null;`
      ) as () => BotFn | null;
      userFn = factory();
      if (!userFn) {
        initError = 'Không tìm thấy hàm getMove(fen, legalMoves, chessState) trong script bot.';
      }
    } catch (err: any) {
      initError = `Lỗi cú pháp script bot: ${err?.message ?? err}`;
    }
    ctx.postMessage(initError ? { type: 'init-error', message: initError } : { type: 'ready' });
    return;
  }

  if (msg?.type === 'move') {
    if (!userFn) {
      ctx.postMessage({ type: 'move-error', message: initError ?? 'Bot chưa được khởi tạo.' });
      return;
    }
    const started = Date.now();
    try {
      const result = userFn(msg.fen, msg.legalMoves, msg.chessState);
      ctx.postMessage({
        type: 'move-result',
        result: result === undefined ? null : result,
        thinkingTimeMs: Date.now() - started,
      });
    } catch (err: any) {
      ctx.postMessage({
        type: 'move-error',
        message: `Lỗi thực thi bot: ${err?.message ?? err}`,
        thinkingTimeMs: Date.now() - started,
      });
    }
  }
};
