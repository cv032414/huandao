// 準備期提示與「正式開始闖關」按鈕（首頁、設定頁共用）
import { getAppDate, toDateKey, formatAppDate, parseDateKey } from '../day.js';
import { firstFullWeekStart } from '../game.js';
import { withStartDate } from '../store.js';
import { h, formatShortDate } from '../ui.js';

function startNow(ctx) {
  const todayKey = toDateKey(getAppDate(ctx.getNow()));
  const firstWeek = firstFullWeekStart(todayKey);
  const weekNote = firstWeek === todayKey
    ? '今天是週一，這週就開始算每週達標和地圖。'
    : `每週達標和地圖從下週一（${formatShortDate(firstWeek)}）開始結算，這週不結算。`;
  const confirmed = window.confirm(
    `確定從今天（${formatAppDate(parseDateKey(todayKey))}）正式開始闖關嗎？\n\n`
    + `・經驗值、等級、地圖從今天起算。\n・${weekNote}\n・之前的體重和任務紀錄都會保留，但不算經驗值。\n\n開始後不能取消。`,
  );
  if (!confirmed) return;
  ctx.navigate('#/');
  ctx.commit(withStartDate(ctx.getData(), todayKey));
}

export function startButton(ctx) {
  return h('button', { className: 'button', type: 'button', text: '正式開始闖關', onClick: () => startNow(ctx) });
}

/** 首頁：準備期提示（已開始就不顯示） */
export function prepCard(ctx) {
  if (ctx.data.progress.startDate) return null;
  return h('section', { className: 'card prep-card', 'aria-label': '準備期' },
    h('p', { className: 'notice-title', text: '準備期' }),
    h('p', { text: '體重和任務照常記，經驗值和地圖從正式開始那天起算。' }),
    h('p', { className: 'note', text: '工具都準備好、想正式開始時，按下面的按鈕。' }),
    startButton(ctx));
}

/** 設定頁：開始日或開始按鈕 */
export function startSection(ctx) {
  const { startDate } = ctx.data.progress;
  return h('section', { className: 'card' },
    h('h2', { text: '闖關進度' }),
    startDate
      ? h('p', { text: `開始日：${formatAppDate(parseDateKey(startDate))}` })
      : h('p', { text: '目前是準備期：體重和任務照常記，經驗值和地圖從正式開始那天起算。' }),
    startDate ? null : startButton(ctx));
}
