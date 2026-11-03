import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyData, withWeighIn, withoutWeighIn, withSettings, withBackupDone, countWeighIns,
  withDayType, withTrainingCompleted, withSteps, withMealStatus, withMealNote, withCelebratedLevel,
  withStartDate, withSeenSettlement, withChapterCleared, withMenuPlan, withExerciseVariant, withBeepEnabled, withTrainingFinished,
  loadData, saveData, saveSafetyCopy, loadSafetyCopy, STORAGE_KEY, SAFETY_COPY_KEY, OLDER_SAFETY_COPY_KEY,
} from '../store.js';

const NOW = '2026-11-03T07:00:00.000Z';
const LATER = '2026-11-04T07:00:00.000Z';
const VALUES = { weightKg: 82.4, bodyFatPct: null, skeletalMusclePct: null, visceralFatLevel: null };

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    keys: () => [...map.keys()],
  };
}

test('新資料：預設身高 174、沒有任何一天', () => {
  const data = createEmptyData(NOW);
  assert.equal(data.settings.heightCm, 174);
  assert.deepEqual(data.days, {});
  assert.equal(data.meta.lastBackupAt, null);
});

test('存體重會產生新的資料，不改到舊的', () => {
  const before = createEmptyData(NOW);
  const after = withWeighIn(before, '2026-11-03', VALUES, { todayKey: '2026-11-03', nowIso: NOW });
  assert.deepEqual(before.days, {});
  assert.equal(after.days['2026-11-03'].weighIn.weightKg, 82.4);
  assert.equal(after.days['2026-11-03'].weighIn.isBackfill, false);
  assert.deepEqual(after.days['2026-11-03'].meals, { breakfast: null, lunch: null, dinner: null });
});

test('補登標記：第一次記錄時決定，之後修改保留', () => {
  const opts = { todayKey: '2026-11-03', nowIso: NOW };
  const onTime = withWeighIn(createEmptyData(NOW), '2026-11-03', VALUES, opts);
  const editedNextDay = withWeighIn(onTime, '2026-11-03', { ...VALUES, weightKg: 82.2 }, { todayKey: '2026-11-04', nowIso: LATER });
  const weighIn = editedNextDay.days['2026-11-03'].weighIn;
  assert.equal(weighIn.isBackfill, false);
  assert.equal(weighIn.recordedAt, NOW);
  assert.equal(weighIn.editedAt, LATER);

  const backfilled = withWeighIn(createEmptyData(NOW), '2026-10-20', VALUES, opts);
  assert.equal(backfilled.days['2026-10-20'].weighIn.isBackfill, true);
});

test('改設定、記備份時間、數紀錄天數', () => {
  const data = withWeighIn(createEmptyData(NOW), '2026-11-03', VALUES, { todayKey: '2026-11-03', nowIso: NOW });
  assert.equal(withSettings(data, { heightCm: 175 }, NOW).settings.heightCm, 175);
  assert.equal(withBackupDone(data, LATER).meta.lastBackupAt, LATER);
  assert.equal(countWeighIns(data), 1);
});

test('存進去再讀出來一樣', () => {
  const storage = memoryStorage();
  const data = withWeighIn(createEmptyData(NOW), '2026-11-03', VALUES, { todayKey: '2026-11-03', nowIso: NOW });
  assert.equal(saveData(storage, data).ok, true);
  assert.deepEqual(loadData(storage, NOW).data, data);
});

test('第一次打開沒有資料，給空白資料', () => {
  const { data, error } = loadData(memoryStorage(), NOW);
  assert.equal(error, null);
  assert.deepEqual(data.days, {});
});

test('資料壞掉時另存原文並回報', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{壞掉' });
  const { data, error } = loadData(storage, NOW);
  assert.ok(error);
  assert.deepEqual(data.days, {});
  assert.ok(storage.keys().some((key) => key.startsWith(`${STORAGE_KEY}.corrupt.`)));
});

test('存檔失敗時回報錯誤', () => {
  const storage = { setItem: () => { throw new Error('空間已滿'); } };
  const result = saveData(storage, createEmptyData(NOW));
  assert.equal(result.ok, false);
  assert.match(result.error, /空間已滿/);
});

test('格式不對的資料（例如 null、陣列、缺欄位）當作讀不出來，另存原文', () => {
  for (const raw of ['null', '[]', '{}', '{"days":{}}']) {
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const { data, error } = loadData(storage, NOW);
    assert.ok(error, raw);
    assert.deepEqual(data.days, {});
    assert.ok(storage.keys().some((key) => key.startsWith(`${STORAGE_KEY}.corrupt.`)));
  }
});

test('另存原文失敗時仍然回報錯誤，不會整個停掉', () => {
  const storage = { getItem: () => '{壞掉', setItem: () => { throw new Error('空間已滿'); } };
  const { error } = loadData(storage, NOW);
  assert.match(error, /從備份匯入/);
});

