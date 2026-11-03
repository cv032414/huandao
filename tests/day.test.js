import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAppDate, isDefaultTrainingDay, formatAppDate, buildDailyTasks } from '../day.js';

test('凌晨 3:59 還算前一天', () => {
  const appDate = getAppDate(new Date(2026, 10, 4, 3, 59));
  assert.equal(appDate.getDate(), 3);
});

test('凌晨 4:00 換成新的一天', () => {
  const appDate = getAppDate(new Date(2026, 10, 4, 4, 0));
  assert.equal(appDate.getDate(), 4);
});

test('月初凌晨跨回上個月最後一天', () => {
  const appDate = getAppDate(new Date(2026, 11, 1, 1, 0));
  assert.deepEqual([appDate.getMonth(), appDate.getDate()], [10, 30]);
});

test('週一、三、五是預設訓練日，其他不是', () => {
  // 2026-11-02 是週一
  const flags = [2, 3, 4, 5, 6, 7, 8].map((day) => isDefaultTrainingDay(new Date(2026, 10, day)));
  assert.deepEqual(flags, [true, false, true, false, true, false, false]);
});

test('日期顯示成中文格式', () => {
  assert.equal(formatAppDate(new Date(2026, 10, 3)), '11 月 3 日（週二）');
});

test('訓練日的 5 項任務', () => {
  const labels = buildDailyTasks(true).map((task) => task.label);
  assert.deepEqual(labels, ['早上量體重', '早晨訓練', '早餐', '午餐', '晚餐']);
});

test('走路日的 5 項任務', () => {
  const labels = buildDailyTasks(false).map((task) => task.label);
  assert.deepEqual(labels, ['早上量體重', '走路 8000 步', '早餐', '午餐', '晚餐']);
});
