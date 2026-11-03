// 跳出來的大畫面：上週結果、過關、升級。一次只跳一個，關掉才記錄「看過了」。
import { STATIONS, CHAPTERS } from '../map-data.js';
import {
  latestSettlement, currentStationIndex, newlyClearedChapters, settlementMessage, chaptersReached,
  chapterRange, journeySummary,
} from '../map.js';
import { levelInfo, totalXp, weekSummary, weekStreak, XP, DAYS_TO_ACHIEVE_WEEK } from '../game.js';
import { unlockedAtLevel } from '../training.js';
import { withCelebratedLevel, withSeenSettlement, withChapterCleared } from '../store.js';
import { h } from '../ui.js';
import { carIcon } from './map-art.js';

const supportsDialog = () => typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype;

/**
 * 顯示一個大畫面。onClose 在關掉時呼叫（記錄看過了）。
 * 舊版 iPhone 沒有對話框功能時，改用一般提示框。
 */
const CONFETTI_PIECES = 36;
const CONFETTI_COLORS = ['var(--accent)', 'var(--brand)', 'var(--series-1)', 'var(--series-2)', '#E87BA4'];

/** 彩帶：從上面飄下來的小紙片（只有動畫，沒有聲音；系統設定「減少動態效果」時不顯示） */
function confetti() {
  return h('div', { className: 'confetti', 'aria-hidden': 'true' },
    Array.from({ length: CONFETTI_PIECES }, (_, i) => h('span', {
      style: [
        `left: ${Math.round(Math.random() * 100)}%`,
        `background: ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`,
        `animation-delay: ${(Math.random() * 1.5).toFixed(2)}s`,
        `animation-duration: ${(2.5 + Math.random() * 2).toFixed(2)}s`,
        `--drift: ${Math.round((Math.random() - 0.5) * 80)}px`,
      ].join('; '),
    })));
}

export function showCelebration({ emoji, withCar, withConfetti, title, big, lines, buttonText, onClose }) {
  if (!supportsDialog()) {
    const texts = lines.map((line) => (typeof line === 'object' ? line.text : line));
    window.alert([emoji, title, big, ...texts].filter(Boolean).join('\n'));
    onClose?.();
    return;
  }
  const dialog = h('dialog', { className: 'celebrate', 'aria-labelledby': 'celebrate-title' },
    withConfetti ? confetti() : null,
    withCar ? carIcon('celebrate-car') : null,
    emoji ? h('p', { className: 'celebrate-emoji', 'aria-hidden': 'true', text: emoji }) : null,
    h('h2', { id: 'celebrate-title', text: title }),
    big ? h('p', { className: 'celebrate-level', text: big }) : null,
    lines.map((line) => h('p', { className: typeof line === 'object' ? line.className : null, text: typeof line === 'object' ? line.text : line })),
    h('button', { className: 'button', type: 'button', text: buttonText, onClick: () => dialog.close() }));
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  document.body.append(dialog);
  dialog.showModal();
}

// ---------- 上週結果 ----------
function reclearedLine(result, chaptersCleared) {
  const before = chaptersReached(result.from);
  const again = chaptersReached(result.to).filter((id) => !before.includes(id) && chaptersCleared.includes(id));
  if (again.length === 0) return null;
  const chapter = CHAPTERS.find((c) => c.id === again[again.length - 1]);
  return { className: 'note', text: `再次通過${chapter.title}！` };
}

export function settlementContent(data, result, todayKey) {
  const week = weekSummary(data.days, result.weekStart);
  const { streak, total } = weekStreak(data.days, todayKey, data.progress.startDate);
  const weekLine = week.achieved
    ? `上週完成 ${week.completeDays} 天，達標！+${XP.weeklyBonus} 經驗值`
    : `上週完成 ${week.completeDays} 天（${DAYS_TO_ACHIEVE_WEEK} 天算達標）。這週再一起努力。`;
  return {
    withCar: true,
    title: '上週結果',
    big: `${STATIONS[result.to].name} ${STATIONS[result.to].kg}`,
    lines: [
      settlementMessage(result),
      reclearedLine(result, data.progress.chaptersCleared),
      weekLine,
      { className: 'note', text: `連續達標 ${streak} 週・累計 ${total} 週` },
    ].filter(Boolean),
    buttonText: '好',
  };
}

// ---------- 過關 ----------
/**
 * 過關畫面的內容。journey：環島完成時的總結（journeySummary）；試玩時沒有真實資料就是 null。
 */
