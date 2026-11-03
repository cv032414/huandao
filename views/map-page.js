// 「地圖」頁：小車在台灣哪一站、本週目前平均、連續達標週數、試玩模式
import { STATIONS, CHAPTERS, START_KG, GOAL_KG } from '../map-data.js';
import {
  currentStationIndex, settlementHistory, stationIndexForAverage, nextStationHint, settlementMessage,
  chaptersReached,
} from '../map.js';
import { weekAverage } from '../progress.js';
import { weekStartKey, weekStreak, firstFullWeekStart } from '../game.js';
import { formatShortDate, h, notice, pageHeader } from '../ui.js';
import { taiwanMap } from './map-art.js';
import { showCelebration, chapterContent } from './celebrate.js';

const TRIAL_MIN = GOAL_KG - 1;
const TRIAL_MAX = START_KG + 2;
// 試玩的數字只放在記憶體，不存
const trial = { isOn: false, avg: 77.6 };

// 離開地圖頁就結束試玩，下次回來看到的是真實狀態
window.addEventListener('hashchange', () => {
  if (window.location.hash.replace(/^#\/?/, '').split('/')[0] !== 'map') trial.isOn = false;
});

function whereText(index) {
  const station = STATIONS[index];
  const note = station.note ? `（${station.note}）` : '';
  return `${station.name} ${station.kg} 公斤${note}`;
}

/** 「本週目前平均 X 公斤，距離下一站還差 Y 公斤」 */
export function weekHintText(days, index, todayKey) {
  const { avg, count } = weekAverage(days, weekStartKey(todayKey));
  const { next, gap } = nextStationHint(index, avg);
  if (!next) return avg === null ? '環島完成！繼續記錄就好。' : `本週目前平均 ${avg.toFixed(1)} 公斤。環島完成！`;
  if (avg === null) return `本週還沒有體重紀錄。下一站：${next.name} ${next.kg} 公斤。`;
  const countNote = count < 3 ? `（本週已量 ${count} 天，要 3 天以上才算數）` : '';
  if (index === 0 && avg > START_KG) return `本週目前平均 ${avg.toFixed(1)} 公斤，目前在起點，距離${next.name}還差 ${gap.toFixed(1)} 公斤${countNote}`;
  if (gap === 0) return `本週目前平均 ${avg.toFixed(1)} 公斤，已經到${next.name}的公斤數，週日過完結算就會前進${countNote}`;
  return `本週目前平均 ${avg.toFixed(1)} 公斤，距離下一站${next.name}還差 ${gap.toFixed(1)} 公斤${countNote}`;
}

function chapterList(index) {
  const reached = chaptersReached(index);
  return h('section', { className: 'card' },
    h('h2', { text: '路線' }),
    CHAPTERS.map((chapter) => {
      const stations = STATIONS.filter((s) => s.chapter === chapter.id);
      return h('div', { className: 'chapter' },
        h('p', { className: 'chapter-title', text: `${chapter.title}${reached.includes(chapter.id) ? ' ✓' : ''}` }),
        h('ol', { className: 'station-list' }, stations.map((station) => {
          const i = STATIONS.indexOf(station);
          return h('li', { className: i <= index ? 'station-reached' : null, 'aria-current': i === index ? 'location' : null },
            `${station.name} ${station.kg}${station.note ? `・${station.note}` : ''}${i === index ? '　← 小車在這裡' : ''}`);
        })));
    }));
}

function trialCard(ctx) {
  if (!trial.isOn) {
    return h('button', {
      className: 'chip-button', type: 'button', text: '試玩模式：假裝體重變化看看',
      onClick: () => {
        trial.isOn = true;
        ctx.refresh();
      },
    });
  }
  const index = stationIndexForAverage(trial.avg);
  const output = h('p', { className: 'trial-output', text: `假裝一週平均 ${trial.avg.toFixed(1)} 公斤 → ${whereText(index)}` });
  return notice('warn',
    h('p', { className: 'notice-title', text: '試玩模式（不會存、不影響真實資料）' }),
    h('label', { className: 'field-label', for: 'trial-avg', text: '拖拉假裝的一週平均體重' }),
    h('input', {
      id: 'trial-avg', className: 'trial-slider', type: 'range', min: TRIAL_MIN, max: TRIAL_MAX, step: 0.1, value: trial.avg,
      onInput: (event) => {
        trial.avg = Number(event.target.value);
        const next = stationIndexForAverage(trial.avg);
        output.textContent = `假裝一週平均 ${trial.avg.toFixed(1)} 公斤 → ${whereText(next)}`;
        document.querySelector('[data-role="map"]')?.replaceChildren(taiwanMap(next, { label: `試玩：小車在${whereText(next)}` }));
      },
      onChange: () => {
        ctx.refresh();
        document.getElementById('trial-avg')?.focus();
      },
    }),
    output,
    h('p', { className: 'note', text: '看過關畫面：' }),
    h('div', { className: 'choice-row' }, CHAPTERS.map((chapter) => h('button', {
      className: 'chip-button chip-button-small', type: 'button', text: chapter.id === 3 ? '環島完成' : `第${'一二三'[chapter.id - 1]}章過關`,
      onClick: () => showCelebration({ ...chapterContent(chapter.id), onClose: null }),
    }))),
    h('button', {
      className: 'button button-secondary', type: 'button', text: '離開試玩',
      onClick: () => {
        trial.isOn = false;
        ctx.refresh();
      },
    }));
}

function statusCard(data, index, todayKey) {
  const { startDate } = data.progress;
  if (!startDate) {
    return notice('info', h('p', { text: '準備期：小車先停在台北起點。按「正式開始闖關」之後，從下一個完整的週一開始，每週日過完結算一次。' }));
  }
  const history = settlementHistory(data.days, startDate, todayKey);
  const last = history[history.length - 1];
  const { streak, total } = weekStreak(data.days, todayKey, startDate);
  const firstWeek = firstFullWeekStart(startDate);
  return h('section', { className: 'card' },
    h('h2', { text: `目前在 ${whereText(index)}` }),
    h('p', { text: weekHintText(data.days, index, todayKey) }),
    last
      ? h('p', { className: 'note', text: `最近一次結算（${formatShortDate(last.weekStart)} 那週）：${settlementMessage(last)}` })
      : h('p', { className: 'note', text: `第一次結算：${formatShortDate(firstWeek)} 那週過完（週日之後）。` }),
    h('div', { className: 'week-stats' },
      h('div', {}, h('p', { className: 'stat-value', text: `${streak} 週` }), h('p', { className: 'note', text: '連續達標' })),
      h('div', {}, h('p', { className: 'stat-value', text: `${total} 週` }), h('p', { className: 'note', text: '累計達標' }))));
}

export function renderMap(ctx) {
  const { data, todayKey } = ctx;
  const realIndex = currentStationIndex(data.days, data.progress.startDate, todayKey);
  const index = trial.isOn ? stationIndexForAverage(trial.avg) : realIndex;
  return [
    pageHeader('環島地圖', `台北 ${START_KG} → 繞台灣一圈 → 台北 ${GOAL_KG}`),
    h('div', { className: 'content' },
      trial.isOn ? null : statusCard(data, realIndex, todayKey),
      trialCard(ctx),
      h('section', { className: 'card map-card' },
        h('div', { 'data-role': 'map' }, taiwanMap(index, { label: `${trial.isOn ? '試玩：' : ''}小車在${whereText(index)}` }))),
      chapterList(index),
      h('p', { className: 'note', text: '規則：每週一到週日的平均體重（四捨五入到小數點後一位）等於或低於某站的公斤數，就開到那一站；一週要量 3 天以上才算數。變重也會真的退回去，沒關係，重新出發就好。' })),
  ];
}
