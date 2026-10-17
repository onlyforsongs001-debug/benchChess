import { useEffect, useRef, useState } from 'react';
import {
  getStockfish,
  evalToCp,
  moveQualityLabel,
  type StockfishEval,
} from '../utils/stockfishClient';

export interface LastMoveReview {
  san: string;
  loss: number;
  label: string;
  tone: 'emerald' | 'lime' | 'amber' | 'orange' | 'rose';
}

export type StockfishStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Options {
  /** Thời gian suy nghĩ cho mỗi lần phân tích (ms) */
  movetime?: number;
  /** FEN của thế trước nước đi vừa rồi (để chấm nước đi) */
  prevFen?: string | null;
  /** SAN của nước đi vừa rồi */
  lastMoveSan?: string | null;
}

/**
 * Đánh giá thế cờ bằng Stockfish theo thời gian thực.
 *
 * - Mỗi khi FEN đổi, engine phân tích lại (ngắt lần đang chạy nếu có).
 * - Điểm của thế trước được cache lại để tính "cp loss" của nước đi vừa rồi
 *   (so với nước đi tốt nhất mà Stockfish chọn).
 */
export function useStockfishAnalysis(
  fen: string | null,
  enabled: boolean,
  { movetime = 700, prevFen = null, lastMoveSan = null }: Options = {}
) {
  const [evalInfo, setEvalInfo] = useState<StockfishEval | null>(null);
  const [status, setStatus] = useState<StockfishStatus>('idle');
  const [lastMove, setLastMove] = useState<LastMoveReview | null>(null);
  const cacheRef = useRef<Map<string, StockfishEval>>(new Map());

  useEffect(() => {
    if (!enabled || !fen) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    const timer = setTimeout(async () => {
      try {
        const res = await getStockfish().analyse(fen, movetime);
        if (cancelled) return;

        cacheRef.current.set(fen, res);
        // Giới hạn bộ nhớ cache
        if (cacheRef.current.size > 60) {
          const first = cacheRef.current.keys().next().value;
          if (first) cacheRef.current.delete(first);
        }
        setEvalInfo(res);
        setStatus('ready');

        // Chấm nước đi vừa rồi.
        // `before` = điểm thế trước nước đi, góc nhìn người đi (≈ giá trị nếu đi nước tốt nhất)
        // `after`  = điểm thế sau nước đi, quy về cùng góc nhìn người đi
        // cp loss  = before − after  (nước đi làm tệ đi bao nhiêu)
        if (prevFen && lastMoveSan) {
          const prev = cacheRef.current.get(prevFen);
          if (prev) {
            const before = evalToCp(prev);
            const after = -evalToCp(res);
            const loss = Math.max(0, before - after);
            const q = moveQualityLabel(loss);
            setLastMove({ san: lastMoveSan, loss, label: q.label, tone: q.tone });
          }
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fen, enabled, prevFen, lastMoveSan, movetime]);

  return { evalInfo, status, lastMove };
}
