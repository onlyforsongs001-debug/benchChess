/**
 * Client UCI cho Stockfish chạy trong trình duyệt.
 *
 * Engine: `public/stockfish.js` (bản asm.js tự chứa) được nạp như một
 * Web Worker cổ điển: `new Worker('/stockfish.js')`.
 *
 * Hỗ trợ:
 *   - `analyse(fen, movetime)` → điểm số + PV (đánh giá thời gian thực)
 *   - Ngắt giữa chừng: yêu cầu mới sẽ `stop` yêu cầu đang chạy
 */

export interface StockfishEval {
  depth: number;
  seldepth: number;
  /** Điểm centipawn, góc nhìn bên đang đi (null nếu bên đang đi bị chiếu hết) */
  scoreCp: number | null;
  /** Số nước đi tới chiếu hết (null nếu không có) */
  mate: number | null;
  /** Dãy nước đi tốt nhất (UCI) */
  pv: string[];
  bestmove: string | null;
  nodes: number;
  nps: number;
  timeMs: number;
}

interface Job {
  fen: string;
  movetime: number;
  resolve: (e: StockfishEval) => void;
}

interface Current extends Job {
  info: Partial<StockfishEval>;
}

const EMPTY_EVAL: StockfishEval = {
  depth: 0,
  seldepth: 0,
  scoreCp: null,
  mate: null,
  pv: [],
  bestmove: null,
  nodes: 0,
  nps: 0,
  timeMs: 0,
};

/** Interface tối thiểu của Worker – cho phép test ngoài trình duyệt. */
export interface WorkerLike {
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: { message?: string }) => void) | null;
  postMessage: (msg: string) => void;
  terminate: () => void;
}

export class StockfishClient {
  private worker: WorkerLike | null = null;
  private readyPromise: Promise<void> | null = null;
  private waiters: { resolve: (l: string) => void; timer: ReturnType<typeof setTimeout> }[] = [];
  private current: Current | null = null;
  private queued: Job | null = null;
  private failed: string | null = null;
  private workerFactory: () => WorkerLike;

  constructor(workerFactory?: () => WorkerLike) {
    this.workerFactory =
      workerFactory ?? (() => new Worker('/stockfish.js') as unknown as WorkerLike);
  }

  /** Khởi động engine (idempotent). */
  ready(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = (async () => {
      this.worker = this.workerFactory();
      this.worker.onmessage = (e) => this.onMessage(String(e.data));
      this.worker.onerror = (e) => {
        this.failed = e.message || 'Không tải được Stockfish';
        this.rejectAll(new Error(this.failed));
      };
      this.worker.postMessage('uci');
      await this.readUntil(l => l === 'uciok', 20000);
      this.worker.postMessage('isready');
      await this.readUntil(l => l === 'readyok', 20000);
      this.worker.postMessage('setoption name UCI_Elo value 2850');
      this.worker.postMessage('setoption name MultiPV value 1');
    })();
    return this.readyPromise;
  }

  private rejectAll(err: Error) {
    const ws = this.waiters.splice(0);
    for (const w of ws) {
      clearTimeout(w.timer);
      w.resolve('');
    }
    this.current?.resolve({ ...EMPTY_EVAL, bestmove: null });
    this.current = null;
    this.queued?.resolve({ ...EMPTY_EVAL, bestmove: null });
    this.queued = null;
    void err;
  }

