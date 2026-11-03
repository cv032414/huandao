// 畫面小工具：建立元素、格式化數字與時間
import { parseDateKey } from './day.js';

/** h('p', { className: 'x', text: '文字' }, 子元素...) */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  el.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return el;
}

export function formatValue(value, unit = '') {
  if (value === null || value === undefined) return '—';
  return unit ? `${value} ${unit}` : String(value);
}

/** 例：11/3（二） */
export function formatShortDate(dateKey) {
  const date = parseDateKey(dateKey);
  const weekday = '日一二三四五六'[date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}（${weekday}）`;
}

/** 例：2026/11/3 15:20 */
export function formatDateTime(iso) {
  const d = new Date(iso);
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${minutes}`;
}

export function pageHeader(title, subtitle) {
  return h('header', { className: 'page-header' },
    h('h1', { text: title }),
    subtitle ? h('p', { className: 'page-subtitle', text: subtitle }) : null);
}

export function notice(kind, ...children) {
  return h('div', { className: `notice notice-${kind}`, role: kind === 'error' ? 'alert' : null }, ...children);
}
