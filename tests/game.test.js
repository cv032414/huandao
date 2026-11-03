import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditTasks, getDayType, stepsXp, validateSteps, getTaskResults, dayXp, isDayComplete,
  weekStartKey, weekSummary, countAchievedPastWeeks, totalXp, xpToReachLevel, levelInfo, shouldSuggestRest,
  countsForXp, firstFullWeekStart, endedWeekStarts, isSettlementWeek, weekStreak,
} from '../game.js';

// 2026-11-02 是週一
const weighIn = (isBackfill = false) => ({ weightKg: 80, isBackfill });
const meal = (status) => ({ status, note: '', planned: null, calories: { value: null, status: 'pending', source: null }, checkedAt: null });
const fullDay = (exercise) => ({
  weighIn: weighIn(),
  exercise: { type: null, steps: null, trainingCompleted: false, ...exercise },
  meals: { breakfast: meal('followed'), lunch: meal('followed'), dinner: meal('followed') },
});

test('任務可以勾的範圍：今天、昨天、前天', () => {
  assert.equal(canEditTasks('2026-11-03', '2026-11-03'), true);
  assert.equal(canEditTasks('2026-11-01', '2026-11-03'), true);
  assert.equal(canEditTasks('2026-10-31', '2026-11-03'), false);
  assert.equal(canEditTasks('2026-11-04', '2026-11-03'), false);
});

test('訓練日／走路日：預設一三五，可以對調', () => {
  assert.equal(getDayType('2026-11-02', undefined), 'training');
  assert.equal(getDayType('2026-11-03', undefined), 'walk');
  assert.equal(getDayType('2026-11-03', { exercise: { type: 'training' } }), 'training');
  assert.equal(getDayType('2026-11-02', { exercise: { type: 'walk' } }), 'walk');
});

test('步數分數：8000 以上 30、5000 以上 15、不到 0', () => {
  assert.deepEqual([stepsXp(8000), stepsXp(7999), stepsXp(5000), stepsXp(4999), stepsXp(null)], [30, 15, 15, 0, 0]);
});

test('步數輸入檢查', () => {
  assert.deepEqual(validateSteps('8500'), { ok: true, value: 8500 });
  assert.deepEqual(validateSteps('8,000'), { ok: true, value: 8000 });
  assert.deepEqual(validateSteps('12，500'), { ok: true, value: 12500 });
  assert.equal(validateSteps('').ok, false);
  assert.equal(validateSteps('80.5').ok, false);
  assert.equal(validateSteps('200000').ok, false);
});

test('訓練日全勾 ✓：一天 70 分、算完成', () => {
  const day = fullDay({ trainingCompleted: true });
  assert.equal(dayXp('2026-11-02', day), 70);
  assert.equal(isDayComplete('2026-11-02', day), true);
});

test('走路日 8000 步全勾 ✓：70 分；5000 步：55 分，仍算完成', () => {
  assert.equal(dayXp('2026-11-03', fullDay({ steps: 9000 })), 70);
  assert.equal(dayXp('2026-11-03', fullDay({ steps: 6000 })), 55);
  assert.equal(isDayComplete('2026-11-03', fullDay({ steps: 6000 })), true);
  assert.equal(isDayComplete('2026-11-03', fullDay({ steps: 4000 })), false);
});

test('△ 也算有勾，但只給 5 分', () => {
  const day = { ...fullDay({ trainingCompleted: true }), meals: { breakfast: meal('deviated'), lunch: meal('followed'), dinner: meal('deviated') } };
  assert.equal(dayXp('2026-11-02', day), 60);
  assert.equal(isDayComplete('2026-11-02', day), true);
});

test('少勾一項就不算完成', () => {
  const day = { ...fullDay({ trainingCompleted: true }), meals: { breakfast: meal('followed'), lunch: null, dinner: meal('followed') } };
  assert.equal(isDayComplete('2026-11-02', day), false);
  assert.equal(getTaskResults('2026-11-02', day).lunch.done, false);
});

test('訓練日只看訓練，有輸入步數也不算', () => {
  const day = fullDay({ steps: 10000, trainingCompleted: false });
  assert.equal(getTaskResults('2026-11-02', day).exercise.done, false);
});

test('超過 2 天補登的體重：算有量，但不給分', () => {
  const day = { weighIn: weighIn(true) };
  assert.deepEqual(getTaskResults('2026-10-01', day).weigh, { done: true, xp: 0 });
});

test('每週從週一開始', () => {
  assert.equal(weekStartKey('2026-11-08'), '2026-11-02');
  assert.equal(weekStartKey('2026-11-02'), '2026-11-02');
  assert.equal(weekStartKey('2026-11-01'), '2026-10-26');
});

function weekWithCompleteDays(count) {
  // 週一到週五依序完成 count 天；一三五訓練，二四走路
  const keys = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].slice(0, count);
  return Object.fromEntries(keys.map((key, i) => [key, fullDay(i % 2 === 0 ? { trainingCompleted: true } : { steps: 8000 })]));
}

