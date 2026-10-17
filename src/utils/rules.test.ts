import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  calculateMaterial,
  getChessStateInfo,
  getDetailedLegalMoves,
  normalizeBotMoveOutput,
  executeBotScript,
  DEFAULT_BOTS,
} from './rules.ts';

test('calculateMaterial correctly scores starting position', () => {
  const chess = new Chess();
  const mat = calculateMaterial(chess);
  assert.equal(mat.whiteScore, 39.5); // 8p(8) + 2n(6) + 2b(6.5) + 2r(10) + 1q(9) = 39.5
  assert.equal(mat.blackScore, mat.whiteScore);
  assert.equal(mat.balance, 0);
  assert.equal(mat.capturedByWhite.length, 0);
  assert.equal(mat.capturedByBlack.length, 0);
});

test('calculateMaterial updates when pieces are captured', () => {
  const chess = new Chess();
  // 1. e4 d5 2. exd5
  chess.move('e4');
  chess.move('d5');
  chess.move('exd5');
  const mat = calculateMaterial(chess);
  assert.equal(mat.capturedByWhite.includes('p'), true);
  assert.equal(mat.balance, 1); // White is +1 pawn
});

test('getDetailedLegalMoves returns all 20 standard opening moves', () => {
  const chess = new Chess();
  const legal = getDetailedLegalMoves(chess);
  assert.equal(legal.length, 20); // 16 pawn moves (1 or 2 squares) + 4 knight moves
  const sans = legal.map(m => m.san);
  assert.equal(sans.includes('e4'), true);
  assert.equal(sans.includes('Nf3'), true);
});

test('normalizeBotMoveOutput handles UCI, SAN, and objects', () => {
  const chess = new Chess();
  const legal = getDetailedLegalMoves(chess);

  // UCI string
  const uciResult = normalizeBotMoveOutput('e2e4', legal);
  assert.notEqual(uciResult, null);
  assert.equal(uciResult?.from, 'e2');
  assert.equal(uciResult?.to, 'e4');

  // SAN string
  const sanResult = normalizeBotMoveOutput('e4', legal);
  assert.notEqual(sanResult, null);
  assert.equal(sanResult?.from, 'e2');
  assert.equal(sanResult?.to, 'e4');

  // Object
  const objResult = normalizeBotMoveOutput({ from: 'g1', to: 'f3' }, legal);
  assert.notEqual(objResult, null);
  assert.equal(objResult?.from, 'g1');
  assert.equal(objResult?.to, 'f3');

  // Illegal move should return null
  const illegal = normalizeBotMoveOutput('e2e5', legal);
  assert.equal(illegal, null);
});

test('executeBotScript runs Gemini 3.8 Flash bot script successfully on initial position', () => {
  const chess = new Chess();
  const fen = chess.fen();
  const geminiBot = DEFAULT_BOTS.find(b => b.id === 'gemini-38-flash');
  assert.ok(geminiBot, 'Gemini 3.8 Flash bot must exist in DEFAULT_BOTS');

  const res = executeBotScript(geminiBot.code, fen, 1000);
  assert.equal(res.success, true, `Gemini 3.8 Flash execution failed: ${res.error}`);
  assert.ok(res.move);
  assert.ok(res.move?.from);
  assert.ok(res.move?.to);
});

test('executeBotScript runs DeepSeek V4.1 Flash bot script successfully on initial position', () => {
  const chess = new Chess();
  const fen = chess.fen();
  const deepseekBot = DEFAULT_BOTS.find(b => b.id === 'deepseek-v41-flash');
  assert.ok(deepseekBot, 'DeepSeek V4.1 Flash bot must exist in DEFAULT_BOTS');

  const res = executeBotScript(deepseekBot.code, fen, 1000);
  assert.equal(res.success, true, `DeepSeek V4.1 Flash execution failed: ${res.error}`);
  assert.ok(res.move);
  assert.ok(res.move?.from);
  assert.ok(res.move?.to);
});

test('executeBotScript runs Claude Sonnet 5.5 bot script successfully on initial position', () => {
  const chess = new Chess();
  const fen = chess.fen();
  const claudeBot = DEFAULT_BOTS.find(b => b.id === 'claude-sonnet-55');
  assert.ok(claudeBot, 'Claude Sonnet 5.5 bot must exist in DEFAULT_BOTS');

  const res = executeBotScript(claudeBot.code, fen, 1000);
  assert.equal(res.success, true, `Claude Sonnet 5.5 execution failed: ${res.error}`);
  assert.ok(res.move);
  assert.ok(res.move?.from);
  assert.ok(res.move?.to);
});

test('executeBotScript catches bad syntax or illegal moves cleanly', () => {
  const chess = new Chess();
  const fen = chess.fen();

  // Bad syntax
  const badSyntax = executeBotScript('function getMove() { return nonExistentVar.call(); }', fen);
  assert.equal(badSyntax.success, false);
  assert.ok(badSyntax.error);

  // Illegal move
  const illegalMove = executeBotScript('function getMove() { return "e1e8"; }', fen);
  assert.equal(illegalMove.success, false);
  assert.ok(illegalMove.error?.includes('không hợp lệ'));
});
