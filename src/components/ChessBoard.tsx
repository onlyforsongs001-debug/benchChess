import React, { useState } from 'react';
import { ChessPiece } from './ChessPieces';
import type { LegalMoveObj } from '../utils/rules';

export type BoardTheme = 'emerald' | 'wood' | 'dark' | 'neon';

interface ChessBoardProps {
  fen: string;
  flipped?: boolean;
  theme?: BoardTheme;
  lastMove?: { from: string; to: string } | null;
  selectedSquare?: string | null;
  legalTargets?: LegalMoveObj[];
  inCheckKingSquare?: string | null;
  onSquareClick?: (square: string) => void;
  interactive?: boolean;
}

const THEME_STYLES: Record<BoardTheme, { light: string; dark: string; border: string }> = {
  emerald: {
    light: 'bg-[#ebecd0] text-[#779556]',
    dark: 'bg-[#779556] text-[#ebecd0]',
    border: 'border-[#465b34]',
  },
  wood: {
    light: 'bg-[#e2c499] text-[#b88b4a]',
    dark: 'bg-[#b88b4a] text-[#e2c499]',
    border: 'border-[#784e27]',
  },
  dark: {
    light: 'bg-[#3b4252] text-[#4c566a]',
    dark: 'bg-[#2e3440] text-[#eceff4]',
    border: 'border-[#1e222a]',
  },
  neon: {
    light: 'bg-[#1e1e38] text-[#38bdf8]',
    dark: 'bg-[#0f0f23] text-[#f43f5e]',
    border: 'border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.15)]',
  },
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  flipped = false,
  theme = 'emerald',
  lastMove,
  selectedSquare,
  legalTargets = [],
  inCheckKingSquare,
  onSquareClick,
  interactive = true,
}) => {
  // Parse FEN into 8x8 grid
  const fenPosition = fen.split(' ')[0];
  const rows = fenPosition.split('/');

  const board: Array<Array<{ type: string; color: 'w' | 'b' } | null>> = [];
  for (let r = 0; r < 8; r++) {
    const rowString = rows[r];
    const rowPieces: Array<{ type: string; color: 'w' | 'b' } | null> = [];
    for (const char of rowString) {
      if (/[1-8]/.test(char)) {
        const empties = parseInt(char, 10);
        for (let i = 0; i < empties; i++) rowPieces.push(null);
      } else {
        const color = char === char.toUpperCase() ? 'w' : 'b';
        rowPieces.push({ type: char.toLowerCase(), color });
      }
    }
    board.push(rowPieces);
  }

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const displayFiles = flipped ? [...files].reverse() : files;
  const displayRanks = flipped ? [...ranks].reverse() : ranks;

  const getSquareCoord = (rowIdx: number, colIdx: number): string => {
    const file = displayFiles[colIdx];
    const rank = displayRanks[rowIdx];
    return `${file}${rank}`;
  };

  const getPieceAtCoord = (coord: string) => {
    const file = coord[0];
    const rank = coord[1];
    const fileIdx = files.indexOf(file);
    const rankIdx = 8 - parseInt(rank, 10);
    return board[rankIdx]?.[fileIdx];
  };

  const currentTheme = THEME_STYLES[theme];

  return (
    <div
      data-testid="chess-board-container"
      className={`relative select-none aspect-square w-full max-w-[min(540px,58vh)] rounded-xl overflow-hidden border-4 shadow-2xl transition-all duration-300 ${currentTheme.border}`}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {displayRanks.map((rank, rIdx) => {
          return displayFiles.map((file, cIdx) => {
            const squareCoord = `${file}${rank}`;
            const isLight = (rIdx + cIdx) % 2 === 0;
            const piece = getPieceAtCoord(squareCoord);

            const isLastMoveFrom = lastMove?.from === squareCoord;
            const isLastMoveTo = lastMove?.to === squareCoord;
            const isSelected = selectedSquare === squareCoord;
            const isKingInCheck = inCheckKingSquare === squareCoord;

            const targetMove = legalTargets.find(m => m.to === squareCoord);
            const isLegalTarget = Boolean(targetMove);
            const isCaptureTarget = isLegalTarget && Boolean(targetMove?.captured || piece);

            return (
              <button
                key={squareCoord}
                type="button"
                onClick={() => onSquareClick?.(squareCoord)}
                disabled={!interactive}
                aria-label={`Ô ${squareCoord}${piece ? ` - Quân ${piece.color === 'w' ? 'Trắng' : 'Đen'} ${piece.type.toUpperCase()}` : ''}`}
                className={`relative flex items-center justify-center p-1 transition-colors duration-150 cursor-pointer ${
                  isLight ? currentTheme.light : currentTheme.dark
                } ${
                  isLastMoveFrom || isLastMoveTo
                    ? 'ring-inset ring-4 ring-amber-400/70 bg-amber-200/40'
                    : ''
                } ${
                  isSelected ? 'bg-yellow-300/80 ring-inset ring-4 ring-yellow-500' : ''
                } ${
                  isKingInCheck ? 'bg-red-600/80 animate-pulse ring-inset ring-4 ring-red-400' : ''
                }`}
              >
                {/* Square Coordinate Labels (only at edges) */}
                {cIdx === 0 && (
                  <span className="absolute top-0.5 left-1 text-[10px] sm:text-xs font-bold opacity-60 pointer-events-none select-none">
                    {rank}
                  </span>
                )}
                {rIdx === 7 && (
                  <span className="absolute bottom-0.5 right-1 text-[10px] sm:text-xs font-bold opacity-60 pointer-events-none select-none">
                    {file}
                  </span>
                )}

                {/* Piece Rendering */}
                {piece && (
                  <div className="w-full h-full flex items-center justify-center z-10 drop-shadow-md">
                    <ChessPiece type={piece.type} color={piece.color} />
                  </div>
                )}

                {/* Legal Target Dot / Ring Marker */}
                {isLegalTarget && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    {isCaptureTarget ? (
                      <div className="w-full h-full border-4 border-emerald-500/80 rounded-full animate-pulse" />
                    ) : (
                      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500/80 rounded-full shadow-md" />
                    )}
                  </div>
                )}
              </button>
            );
          });
        })}
      </div>
    </div>
  );
};
