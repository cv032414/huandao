// 「成果」頁：體重與身體數值的趨勢圖、試玩模式、體重紀錄列表
import {
  METRICS, RANGES, DEFAULT_RANGE_ID, dailyPoints, weeklyAveragePoints, rangeDomain, pointsInDomain, changeSummary, buildSampleDays,
} from '../progress.js';
import { trendChart } from '../chart.js';
import { addDays } from '../day.js';
import { weekStartKey } from '../game.js';
import { historyList } from './history.js';
import { h, notice, pageHeader } from '../ui.js';

// 只是看圖的選擇，不存進資料；關掉工具就回到預設
const viewState = { rangeId: DEFAULT_RANGE_ID, sample: null };

// 離開「成果」頁就結束試玩，免得下次回來還看到假資料
window.addEventListener('hashchange', () => {
  const route = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  if (route !== 'progress' && route !== 'history' && viewState.sample) {
    viewState.sample = null;
    viewState.rangeId = DEFAULT_RANGE_ID;
  }
});

function legend() {
  return h('div', { className: 'chart-legend' },
    h('span', { className: 'legend-item' }, h('span', { className: 'legend-dot chart-series-1', 'aria-hidden': 'true' }), '每天'),
    h('span', { className: 'legend-item' }, h('span', { className: 'legend-line chart-series-2', 'aria-hidden': 'true' }), '一週平均（週一到週日）'));
}

function changeText(points, unit, digits) {
  const change = changeSummary(points);
  if (!change) return null;
  const sign = change.diff > 0 ? '+' : '';
  const diff = `${sign}${change.diff.toFixed(digits)} ${unit}`;
  const text = `第一週平均 ${change.from.value.toFixed(digits)} → 最近一週平均 ${change.to.value.toFixed(digits)}（${diff}）`;
  return h('p', { className: 'chart-change', text });
}

/** 一週平均畫在週四；週四還沒到（或在範圍外）就畫在範圍的邊上 */
function clampToDomain(points, domain) {
  return points.map((point) => {
    if (point.date > domain.to) return { ...point, date: domain.to };
    if (point.date < domain.from) return { ...point, date: domain.from };
    return point;
  });
}

/** 一週平均用整週的紀錄算（不會因為範圍從週中開始而只算半週），再挑出範圍內的週 */
function weeklyInDomain(all, domain) {
  return clampToDomain(
    weeklyAveragePoints(all).filter((week) => addDays(week.weekStart, 6) >= domain.from && week.weekStart <= domain.to),
    domain,
  );
}

function chartCard({ metric, days, todayKey, startDate, domain }) {
  const all = dailyPoints(days, metric.key, todayKey);
  const daily = pointsInDomain(all, domain);
  const title = h('h2', { text: `${metric.label}（${metric.unit}）` });
  if (daily.length === 0) {
    return h('section', { className: 'card chart-card' }, title,
      h('p', { className: 'note', text: all.length ? '這段期間沒有紀錄，可以換成「全部」看看。' : `還沒有${metric.label}的紀錄。` }));
  }
  const weekly = weeklyInDomain(all, domain);
  // 變化只比「已經過完的週」，本週還沒過完，數字還會變
  const finishedWeeks = weekly.filter((week) => week.weekStart < weekStartKey(todayKey));
  const chart = trendChart({
    label: metric.label, unit: metric.unit, digits: metric.digits, daily, weekly, domain, startDate,
  });
  return h('section', { className: 'card chart-card' },
    title,
    legend(),
    chart.element,
    chart.readout,
    changeText(finishedWeeks, metric.unit, metric.digits),
    daily.length < 2 ? h('p', { className: 'note', text: '再多記幾天，就看得出趨勢。' }) : null);
}

function rangePicker(ctx) {
  return h('div', { className: 'choice-row', role: 'group', 'aria-label': '時間範圍' }, RANGES.map((range) => h('button', {
    className: `chip-button chip-button-small${viewState.rangeId === range.id ? ' chip-button-on' : ''}`, type: 'button', text: range.label,
    'aria-pressed': String(viewState.rangeId === range.id),
    onClick: () => {
      viewState.rangeId = range.id;
      ctx.refresh();
    },
  })));
}

function sampleToggle(ctx) {
  if (viewState.sample) {
    return notice('warn',
      h('p', { text: '試玩模式：現在看到的是假資料（大約 4 個月），只是讓你先看看圖的樣子，不會存進手機。' }),
      h('button', {
        className: 'button button-secondary', type: 'button', text: '離開試玩，看我的資料',
        onClick: () => {
          viewState.sample = null;
          viewState.rangeId = DEFAULT_RANGE_ID;
          ctx.refresh();
        },
      }));
  }
  return h('button', {
    className: 'chip-button', type: 'button', text: '試玩模式：看看幾個月後的樣子',
    onClick: () => {
      viewState.sample = buildSampleDays(ctx.todayKey);
      viewState.rangeId = 'all';
      ctx.refresh();
    },
  });
}

export function renderProgress(ctx) {
  const { data, todayKey } = ctx;
  const source = viewState.sample ?? { days: data.days, startDate: data.progress.startDate };
  // 四張圖用同一段時間（以體重紀錄為準），方便上下對照
  const domain = rangeDomain(viewState.rangeId, dailyPoints(source.days, 'weightKg', todayKey), todayKey);
  const charts = METRICS.map((metric) => chartCard({
    metric, days: source.days, todayKey, startDate: source.startDate, domain,
  }));
  return [
    pageHeader('成果', viewState.sample ? '試玩中（假資料）' : '體重和身體數值的變化'),
    h('div', { className: 'content' },
      sampleToggle(ctx),
      h('a', { className: 'button', href: '#/weigh', text: '記今天的體重' }),
      rangePicker(ctx),
      charts,
      h('p', { className: 'note', text: '每天上下 0.5–1 公斤是正常波動，看一週平均線比較準。空著的日子不畫點。' }),
      viewState.sample
        ? h('section', { className: 'card' }, h('p', { className: 'note', text: '試玩中不顯示紀錄列表。離開試玩就會看到你自己的紀錄。' }))
        : historyList(data),
      h('a', { className: 'button button-text', href: '#/settings', text: '設定（身高、備份）' })),
  ];
}
