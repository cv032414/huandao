// 日期與每日任務的規則（規格書 v0.3.1）

// 凌晨 4 點才換日：4 點前都算前一天
export const DAY_ROLLOVER_HOUR = 4;

// 預設訓練日：週一、三、五（0 = 週日）
export const DEFAULT_TRAINING_WEEKDAYS = Object.freeze([1, 3, 5]);

const WEEKDAY_NAMES = Object.freeze(['日', '一', '二', '三', '四', '五', '六']);
const MS_PER_HOUR = 60 * 60 * 1000;

const WEIGH_TASK = Object.freeze({ id: 'weigh', label: '早上量體重', hint: '體重必填，其他 3 項可空著' });
const TRAINING_TASK = Object.freeze({ id: 'training', label: '早晨訓練', hint: '約 15–18 分鐘' });
const WALK_TASK = Object.freeze({ id: 'walk', label: '走路 8000 步', hint: '看 iPhone「健康」App 後輸入步數' });
const MEAL_HINT = '照菜單 ✓，或有吃但沒照 △';
const MEAL_TASKS = Object.freeze([
  Object.freeze({ id: 'breakfast', label: '早餐', hint: MEAL_HINT }),
  Object.freeze({ id: 'lunch', label: '午餐', hint: MEAL_HINT }),
  Object.freeze({ id: 'dinner', label: '晚餐', hint: MEAL_HINT }),
]);

/** 回傳工具認定的「今天」（只有年月日，時間為 0 點） */
export function getAppDate(now) {
  const shifted = new Date(now.getTime() - DAY_ROLLOVER_HOUR * MS_PER_HOUR);
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

export function isDefaultTrainingDay(appDate) {
  return DEFAULT_TRAINING_WEEKDAYS.includes(appDate.getDay());
}

/** 例：11 月 3 日（週二） */
export function formatAppDate(appDate) {
  const weekday = WEEKDAY_NAMES[appDate.getDay()];
  return `${appDate.getMonth() + 1} 月 ${appDate.getDate()} 日（週${weekday}）`;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** 日期代號，例：2026-11-03（資料用這個當每一天的名字） */
export function toDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  return toDateKey(parseDateKey(value)) === value;
}

export function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** 從 fromKey 到 toKey 差幾天（toKey 較晚為正數） */
export function daysBetween(fromKey, toKey) {
  return Math.round((parseDateKey(toKey) - parseDateKey(fromKey)) / MS_PER_DAY);
}

/** 往後（正數）或往前（負數）幾天的日期代號 */
export function addDays(dateKey, count) {
  const date = parseDateKey(dateKey);
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + count));
}

/** 今天的 5 項任務：量體重、訓練或走路、三餐 */
export function buildDailyTasks(isTrainingDay) {
  const exerciseTask = isTrainingDay ? TRAINING_TASK : WALK_TASK;
  return [WEIGH_TASK, exerciseTask, ...MEAL_TASKS];
}
