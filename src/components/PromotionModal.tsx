import React from 'react';
import { ChessPiece } from './ChessPieces';

interface PromotionModalProps {
  isOpen: boolean;
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
  isOpen,
  color,
  onSelect,
  onCancel,
}) => {
  if (!isOpen) return null;

  const pieces: Array<{ type: 'q' | 'r' | 'b' | 'n'; label: string }> = [
    { type: 'q', label: 'Hậu (Queen)' },
    { type: 'r', label: 'Xe (Rook)' },
    { type: 'b', label: 'Tượng (Bishop)' },
    { type: 'n', label: 'Mã (Knight)' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl max-w-xs w-full text-center">
        <h3 id="promotion-title" className="text-base font-bold text-white mb-1">
          Phong Cấp Cho Tốt
        </h3>
        <p className="text-xs text-slate-400 mb-4">Chọn quân cờ bạn muốn biến hóa thành:</p>

        <div className="grid grid-cols-2 gap-2.5">
          {pieces.map(p => (
            <button
              key={p.type}
              type="button"
              onClick={() => onSelect(p.type)}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 mb-1.5 transition-transform group-hover:scale-110">
                <ChessPiece type={p.type} color={color} />
              </div>
              <span className="text-xs font-bold text-slate-200">{p.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full py-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          Hủy nước đi
        </button>
      </div>
    </div>
  );
};
