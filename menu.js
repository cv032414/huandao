// 每日菜單的排法（規格書 v0.4 第 4 節）
// - 每餐指定一種店，從「蛋白質、主食、蔬果、飲料」每格抽一樣（自助餐蔬果抽 3 樣）
// - 一天總熱量控制在 1600–1700 大卡，抽到不在範圍就重抽
// - 避免昨天同一餐吃過的東西
import { STORES, MEAL_ORDER, DAILY_KCAL_RANGE } from './menu-data.js';
import { MENU_CELLS } from './schema.js';

const MAX_ATTEMPTS = 4000;

export const storeById = (id) => STORES.find((store) => store.id === id) ?? null;

export function storesForMeal(mealId) {
  return STORES.filter((store) => store.meals.includes(mealId));
}

/** 可以重現的亂數（同一個種子抽出一樣的結果，方便測試） */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (list, random) => list[Math.floor(random() * list.length)];

function pickDistinct(list, count, random) {
  const pool = [...list];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
}

export function optionsFor(store, cell, mealId) {
  return store.cells[cell].filter((item) => !item.meals || item.meals.includes(mealId));
}

const toPlanItem = (cell) => (item) => ({ cell, id: item.id, name: item.name, kcal: item.kcal });

/** 排一餐：在指定的店，每格抽；盡量避開 avoidIds（昨天同一餐吃過的） */
export function planMeal(mealId, storeId, random, avoidIds = new Set()) {
  const store = storeById(storeId);
  const items = MENU_CELLS.flatMap((cell) => {
    const count = cell === 'veg' ? store.vegCount : 1;
    const options = optionsFor(store, cell, mealId);
    const fresh = options.filter((item) => !avoidIds.has(item.id));
    return pickDistinct(fresh.length >= count ? fresh : options, count, random).map(toPlanItem(cell));
  });
  return { store: store.id, items };
}

export const mealKcal = (meal) => (meal ? meal.items.reduce((sum, item) => sum + item.kcal, 0) : 0);

export const dayKcal = (plan) => MEAL_ORDER.reduce((sum, mealId) => sum + mealKcal(plan?.[mealId]), 0);

/** 'low' 稍微不足、'ok' 剛好、'high' 稍微超過 */
export function kcalStatus(total) {
  if (total < DAILY_KCAL_RANGE.min) return 'low';
  if (total > DAILY_KCAL_RANGE.max) return 'high';
  return 'ok';
}

const distanceToRange = (total) => Math.max(DAILY_KCAL_RANGE.min - total, total - DAILY_KCAL_RANGE.max, 0);

function avoidSet(yesterdayPlan, mealId) {
  return new Set((yesterdayPlan?.[mealId]?.items ?? []).map((item) => item.id));
}

/** 重抽很多次，選第一個在範圍內的；都不在範圍就選最接近的 */
function bestOf(generate) {
  let best = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const plan = generate();
    const distance = distanceToRange(dayKcal(plan));
    if (distance === 0) return plan;
    if (!best || distance < best.distance) best = { plan, distance };
  }
  return best.plan;
}

/** 排一整天的三餐 */
export function planDay(random, yesterdayPlan = null) {
  return bestOf(() => Object.fromEntries(MEAL_ORDER.map((mealId) => {
    const store = pick(storesForMeal(mealId), random);
    return [mealId, planMeal(mealId, store.id, random, avoidSet(yesterdayPlan, mealId))];
  })));
}

/** 換店：這一餐改成別家店重新排，其他兩餐不動，盡量讓一天總熱量還在範圍內 */
export function changeStore(plan, mealId, storeId, random, yesterdayPlan = null) {
  return bestOf(() => ({ ...plan, [mealId]: planMeal(mealId, storeId, random, avoidSet(yesterdayPlan, mealId)) }));
}

/** 這一項還有沒有別的可以換（同一格、同一餐、這餐還沒選的） */
export function alternativesFor(plan, mealId, index) {
  const meal = plan[mealId];
  const item = meal.items[index];
  const store = storeById(meal.store);
  if (!store) return [];
  const taken = new Set(meal.items.map((planItem) => planItem.id));
  return optionsFor(store, item.cell, mealId).filter((option) => !taken.has(option.id));
}

/** 換一個：同一格換成別的選項（應付賣完）；不強制熱量範圍 */
export function swapItem(plan, mealId, index, random) {
  const choices = alternativesFor(plan, mealId, index);
  if (choices.length === 0) return plan;
  const meal = plan[mealId];
  const replacement = toPlanItem(meal.items[index].cell)(pick(choices, random));
  const items = meal.items.map((item, i) => (i === index ? replacement : item));
  return { ...plan, [mealId]: { ...meal, items } };
}

/** 一餐的簡短說明，例如「超商：茶葉蛋 2 顆、烤地瓜（中）…」 */
export function mealSummary(meal) {
  if (!meal) return '';
  const store = storeById(meal.store);
  const names = meal.items.filter((item) => item.kcal > 0 || item.cell !== 'staple').map((item) => item.name);
  return `${store?.name ?? '其他'}：${names.join('、')}`;
}
