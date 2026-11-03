// 「成果」頁的計算：體重與身體數值的趨勢、一週平均、時間範圍、試玩用的假資料。
// 只讀資料、不改資料；試玩的假資料只放在記憶體裡，絕對不存。
import { addDays, daysBetween } from './day.js';
import { weekStartKey } from './game.js';

export const METRICS = Object.freeze([
  { key: 'weightKg', label: '體重', unit: '公斤', digits: 1 },
  { key: 'bodyFatPct', label: '體脂率', unit: '%', digits: 1 },
  { key: 'skeletalMusclePct', label: '骨骼肌率', unit: '%', digits: 1 },
  { key: 'visceralFatLevel', label: '內臟脂肪', unit: '級', digits: 1 },
]);

export const RANGES = Object.freeze([
  { id: '4w', label: '4 週', days: 28 },
  { id: '3m', label: '3 個月', days: 91 },
  { id: 'all', label: '全部', days: null },
]);
export const DEFAULT_RANGE_ID = '3m';

/** 一週平均放在週四畫（一週的中間） */
const WEEK_MIDDLE_OFFSET = 3;

/** 四捨五入到小數點後一位（地圖結算也用這個） */
export function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

/** 某一項數值的每日點（只有那天有填才有點），依日期排，不含未來日期 */
export function dailyPoints(days, metricKey, todayKey) {
  return Object.keys(days)
    .filter((key) => key <= todayKey)
    .sort()
    .map((key) => ({ date: key, value: days[key]?.weighIn?.[metricKey] }))
    .filter((point) => typeof point.value === 'number' && Number.isFinite(point.value));
}

/**
 * 平均後四捨五入到小數點後一位。用「十分之一公斤」的整數來算，
 * 避免小數運算的誤差（例如 74.0 和 74.1 平均 74.05，要算成 74.1，不能變成 74.0）
 */
export function averageToTenth(values) {
  const tenths = values.reduce((sum, value) => sum + Math.round(value * 10), 0);
  return Math.round(tenths / values.length) / 10;
}

/** 一週（週一到週日）的平均體重和紀錄天數；沒有紀錄時 avg 是 null */
export function weekAverage(days, weekStart) {
  const values = Array.from({ length: 7 }, (_, i) => days[addDays(weekStart, i)]?.weighIn?.weightKg)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return { weekStart, avg: null, count: 0 };
  return { weekStart, avg: averageToTenth(values), count: values.length };
}

/** 每週平均線：每個有紀錄的週一個點，畫在週四 */
export function weeklyAveragePoints(points) {
  const groups = new Map();
  for (const point of points) {
    const week = weekStartKey(point.date);
    groups.set(week, [...(groups.get(week) ?? []), point.value]);
  }
  return [...groups.entries()].map(([week, values]) => ({
    date: addDays(week, WEEK_MIDDLE_OFFSET),
    weekStart: week,
    value: averageToTenth(values),
    count: values.length,
  }));
}

/** 圖的左右範圍（日期）；「全部」從第一筆紀錄開始 */
export function rangeDomain(rangeId, points, todayKey) {
  const range = RANGES.find((item) => item.id === rangeId) ?? RANGES.find((item) => item.id === DEFAULT_RANGE_ID);
  const first = points[0]?.date ?? todayKey;
  const from = range.days === null ? first : addDays(todayKey, -(range.days - 1));
  // 至少留 7 天寬，免得只有一兩筆時擠成一條線
  const start = daysBetween(from, todayKey) < 6 ? addDays(todayKey, -6) : from;
  return { from: start, to: todayKey };
}

export function pointsInDomain(points, domain) {
  return points.filter((point) => point.date >= domain.from && point.date <= domain.to);
}

/** 上下範圍取整齊的數字，上下各留一點空間 */
export function niceValueDomain(values, minSpan = 1) {
  if (values.length === 0) return { min: 0, max: 1, step: 1 };
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, minSpan);
  const step = [0.5, 1, 2, 5, 10, 20].find((candidate) => span / candidate <= 4) ?? 50;
  const min = Math.floor((low - span * 0.1) / step) * step;
  const max = Math.ceil((high + span * 0.1) / step) * step;
  return { min: roundToTenth(min), max: roundToTenth(max), step };
}

export function valueTicks({ min, max, step }) {
  const ticks = [];
  for (let value = min; value <= max + 1e-9; value += step) ticks.push(roundToTenth(value));
  return ticks;
}

/** 範圍裡第一筆和最後一筆差多少（只算有紀錄的） */
export function changeSummary(points) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return { from: first, to: last, diff: roundToTenth(last.value - first.value) };
}

/**
 * 試玩用的假資料：大約 4 個月，從 80 公斤慢慢往下，有上下波動、偶爾漏量。
 * 只給圖表和地圖預覽用，不會存進手機。
 */
export function buildSampleDays(todayKey, random = Math.random) {
  const totalDays = 120;
  const days = {};
  for (let i = totalDays - 1; i >= 0; i -= 1) {
    if (random() < 0.15) continue; // 偶爾忘了量
    const progress = (totalDays - 1 - i) / (totalDays - 1);
    const trend = 80.4 - progress * 5.6;
    const wobble = (random() - 0.5) * 1.2;
    const weightKg = roundToTenth(trend + wobble);
    const hasExtras = random() > 0.2;
    days[addDays(todayKey, -i)] = {
      weighIn: {
        weightKg,
        bodyFatPct: hasExtras ? roundToTenth(27.5 - progress * 3.5 + (random() - 0.5) * 0.8) : null,
        skeletalMusclePct: hasExtras ? roundToTenth(31.5 + progress * 1.2 + (random() - 0.5) * 0.6) : null,
        visceralFatLevel: hasExtras ? roundToTenth(Math.round(12 - progress * 3) + (random() < 0.2 ? 0.5 : 0)) : null,
        isBackfill: false,
      },
    };
  }
  return { days, startDate: addDays(todayKey, -(totalDays - 15)) };
}
