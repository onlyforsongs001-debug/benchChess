import React, { useState } from 'react';
import {
  X,
  Bot,
  BrainCircuit,
  Swords,
  Trash2,
  Sparkles,
  Code2,
  Check,
  MessageSquarePlus,
  Plus,
  UserPlus,
} from 'lucide-react';
import type { ChessBot } from '../types/chess';

interface BotManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bots: ChessBot[];
  whiteBotId: string;
  blackBotId: string;
  onSelectWhiteBot: (botId: string) => void;
  onSelectBlackBot: (botId: string) => void;
  onDeleteBot: (botId: string) => void;
  onAddBot?: (bot: ChessBot) => void;
}

const CODE_TEMPLATE = `function getMove(fen, legalMoves, chessState) {
  if (!legalMoves || legalMoves.length === 0) return null;
  if (legalMoves.length === 1) return legalMoves[0];

  // Ví dụ: ăn quân nếu có, nếu không thì đi nước đầu tiên hợp lệ
  const capture = legalMoves.find(m => m.captured);
  return capture || legalMoves[0];
}`;

export const BotManagerModal: React.FC<BotManagerModalProps> = ({
  isOpen,
  onClose,
  bots,
  whiteBotId,
  blackBotId,
  onSelectWhiteBot,
  onSelectBlackBot,
  onDeleteBot,
  onAddBot,
}) => {
  const [selectedBotId, setSelectedBotId] = useState<string>(bots[0]?.id || '');
  const [mode, setMode] = useState<'roster' | 'add'>('roster');

  // Form thêm bot
  const [name, setName] = useState('');
  const [modelName, setModelName] = useState('');
  const [elo, setElo] = useState('1500');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState(CODE_TEMPLATE);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentBot = bots.find(b => b.id === selectedBotId) || bots[0];

  const handleSubmit = () => {
    if (!name.trim()) {
      setFormError('Cần nhập tên bot.');
      return;
    }
    if (!/function\s+(getMove|chooseMove|botMove)\s*\(/.test(code)) {
      setFormError('Script phải chứa hàm getMove(fen, legalMoves, chessState).');
      return;
    }
    const id = `custom-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bot'}-${Date.now().toString(36)}`;
    const newBot: ChessBot = {
      id,
      name: name.trim(),
      modelName: modelName.trim() || 'Bot tự chế',
      description: description.trim() || 'Bot do người dùng nạp trực tiếp.',
      avatar: '',
      colorTheme: 'from-emerald-600 to-teal-800',
      eloEstimate: Math.max(100, Math.min(4000, parseInt(elo, 10) || 1500)),
      code,
      isBuiltIn: false,
      wins: 0,
      draws: 0,
      losses: 0,
    };
    onAddBot?.(newBot);
    setName('');
    setModelName('');
    setElo('1500');
    setDescription('');
    setCode(CODE_TEMPLATE);
    setFormError(null);
    setSelectedBotId(id);
    setMode('roster');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bot-manager-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 id="bot-manager-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Danh Sách Bot AI Đã Nạp
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  {bots.length} Bot
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Chọn Bot cầm Trắng và Đen để thi đấu, hoặc xem mã thuật toán của từng Bot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'roster' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('add');
                  setFormError(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Thêm Bot AI</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('roster');
                  setFormError(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Quay lại danh sách</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {mode === 'add' ? (
          /* Form thêm bot mới */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/25 text-[11px] text-slate-300 leading-relaxed">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Script của bot sẽ được chạy trong <strong className="text-white">Web Worker sandbox</strong>:
                  không truy cập được <code>window</code>/<code>localStorage</code>/<code>fetch</code>, và bị giới hạn
                  thời gian 2 giây mỗi nước đi. Hàm bắt buộc:
                  <code className="ml-1 px-1 py-0.5 rounded bg-slate-950 text-emerald-300">getMove(fen, legalMoves, chessState)</code>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-300">Tên bot *</span>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ví dụ: GPT-5 Turbo"
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-slate-100 outline-none focus:border-indigo-500 transition"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-300">Mô hình</span>
                  <input
                    type="text"
                    value={modelName}
                    onChange={e => setModelName(e.target.value)}
                    placeholder="Ví dụ: OpenAI GPT-5"
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-slate-100 outline-none focus:border-indigo-500 transition"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-300">ELO ước tính</span>
                  <input
                    type="number"
                    value={elo}
                    min={100}
                    max={4000}
                    onChange={e => setElo(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-slate-100 outline-none focus:border-indigo-500 transition font-mono"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-300">Mô tả</span>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Thuật toán, điểm mạnh…"
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-sm text-slate-100 outline-none focus:border-indigo-500 transition"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-indigo-400" /> Mã nguồn thuật toán
                </span>
                <textarea
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  spellCheck={false}
                  rows={12}
                  className="mt-1 w-full px-3 py-2.5 rounded-lg bg-slate-950/90 border border-slate-700 text-xs font-mono text-emerald-300 leading-relaxed outline-none focus:border-indigo-500 transition resize-y"
                />
              </label>

              {formError && (
                <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-500/30 rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nạp bot vào sàn đấu</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('roster');
                    setFormError(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition cursor-pointer"
                >
                  Huỷ
                </button>
              </div>
            </div>
          </div>
        ) : bots.length === 0 ? (
          /* Empty state: No bots yet */
          <div className="flex-1 p-8 sm:p-12 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center mb-4 text-indigo-400 shadow-xl">
              <MessageSquarePlus className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Chưa có Bot AI nào trong hệ thống</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Bạn hãy gửi <strong>Tên Bot</strong> và <strong>Script do AI viết</strong> trong khung chat, mình sẽ nạp trực tiếp vào hệ thống cho bạn ngay lập tức!
            </p>
          </div>
        ) : (
          /* Bot Roster & Inspection Grid */
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr] divide-y md:divide-y-0 md:divide-x divide-slate-800">
            {/* Left Column: Bot Roster */}
            <div className="flex flex-col h-full bg-slate-950/50 overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Chọn Đấu Thủ ({bots.length})
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {bots.map(b => {
                  const isSelected = selectedBotId === b.id;
                  const isWhite = whiteBotId === b.id;
                  const isBlack = blackBotId === b.id;

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBotId(b.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 border-indigo-500 shadow-sm'
                          : 'bg-slate-900/60 border-slate-800/70 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-700 bg-slate-800 flex items-center justify-center">
                          {b.avatar ? (
                            <img src={b.avatar} alt={b.name} className="w-full h-full object-cover" />
                          ) : (
                            <Bot className="w-5 h-5 text-indigo-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-100 truncate">{b.name}</h4>
                            <span className="text-[10px] text-amber-400 font-mono font-semibold">
                              ~{b.eloEstimate}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{b.modelName}</p>

                          {/* Quick White / Black select */}
                          <div className="flex items-center gap-1.5 mt-2">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onSelectWhiteBot(b.id);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                isWhite
                                  ? 'bg-white text-slate-950 border-white shadow'
                                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {isWhite ? '✓ Cầm Trắng' : 'Cầm Trắng'}
                            </button>

                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onSelectBlackBot(b.id);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                isBlack
                                  ? 'bg-slate-950 text-white border-slate-400 ring-1 ring-slate-400 shadow'
                                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {isBlack ? '✓ Cầm Đen' : 'Cầm Đen'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Bot Details & Script Viewer */}
            {currentBot && (
              <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <BrainCircuit className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-100">{currentBot.name}</h3>
                      <p className="text-xs text-slate-400">
                        Mô hình: <span className="text-slate-200 font-semibold">{currentBot.modelName}</span> • ELO: <span className="font-mono text-amber-400">~{currentBot.eloEstimate}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteBot(currentBot.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Bot</span>
                  </button>
                </div>

                {/* Matchup Assign Buttons */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-medium">
                    Gán vị trí thi đấu trong trận:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectWhiteBot(currentBot.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        whiteBotId === currentBot.id
                          ? 'bg-white text-slate-950 shadow-md ring-2 ring-indigo-500'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {whiteBotId === currentBot.id ? '✓ Đang Cầm Trắng' : 'Chọn Cầm Trắng'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectBlackBot(currentBot.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        blackBotId === currentBot.id
                          ? 'bg-slate-950 text-white border border-slate-500 ring-2 ring-indigo-500 shadow-md'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {blackBotId === currentBot.id ? '✓ Đang Cầm Đen' : 'Chọn Cầm Đen'}
                    </button>
                  </div>
                </div>

                {/* Script Code Viewer */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-indigo-400" />
                      Mã Nguồn Thuật Toán Của Bot:
                    </span>
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Chạy trong Web Worker sandbox
                    </span>
                  </div>

                  <pre className="w-full max-h-[320px] overflow-y-auto p-4 bg-slate-950/90 border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 leading-relaxed whitespace-pre-wrap select-all">
                    {currentBot.code}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
