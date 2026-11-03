// 資料的格式：長什麼樣子、怎麼檢查。手機裡讀出的資料和匯入的備份都經過這裡。
import { isDateKey, getAppDate, toDateKey } from './day.js';
import { WEIGH_FIELDS, checkFieldValue, validateHeight, isBackfillEntry } from './weigh.js';

export const SCHEMA_VERSION = 1;
export const DEFAULT_HEIGHT_CM = 174;

const EXERCISE_TYPES = Object.freeze(['training', 'walk']);
const MAX_STEPS = 100000;
const MEAL_STATUSES = Object.freeze(['followed', 'deviated']);
const CALORIE_STATUSES = Object.freeze(['pending', 'estimated']);
export const MAX_NOTE_LENGTH = 500;
const MAX_MEAL_CALORIES = 5000;
const MAX_SOURCE_LENGTH = 100;
const MAX_LEVEL = 1000;
const MAX_DEVICE_ID_LENGTH = 100;
const MAX_ID_LENGTH = 60;
const MAX_PLAN_ITEMS = 10;
const MAX_ITEM_CALORIES = 3000;
const CHAPTER_COUNT = 3;
export const MENU_CELLS = Object.freeze(['protein', 'staple', 'veg', 'drink']);
export const EXERCISE_KEYS = Object.freeze(['squat', 'pushup', 'bridge', 'plank']);
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** 只接受工具自己寫的時間格式，而且不能晚於現在 */
export function isValidTimestamp(value, nowIso) {
  return typeof value === 'string' && ISO_PATTERN.test(value)
    && !Number.isNaN(Date.parse(value)) && Date.parse(value) <= Date.parse(nowIso);
}

export function createDeviceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 一天的紀錄：
 * - weighIn：體重紀錄或 null
 * - exercise.type：'training' | 'walk' | null（null = 照預設的一三五）；steps：步數；trainingCompleted：訓練打勾
 * - meals.breakfast 等：null（還沒勾）或
 *   { status: 'followed' | 'deviated', note, planned（勾的當下那一餐的菜單）, calories: { value, status: 'pending' | 'estimated', source }, checkedAt }
 * - menuPlan：這天排好的菜單 { breakfast, lunch, dinner }，每餐 { store, items: [{ cell, id, name, kcal }] }；
 *   排好就存起來，之後菜單庫改了也不會影響已經排好的日子
 */
export function createDayRecord(dateKey) {
  return {
    date: dateKey,
    weighIn: null,
    exercise: { type: null, steps: null, trainingCompleted: false },
    meals: { breakfast: null, lunch: null, dinner: null },
    menuPlan: null,
    updatedAt: null,
  };
}

const roundTo1 = (value) => Math.round(value * 10) / 10;
const timestampOrNull = (value, nowIso) => (isValidTimestamp(value, nowIso) ? value : null);

/**
 * 是不是補登，由「哪一天的紀錄」和「什麼時候記的」決定。
 * 有記錄時間就照現在的規則重算（v0.3.2 改過規則，舊資料也跟著更新）。
 */
function backfillFlag(weighIn, dateKey, recordedAt) {
  if (!recordedAt) return weighIn.isBackfill === true;
  return isBackfillEntry(dateKey, toDateKey(getAppDate(new Date(recordedAt))));
}

function sanitizeWeighIn(weighIn, nowIso, dateKey) {
  if (weighIn === null || weighIn === undefined) return { ok: true, value: null };
  if (!isPlainObject(weighIn)) return { ok: false };
  const values = {};
  for (const field of WEIGH_FIELDS) {
    const value = weighIn[field.key] ?? null;
    if (value !== null && typeof value !== 'number') return { ok: false };
    if (checkFieldValue(field, value)) return { ok: false };
    values[field.key] = value === null ? null : roundTo1(value);
  }
  const recordedAt = timestampOrNull(weighIn.recordedAt, nowIso);
  return {
    ok: true,
    value: {
      ...values,
      recordedAt,
      editedAt: timestampOrNull(weighIn.editedAt, nowIso),
      isBackfill: backfillFlag(weighIn, dateKey, recordedAt),
    },
  };
}

function sanitizeExercise(exercise) {
  const empty = createDayRecord('').exercise;
  if (!isPlainObject(exercise)) return empty;
  const { type, steps, trainingCompleted } = exercise;
  return {
    type: EXERCISE_TYPES.includes(type) ? type : null,
    steps: Number.isInteger(steps) && steps >= 0 && steps <= MAX_STEPS ? steps : null,
    trainingCompleted: trainingCompleted === true,
  };
}

function sanitizeCalories(calories) {
  if (!isPlainObject(calories)) return { value: null, status: 'pending', source: null };
  const { value, status, source } = calories;
  return {
    value: Number.isFinite(value) && value >= 0 && value <= MAX_MEAL_CALORIES ? Math.round(value) : null,
    status: CALORIE_STATUSES.includes(status) ? status : 'pending',
    source: typeof source === 'string' && source.length <= MAX_SOURCE_LENGTH ? source : null,
  };
}

const shortString = (value) => typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;

/** 一餐的菜單：{ store, items }；格式不對回傳 null */
export function sanitizePlanMeal(plan) {
  if (!isPlainObject(plan) || !shortString(plan.store) || !Array.isArray(plan.items)) return null;
  if (plan.items.length === 0 || plan.items.length > MAX_PLAN_ITEMS) return null;
  const items = plan.items.map((item) => (
    isPlainObject(item) && MENU_CELLS.includes(item.cell) && shortString(item.id) && shortString(item.name)
      && Number.isInteger(item.kcal) && item.kcal >= 0 && item.kcal <= MAX_ITEM_CALORIES
      ? { cell: item.cell, id: item.id, name: item.name, kcal: item.kcal }
      : null));
  return items.every(Boolean) ? { store: plan.store, items } : null;
}

