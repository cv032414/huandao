import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, needsBackupReminder, daysSinceBackup, backupFileName } from '../backup.js';
import { createEmptyData, withWeighIn, withBackupDone } from '../store.js';

const NOW = '2026-11-03T07:00:00.000Z';
const LATE = '2026-11-10T00:00:00.000Z';
const VALUES = { weightKg: 82.4, bodyFatPct: 27.5, skeletalMusclePct: 31.2, visceralFatLevel: 11 };

function sampleData() {
  return withWeighIn(createEmptyData(NOW), '2026-11-03', VALUES, { todayKey: '2026-11-03', nowIso: NOW });
}

test('匯出再匯入，資料一樣，備份時間記成匯出時間', () => {
  const data = sampleData();
  const exportedAt = '2026-11-05T01:00:00.000Z';
  const result = parseBackup(JSON.stringify(buildBackup(data, exportedAt)), LATE);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.days, data.days);
  assert.deepEqual(result.data.settings, data.settings);
  assert.equal(result.data.meta.lastBackupAt, exportedAt);
});

test('不是 JSON 的檔案擋下來', () => {
  assert.equal(parseBackup('hello', LATE).ok, false);
});

test('別的 App 的檔案擋下來', () => {
  assert.equal(parseBackup(JSON.stringify({ app: 'other', data: {} }), LATE).ok, false);
});

test('較新版本的備份擋下來', () => {
  const backup = buildBackup({ ...sampleData(), schemaVersion: 99 }, NOW);
  assert.match(parseBackup(JSON.stringify(backup), LATE).error, /較新的版本/);
});

test('數字不合理的紀錄擋下來', () => {
  const data = sampleData();
  const broken = { ...data, days: { '2026-11-03': { ...data.days['2026-11-03'], weighIn: { ...VALUES, weightKg: '82' } } } };
  assert.equal(parseBackup(JSON.stringify(buildBackup(broken, NOW)), LATE).ok, false);
});

test('日期代號不對的紀錄擋下來', () => {
  const data = sampleData();
  const broken = { ...data, days: { '2026-13-45': data.days['2026-11-03'] } };
  assert.equal(parseBackup(JSON.stringify(buildBackup(broken, NOW)), LATE).ok, false);
});

test('備份檔名', () => {
  assert.equal(backupFileName('2026-11-03'), 'huandao-backup-2026-11-03.json');
});

test('沒有任何紀錄時不提醒備份', () => {
  assert.equal(needsBackupReminder(createEmptyData(NOW), new Date('2026-12-01T00:00:00Z')), false);
});

test('從沒備份過：開始使用滿 7 天提醒', () => {
  const data = sampleData();
  assert.equal(needsBackupReminder(data, new Date('2026-11-09T07:00:00Z')), false);
  assert.equal(needsBackupReminder(data, new Date('2026-11-10T07:00:00Z')), true);
});

test('備份過：從上次備份算 7 天', () => {
  const data = withBackupDone(sampleData(), '2026-11-08T07:00:00.000Z');
  assert.equal(daysSinceBackup(data, new Date('2026-11-10T07:00:00Z')), 2);
  assert.equal(needsBackupReminder(data, new Date('2026-11-10T07:00:00Z')), false);
});

test('匯出時間在未來（時間不對）時不當作已備份，會提醒', () => {
  const result = parseBackup(JSON.stringify(buildBackup(sampleData(), '9999-01-01T00:00:00.000Z')), LATE);
  assert.equal(result.ok, true);
  assert.equal(result.data.meta.lastBackupAt, null);
});

test('時間讀不懂時一律提醒備份', () => {
  const data = { ...sampleData(), meta: { ...sampleData().meta, lastBackupAt: null, createdAt: 'xx' } };
  assert.equal(needsBackupReminder(data, new Date(LATE)), true);
});

test('匯入時數字整理成小數一位，運動欄位只留認得的內容，三餐先清空', () => {
  const data = sampleData();
  const day = data.days['2026-11-03'];
  const messy = {
    ...data,
    days: {
      '2026-11-03': {
        ...day,
        weighIn: { ...day.weighIn, weightKg: 82.456 },
        exercise: { type: 'fly', steps: 'many', trainingCompleted: 'yes', extra: 'x'.repeat(1000) },
        meals: { breakfast: { anything: true } },
      },
    },
  };
  const result = parseBackup(JSON.stringify(buildBackup(messy, NOW)), LATE);
  assert.equal(result.ok, true);
  const clean = result.data.days['2026-11-03'];
  assert.equal(clean.weighIn.weightKg, 82.5);
  assert.deepEqual(clean.exercise, { type: null, steps: null, trainingCompleted: false });
  assert.deepEqual(clean.meals, { breakfast: null, lunch: null, dinner: null });
});
