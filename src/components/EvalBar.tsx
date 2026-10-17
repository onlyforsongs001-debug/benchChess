import React from 'react';

interface EvalBarProps {
  score: number; // e.g. +2.5 for white, -3.0 for black
  flipped?: boolean;
}

export const EvalBar: React.FC<EvalBarProps> = ({ score, flipped = false }) => {
  // Convert evaluation score to percentage (0% to 100%)
  // Logistic curve: 50 + 50 * (2 / (1 + exp(-0.4 * score)) - 1)
  const clampedScore = Math.max(-15, Math.min(15, score));
  let whitePercent = 50 + (2 / (1 + Math.exp(-0.4 * clampedScore)) - 1) * 50;
  whitePercent = Math.max(5, Math.min(95, whitePercent));

  const displayWhitePercent = flipped ? 100 - whitePercent : whitePercent;
  const isAdvantageWhite = score > 0.3;
  const isAdvantageBlack = score < -0.3;

  return (
    <div className="flex flex-col items-center justify-between h-full py-1">
      <div className="w-4 sm:w-5 h-full bg-slate-900 rounded-full overflow-hidden flex flex-col border border-slate-700 shadow-inner relative">
        {/* Black side on top (if not flipped) */}
        <div
          className="w-full bg-slate-900 transition-all duration-500 ease-out flex items-center justify-center"
          style={{ height: `${100 - displayWhitePercent}%` }}
        />
        {/* White side on bottom */}
        <div
          className="w-full bg-slate-100 transition-all duration-500 ease-out"
          style={{ height: `${displayWhitePercent}%` }}
        />

        {/* Advantage Badge text inside the bar */}
        <div className="absolute inset-x-0 bottom-1 flex items-center justify-center">
          <span className="text-[9px] font-bold font-mono text-slate-800">
            {score > 0 ? `+${score}` : score < 0 ? score : '0.0'}
          </span>
        </div>
      </div>
    </div>
  );
};
