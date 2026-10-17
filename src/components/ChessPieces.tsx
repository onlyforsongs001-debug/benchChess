import React from 'react';

interface PieceProps {
  type: string; // 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
  color: 'w' | 'b';
  className?: string;
}

export const ChessPiece: React.FC<PieceProps> = ({ type, color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#ffffff' : '#1e293b';
  const stroke = isWhite ? '#334155' : '#94a3b8';
  const highlight = isWhite ? '#f8fafc' : '#0f172a';

  switch (type.toLowerCase()) {
    case 'p':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 L 34,39.5 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 1.47,-1.19 2.41,-3 2.41,-5.03 0,-2.41 -1.33,-4.5 -3.28,-5.62 c 0.49,-0.67 0.78,-1.49 0.78,-2.38 0,-2.21 -1.79,-4 -4,-4 z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'n':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="m 22,10 c 10.5,1 16.5,8 16,29 L 15,39 C 15,30 9.5,23.5 9.5,17 9.5,13.5 12,10.5 16,10 c 3,0 6,1 6,1 z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="m 24,18 c 0.38,2.91 -5.55,7.37 -8,9 -3,2 -2.82,4.34 -5,4 -1.042,-0.94 1.41,-3.04 0,-3 -1,0 0.19,1.23 -1,2 -1,0 -4.003,1 -4,-4 0,-2 6,-12 6,-12 0,0 1.89,-1.9 2,-3.5 -0.73,-0.99 -0.5,-2 -0.5,-3 1,-1 3,2.5 3,2.5 z"
            fill={highlight}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <circle cx="15" cy="15" r="1.5" fill={stroke} />
        </svg>
      );

    case 'b':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
            <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
            <path d="m 25 8 a 2.5 2.5 0 1 1 -5 0 a 2.5 2.5 0 1 1 5 0 z" />
            <path d="m 17.5,26 l 10,0 M 15,30 l 15,0" />
            <path d="m 22.5,15.5 l 0,6 M 20,18 l 5,0" />
          </g>
        </svg>
      );

    case 'r':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" />
            <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" />
            <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" />
            <path d="M 34,14 L 31,17 L 14,17 L 11,14" />
            <path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17" />
            <path d="M 14,29.5 L 11,32 L 34,32 L 31,29.5" />
            <path d="M 14,16.5 L 31,16.5" />
          </g>
        </svg>
      );

    case 'q':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 8 12 A 2 2 0 1 1 4 12 A 2 2 0 1 1 8 12 z M 24.5 7.5 A 2 2 0 1 1 20.5 7.5 A 2 2 0 1 1 24.5 7.5 z M 41 12 A 2 2 0 1 1 37 12 A 2 2 0 1 1 41 12 z M 16 8.5 A 2 2 0 1 1 12 8.5 A 2 2 0 1 1 16 8.5 z M 33 8.5 A 2 2 0 1 1 29 8.5 A 2 2 0 1 1 33 8.5 z" />
            <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38,14 L 31,25 L 22.5,10 L 14,25 L 7,14 L 9,26 z" />
            <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 10.5,36 10.5,36 C 9,37.5 11,38.5 11,38.5 L 34,38.5 C 34,38.5 35.5,37.5 34.5,36 C 34.5,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 L 9,26 z" />
            <path d="M 11,38.5 A 35 35 1 0 0 34,38.5" />
          </g>
        </svg>
      );

    case 'k':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 22.5,11.63 L 22.5,6" stroke={stroke} />
            <path d="M 20,8 L 25,8" stroke={stroke} />
            <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 22.5,25 z" />
            <path d="M 12.5,37 C 15,40.5 30,40.5 32.5,37 C 32.5,30 38.5,25.5 38.5,18 C 38.5,13 32,10.5 27.5,13 C 25,14.5 24.5,16 22.5,16 C 20.5,16 20,14.5 17.5,13 C 13,10.5 6.5,13 6.5,18 C 6.5,25.5 12.5,30 12.5,37 z" />
            <path d="M 11.5,37 C 17,40.5 28,40.5 33.5,37" />
            <path d="M 11.5,30 C 17,33.5 28,33.5 33.5,30" />
            <path d="M 11.5,33.5 C 17,37 28,37 33.5,33.5" />
          </g>
        </svg>
      );

    default:
      return null;
  }
};