  private readUntil(predicate: (line: string) => boolean, timeoutMs = 15000): Promise<string> {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex(w => w.timer === timer);
        if (idx >= 0) this.waiters.splice(idx, 1);
        resolve('');
      }, timeoutMs);
      this.waiters.push({ resolve, timer });
    });
  }

  private onMessage(line: string) {
    if (!line) return;

    if (line.startsWith('info ') && this.current) {
      this.parseInfo(line, this.current.info);
      return;
    }

    if (line.startsWith('bestmove')) {
      const parts = line.split(/\s+/);
      const bestmove = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
      this.finishCurrent(bestmove);
      return;
    }

    const waiter = this.waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(line);
    }
  }

  private parseInfo(line: string, info: Partial<StockfishEval>) {
    const d = /depth (\d+)/.exec(line);
    if (d) info.depth = parseInt(d[1], 10);
    const sd = /seldepth (\d+)/.exec(line);
    if (sd) info.seldepth = parseInt(sd[1], 10);
    const cp = /score cp (-?\d+)/.exec(line);
    if (cp) {
      info.scoreCp = parseInt(cp[1], 10);
      info.mate = null;
    }
    const mt = /score mate (-?\d+)/.exec(line);
    if (mt) {
      info.mate = parseInt(mt[1], 10);
      info.scoreCp = null;
    }
    const nd = /nodes (\d+)/.exec(line);
    if (nd) info.nodes = parseInt(nd[1], 10);
    const nps = /nps (\d+)/.exec(line);
    if (nps) info.nps = parseInt(nps[1], 10);
    const tm = /time (\d+)/.exec(line);
    if (tm) info.timeMs = parseInt(tm[1], 10);
    const pvIdx = line.indexOf(' pv ');
    if (pvIdx >= 0) info.pv = line.slice(pvIdx + 4).trim().split(/\s+/).filter(Boolean);
  }

  private finishCurrent(bestmove: string | null) {
    const cur = this.current;
    this.current = null;
    if (cur) {
      cur.resolve({
        ...EMPTY_EVAL,
        ...cur.info,
        bestmove,
      });
    }
    if (this.queued) {
      const job = this.queued;
      this.queued = null;
      this.startSearch(job);
    }
  }

  private startSearch(job: Job) {
    if (!this.worker) return;
    this.current = { ...job, info: {} };
    this.worker.postMessage(`position fen ${job.fen}`);
    this.worker.postMessage(`go movetime ${job.movetime}`);
  }

  /** Phân tích một thế cờ. Yêu cầu mới sẽ ngắt yêu cầu đang chạy. */
  async analyse(fen: string, movetime = 700): Promise<StockfishEval> {
    if (this.failed) return { ...EMPTY_EVAL };
    await this.ready();
    if (this.failed) return { ...EMPTY_EVAL };

    return new Promise<StockfishEval>(resolve => {
      const job: Job = { fen, movetime, resolve };
      if (this.current) {
        this.queued = job;
        this.worker!.postMessage('stop');
        return;
      }
      this.startSearch(job);
    });
  }

  /** Dừng hẳn engine và giải phóng tài nguyên. */
  dispose() {
    try {
      this.worker?.postMessage('quit');
      this.worker?.terminate();
    } catch {
      /* ignore */
    }
    this.worker = null;
    this.readyPromise = null;
    this.current = null;
    this.queued = null;
  }
}

/* ------------------------------------------------------------------ *
 * Singleton + tiện ích chuyển PV (UCI) sang SAN
 * ------------------------------------------------------------------ */
let client: StockfishClient | null = null;

export function getStockfish(): StockfishClient {
  if (!client) client = new StockfishClient();
  return client;
}

export function disposeStockfish() {
  client?.dispose();
  client = null;
}

/** Quy điểm về centipawn để so sánh (mate → ±30000). */
export function evalToCp(e: { scoreCp: number | null; mate: number | null }): number {
  if (e.mate !== null && e.mate !== undefined) {
    return e.mate > 0 ? 30000 - e.mate * 100 : -30000 - e.mate * 100;
  }
  return e.scoreCp ?? 0;
}

/** Nhãn chất lượng nước đi dựa trên centipawn bị mất. */
export function moveQualityLabel(loss: number): {
  label: string;
  tone: 'emerald' | 'lime' | 'amber' | 'orange' | 'rose';
} {
  if (loss < 20) return { label: 'Tuyệt vời', tone: 'emerald' };
  if (loss < 50) return { label: 'Nước tốt', tone: 'lime' };
  if (loss < 100) return { label: 'Chấp nhận được', tone: 'amber' };
  if (loss < 300) return { label: 'Bất đắc kỳ', tone: 'orange' };
  return { label: 'Sai lầm nặng', tone: 'rose' };
}
