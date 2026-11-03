import { daysBetween, formatAppDate, isDateKey, parseDateKey, toDateKey } from '../day.js';
import { needsBackupReminder, daysSinceBackup } from '../backup.js';
import {
  canEditTasks, getDayType, getTaskResults, dayXp, totalXp, levelInfo, weekStartKey, weekSummary,
  shouldSuggestRest, weekStreak, DAYS_TO_ACHIEVE_WEEK, TRAININGS_PER_WEEK, XP, countsForXp, isSettlementWeek,
} from '../game.js';
import { prepCard } from './start.js';
import { scheduleCelebrations } from './celebrate.js';
import { currentStationIndex } from '../map.js';
import { STATIONS } from '../map-data.js';
import { weekHintText } from './map-page.js';
import { h, notice } from '../ui.js';
import { taskList } from './tasks.js';

const MAX_DAY_XP = 70;
const DAY_TABS = Object.freeze([{ daysAgo: 2, label: '前天' }, { daysAgo: 1, label: '昨天' }, { daysAgo: 0, label: '今天' }]);

function backupReminder(data, now) {
  if (!needsBackupReminder(data, now)) return null;
  const message = data.meta.lastBackupAt
    ? `已經 ${daysSinceBackup(data, now)} 天沒有備份了`
    : '你還沒有備份過資料';
  return notice('warn',
    h('p', { className: 'notice-title', text: message }),
    h('p', { text: '換手機、刪掉主畫面圖示或清除 Safari 資料，紀錄都會不見。' }),
    h('a', { className: 'button button-small', href: '#/settings', text: '去備份' }));
}

function levelCard(data, todayKey, dateKey) {
  const { startDate } = data.progress;
  if (!startDate) return null;
  const xp = totalXp(data.days, todayKey, startDate);
  const info = levelInfo(xp);
  const percent = Math.round((info.xpIntoLevel / info.xpForNextLevel) * 100);
  const isToday = dateKey === todayKey;
  return h('section', { className: 'card level-card', 'aria-label': '等級與經驗值' },
    h('div', { className: 'level-row' },
      h('p', { className: 'level-badge', text: `Lv.${info.level}` }),
      h('div', { className: 'level-text' },
        h('p', { className: 'level-xp', text: `經驗值 ${xp}` }),
        h('p', { className: 'note', text: `再 ${info.xpToNext} 升到 Lv.${info.level + 1}` })),
      h('p', {
        className: 'level-today',
        text: countsForXp(dateKey, startDate)
          ? `${isToday ? '今天' : '這天'} +${dayXp(dateKey, data.days[dateKey])}／${MAX_DAY_XP}`
          : '開始日前不計分',
      })),
    h('div', {
      className: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': info.xpForNextLevel, 'aria-valuenow': info.xpIntoLevel,
    }, h('div', { className: 'progress-fill', style: `width: ${percent}%` })));
}

/** 首頁的小地圖卡：目前在哪一站、本週目前平均、連續達標週數 */
function mapCard(data, todayKey) {
  const { startDate } = data.progress;
  if (!startDate) return null;
  const index = currentStationIndex(data.days, startDate, todayKey);
  const station = STATIONS[index];
  const { streak, total } = weekStreak(data.days, todayKey, startDate);
  return h('a', { className: 'card map-mini', href: '#/map' },
    h('div', { className: 'card-title-row' },
      h('h2', { text: `🚗 ${station.name} ${station.kg} 公斤` }),
      h('span', { className: 'chevron', 'aria-hidden': 'true', text: '›' })),
    h('p', { className: 'note', text: weekHintText(data.days, index, todayKey) }),
    h('p', { className: 'note', text: `連續達標 ${streak} 週・累計 ${total} 週` }));
}

function weekGoalText(summary, isPastWeek, settles) {
  const remaining = Math.max(DAYS_TO_ACHIEVE_WEEK - summary.completeDays, 0);
  if (!settles) return `一週完成 ${DAYS_TO_ACHIEVE_WEEK} 天算達標；這週不結算（準備期或開始日所在的不完整週）`;
  if (isPastWeek) {
    return summary.achieved
      ? `上週已達標，已加 ${XP.weeklyBonus} 經驗值`
      : `上週還差 ${remaining} 天達標；補勾後達標，會補加 ${XP.weeklyBonus}`;
  }
  return summary.achieved
    ? `本週已達標！週日過完會加 ${XP.weeklyBonus} 經驗值`
    : `再完成 ${remaining} 天就達標（週日過完 +${XP.weeklyBonus}）`;
}

