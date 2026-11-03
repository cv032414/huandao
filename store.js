// 資料怎麼存：整份資料是一個物件，存在手機的 localStorage 裡。
// 每次修改都產生新的物件，不直接改舊的。
import { isBackfillEntry } from './weigh.js';
import {
  SCHEMA_VERSION, DEFAULT_HEIGHT_CM, createDayRecord, createDeviceId, sanitizeData,
} from './schema.js';

export { SCHEMA_VERSION, DEFAULT_HEIGHT_CM, createDayRecord };

export const STORAGE_KEY = 'huandao.data';
// 匯入前的資料保留兩份：最近一次與再前一次
export const SAFETY_COPY_KEY = 'huandao.data.beforeImport';
export const OLDER_SAFETY_COPY_KEY = 'huandao.data.beforeImport.previous';

export function createEmptyData(nowIso) {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { createdAt: nowIso, updatedAt: nowIso, lastBackupAt: null, deviceId: createDeviceId() },
    settings: { heightCm: DEFAULT_HEIGHT_CM, exerciseVariants: {}, beepEnabled: true },
    progress: { celebratedLevel: 1, startDate: null, seenSettlementWeek: null, chaptersCleared: [] },
    days: {},
  };
}

function withDay(data, dateKey, updateDay, nowIso) {
  const day = data.days[dateKey] ?? createDayRecord(dateKey);
  return {
    ...data,
    meta: { ...data.meta, updatedAt: nowIso },
    days: { ...data.days, [dateKey]: { ...updateDay(day), updatedAt: nowIso } },
  };
}

/** 存某一天的體重；第一次記錄時決定是不是補登，之後修改不改變 */
export function withWeighIn(data, dateKey, values, { todayKey, nowIso }) {
  return withDay(data, dateKey, (day) => {
    const previous = day.weighIn;
    const weighIn = {
      ...values,
      recordedAt: previous?.recordedAt ?? nowIso,
      editedAt: previous ? nowIso : null,
      isBackfill: previous ? previous.isBackfill : isBackfillEntry(dateKey, todayKey),
    };
    return { ...day, weighIn };
  }, nowIso);
}

/** 刪除某一天的體重（那一天的其他紀錄保留） */
export function withoutWeighIn(data, dateKey, nowIso) {
  if (!data.days[dateKey]?.weighIn) return data;
  return withDay(data, dateKey, (day) => ({ ...day, weighIn: null }), nowIso);
}

/** 訓練日／走路日對調；改回預設時存 null */
export function withDayType(data, dateKey, type, defaultType, nowIso) {
  const stored = type === defaultType ? null : type;
  return withDay(data, dateKey, (day) => ({ ...day, exercise: { ...day.exercise, type: stored } }), nowIso);
}

export function withTrainingCompleted(data, dateKey, completed, nowIso) {
  return withDay(data, dateKey, (day) => ({ ...day, exercise: { ...day.exercise, trainingCompleted: completed } }), nowIso);
}

export function withSteps(data, dateKey, steps, nowIso) {
  return withDay(data, dateKey, (day) => ({ ...day, exercise: { ...day.exercise, steps } }), nowIso);
}

const planKcal = (planned) => planned.items.reduce((sum, item) => sum + item.kcal, 0);

/**
 * 一餐的紀錄。planned = 勾的當下這一餐排的菜單。
 * 照菜單 ✓ 的熱量就用菜單的數字（標「已估算」、來源「菜單」）；沒照 △ 的等第二階段 AI 再估。
 */
export function createMealEntry(status, note, nowIso, planned = null) {
  const fromMenu = status === 'followed' && planned;
  return {
    status,
    note,
    planned,
    calories: fromMenu
      ? { value: planKcal(planned), status: 'estimated', source: 'menu' }
      : { value: null, status: 'pending', source: null },
    checkedAt: nowIso,
  };
}

/** 勾餐：status 為 'followed'（✓）、'deviated'（△）或 null（取消勾選） */
export function withMealStatus(data, dateKey, mealId, status, nowIso) {
  return withDay(data, dateKey, (day) => {
    const previous = day.meals[mealId];
    const planned = day.menuPlan?.[mealId] ?? null;
    const meal = status === null ? null : createMealEntry(status, previous?.note ?? '', nowIso, planned);
    return { ...day, meals: { ...day.meals, [mealId]: meal } };
  }, nowIso);
}