test('匯入前另存資料，保留最近兩份', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: 'A' });
  saveSafetyCopy(storage);
  storage.setItem(STORAGE_KEY, 'B');
  saveSafetyCopy(storage);
  assert.equal(storage.getItem(SAFETY_COPY_KEY), 'B');
  assert.equal(storage.getItem(OLDER_SAFETY_COPY_KEY), 'A');
});

test('讀出匯入前的資料', () => {
  const data = withWeighIn(createEmptyData(NOW), '2026-11-03', VALUES, { todayKey: '2026-11-03', nowIso: NOW });
  const storage = memoryStorage({ [SAFETY_COPY_KEY]: JSON.stringify(data) });
  assert.equal(loadSafetyCopy(storage, LATER).days['2026-11-03'].weighIn.weightKg, 82.4);
  assert.equal(loadSafetyCopy(memoryStorage(), LATER), null);
});

test('刪除體重：那天的體重清空，不改到舊資料，其他天不受影響', () => {
  const opts = { todayKey: '2026-11-03', nowIso: NOW };
  const two = withWeighIn(withWeighIn(createEmptyData(NOW), '2026-11-02', VALUES, opts), '2026-11-03', VALUES, opts);
  const after = withoutWeighIn(two, '2026-11-03', LATER);
  assert.equal(two.days['2026-11-03'].weighIn.weightKg, 82.4);
  assert.equal(after.days['2026-11-03'].weighIn, null);
  assert.equal(after.days['2026-11-02'].weighIn.weightKg, 82.4);
  assert.equal(countWeighIns(after), 1);
  assert.equal(withoutWeighIn(after, '2026-11-03', LATER), after);
});

test('補登標記：2 天內補記不算補登', () => {
  const data = withWeighIn(createEmptyData(NOW), '2026-11-01', VALUES, { todayKey: '2026-11-03', nowIso: NOW });
  assert.equal(data.days['2026-11-01'].weighIn.isBackfill, false);
});

test('舊規則存的「補登」標記，讀取時依新規則重算', () => {
  // 第 2 步舊版：11/3 補記 11/2 被標成補登；新規則下是正常紀錄
  const data = withWeighIn(createEmptyData(NOW), '2026-11-02', VALUES, { todayKey: '2026-11-03', nowIso: NOW });
  const old = { ...data, days: { '2026-11-02': { ...data.days['2026-11-02'], weighIn: { ...data.days['2026-11-02'].weighIn, isBackfill: true } } } };
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(old) });
  assert.equal(loadData(storage, LATER).data.days['2026-11-02'].weighIn.isBackfill, false);
});

test('對調訓練日／走路日；改回預設時存成空的', () => {
  const swapped = withDayType(createEmptyData(NOW), '2026-11-03', 'training', 'walk', NOW);
  assert.equal(swapped.days['2026-11-03'].exercise.type, 'training');
  assert.equal(withDayType(swapped, '2026-11-03', 'walk', 'walk', NOW).days['2026-11-03'].exercise.type, null);
});

test('勾餐 ✓／△、備註、取消勾選', () => {
  const ticked = withMealStatus(createEmptyData(NOW), '2026-11-03', 'lunch', 'deviated', NOW);
  const lunch = ticked.days['2026-11-03'].meals.lunch;
  assert.equal(lunch.status, 'deviated');
  assert.deepEqual(lunch.calories, { value: null, status: 'pending', source: null });
  const noted = withMealNote(ticked, '2026-11-03', 'lunch', '排骨便當', NOW);
  assert.equal(noted.days['2026-11-03'].meals.lunch.note, '排骨便當');
  assert.equal(withMealStatus(noted, '2026-11-03', 'lunch', 'followed', NOW).days['2026-11-03'].meals.lunch.note, '排骨便當');
  assert.equal(withMealStatus(noted, '2026-11-03', 'lunch', null, NOW).days['2026-11-03'].meals.lunch, null);
  assert.equal(ticked.days['2026-11-03'].meals.lunch.note, '');
});

test('訓練打勾、步數、慶祝過的等級', () => {
  const data = withSteps(withTrainingCompleted(createEmptyData(NOW), '2026-11-02', true, NOW), '2026-11-03', 8200, NOW);
  assert.equal(data.days['2026-11-02'].exercise.trainingCompleted, true);
  assert.equal(data.days['2026-11-03'].exercise.steps, 8200);
  assert.equal(withCelebratedLevel(data, 3).progress.celebratedLevel, 3);
  assert.equal(data.progress.celebratedLevel, 1);
});

test('三餐、運動、等級存進去再讀出來一樣', () => {
  const storage = memoryStorage();
  let data = withMealStatus(createEmptyData(NOW), '2026-11-03', 'dinner', 'deviated', NOW);
  data = withMealNote(data, '2026-11-03', 'dinner', '滷肉飯', NOW);
  data = withSteps(data, '2026-11-03', 6000, NOW);
  data = withCelebratedLevel(data, 2);
  saveData(storage, data);
  assert.deepEqual(loadData(storage, LATER).data, data);
});

