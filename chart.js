// 趨勢圖：用 SVG 畫（不靠外部套件）。點圖可以看那一天的數字。
import { daysBetween } from './day.js';
import { niceValueDomain, valueTicks } from './progress.js';
import { formatShortDate } from './ui.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 340;
const HEIGHT = 190;
const PAD = Object.freeze({ top: 12, right: 12, bottom: 26, left: 38 });
const DOT_RADIUS = 4;
const SMALL_DOT_RADIUS = 3;
/** 點很多時（例如看「全部」）改用小一點的點，免得擠成一團 */
const DENSE_POINTS = 60;

function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) el.setAttribute(key, String(value));
  }
  el.append(...children.filter(Boolean));
  return el;
}

/** 日期、數值換成圖上的位置 */
export function createScales(domain, valueDomain) {
  const spanDays = Math.max(daysBetween(domain.from, domain.to), 1);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  return {
    x: (dateKey) => PAD.left + (daysBetween(domain.from, dateKey) / spanDays) * plotWidth,
    y: (value) => PAD.top + (1 - (value - valueDomain.min) / (valueDomain.max - valueDomain.min)) * plotHeight,
  };
}

function formatNumber(value, digits) {
  return Number.isInteger(value) && digits === 0 ? String(value) : value.toFixed(digits);
}

/**
 * 平滑曲線每一點的斜率（單調三次曲線）：
 * 曲線只會在點和點之間平順地轉彎，不會超出前後兩點的高低（不會畫出假的高峰）。
 */
export function monotoneSlopes(xs, ys) {
  const n = xs.length;
  const secants = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  return xs.map((_, i) => {
    if (i === 0) return secants[0] ?? 0;
    if (i === n - 1) return secants[n - 2];
    const [a, b] = [secants[i - 1], secants[i]];
    if (a * b <= 0) return 0; // 轉折點：平平的
    const [w1, w2] = [2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]), (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1])];
    return (w1 + w2) / (w1 / a + w2 / b);
  });
}

/** 把一週平均的點連成平滑的線 */
function smoothPath(points, scales) {
  const xs = points.map((point) => scales.x(point.date));
  const ys = points.map((point) => scales.y(point.value));
  const slopes = monotoneSlopes(xs, ys);
  const fmt = (n) => n.toFixed(1);
  return xs.map((x, i) => {
    if (i === 0) return `M${fmt(x)},${fmt(ys[0])}`;
    const dx = (x - xs[i - 1]) / 3;
    return `C${fmt(xs[i - 1] + dx)},${fmt(ys[i - 1] + slopes[i - 1] * dx)} ${fmt(x - dx)},${fmt(ys[i] - slopes[i] * dx)} ${fmt(x)},${fmt(ys[i])}`;
  }).join(' ');
}

function gridLayer(valueDomain, scales, digits) {
  return svg('g', { class: 'chart-grid' }, ...valueTicks(valueDomain).map((tick) => svg('g', {},
    svg('line', { x1: PAD.left, x2: WIDTH - PAD.right, y1: scales.y(tick), y2: scales.y(tick) }),
    svg('text', { x: PAD.left - 6, y: scales.y(tick) + 4, 'text-anchor': 'end' }, document.createTextNode(formatNumber(tick, tick % 1 ? 1 : 0))))));
}

function dateLabels(domain, scales) {
  const labels = [
    { key: domain.from, anchor: 'start' },
    { key: domain.to, anchor: 'end' },
  ];
  return svg('g', { class: 'chart-axis' }, ...labels.map(({ key, anchor }) => svg('text', {
    x: scales.x(key), y: HEIGHT - 8, 'text-anchor': anchor,
  }, document.createTextNode(formatShortDate(key)))));
}

function startMarker(startDate, domain, scales) {
  if (!startDate || startDate < domain.from || startDate > domain.to) return null;
  const x = scales.x(startDate);
  const nearRight = x > WIDTH - PAD.right - 40;
  return svg('g', { class: 'chart-start' },
    svg('line', { x1: x, x2: x, y1: PAD.top, y2: HEIGHT - PAD.bottom }),
    svg('text', { x: nearRight ? x - 4 : x + 4, y: PAD.top + 10, 'text-anchor': nearRight ? 'end' : 'start' }, document.createTextNode('開始日')));
}

/** 找離點的位置最近的那一筆 */
export function nearestPoint(points, scales, x) {
  let best = null;
  for (const point of points) {
    const distance = Math.abs(scales.x(point.date) - x);
    if (!best || distance < best.distance) best = { point, distance };
  }
  return best?.point ?? null;
}

/**
 * 畫一張趨勢圖。
 * daily：每天的點；weekly：一週平均（畫成平滑的線，點畫在線的上面）。點圖時把數字寫在 readout 那一行。
 */
export function trendChart({ label, unit, digits, daily, weekly, domain, startDate }) {
  const allValues = [...daily, ...weekly].map((point) => point.value);
  const dotRadius = daily.length > DENSE_POINTS ? SMALL_DOT_RADIUS : DOT_RADIUS;
  const valueDomain = niceValueDomain(allValues, unit === '公斤' ? 2 : 1);
  const scales = createScales(domain, valueDomain);

  const readout = document.createElement('p');
  readout.className = 'chart-readout';
  readout.setAttribute('aria-live', 'polite');
  readout.textContent = '點圖上的位置可以看那一天的數字';

  const highlight = svg('circle', { class: 'chart-highlight', r: DOT_RADIUS + 3, visibility: 'hidden' });
  const cursor = svg('line', { class: 'chart-cursor', y1: PAD.top, y2: HEIGHT - PAD.bottom, visibility: 'hidden' });

  const root = svg('svg', {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: 'chart-svg', role: 'img',
    'aria-label': `${label}趨勢圖，${formatShortDate(domain.from)} 到 ${formatShortDate(domain.to)}，共 ${daily.length} 筆`,
  },
  gridLayer(valueDomain, scales, digits),
  startMarker(startDate, domain, scales),
  dateLabels(domain, scales),
  cursor,
  weekly.length > 1 ? svg('path', { class: 'chart-line chart-series-2', d: smoothPath(weekly, scales) }) : null,
  svg('g', {}, ...daily.map((point) => svg('circle', { class: 'chart-dot chart-series-1', cx: scales.x(point.date), cy: scales.y(point.value), r: dotRadius }))),
  highlight);

  const show = (event) => {
    const box = root.getBoundingClientRect();
    if (box.width === 0) return;
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    const point = nearestPoint(daily, scales, x);
    if (!point) return;
    const week = weekly.find((item) => daysBetween(item.weekStart, point.date) >= 0 && daysBetween(item.weekStart, point.date) < 7);
    readout.textContent = `${formatShortDate(point.date)}：${formatNumber(point.value, digits)} ${unit}`
      + (week ? `・那週平均 ${formatNumber(week.value, digits)} ${unit}` : '');
    const cx = scales.x(point.date);
    highlight.setAttribute('cx', cx);
    highlight.setAttribute('cy', scales.y(point.value));
    highlight.setAttribute('visibility', 'visible');
    cursor.setAttribute('x1', cx);
    cursor.setAttribute('x2', cx);
    cursor.setAttribute('visibility', 'visible');
  };
  root.addEventListener('pointerdown', show);
  root.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' || event.buttons) show(event);
  });

  return { element: root, readout };
}
