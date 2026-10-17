import React, { useState } from 'react';
import { Copy, Check, FileText, Download } from 'lucide-react';
import type { MoveRecord } from '../types/chess';

interface MoveHistoryProps {
  history: MoveRecord[];
  currentMoveIndex: number; // -1 = start, 0 = 1st half-move, etc.
  fen: string;
  pgn: string;
  onSelectMove: (halfMoveIndex: number) => void;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  history,
  currentMoveIndex,
  fen,
  pgn,
  onSelectMove,
}) => {
  const [copiedFen, setCopiedFen] = useState(false);
  const [copiedPgn, setCopiedPgn] = useState(false);

  const handleCopyFen = async () => {
    try {
      await navigator.clipboard.writeText(fen);
      setCopiedFen(true);
      setTimeout(() => setCopiedFen(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyPgn = async () => {
    try {
      await navigator.clipboard.writeText(pgn || '1. e4');
      setCopiedPgn(true);
      setTimeout(() => setCopiedPgn(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadPgn = () => {
    const blob = new Blob([pgn || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess_match_${new Date().toISOString().slice(0, 10)}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Header with Title and Actions */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span>Biên bản nước đi ({history.length} lượt)</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopyFen}
            title="Sao chép chuỗi FEN hiện tại"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition cursor-pointer"
          >
            {copiedFen ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedFen ? 'Đã chép FEN' : 'FEN'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPgn}
            title="Sao chép PGN ván đấu"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition cursor-pointer"
          >
            {copiedPgn ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedPgn ? 'Đã chép PGN' : 'PGN'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPgn}
            title="Tải file PGN"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Move List */}
      <div className="flex-1 overflow-y-auto p-2 text-xs max-h-[360px] divide-y divide-slate-800/40">
        {history.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            Chưa có nước đi nào. Nhấn Bắt đầu để quan sát!
          </div>
        ) : (
          history.map((record, idx) => {
            const whiteHalfIdx = idx * 2;
            const blackHalfIdx = idx * 2 + 1;

            const isWhiteActive = currentMoveIndex === whiteHalfIdx;
            const isBlackActive = currentMoveIndex === blackHalfIdx;

            return (
              <div
                key={record.moveNumber}
                className={`grid grid-cols-[36px_1fr_1fr] items-center py-1 px-1.5 rounded transition ${
                  idx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/20'
                }`}
              >
                {/* Move Number */}
                <span className="text-slate-500 font-mono font-semibold">{record.moveNumber}.</span>

                {/* White Move */}
                {record.white ? (
                  <button
                    type="button"
                    onClick={() => onSelectMove(whiteHalfIdx)}
                    className={`flex items-center justify-between px-2 py-0.5 rounded text-left transition cursor-pointer font-mono ${
                      isWhiteActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800/70'
                    }`}
                  >
                    <span>{record.white.san}</span>
                    {record.white.thinkingTimeMs !== undefined && record.white.thinkingTimeMs > 0 && (
                      <span className={`text-[10px] ${isWhiteActive ? 'text-slate-900' : 'text-slate-500'}`}>
                        {record.white.thinkingTimeMs}ms
                      </span>
                    )}
                  </button>
                ) : (
                  <span />
                )}

                {/* Black Move */}
                {record.black ? (
                  <button
                    type="button"
                    onClick={() => onSelectMove(blackHalfIdx)}
                    className={`flex items-center justify-between px-2 py-0.5 rounded text-left transition cursor-pointer font-mono ${
                      isBlackActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-200 hover:bg-slate-800/70'
                    }`}
                  >
                    <span>{record.black.san}</span>
                    {record.black.thinkingTimeMs !== undefined && record.black.thinkingTimeMs > 0 && (
                      <span className={`text-[10px] ${isBlackActive ? 'text-slate-900' : 'text-slate-500'}`}>
                        {record.black.thinkingTimeMs}ms
                      </span>
                    )}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
