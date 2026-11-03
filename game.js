// 每日任務、經驗值、等級、每週達標的規則（規格書 v0.3.3 第 7 節）
// 經驗值不另外存，每次都從每一天的紀錄算出來，修改、刪除紀錄時自動正確。
import { addDays, daysBetween, isDefaultTrainingDay, parseDateKey, toDateKey } from './day.js';
import { EDIT_WINDOW_DAYS } from './weigh.js';

const MAX_STEPS_INPUT = 100000;

export const XP = Object.freeze({
  weigh: 10,
  training: 30,
  walkFull: 30,
  walkHalf: 15,
  mealFollowed: 10,
  mealDeviated: 5,
  weeklyBonus: 50,
});

export const STEPS_FULL = 8000;
export const STEPS_HALF = 5000;
export const DAYS_TO_ACHIEVE_WEEK = 5;
export const TRAININGS_PER_WEEK = 3;
export const MEAL_IDS = Object.freeze(['breakfast', 'lunch', 'dinner']);
export const MEAL_LABELS = Object.freeze({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐' });

/** 今天、昨天、前天的任務可以勾、改（不用管補登，超過 2 天的任務本來就不能勾） */
export function canEditTasks(dateKey, todayKey) {
  const daysAgo = daysBetween(dateKey, todayKey);
  return daysAgo >= 0 && daysAgo <= EDIT_WINDOW_DAYS;
}

/** 這天是訓練日還是走路日：有對調就照對調，沒有就照預設的一三五 */
export function getDayType(dateKey, day) {
  const override = day?.exercise?.type;
  if (override === 'training' || override === 'walk') return override;
  return isDefaultTrainingDay(parseDateKey(dateKey)) ? 'training' : 'walk';
}

/** 步數可以打「8,000」：逗號當千位分隔符號拿掉（不能當小數點） */
export function validateSteps(raw) {
  const text = String(raw ?? '').trim().replace(/[,，\s]/g, '');
  if (!/^\d+$/.test(text)) return { ok: false, error: '請輸入步數（整數）' };
  const value = Number(text);
  if (value > MAX_STEPS_INPUT) return { ok: false, error: `步數應該在 0–${MAX_STEPS_INPUT} 之間` };
  return { ok: true, value };
}

export function stepsXp(steps) {
  if (!Number.isInteger(steps)) return 0;
  if (steps >= STEPS_FULL) return XP.walkFull;
  if (steps >= STEPS_HALF) return XP.walkHalf;
  return 0;
}

function weighTask(day) {
  const weighIn = day?.weighIn ?? null;
  // 超過 2 天的補登：算有量，但不給經驗值
  return { done: Boolean(weighIn), xp: weighIn && !weighIn.isBackfill ? XP.weigh : 0 };
}

function exerciseTask(dateKey, day) {
  if (getDayType(dateKey, day) === 'training') {
    const done = day?.exercise?.trainingCompleted === true;
    return { done, xp: done ? XP.training : 0 };
  }
  const xp = stepsXp(day?.exercise?.steps);
  return { done: xp > 0, xp };
}

function mealTask(meal) {
  if (meal?.status === 'followed') return { done: true, xp: XP.mealFollowed };
  if (meal?.status === 'deviated') return { done: true, xp: XP.mealDeviated };
  return { done: false, xp: 0 };
}

/** 一天 5 項任務各自有沒有完成、拿幾分 */
export function getTaskResults(dateKey, day) {
  return {
    weigh: weighTask(day),
    exercise: exerciseTask(dateKey, day),
    breakfast: mealTask(day?.meals?.breakfast),
    lunch: mealTask(day?.meals?.lunch),
    dinner: mealTask(day?.meals?.dinner),
  };
}

export function dayXp(dateKey, day) {
  return Object.values(getTaskResults(dateKey, day)).reduce((sum, task) => sum + task.xp, 0);
}

/** 5 項全部有勾才算這天完成（✓ 和 △ 都算有勾） */
export function isDayComplete(dateKey, day) {
  return Object.values(getTaskResults(dateKey, day)).every((task) => task.done);
}

/** 這一週的週一 */
export function weekStartKey(dateKey) {
  const date = parseDateKey(dateKey);
  const offset = (date.getDay() + 6) % 7;
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset));
}

