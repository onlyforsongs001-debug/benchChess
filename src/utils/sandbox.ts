/**
 * Bot sandbox – chạy script bot trong Web Worker.
 *
 * Mục tiêu:
 *   1. Tách bot khỏi main thread: script lỗi / treo không kẹn UI.
 *   2. Có timeout cứng: quá hạn → terminate worker → engine được dựng lại.
 *   3. Cô lập: worker không có `window`, `document`, `localStorage`, `fetch`.
 *   4. Engine sống suốt ván: script được `eval` MỘT LẦN cho mỗi bot, nên
 *      `getMove._engine` (bảng transposition, killer, history, lịch sử lặp thế)
 *      được tái sử dụng giữa các nước đi thay vì bị reset mỗi lượt.
 */

export interface SandboxMoveRequest {
  fen: string;
  legalMoves: unknown[];
  chessState: unknown;
}

export interface SandboxResult {
  success: boolean;
  raw?: unknown;
  error?: string;
  /** Thời gian suy nghĩ (ms) do chính bot báo về */
  thinkingTimeMs?: number;
}

type Pending = {
  resolve: (r: SandboxResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class BotSession {
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private ready = false;
  private initError: string | null = null;
  private code: string;

  constructor(code: string) {
    this.code = code;
    this.spawn();
  }

  private spawn() {
    this.worker = new Worker(new URL('../workers/bot.worker.ts', import.meta.url), {
      type: 'module',
      name: 'chess-bot-sandbox',
    });
    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg?.type === 'ready') {
        this.ready = true;
      } else if (msg?.type === 'init-error') {
        this.initError = msg.message;
        this.ready = true;
      } else if (msg?.type === 'move-result') {
        const p = this.pending;
        if (!p) return;
        this.pending = null;
        clearTimeout(p.timer);
        p.resolve({ success: true, raw: msg.result, thinkingTimeMs: msg.thinkingTimeMs });
      } else if (msg?.type === 'move-error') {
        const p = this.pending;
        if (!p) return;
        this.pending = null;
        clearTimeout(p.timer);
        p.resolve({ success: false, error: msg.message });
      }
    };
    this.worker.onerror = (e) => {
      this.initError = e.message || 'Lỗi worker';
      this.ready = true;
    };
    this.worker.postMessage({ type: 'init', code: this.code });
  }

  /** Gọi getMove() của bot trong worker, có timeout cứng. */
  async move(req: SandboxMoveRequest, timeoutMs: number): Promise<SandboxResult> {
    if (!this.worker) this.spawn();
    if (!this.ready) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (this.initError) {
      return { success: false, error: this.initError };
    }

    const started = Date.now();
    return new Promise<SandboxResult>(resolve => {
      const timer = setTimeout(() => {
        this.pending = null;
        // Treo → hủy worker. Lần sau sẽ dựng phiên mới.
        this.kill();
        resolve({
          success: false,
          error: `Bot vượt quá giới hạn ${timeoutMs}ms và đã bị dừng.`,
          thinkingTimeMs: Date.now() - started,
        });
      }, timeoutMs);

      this.pending = { resolve, timer };
      this.worker!.postMessage({ type: 'move', ...req });
    });
  }

  private kill() {
    try {
      this.worker?.terminate();
    } catch {
      /* ignore */
    }
    this.worker = null;
    this.ready = false;
    this.initError = null;
  }

  dispose() {
    this.kill();
  }
}

/* ------------------------------------------------------------------ *
 * Quản lý các phiên bot (một phiên cho mỗi bot, sống suốt ván)
 * ------------------------------------------------------------------ */
const sessions = new Map<string, { hash: string; session: BotSession }>();

function hashCode(code: string): string {
  let h = 5381;
  for (let i = 0; i < code.length; i++) h = ((h << 5) + h + code.charCodeAt(i)) | 0;
  return String(h);
}

export function getBotSession(botId: string, code: string): BotSession {
  const hash = hashCode(code);
  const existing = sessions.get(botId);
  if (existing && existing.hash === hash) return existing.session;
  existing?.session.dispose();
  const session = new BotSession(code);
  sessions.set(botId, { hash, session });
  return session;
}

export function disposeBotSession(botId: string) {
  const existing = sessions.get(botId);
  existing?.session.dispose();
  sessions.delete(botId);
}

export function disposeAllBotSessions() {
  for (const id of Array.from(sessions.keys())) disposeBotSession(id);
}

/* ------------------------------------------------------------------ *
 * Tiện ích cấp cao: chạy 1 nước đi của bot và trả về kết quả chuẩn hoá
 * ------------------------------------------------------------------ */
import { Chess } from 'chess.js';
import {
  getDetailedLegalMoves,
  getChessStateInfo,
  normalizeBotMoveOutput,
} from './rules';
import type { BotExecutionResult } from '../types/chess';

export async function runBotMove(
  botId: string,
  botCode: string,
  fen: string,
  timeoutMs = 2000
): Promise<BotExecutionResult> {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch (e: any) {
    return { success: false, thinkingTimeMs: 0, error: `FEN không hợp lệ: ${e.message}` };
  }

  const legalMoves = getDetailedLegalMoves(chess);
  if (legalMoves.length === 0) {
    return {
      success: false,
      thinkingTimeMs: 0,
      error: 'Không còn nước đi hợp lệ (Hết cờ hoặc hòa).',
    };
  }

  const session = getBotSession(botId, botCode);
  const res = await session.move(
    { fen, legalMoves, chessState: getChessStateInfo(chess) },
    timeoutMs
  );

  if (!res.success) {
    return {
      success: false,
      thinkingTimeMs: res.thinkingTimeMs ?? 0,
      error: res.error ?? 'Bot không phản hồi.',
    };
  }

  const validMove = normalizeBotMoveOutput(res.raw, legalMoves);
  if (!validMove) {
    return {
      success: false,
      thinkingTimeMs: res.thinkingTimeMs ?? 0,
      error: `Bot trả về nước đi không hợp lệ (${JSON.stringify(res.raw)}).`,
    };
  }

  return {
    success: true,
    move: { from: validMove.from, to: validMove.to, promotion: validMove.promotion },
    san: validMove.san,
    thinkingTimeMs: res.thinkingTimeMs ?? 0,
  };
}