/** 顯示「正在看的那一天」所在的那一週；週一看昨天（週日）時就是上週 */
function weekCard(data, dateKey, todayKey) {
  const startKey = weekStartKey(dateKey);
  const isPastWeek = startKey < weekStartKey(todayKey);
  const label = isPastWeek ? '上週' : '本週';
  const summary = weekSummary(data.days, startKey);
  const settles = isSettlementWeek(startKey, data.progress.startDate);
  return h('section', { className: 'card week-card', 'aria-label': `${label}進度` },
    h('div', { className: 'week-stats' },
      h('div', {}, h('p', { className: 'stat-value', text: `${summary.completeDays}／7` }), h('p', { className: 'note', text: `${label}完成天數` })),
      h('div', {}, h('p', { className: 'stat-value', text: `${summary.trainingCount}／${TRAININGS_PER_WEEK}` }), h('p', { className: 'note', text: `${label}訓練次數` }))),
    h('p', { className: 'note', text: `${weekGoalText(summary, isPastWeek, settles)}。完成 = 當天 5 項都有勾（✓ 或 △ 都算）。` }));
}

function dayTabs(todayKey, dateKey) {
  const today = parseDateKey(todayKey);
  return h('nav', { className: 'day-tabs', 'aria-label': '選擇日期' }, DAY_TABS.map(({ daysAgo, label }) => {
    const key = toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo));
    return h('a', { href: daysAgo === 0 ? '#/' : `#/day/${key}`, 'aria-current': key === dateKey ? 'page' : null }, label);
  }));
}

function completionNote(dateKey, day) {
  const missing = Object.values(getTaskResults(dateKey, day)).filter((task) => !task.done).length;
  if (missing === 0) return notice('success', h('p', { text: '這天 5 項都完成了 ✓' }));
  return h('p', { className: 'note', text: `還差 ${missing} 項，這天就算完成。` });
}

export function renderHome(ctx, requestedKey) {
  const { data, todayKey, now } = ctx;
  const isAllowed = isDateKey(requestedKey) && canEditTasks(requestedKey, todayKey);
  const dateKey = isAllowed ? requestedKey : todayKey;
  const isTraining = getDayType(dateKey, data.days[dateKey]) === 'training';
  const viewing = daysBetween(dateKey, todayKey) === 1 ? '昨天' : '前天';
  scheduleCelebrations(ctx);

  return [
    h('header', { className: 'hero' },
      h('a', { className: 'hero-settings', href: '#/settings', 'aria-label': '設定' }, h('span', { 'aria-hidden': 'true', text: '⚙︎' }), '設定'),
      h('p', { className: 'app-name', text: dateKey === todayKey ? '減重闖關' : `減重闖關・正在看${viewing}` }),
      h('h1', { text: formatAppDate(parseDateKey(dateKey)) }),
      h('p', {
        className: 'chip',
        dataset: { type: isTraining ? 'training' : 'walk' },
        text: isTraining ? '訓練日' : '走路日',
      })),
    h('div', { className: 'content' },
      backupReminder(data, now),
      prepCard(ctx),
      levelCard(data, todayKey, dateKey),
      mapCard(data, todayKey),
      weekCard(data, dateKey, todayKey),
      shouldSuggestRest(data.days, dateKey)
        ? notice('info', h('p', { text: '前一天剛做過訓練，建議中間休息一天，今天可以改成走路日（不強制）。' }))
        : null,
      h('section', { className: 'card', 'aria-labelledby': 'tasks-title' },
        h('div', { className: 'card-title-row' },
          h('h2', { id: 'tasks-title', text: dateKey === todayKey ? '今日任務' : `${viewing}的任務` })),
        dayTabs(todayKey, dateKey),
        taskList(ctx, dateKey),
        completionNote(dateKey, data.days[dateKey]),
        h('p', { className: 'note', text: '今天、昨天、前天的任務都可以補勾、修改，正常給分。' })),
      h('p', { className: 'footnote', text: '提醒：刪除主畫面圖示前請先備份，否則資料會一起不見。' })),
  ];
}
