// 「菜單」頁：今天三餐吃什麼，可以換店、換一個
import { getAppDate, toDateKey, addDays, formatAppDate } from '../day.js';
import { CELL_LABELS, DAILY_KCAL_RANGE, MEAL_ORDER } from '../menu-data.js';
import {
  storeById, storesForMeal, changeStore, swapItem, alternativesFor, mealKcal, dayKcal, kcalStatus,
} from '../menu.js';
import { MEAL_LABELS } from '../game.js';
import { withMenuPlan } from '../store.js';
import { h, notice, pageHeader } from '../ui.js';

/** 每次按按鈕都重新拿今天和最新的資料（畫面可能開著跨過凌晨 4 點） */
function updatePlan(ctx, change) {
  const now = ctx.getNow();
  const todayKey = toDateKey(getAppDate(now));
  const data = ctx.getData();
  const plan = data.days[todayKey]?.menuPlan;
  if (!plan) {
    ctx.refresh(); // 剛跨過凌晨 4 點：重畫成新的一天的菜單
    return;
  }
  const yesterdayPlan = data.days[addDays(todayKey, -1)]?.menuPlan ?? null;
  ctx.commit(withMenuPlan(data, todayKey, change(plan, yesterdayPlan), now.toISOString()));
}

function totalNotice(total) {
  const status = kcalStatus(total);
  if (status === 'ok') {
    return notice('success', h('p', { text: `今天總計約 ${total} 大卡（目標 ${DAILY_KCAL_RANGE.min}–${DAILY_KCAL_RANGE.max}）` }));
  }
  const word = status === 'high' ? '稍微超過' : '稍微不足';
  return notice('info', h('p', { text: `今天總計約 ${total} 大卡，${word}（目標 ${DAILY_KCAL_RANGE.min}–${DAILY_KCAL_RANGE.max}）。換店或換一個都可以，不用勉強。` }));
}

function itemRow(ctx, plan, mealId, item, index, isTicked) {
  const canSwap = !isTicked && alternativesFor(plan, mealId, index).length > 0;
  return h('li', { className: 'menu-item' },
    h('span', { className: 'menu-cell', text: CELL_LABELS[item.cell] }),
    h('div', { className: 'menu-item-body' },
      h('p', { text: item.name }),
      h('p', { className: 'note', text: `約 ${item.kcal} 大卡` })),
    canSwap
      ? h('button', {
        className: 'chip-button chip-button-small', type: 'button', text: '換一個',
        'aria-label': `${item.name}換一個`,
        onClick: () => updatePlan(ctx, (current) => swapItem(current, mealId, index, Math.random)),
      })
      : null);
}

function storePicker(ctx, mealId, currentStoreId) {
  const others = storesForMeal(mealId).filter((store) => store.id !== currentStoreId);
  return h('details', { className: 'store-picker' },
    h('summary', { className: 'chip-button chip-button-small', text: '換店' }),
    h('div', { className: 'choice-row' }, others.map((store) => h('button', {
      className: 'chip-button chip-button-small', type: 'button', text: store.name,
      onClick: () => updatePlan(ctx, (current, yesterday) => changeStore(current, mealId, store.id, Math.random, yesterday)),
    }))));
}

function mealCard(ctx, plan, mealId) {
  const meal = plan[mealId];
  // 已經勾了的餐不能再換，免得紀錄和菜單對不起來
  const isTicked = Boolean(ctx.data.days[ctx.todayKey]?.meals?.[mealId]);
  const store = storeById(meal.store);
  return h('section', { className: 'card', 'aria-label': MEAL_LABELS[mealId] },
    h('div', { className: 'card-title-row' },
      h('h2', {}, `${MEAL_LABELS[mealId]}・${store?.name ?? '其他'}`),
      h('p', { className: 'menu-kcal', text: `約 ${mealKcal(meal)} 大卡` })),
    store ? h('p', { className: 'note', text: store.tip }) : null,
    h('ol', { className: 'menu-items' }, meal.items.map((item, index) => itemRow(ctx, plan, mealId, item, index, isTicked))),
    isTicked
      ? h('p', { className: 'note', text: '這餐已經在首頁勾了，不能再換。要換的話，先回首頁取消勾選。' })
      : storePicker(ctx, mealId, meal.store));
}

export function renderMenu(ctx) {
  const plan = ctx.data.days[ctx.todayKey]?.menuPlan;
  if (!plan || MEAL_ORDER.some((mealId) => !plan[mealId])) {
    return [pageHeader('今天的菜單'), h('div', { className: 'content' }, notice('error', h('p', { text: '菜單排不出來，請關掉工具再打開一次。' })))];
  }
  return [
    pageHeader('今天的菜單', formatAppDate(getAppDate(ctx.now))),
    h('div', { className: 'content' },
      totalNotice(dayKcal(plan)),
      MEAL_ORDER.map((mealId) => mealCard(ctx, plan, mealId)),
      h('p', { className: 'note', text: '每餐公式：一份蛋白質＋一份主食＋一份蔬菜或水果＋水或無糖飲料。熱量都是大約的數字；店家份量不同，實際會有差。' }),
      h('p', { className: 'note', text: '賣完就按「換一個」；不想去這家就按「換店」。吃完回首頁勾 ✓ 或 △。' })),
  ];
}
