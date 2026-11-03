// 體重紀錄列表（放在「成果」頁下方；也是圖表的「表格版」）
import { calcBmi } from '../weigh.js';
import { h, formatShortDate, formatValue } from '../ui.js';

function historyRow(dateKey, weighIn, heightCm) {
  const extras = [
    `體脂 ${formatValue(weighIn.bodyFatPct, '%')}`,
    `骨骼肌 ${formatValue(weighIn.skeletalMusclePct, '%')}`,
    `內臟脂肪 ${formatValue(weighIn.visceralFatLevel)}`,
  ].join('・');
  return h('li', {},
    h('a', { className: 'history-row', href: `#/weigh/${dateKey}` },
      h('div', { className: 'history-main' },
        h('span', { className: 'history-date', text: formatShortDate(dateKey) }),
        h('span', { className: 'history-weight', text: `${weighIn.weightKg} 公斤` }),
        h('span', { className: 'history-bmi', text: `BMI ${calcBmi(weighIn.weightKg, heightCm)}` })),
      h('p', { className: 'history-extra', text: extras + (weighIn.isBackfill ? '・補登' : '') })));
}

export function historyList(data) {
  const keys = Object.keys(data.days).filter((key) => data.days[key].weighIn).sort().reverse();
  if (keys.length === 0) {
    return h('section', { className: 'card' },
      h('h2', { text: '體重紀錄' }),
      h('p', { text: '還沒有任何體重紀錄。' }));
  }
  return h('section', { className: 'card' },
    h('h2', { text: `體重紀錄（共 ${keys.length} 天）` }),
    h('p', { className: 'note', text: '點一筆可以查看或修改。' }),
    h('ol', { className: 'history' }, keys.map((key) => historyRow(key, data.days[key].weighIn, data.settings.heightCm))));
}