export function chapterContent(chapterId, journey = null) {
  const chapter = CHAPTERS.find((c) => c.id === chapterId);
  const { from, to } = chapterRange(chapterId);
  const chapterLine = `這一章減了 ${from.kg - to.kg} 公斤：${from.name} ${from.kg} → ${to.name} ${to.kg}`;
  if (chapterId === CHAPTERS[CHAPTERS.length - 1].id) {
    const start = STATIONS[0];
    const summary = journey
      ? [
        { className: 'celebrate-stat', text: `總共減了 ${journey.lost.toFixed(1)} 公斤` },
        `開始時 ${journey.startWeight} 公斤 → 最後一週平均 ${journey.finalAvg.toFixed(1)} 公斤`,
        { className: 'celebrate-stat', text: `花了 ${journey.weeks} 週` },
      ]
      : [{ className: 'celebrate-stat', text: `繞台灣一圈：${start.name} ${start.kg} → ${to.name} ${to.kg}，共 ${start.kg - to.kg} 公斤` }];
    return {
      emoji: '🏁', withConfetti: true, title: '環島完成！', big: `${to.name} ${to.kg}`,
      lines: [...summary, chapterLine, '工具會繼續幫你記錄；之後怎麼維持，再一起討論。'],
      buttonText: '太棒了',
    };
  }
  const next = CHAPTERS.find((c) => c.id === chapterId + 1);
  return {
    emoji: '🎊', withConfetti: true, title: `${chapter.title} 過關！`, big: `${to.name} ${to.kg}`,
    lines: [{ className: 'celebrate-stat', text: chapterLine }, `下一段：${next.title}`],
    buttonText: '繼續出發',
  };
}

// ---------- 升級 ----------
export function levelUpContent(level, previousLevel) {
  const unlocked = [];
  for (let n = previousLevel + 1; n <= level; n += 1) unlocked.push(...unlockedAtLevel(n));
  return {
    emoji: '🎉', title: '升級了！', big: `Lv.${level}`,
    lines: unlocked.length
      ? [
        `解鎖進階版：${unlocked.map(({ variant }) => variant.name).join('、')}`,
        { className: 'note', text: '不用馬上換；目前這組做起來輕鬆再到「訓練」頁換。' },
      ]
      : ['每天一點一點，正在往目標前進。'],
    buttonText: '太好了',
  };
}

/** 現在該跳哪一個畫面（照順序：上週結果 → 過關 → 升級）；沒有就是 null */
export function pendingCelebration(data, todayKey) {
  const { startDate, seenSettlementWeek, chaptersCleared, celebratedLevel } = data.progress;
  if (!startDate) return null;
  const result = latestSettlement(data.days, startDate, todayKey);
  if (result && seenSettlementWeek !== result.weekStart) {
    return { key: `settle:${result.weekStart}`, content: settlementContent(data, result, todayKey), save: (d) => withSeenSettlement(d, result.weekStart) };
  }
  const [chapterId] = newlyClearedChapters(currentStationIndex(data.days, startDate, todayKey), chaptersCleared);
  if (chapterId) return { key: `chapter:${chapterId}`, content: chapterContent(chapterId, journeySummary(data.days, startDate, todayKey)), save: (d) => withChapterCleared(d, chapterId) };
  const { level } = levelInfo(totalXp(data.days, todayKey, startDate));
  if (level > celebratedLevel) {
    return { key: `level:${level}`, content: levelUpContent(level, celebratedLevel), save: (d) => withCelebratedLevel(d, level) };
  }
  return null;
}

let isScheduled = false;
const isHomeRoute = () => ['', 'day'].includes(window.location.hash.replace(/^#\/?/, '').split('/')[0]);
// 這次打開工具已經跳過的畫面；萬一存不進手機，也不會一直重複跳
const shownThisSession = new Set();

/** 首頁畫完後才跳（一次一個；關掉、存好後首頁重畫，會接著跳下一個） */
export function scheduleCelebrations(ctx) {
  const first = pendingCelebration(ctx.data, ctx.todayKey);
  if (isScheduled || !first || shownThisSession.has(first.key)) return;
  isScheduled = true;
  requestAnimationFrame(() => {
    isScheduled = false;
    // 等待的這一下已經切到別頁（或從背景回來時在別頁）：不跳，下次回首頁再跳
    if (!isHomeRoute() || document.querySelector('dialog.celebrate')) return;
    // 重新拿最新的資料和日期，免得畫面等待時資料已經變了
    const pending = pendingCelebration(ctx.getData(), ctx.todayKey);
    if (!pending || shownThisSession.has(pending.key)) return;
    shownThisSession.add(pending.key);
    showCelebration({ ...pending.content, onClose: () => ctx.commit(pending.save(ctx.getData())) });
  });
}