function sanitizeMenuPlan(menuPlan) {
  if (!isPlainObject(menuPlan)) return null;
  return {
    breakfast: sanitizePlanMeal(menuPlan.breakfast),
    lunch: sanitizePlanMeal(menuPlan.lunch),
    dinner: sanitizePlanMeal(menuPlan.dinner),
  };
}

/** 一餐：格式不對的就當作沒勾 */
function sanitizeMeal(meal, nowIso) {
  if (!isPlainObject(meal) || !MEAL_STATUSES.includes(meal.status)) return null;
  return {
    status: meal.status,
    note: typeof meal.note === 'string' ? meal.note.slice(0, MAX_NOTE_LENGTH) : '',
    planned: sanitizePlanMeal(meal.planned),
    calories: sanitizeCalories(meal.calories),
    checkedAt: timestampOrNull(meal.checkedAt, nowIso),
  };
}

function sanitizeMeals(meals, nowIso) {
  const empty = createDayRecord('').meals;
  if (!isPlainObject(meals)) return empty;
  return Object.fromEntries(Object.keys(empty).map((id) => [id, sanitizeMeal(meals[id], nowIso)]));
}

const dateKeyOrNull = (value) => (isDateKey(value) ? value : null);

/**
 * 遊戲進度：
 * - celebratedLevel：已經跳過升級畫面的等級
 * - startDate：正式開始闖關那天（null = 準備期）
 * - seenSettlementWeek：已經看過「上週結果」的那一週（週一的日期）
 * - chaptersCleared：已經看過過關畫面的章節
 */
const EARLIEST_START_DATE = '2020-01-01';

/** 開始日不能在未來、也不能早得離譜（手機時間錯了或備份檔被改過） */
function plausibleStartDate(value, todayKey) {
  return isDateKey(value) && value >= EARLIEST_START_DATE && value <= todayKey ? value : null;
}

function sanitizeProgress(progress, todayKey) {
  const level = progress?.celebratedLevel;
  const chapters = Array.isArray(progress?.chaptersCleared) ? progress.chaptersCleared : [];
  return {
    celebratedLevel: Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL ? level : 1,
    startDate: plausibleStartDate(progress?.startDate, todayKey),
    seenSettlementWeek: dateKeyOrNull(progress?.seenSettlementWeek),
    chaptersCleared: [...new Set(chapters.filter((n) => Number.isInteger(n) && n >= 1 && n <= CHAPTER_COUNT))].sort(),
  };
}

/** 設定：身高、每個動作選用的版本、訓練提示音 */
function sanitizeSettings(settings, heightCm) {
  const variants = isPlainObject(settings?.exerciseVariants) ? settings.exerciseVariants : {};
  return {
    heightCm,
    exerciseVariants: Object.fromEntries(EXERCISE_KEYS
      .filter((key) => shortString(variants[key]))
      .map((key) => [key, variants[key]])),
    beepEnabled: settings?.beepEnabled !== false,
  };
}

function sanitizeDay(dateKey, day, nowIso) {
  if (!isDateKey(dateKey) || !isPlainObject(day)) return null;
  const weighIn = sanitizeWeighIn(day.weighIn, nowIso, dateKey);
  if (!weighIn.ok) return null;
  return {
    date: dateKey,
    weighIn: weighIn.value,
    exercise: sanitizeExercise(day.exercise),
    meals: sanitizeMeals(day.meals, nowIso),
    menuPlan: sanitizeMenuPlan(day.menuPlan),
    updatedAt: timestampOrNull(day.updatedAt, nowIso),
  };
}

function sanitizeDays(days, nowIso) {
  const result = {};
  for (const [dateKey, day] of Object.entries(days)) {
    const clean = sanitizeDay(dateKey, day, nowIso);
    if (!clean) return { ok: false, error: `${dateKey} 這一天的資料有問題` };
    result[dateKey] = clean;
  }
  return { ok: true, days: result };
}

function sanitizeMeta(meta, nowIso) {
  const deviceId = typeof meta.deviceId === 'string' && meta.deviceId.length <= MAX_DEVICE_ID_LENGTH
    ? meta.deviceId
    : createDeviceId();
  return {
    createdAt: timestampOrNull(meta.createdAt, nowIso) ?? nowIso,
    updatedAt: timestampOrNull(meta.updatedAt, nowIso) ?? nowIso,
    lastBackupAt: timestampOrNull(meta.lastBackupAt, nowIso),
    deviceId,
  };
}

/** 檢查整包資料；格式對就回傳整理過的新資料，不對就回傳錯誤原因 */
export function sanitizeData(data, nowIso) {
  if (!isPlainObject(data)) return { ok: false, error: '資料格式不對' };
  if (!Number.isInteger(data.schemaVersion) || data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: '資料來自較新的版本，請先更新工具' };
  }
  const height = validateHeight(data.settings?.heightCm);
  if (!height.ok || !isPlainObject(data.days) || !isPlainObject(data.meta)) {
    return { ok: false, error: '資料內容不完整' };
  }
  const days = sanitizeDays(data.days, nowIso);
  if (!days.ok) return { ok: false, error: days.error };
  return {
    ok: true,
    data: {
      schemaVersion: SCHEMA_VERSION,
      meta: sanitizeMeta(data.meta, nowIso),
      settings: sanitizeSettings(data.settings, height.value),
      progress: sanitizeProgress(data.progress, toDateKey(getAppDate(new Date(nowIso)))),
      days: days.days,
    },
  };
}
