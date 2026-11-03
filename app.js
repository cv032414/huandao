import { getAppDate, toDateKey, addDays } from './day.js';
import {
  loadData, saveData, saveSafetyCopy, loadSafetyCopy, createEmptyData, SAFETY_COPY_KEY, withMenuPlan,
} from './store.js';
import { planDay, changeStore, storesForMeal, storeById } from './menu.js';
import { MEAL_ORDER } from './menu-data.js';
import { renderMenu } from './views/menu.js';
import { renderTraining } from './views/training.js';
import { renderHome } from './views/home.js';
import { renderWeigh } from './views/weigh.js';
import { renderProgress } from './views/progress.js';
import { renderMap } from './views/map-page.js';
import { renderSettings } from './views/settings.js';
import { notice, h } from './ui.js';

const ROUTES = {
  '': { tab: 'home', render: renderHome },
  day: { tab: 'home', render: renderHome },
  menu: { tab: 'menu', render: renderMenu },
  training: { tab: 'training', render: renderTraining },
  weigh: { tab: 'home', render: renderWeigh },
  map: { tab: 'map', render: renderMap },
  progress: { tab: 'progress', render: renderProgress },
  history: { tab: 'progress', render: renderProgress },
  settings: { tab: null, render: renderSettings },
};

const state = { data: null, storage: null, storageError: null, flash: null, renderedDayKey: null };

function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function isAppleMobile() {
  const ua = window.navigator.userAgent;
  const isIPadDesktopMode = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || isIPadDesktopMode;
}

function openStorage() {
  try {
    const storage = window.localStorage;
    const result = loadData(storage, new Date().toISOString());
    return { storage, data: result.data, error: result.error };
  } catch (err) {
    return { storage: null, data: createEmptyData(new Date().toISOString()), error: `這支手機目前不能存資料（${err.message}）。` };
  }
}

function parseRoute() {
  const [name = '', param] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { route: Object.hasOwn(ROUTES, name) ? ROUTES[name] : ROUTES[''], param };
}

function persist(nextData) {
  if (!state.storage) return { ok: false, error: state.storageError };
  return saveData(state.storage, nextData);
}

function commit(nextData, { flash } = {}) {
  const result = persist(nextData);
  if (!result.ok) {
    window.alert(result.error);
    render(); // 畫面回到手機裡真正存著的樣子
    return false;
  }
  state.data = nextData;
  state.flash = flash ?? null;
  render();
  return true;
}

function replaceAllData(nextData, options) {
  try {
    if (state.storage) saveSafetyCopy(state.storage);
  } catch (err) {
    window.alert(`無法先保留目前的資料，已取消匯入（${err.message}）。`);
    return false;
  }
  return commit(nextData, options);
}

function readSafely(read) {
  try {
    return read();
  } catch {
    return null;
  }
}

function navigate(hash) {
  state.flash = null;
  window.location.hash = hash;
}

function buildContext() {
  const now = new Date();
  const appDate = getAppDate(now);
  const flash = state.flash;
  state.flash = null;
  return {
    data: state.data,
    getData: () => state.data,
    // 按下儲存時重新取得時間，避免畫面開著跨過凌晨 4 點存到前一天
    getNow: () => new Date(),
    now,
    appDate,
    todayKey: toDateKey(appDate),
    flash,
    commit,
    replaceAllData,
    hasSafetyCopy: () => readSafely(() => state.storage?.getItem(SAFETY_COPY_KEY) != null) === true,
    loadSafetyCopy: () => readSafely(() => (state.storage ? loadSafetyCopy(state.storage, new Date().toISOString()) : null)),
    navigate,
    refresh: () => render(),
  };
}

/** 重畫前記下還沒存的輸入（備註、步數），標記為 data-draft */
function collectDrafts(view) {
  return [...view.querySelectorAll('[data-draft]')]
    .filter((el) => el.value !== el.defaultValue)
    .map((el) => ({ key: el.dataset.draft, value: el.value, savedValue: el.defaultValue }));
}

/** 重畫後放回去；但如果那一格剛好被存成新的值，就用新的值 */
function restoreDrafts(view, drafts) {
  for (const draft of drafts) {
    const el = [...view.querySelectorAll('[data-draft]')].find((node) => node.dataset.draft === draft.key);
    if (el && el.defaultValue === draft.savedValue) el.value = draft.value;
  }
}

/**
 * 今天還沒有菜單就排一份並存起來（不重畫畫面）。
 * 排好就固定，重新打開工具也不會變。
 */
/** 這一餐排的店還有賣這一餐嗎（菜單庫改過後，例如麥當勞不再排早餐） */
const isUsableMeal = (plan, mealId) => Boolean(plan?.[mealId]) && storeById(plan[mealId].store)?.meals.includes(mealId) === true;

function fillMenuPlan(existing, yesterdayPlan) {
  if (!existing) return planDay(Math.random, yesterdayPlan);
  // 有幾餐壞掉（或那家店不再排這一餐）時，只重排那幾餐，並盡量讓一天總熱量還在範圍內
  return MEAL_ORDER.filter((mealId) => !isUsableMeal(existing, mealId)).reduce((plan, mealId) => {
    const stores = storesForMeal(mealId);
    const store = stores[Math.floor(Math.random() * stores.length)];
    return changeStore(plan, mealId, store.id, Math.random, yesterdayPlan);
  }, existing);
}

function ensureTodayMenuPlan() {
  const todayKey = toDateKey(getAppDate(new Date()));
  const existing = state.data.days[todayKey]?.menuPlan;
  if (existing && MEAL_ORDER.every((mealId) => isUsableMeal(existing, mealId))) return;
  const yesterdayPlan = state.data.days[addDays(todayKey, -1)]?.menuPlan ?? null;
  let plan;
  try {
    plan = fillMenuPlan(existing, yesterdayPlan);
  } catch (err) {
    console.error('排菜單失敗', err);
    return;
  }
  const next = withMenuPlan(state.data, todayKey, plan, new Date().toISOString());
  persist(next); // 存不進去也先用著，畫面還是有菜單
  state.data = next;
}

function render() {
  const { route, param } = parseRoute();
  ensureTodayMenuPlan();
  const view = document.getElementById('view');
  const drafts = collectDrafts(view);
  const ctx = buildContext();
  state.renderedDayKey = ctx.todayKey;
  const errorBanner = state.storageError ? notice('error', h('p', { text: state.storageError })) : null;
  view.replaceChildren(...[errorBanner, route.render(ctx, param)].flat().filter(Boolean));
  restoreDrafts(view, drafts);

  for (const link of document.querySelectorAll('.tabbar a')) {
    link.toggleAttribute('aria-current', link.dataset.tab === route.tab);
  }
  document.getElementById('install-banner').hidden = isStandalone() || !isAppleMobile();
}

function init() {
  const opened = openStorage();
  state.storage = opened.storage;
  state.data = opened.data;
  state.storageError = opened.error;
  // 請瀏覽器盡量不要自動清掉這個網頁的資料
  navigator.storage?.persist?.().catch(() => {});

  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });
  // 工具一直開著跨過凌晨 4 點時，回到畫面就更新成新的一天；
  // 同一天就不重畫，免得清掉還沒存的輸入
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (toDateKey(getAppDate(new Date())) !== state.renderedDayKey) render();
  });
  render();
}

init();