test('慶祝過的等級只增不減', () => {
  const data = withCelebratedLevel(createEmptyData(NOW), 3);
  assert.equal(withCelebratedLevel(data, 2).progress.celebratedLevel, 3);
});

test('沒勾的餐寫備註：資料不變', () => {
  const data = createEmptyData(NOW);
  assert.equal(withMealNote(data, '2026-11-03', 'lunch', 'x', NOW), data);
});

test('正式開始闖關：記下開始日、慶祝紀錄從頭算；已經開始就不會再改', () => {
  const before = withChapterCleared(withCelebratedLevel(createEmptyData(NOW), 3), 1);
  const started = withStartDate(before, '2026-11-04');
  assert.equal(started.progress.startDate, '2026-11-04');
  assert.equal(started.progress.celebratedLevel, 1);
  assert.deepEqual(started.progress.chaptersCleared, []);
  assert.equal(withStartDate(started, '2026-11-10'), started);
  assert.equal(before.progress.startDate, null);
});

test('看過的結算週、過關章節、排好的菜單都存得進去也讀得出來', () => {
  const plan = { store: 'cvs', items: [{ cell: 'protein', id: 'tea-egg', name: '茶葉蛋', kcal: 75 }] };
  let data = withStartDate(createEmptyData(NOW), '2026-11-02');
  data = withSeenSettlement(data, '2026-11-02');
  data = withChapterCleared(withChapterCleared(data, 2), 1);
  data = withMenuPlan(data, '2026-11-03', { breakfast: plan, lunch: null, dinner: null }, NOW);
  const storage = memoryStorage();
  saveData(storage, data);
  const loaded = loadData(storage, LATER).data;
  assert.deepEqual(loaded, data);
  assert.deepEqual(loaded.progress.chaptersCleared, [1, 2]);
});

test('菜單格式不對的就當作沒有', () => {
  const data = withMenuPlan(createEmptyData(NOW), '2026-11-03', { breakfast: { store: 'cvs', items: [{ cell: 'x', id: 'a', name: 'a', kcal: 1 }] } }, NOW);
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(data) });
  assert.equal(loadData(storage, LATER).data.days['2026-11-03'].menuPlan.breakfast, null);
});

test('照菜單 ✓：記下當時的菜單和熱量（已估算）；沒照 △：熱量待估算', () => {
  const plan = { store: 'cvs', items: [
    { cell: 'protein', id: 'cvs-tea-egg', name: '茶葉蛋 2 顆', kcal: 150 },
    { cell: 'staple', id: 'cvs-sweet-potato', name: '烤地瓜（中）', kcal: 220 },
  ] };
  const data = withMenuPlan(createEmptyData(NOW), '2026-11-03', { breakfast: plan, lunch: null, dinner: null }, NOW);
  const followed = withMealStatus(data, '2026-11-03', 'breakfast', 'followed', NOW).days['2026-11-03'].meals.breakfast;
  assert.deepEqual(followed.planned, plan);
  assert.deepEqual(followed.calories, { value: 370, status: 'estimated', source: 'menu' });
  const deviated = withMealStatus(data, '2026-11-03', 'breakfast', 'deviated', NOW).days['2026-11-03'].meals.breakfast;
  assert.deepEqual(deviated.calories, { value: null, status: 'pending', source: null });
  const noPlan = withMealStatus(createEmptyData(NOW), '2026-11-03', 'lunch', 'followed', NOW).days['2026-11-03'].meals.lunch;
  assert.equal(noPlan.planned, null);
  assert.equal(noPlan.calories.status, 'pending');
});

test('開始日在未來或早得離譜：當作還沒開始', () => {
  for (const startDate of ['2030-01-01', '1900-01-01']) {
    const data = { ...createEmptyData(NOW), progress: { celebratedLevel: 1, startDate, seenSettlementWeek: null, chaptersCleared: [] } };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(data) });
    assert.equal(loadData(storage, LATER).data.progress.startDate, null, startDate);
  }
});

test('選動作版本、提示音開關、訓練做完（走路日會改成訓練日並打勾）', () => {
  let data = withExerciseVariant(createEmptyData(NOW), 'pushup', 'pushup-wall');
  assert.deepEqual(data.settings.exerciseVariants, { pushup: 'pushup-wall' });
  data = withBeepEnabled(data, false);
  assert.equal(data.settings.beepEnabled, false);
  const finished = withTrainingFinished(data, '2026-11-03', 'walk', NOW).days['2026-11-03'].exercise;
  assert.deepEqual(finished, { type: 'training', steps: null, trainingCompleted: true });
  const onTrainingDay = withTrainingFinished(data, '2026-11-02', 'training', NOW).days['2026-11-02'].exercise;
  assert.equal(onTrainingDay.type, null);
  const storage = memoryStorage();
  saveData(storage, data);
  assert.deepEqual(loadData(storage, LATER).data.settings, data.settings);
});