export function weekDateKeys(startKey) {
  const start = parseDateKey(startKey);
  return Array.from({ length: 7 }, (_, i) => toDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

export function weekSummary(days, startKey) {
  const keys = weekDateKeys(startKey);
  const completeDays = keys.filter((key) => isDayComplete(key, days[key])).length;
  const trainingCount = keys.filter((key) => getDayType(key, days[key]) === 'training'
    && days[key]?.exercise?.trainingCompleted === true).length;
  return { completeDays, trainingCount, achieved: completeDays >= DAYS_TO_ACHIEVE_WEEK };
}

/** 開始日（含）以後的日子才算經驗值；準備期（還沒開始）都不算 */
export function countsForXp(dateKey, startDate) {
  return Boolean(startDate) && dateKey >= startDate;
}

/** 開始日之後第一個完整的週一；開始日剛好是週一就是那天 */
export function firstFullWeekStart(startDate) {
  const weekStart = weekStartKey(startDate);
  return weekStart === startDate ? startDate : addDays(weekStart, 7);
}

/** 要結算的週：從第一個完整週到上週（已經過完的週），依時間排 */
export function endedWeekStarts(startDate, todayKey) {
  if (!startDate) return [];
  const currentWeek = weekStartKey(todayKey);
  const weeks = [];
  for (let week = firstFullWeekStart(startDate); week < currentWeek; week = addDays(week, 7)) weeks.push(week);
  return weeks;
}

/** 這一週會不會結算（開始日所在的不完整週、準備期都不結算） */
export function isSettlementWeek(weekStart, startDate) {
  return Boolean(startDate) && weekStart >= firstFullWeekStart(startDate);
}

export function countAchievedPastWeeks(days, todayKey, startDate) {
  return endedWeekStarts(startDate, todayKey).filter((week) => weekSummary(days, week).achieved).length;
}

export function totalXp(days, todayKey, startDate) {
  // 未來日期的紀錄（只可能來自被改過的備份檔）不算分
  const fromDays = Object.entries(days)
    .filter(([key]) => key <= todayKey && countsForXp(key, startDate))
    .reduce((sum, [key, day]) => sum + dayXp(key, day), 0);
  return fromDays + countAchievedPastWeeks(days, todayKey, startDate) * XP.weeklyBonus;
}

/**
 * 連續達標週數與累計達標週數：
 * 沒達標的週暫停（不加不減），連續兩週沒達標才歸零；累計只增不減。
 */
export function weekStreak(days, todayKey, startDate) {
  let streak = 0;
  let total = 0;
  let misses = 0;
  for (const week of endedWeekStarts(startDate, todayKey)) {
    if (weekSummary(days, week).achieved) {
      streak += 1;
      total += 1;
      misses = 0;
    } else {
      misses += 1;
      if (misses >= 2) streak = 0;
    }
  }
  return { streak, total };
}

/** 升到第 n 級需要的累計經驗值：升 2 級 200、升 3 級再 300、升 4 級再 400… */
export function xpToReachLevel(level) {
  return level <= 1 ? 0 : 50 * (level * level + level - 2);
}

export function levelInfo(xp) {
  let level = 1;
  while (xp >= xpToReachLevel(level + 1)) level += 1;
  const floor = xpToReachLevel(level);
  const next = xpToReachLevel(level + 1);
  return { level, xpIntoLevel: xp - floor, xpForNextLevel: next - floor, xpToNext: next - xp };
}

/** 昨天剛做過訓練、今天又是訓練日 → 建議中間休息一天（只提醒） */
export function shouldSuggestRest(days, dateKey) {
  if (getDayType(dateKey, days[dateKey]) !== 'training') return false;
  const date = parseDateKey(dateKey);
  const yesterday = toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
  const yesterdayDay = days[yesterday];
  return getDayType(yesterday, yesterdayDay) === 'training' && yesterdayDay?.exercise?.trainingCompleted === true;
}

/** 目前等級（準備期一律 Lv.1） */
export function currentLevel(data, todayKey) {
  return levelInfo(totalXp(data.days, todayKey, data.progress.startDate)).level;
}
