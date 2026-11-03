import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORES, MEAL_ORDER, DAILY_KCAL_RANGE } from '../menu-data.js';
import {
  seededRandom, storesForMeal, planMeal, planDay, changeStore, swapItem, alternativesFor,
  dayKcal, mealKcal, kcalStatus, mealSummary, optionsFor,
} from '../menu.js';
import { sanitizePlanMeal, MENU_CELLS } from '../schema.js';

test('菜單庫：6 種店，每格都有選項，id 不重複，熱量是 10 的倍數', () => {
  assert.equal(STORES.length, 6);
  const ids = new Set();
  for (const store of STORES) {
    for (const cell of MENU_CELLS) {
      for (const mealId of store.meals) {
        assert.ok(optionsFor(store, cell, mealId).length >= (cell === 'veg' ? store.vegCount : 1), `${store.name} ${cell} ${mealId}`);
      }
      for (const item of store.cells[cell]) {
        assert.ok(!ids.has(item.id), item.id);
        ids.add(item.id);
        assert.equal(item.kcal % 10, 0, item.id);
      }
    }
  }
});

test('早餐只從早餐店、超商、速食店抽；午晚餐不會排到早餐店', () => {
  assert.deepEqual(storesForMeal('breakfast').map((s) => s.name), ['早餐店', '超商', '速食店']);
  assert.deepEqual(storesForMeal('lunch').map((s) => s.name), ['超商', '便當店', '自助餐', '麵店小吃', '速食店']);
  assert.deepEqual(storesForMeal('dinner').map((s) => s.name), storesForMeal('lunch').map((s) => s.name));
});

test('排一餐：四格各一樣，自助餐蔬菜 3 樣不重複', () => {
  const meal = planMeal('lunch', 'buffet', seededRandom(1));
  const cells = meal.items.map((item) => item.cell);
  assert.deepEqual(cells, ['protein', 'staple', 'veg', 'veg', 'veg', 'drink']);
  const vegIds = meal.items.filter((item) => item.cell === 'veg').map((item) => item.id);
  assert.equal(new Set(vegIds).size, 3);
  assert.ok(sanitizePlanMeal(meal));
});

test('速食店早餐只會排早餐主餐', () => {
  for (let seed = 1; seed < 30; seed += 1) {
    const meal = planMeal('breakfast', 'fastfood', seededRandom(seed));
    assert.ok(['ff-egg-burger', 'ff-chicken-egg-burger'].includes(meal.items[0].id));
  }
});

test('連續一年每天排菜單，總熱量都在 1600–1700 大卡', () => {
  let yesterday = null;
  for (let seed = 1; seed <= 365; seed += 1) {
    const plan = planDay(seededRandom(seed), yesterday);
    const total = dayKcal(plan);
    assert.ok(total >= DAILY_KCAL_RANGE.min && total <= DAILY_KCAL_RANGE.max, `seed ${seed}: ${total}`);
    assert.deepEqual(Object.keys(plan), MEAL_ORDER);
    yesterday = plan;
  }
});

test('盡量避開昨天同一餐吃過的東西', () => {
  let repeats = 0;
  let yesterday = planDay(seededRandom(7));
  for (let seed = 8; seed < 108; seed += 1) {
    const today = planDay(seededRandom(seed), yesterday);
    for (const mealId of MEAL_ORDER) {
      if (today[mealId].store !== yesterday[mealId].store) continue;
      const before = new Set(yesterday[mealId].items.map((item) => item.id));
      // 只有一個選項的格子（例如速食主食）一定會重複，不算
      repeats += today[mealId].items.filter((item) => before.has(item.id) && item.id !== 'ff-bread-included').length;
    }
    yesterday = today;
  }
  assert.ok(repeats < 10, `重複 ${repeats} 次`);
});

test('換店：只改那一餐，其他兩餐不動，總熱量盡量在範圍內', () => {
  const plan = planDay(seededRandom(3));
  const next = changeStore(plan, 'lunch', plan.lunch.store === 'noodle' ? 'buffet' : 'noodle', seededRandom(4));
  assert.deepEqual(next.breakfast, plan.breakfast);
  assert.deepEqual(next.dinner, plan.dinner);
  assert.notEqual(next.lunch.store, plan.lunch.store);
  assert.equal(kcalStatus(dayKcal(next)), 'ok');
});

test('換一個：同一格換成別的，其他不動；沒得換就不變', () => {
  const plan = { breakfast: planMeal('breakfast', 'cvs', seededRandom(5)), lunch: null, dinner: null };
  const next = swapItem(plan, 'breakfast', 0, seededRandom(6));
  assert.equal(next.breakfast.items[0].cell, 'protein');
  assert.notEqual(next.breakfast.items[0].id, plan.breakfast.items[0].id);
  assert.deepEqual(next.breakfast.items.slice(1), plan.breakfast.items.slice(1));

  const ff = { breakfast: null, lunch: planMeal('lunch', 'fastfood', seededRandom(1)), dinner: null };
  assert.equal(alternativesFor(ff, 'lunch', 1).length, 0);
  assert.equal(swapItem(ff, 'lunch', 1, seededRandom(2)), ff);
});

test('熱量狀態與一餐說明', () => {
  assert.deepEqual([kcalStatus(1599), kcalStatus(1600), kcalStatus(1700), kcalStatus(1701)], ['low', 'ok', 'ok', 'high']);
  const meal = { store: 'fastfood', items: [
    { cell: 'protein', id: 'ff-grilled-chicken-wrap', name: '烤雞捲餅', kcal: 390 },
    { cell: 'staple', id: 'ff-bread-included', name: '主餐的麵包', kcal: 0 },
    { cell: 'veg', id: 'ff-apple', name: '蘋果片', kcal: 50 },
    { cell: 'drink', id: 'ff-green-tea', name: '無糖綠茶', kcal: 0 },
  ] };
  assert.equal(mealKcal(meal), 440);
  assert.equal(mealSummary(meal), '速食店：烤雞捲餅、蘋果片、無糖綠茶');
});
