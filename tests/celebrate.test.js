import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingCelebration, levelUpContent, chapterContent } from '../views/celebrate.js';
import { createEmptyData } from '../store.js';
import { addDays } from '../day.js';

const meal = { status: 'followed', note: '', planned: null, calories: { value: null, status: 'pending', source: null }, checkedAt: null };
/** 一整天都完成（量體重、訓練、三餐） */
const fullDay = (weightKg) => ({
  weighIn: { weightKg, isBackfill: false },
  exercise: { type: 'training', steps: null, trainingCompleted: true },
  meals: { breakfast: meal, lunch: meal, dinner: meal },
});

function dataWith({ startDate, days, progress = {} }) {
  const base = createEmptyData('2026-10-01T00:00:00.000Z');
  return { ...base, days, progress: { ...base.progress, startDate, ...progress } };
}

/** 2026-10-12（週一）那週每天 75 公斤、全部完成 → 彰化，第一章過關 */
const days = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [addDays('2026-10-12', i), fullDay(75)]));

test('準備期不跳任何畫面', () => {
  assert.equal(pendingCelebration(dataWith({ startDate: null, days }), '2026-10-20'), null);
});

test('順序：上週結果 → 第一次過關 → 升級', () => {
  const todayKey = '2026-10-20';
  const first = pendingCelebration(dataWith({ startDate: '2026-10-12', days }), todayKey);
  assert.equal(first.key, 'settle:2026-10-12');
  assert.equal(first.content.big, '彰化 75');
  assert.ok(first.content.lines.some((line) => String(line).includes('達標')));

  const afterSettle = first.save(dataWith({ startDate: '2026-10-12', days }));
  const second = pendingCelebration(afterSettle, todayKey);
  assert.equal(second.key, 'chapter:1');

  const third = pendingCelebration(second.save(afterSettle), todayKey);
  assert.match(third.key, /^level:/);
  assert.equal(pendingCelebration(third.save(second.save(afterSettle)), todayKey), null);
});

test('已經過關過的章，再到一次不再跳大畫面', () => {
  const data = dataWith({ startDate: '2026-10-12', days, progress: { seenSettlementWeek: '2026-10-12', chaptersCleared: [1], celebratedLevel: 99 } });
  assert.equal(pendingCelebration(data, '2026-10-20'), null);
});

test('升級畫面列出這次解鎖的進階版', () => {
  assert.match(levelUpContent(3, 2).lines[0], /解鎖進階版/);
  assert.equal(levelUpContent(4, 3).lines.length, 1);
  assert.match(levelUpContent(6, 2).lines[0], /、/); // 一次升好幾級，兩個都列
});

test('過關畫面：第三章是環島完成的結局', () => {
  assert.equal(chapterContent(1).big, '彰化 75');
  assert.equal(chapterContent(3).title, '環島完成！');
});

test('過關畫面有彩帶和這一章的成就數字', () => {
  const first = chapterContent(1);
  assert.equal(first.withConfetti, true);
  assert.equal(first.lines[0].text, '這一章減了 5 公斤：台北 80 → 彰化 75');
  assert.equal(chapterContent(2).lines[0].text, '這一章減了 4 公斤：彰化 75 → 墾丁 71');
  assert.ok(chapterContent(3).lines.some((line) => (line.text ?? line) === '這一章減了 6 公斤：墾丁 71 → 台北 65'));
});

test('環島完成：總共減了幾公斤、花了幾週', () => {
  const ending = chapterContent(3, { startWeight: 80.1, finalAvg: 64.8, lost: 15.3, weeks: 30 });
  const texts = ending.lines.map((line) => line.text ?? line);
  assert.ok(texts.includes('總共減了 15.3 公斤'));
  assert.ok(texts.includes('花了 30 週'));
  // 試玩（沒有真實資料）時用站的公斤數
  assert.ok(chapterContent(3).lines.some((line) => (line.text ?? line).includes('共 15 公斤')));
});