test('一週完成 5 天算達標、本週訓練次數', () => {
  assert.deepEqual(weekSummary(weekWithCompleteDays(5), '2026-11-02'), { completeDays: 5, trainingCount: 3, achieved: true });
  assert.equal(weekSummary(weekWithCompleteDays(4), '2026-11-02').achieved, false);
});

test('每週達標 +50：要等那週結束才算', () => {
  const days = weekWithCompleteDays(5);
  const start = '2026-11-02';
  assert.equal(countAchievedPastWeeks(days, '2026-11-08', start), 0);
  assert.equal(countAchievedPastWeeks(days, '2026-11-09', start), 1);
  assert.equal(totalXp(days, '2026-11-08', start), 350);
  assert.equal(totalXp(days, '2026-11-09', start), 400);
});

test('升級門檻：升 2 級 200、升 3 級再 300、升 4 級再 400', () => {
  assert.deepEqual([2, 3, 4, 5].map(xpToReachLevel), [200, 500, 900, 1400]);
  assert.deepEqual(levelInfo(0), { level: 1, xpIntoLevel: 0, xpForNextLevel: 200, xpToNext: 200 });
  assert.equal(levelInfo(199).level, 1);
  assert.equal(levelInfo(200).level, 2);
  assert.deepEqual(levelInfo(650), { level: 3, xpIntoLevel: 150, xpForNextLevel: 400, xpToNext: 250 });
});

test('昨天剛訓練、今天又是訓練日 → 建議休息', () => {
  const days = { '2026-11-02': fullDay({ trainingCompleted: true }), '2026-11-03': { exercise: { type: 'training' } } };
  assert.equal(shouldSuggestRest(days, '2026-11-03'), true);
  assert.equal(shouldSuggestRest(days, '2026-11-04'), false);
  assert.equal(shouldSuggestRest({ '2026-11-03': { exercise: { type: 'training' } } }, '2026-11-03'), false);
});

test('未來日期的紀錄不算分', () => {
  const days = { '2026-11-03': fullDay({ steps: 9000 }), '2026-12-25': fullDay({ steps: 9000 }) };
  assert.equal(totalXp(days, '2026-11-03', '2026-11-01'), 70);
});

test('準備期（沒有開始日）：經驗值一律 0', () => {
  const days = weekWithCompleteDays(5);
  assert.equal(totalXp(days, '2026-11-20', null), 0);
  assert.equal(countsForXp('2026-11-03', null), false);
});

test('開始日之前的紀錄不算分，開始日（含）以後才算', () => {
  const days = weekWithCompleteDays(5); // 11/2–11/6 各 70 分
  assert.equal(totalXp(days, '2026-11-06', '2026-11-04'), 210);
  assert.equal(countsForXp('2026-11-03', '2026-11-04'), false);
  assert.equal(countsForXp('2026-11-04', '2026-11-04'), true);
});

test('第一個完整週：開始日是週一就從那天，否則從下週一', () => {
  assert.equal(firstFullWeekStart('2026-11-02'), '2026-11-02');
  assert.equal(firstFullWeekStart('2026-11-04'), '2026-11-09');
  assert.equal(firstFullWeekStart('2026-11-08'), '2026-11-09');
  assert.equal(isSettlementWeek('2026-11-02', '2026-11-04'), false);
  assert.equal(isSettlementWeek('2026-11-09', '2026-11-04'), true);
});

test('開始日所在的不完整週不結算、不給 +50', () => {
  const days = weekWithCompleteDays(5);
  assert.equal(countAchievedPastWeeks(days, '2026-11-10', '2026-11-03'), 0);
  assert.deepEqual(endedWeekStarts('2026-11-03', '2026-11-10'), []);
  assert.deepEqual(endedWeekStarts('2026-11-03', '2026-11-17'), ['2026-11-09']);
});

function achievedWeek(startKey) {
  const keys = [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(Number(startKey.slice(0, 4)), Number(startKey.slice(5, 7)) - 1, Number(startKey.slice(8)) + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  return Object.fromEntries(keys.map((key) => [key, fullDay({ trainingCompleted: true, steps: 9000 })]));
}

test('連續達標週數：沒達標暫停、連續兩週沒達標才歸零；累計只增不減', () => {
  // 週：11/2 達標、11/9 沒、11/16 達標、11/23 沒、11/30 沒、12/7 達標
  const days = { ...achievedWeek('2026-11-02'), ...achievedWeek('2026-11-16'), ...achievedWeek('2026-12-07') };
  assert.deepEqual(weekStreak(days, '2026-11-17', '2026-11-02').streak, 1);
  assert.deepEqual(weekStreak(days, '2026-11-23', '2026-11-02'), { streak: 2, total: 2 });
  assert.deepEqual(weekStreak(days, '2026-12-07', '2026-11-02'), { streak: 0, total: 2 });
  assert.deepEqual(weekStreak(days, '2026-12-14', '2026-11-02'), { streak: 1, total: 3 });
});
