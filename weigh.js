// 體重紀錄的規則：欄位檢查、BMI、補登與修改（規格書 v0.3.1 第 6、7 節）
import { daysBetween, getAppDate, toDateKey } from './day.js';

// 今天之外，往前幾天內的紀錄還能修改
export const EDIT_WINDOW_DAYS = 2;

export const WEIGH_FIELDS = Object.freeze([
  Object.freeze({ key: 'weightKg', label: '體重', unit: '公斤', min: 30, max: 250, required: true }),
  Object.freeze({ key: 'bodyFatPct', label: '體脂率', unit: '%', min: 3, max: 70, required: false }),
  Object.freeze({ key: 'skeletalMusclePct', label: '骨骼肌率', unit: '%', min: 10, max: 60, required: false }),
  Object.freeze({ key: 'visceralFatLevel', label: '內臟脂肪', unit: '等級', min: 1, max: 30, required: false }),
]);

export const HEIGHT_RANGE = Object.freeze({ min: 100, max: 230 });

// 國健署成人 BMI 分級
const BMI_LEVELS = Object.freeze([
  { below: 18.5, label: '體重過輕' },
  { below: 24, label: '正常範圍' },
  { below: 27, label: '過重' },
  { below: 30, label: '輕度肥胖' },
  { below: 35, label: '中度肥胖' },
  { below: Infinity, label: '重度肥胖' },
]);

const roundTo1 = (value) => Math.round(value * 10) / 10;

/** 把使用者打的字變成數字；空白回傳 null，看不懂回傳 NaN */
export function parseNumberInput(raw) {
  const text = String(raw ?? '').trim().replace(/，|,/g, '.');
  if (text === '') return null;
  if (!/^\d+(\.\d+)?$/.test(text)) return NaN;
  return Number(text);
}

export function checkFieldValue(field, value) {
  if (value === null) return field.required ? `請輸入${field.label}` : null;
  if (Number.isNaN(value)) return `${field.label}請輸入數字`;
  if (value < field.min || value > field.max) {
    return `${field.label}應該在 ${field.min}–${field.max} ${field.unit}之間`;
  }
  return null;
}

/** 檢查 4 個欄位；回傳 { ok, values, errors } */
export function validateWeighIn(rawInputs) {
  const values = {};
  const errors = {};
  for (const field of WEIGH_FIELDS) {
    const parsed = parseNumberInput(rawInputs[field.key]);
    const error = checkFieldValue(field, parsed);
    if (error) errors[field.key] = error;
    else values[field.key] = parsed === null ? null : roundTo1(parsed);
  }
  const ok = Object.keys(errors).length === 0;
  return { ok, values: ok ? values : null, errors };
}

export function validateHeight(raw) {
  const value = parseNumberInput(raw);
  if (value === null || Number.isNaN(value)) return { ok: false, error: '請輸入身高（公分）' };
  if (value < HEIGHT_RANGE.min || value > HEIGHT_RANGE.max) {
    return { ok: false, error: `身高應該在 ${HEIGHT_RANGE.min}–${HEIGHT_RANGE.max} 公分之間` };
  }
  return { ok: true, value: roundTo1(value) };
}

export function calcBmi(weightKg, heightCm) {
  const heightM = heightCm / 100;
  return roundTo1(weightKg / (heightM * heightM));
}

export function bmiLabel(bmi) {
  return BMI_LEVELS.find((level) => bmi < level.below).label;
}

/** 超過 2 天的日子補記才算補登（補登不給經驗值）；今天、昨天、前天補記都是正常紀錄 */
export function isBackfillEntry(dateKey, todayKey) {
  return daysBetween(dateKey, todayKey) > EDIT_WINDOW_DAYS;
}

/** 補登的紀錄是不是今天補登的（補登當天還能改、能刪） */
export function isBackfilledToday(record, todayKey) {
  if (!record?.isBackfill || !record.recordedAt) return false;
  return toDateKey(getAppDate(new Date(record.recordedAt))) === todayKey;
}

/**
 * 某一天的體重能不能存、能不能刪（record = 那天已有的紀錄或 null）：
 * - 今天、昨天、前天：可以新增、修改、刪除
 * - 更早的日子：沒紀錄可以補登；補登當天可以改、可以刪；其他鎖住
 * - 未來的日子：不行
 */
export function getEditAccess(dateKey, todayKey, record) {
  const daysAgo = daysBetween(dateKey, todayKey);
  if (daysAgo < 0) return { canSave: false, canDelete: false, reason: '不能記錄未來的日子' };
  if (daysAgo <= EDIT_WINDOW_DAYS) return { canSave: true, canDelete: Boolean(record), reason: null };
  if (!record) return { canSave: true, canDelete: false, reason: null };
  if (isBackfilledToday(record, todayKey)) return { canSave: true, canDelete: true, reason: null };
  return { canSave: false, canDelete: false, reason: `超過 ${EDIT_WINDOW_DAYS} 天的紀錄不能修改或刪除` };
}

/** 找某一天之前最近一筆體重紀錄；回傳 { dateKey, weighIn } 或 null */
export function findPreviousWeighIn(days, dateKey) {
  const earlierKey = Object.keys(days)
    .filter((key) => key < dateKey && days[key].weighIn)
    .sort()
    .pop();
  return earlierKey ? { dateKey: earlierKey, weighIn: days[earlierKey].weighIn } : null;
}

export function isWeightUp(previousWeighIn, currentWeighIn) {
  return Boolean(previousWeighIn && currentWeighIn) && currentWeighIn.weightKg > previousWeighIn.weightKg;
}