export function withMealNote(data, dateKey, mealId, note, nowIso) {
  if (!data.days[dateKey]?.meals?.[mealId]) return data;
  return withDay(data, dateKey, (day) => (
    { ...day, meals: { ...day.meals, [mealId]: { ...day.meals[mealId], note } } }
  ), nowIso);
}

/** 正式開始闖關：記下開始日，等級與畫面紀錄從頭算 */
export function withStartDate(data, startDate) {
  if (data.progress?.startDate) return data;
  return {
    ...data,
    progress: { ...data.progress, startDate, celebratedLevel: 1, seenSettlementWeek: null, chaptersCleared: [] },
  };
}

export function withSeenSettlement(data, weekStart) {
  return { ...data, progress: { ...data.progress, seenSettlementWeek: weekStart } };
}

export function withChapterCleared(data, chapter) {
  const cleared = new Set([...(data.progress?.chaptersCleared ?? []), chapter]);
  return { ...data, progress: { ...data.progress, chaptersCleared: [...cleared].sort() } };
}

/** 存某一天排好的菜單（整天三餐一起存） */
export function withMenuPlan(data, dateKey, menuPlan, nowIso) {
  return withDay(data, dateKey, (day) => ({ ...day, menuPlan }), nowIso);
}

/** 選用某個動作的版本（簡單版、起始版或解鎖的進階版） */
export function withExerciseVariant(data, exerciseKey, variantId) {
  const exerciseVariants = { ...data.settings.exerciseVariants, [exerciseKey]: variantId };
  return { ...data, settings: { ...data.settings, exerciseVariants } };
}

export function withBeepEnabled(data, beepEnabled) {
  return { ...data, settings: { ...data.settings, beepEnabled } };
}

/** 訓練做完：當天改成訓練日（如果原本是走路日）並打勾 */
export function withTrainingFinished(data, dateKey, defaultType, nowIso) {
  return withTrainingCompleted(withDayType(data, dateKey, 'training', defaultType, nowIso), dateKey, true, nowIso);
}

/** 記下已經慶祝過的等級（只增不減），升級畫面才不會重複出現 */
export function withCelebratedLevel(data, level) {
  const celebratedLevel = Math.max(data.progress?.celebratedLevel ?? 1, level);
  return { ...data, progress: { ...data.progress, celebratedLevel } };
}

export function withSettings(data, patch, nowIso) {
  return {
    ...data,
    meta: { ...data.meta, updatedAt: nowIso },
    settings: { ...data.settings, ...patch },
  };
}

export function withBackupDone(data, nowIso) {
  return { ...data, meta: { ...data.meta, lastBackupAt: nowIso } };
}

export function countWeighIns(data) {
  return Object.values(data.days).filter((day) => day.weighIn).length;
}

function keepCorruptCopy(storage, raw) {
  try {
    storage.setItem(`${STORAGE_KEY}.corrupt.${Date.now()}`, raw);
    return true;
  } catch {
    return false;
  }
}

/** 讀取資料；讀不懂時另存一份原文，回傳新的空白資料並附上錯誤 */
export function loadData(storage, nowIso) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return { data: createEmptyData(nowIso), error: null };
  let result;
  try {
    result = sanitizeData(JSON.parse(raw), nowIso);
  } catch {
    result = { ok: false };
  }
  if (result.ok) return { data: result.data, error: null };
  const saved = keepCorruptCopy(storage, raw);
  return {
    data: createEmptyData(nowIso),
    error: saved
      ? '手機裡的資料讀不出來，原本的內容已另存一份。請從備份匯入。'
      : '手機裡的資料讀不出來。請先不要記錄新資料，直接從備份匯入。',
  };
}

export function saveData(storage, data) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: `存檔失敗：${err.message}` };
  }
}

/** 匯入前把目前的資料另存一份，原本那份往後挪，萬一匯錯還救得回來 */
export function saveSafetyCopy(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return;
  const latest = storage.getItem(SAFETY_COPY_KEY);
  if (latest !== null) storage.setItem(OLDER_SAFETY_COPY_KEY, latest);
  storage.setItem(SAFETY_COPY_KEY, raw);
}

/** 讀出「匯入前」那份資料；沒有或讀不懂時回傳 null */
export function loadSafetyCopy(storage, nowIso) {
  const raw = storage.getItem(SAFETY_COPY_KEY);
  if (raw === null) return null;
  try {
    const result = sanitizeData(JSON.parse(raw), nowIso);
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}
