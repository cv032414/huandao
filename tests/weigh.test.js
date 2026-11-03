import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNumberInput, validateWeighIn, validateHeight, calcBmi, bmiLabel,
  getEditAccess, isBackfillEntry, isBackfilledToday, findPreviousWeighIn, isWeightUp,
} from '../weigh.js';

test('數字輸入：空白是 null、逗號當小數點、亂打是 NaN', () => {
  assert.equal(parseNumberInput('  '), null);
  assert.equal(parseNumberInput('82,4'), 82.4);
  assert.ok(Number.isNaN(parseNumberInput('8a')));
  assert.ok(Number.isNaN(parseNumberInput('-5')));
});

test('只填體重也能存，其他 3 項存成空的', () => {
  const result = validateWeighIn({ weightKg: '82.46', bodyFatPct: '', skeletalMusclePct: '', visceralFatLevel: '' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.values, { weightKg: 82.5, bodyFatPct: null, skeletalMusclePct: null, visceralFatLevel: null });
});

test('沒填體重不能存', () => {
  const result = validateWeighIn({ weightKg: '', bodyFatPct: '25' });
  assert.equal(result.ok, false);
  assert.equal(result.errors.weightKg, '請輸入體重');
});

test('超出合理範圍的數字擋下來', () => {
  const result = validateWeighIn({ weightKg: '820', bodyFatPct: '90' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.weightKg);
  assert.ok(result.errors.bodyFatPct);
});

test('身高檢查', () => {
  assert.deepEqual(validateHeight('174'), { ok: true, value: 174 });
  assert.equal(validateHeight('17.4').ok, false);
  assert.equal(validateHeight('').ok, false);
});

test('BMI：174 公分 83 公斤約 27.4，輕度肥胖', () => {
  const bmi = calcBmi(83, 174);
  assert.equal(bmi, 27.4);
  assert.equal(bmiLabel(bmi), '輕度肥胖');
  assert.equal(bmiLabel(calcBmi(72, 174)), '正常範圍');
});

const RECORD = { weightKg: 83, isBackfill: false, recordedAt: '2026-11-01T00:00:00.000Z' };
// 2026-11-03 早上 9 點（台灣）= 01:00Z；補登在今天
const BACKFILLED_TODAY = { weightKg: 84, isBackfill: true, recordedAt: '2026-11-03T01:00:00.000Z' };
const BACKFILLED_YESTERDAY = { weightKg: 84, isBackfill: true, recordedAt: '2026-11-02T01:00:00.000Z' };

test('今天、昨天、前天：可以改、有紀錄就可以刪', () => {
  for (const key of ['2026-11-03', '2026-11-02', '2026-11-01']) {
    assert.deepEqual(getEditAccess(key, '2026-11-03', RECORD), { canSave: true, canDelete: true, reason: null });
    assert.equal(getEditAccess(key, '2026-11-03', null).canDelete, false);
  }
});

test('超過 2 天、沒紀錄：可以補登，沒東西可刪', () => {
  assert.deepEqual(getEditAccess('2026-10-31', '2026-11-03', null), { canSave: true, canDelete: false, reason: null });
});

test('補登當天還能改、能刪', () => {
  const access = getEditAccess('2026-10-20', '2026-11-03', BACKFILLED_TODAY);
  assert.equal(access.canSave, true);
  assert.equal(access.canDelete, true);
});

test('補登隔天起鎖住', () => {
  const access = getEditAccess('2026-10-20', '2026-11-03', BACKFILLED_YESTERDAY);
  assert.equal(access.canSave, false);
  assert.equal(access.canDelete, false);
});

test('超過 2 天的正常紀錄鎖住，不能改也不能刪', () => {
  const access = getEditAccess('2026-10-31', '2026-11-03', RECORD);
  assert.equal(access.canSave, false);
  assert.equal(access.canDelete, false);
  assert.match(access.reason, /不能修改或刪除/);
});

test('未來的日子不能記', () => {
  assert.equal(getEditAccess('2026-11-04', '2026-11-03', null).canSave, false);
});

test('補登：超過 2 天才算；今天、昨天、前天補記是正常紀錄', () => {
  // 週三補記週二 → 正常；週日補記上週二 → 補登
  assert.equal(isBackfillEntry('2026-11-03', '2026-11-04'), false);
  assert.equal(isBackfillEntry('2026-11-01', '2026-11-03'), false);
  assert.equal(isBackfillEntry('2026-10-31', '2026-11-03'), true);
  assert.equal(isBackfillEntry('2026-11-03', '2026-11-08'), true);
});

test('判斷是不是今天補登的', () => {
  assert.equal(isBackfilledToday(BACKFILLED_TODAY, '2026-11-03'), true);
  assert.equal(isBackfilledToday(BACKFILLED_YESTERDAY, '2026-11-03'), false);
  assert.equal(isBackfilledToday(RECORD, '2026-11-03'), false);
  assert.equal(isBackfilledToday(null, '2026-11-03'), false);
});

test('找前一筆體重紀錄，跳過沒量的日子', () => {
  const days = {
    '2026-11-01': { weighIn: { weightKg: 83 } },
    '2026-11-02': { weighIn: null },
    '2026-11-04': { weighIn: { weightKg: 82 } },
  };
  assert.deepEqual(findPreviousWeighIn(days, '2026-11-03'), { dateKey: '2026-11-01', weighIn: { weightKg: 83 } });
  assert.equal(findPreviousWeighIn(days, '2026-11-01'), null);
});

test('比上一筆重才算變重', () => {
  assert.equal(isWeightUp({ weightKg: 82 }, { weightKg: 82.3 }), true);
  assert.equal(isWeightUp({ weightKg: 82 }, { weightKg: 82 }), false);
  assert.equal(isWeightUp(null, { weightKg: 82 }), false);
});
