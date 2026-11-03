// 「訓練」頁：選動作版本 → 跟著做（動畫、倒數、第幾輪、下一個動作預告）
import { getAppDate, toDateKey, parseDateKey, isDefaultTrainingDay } from '../day.js';
import {
  EXERCISES, SAFETY_TIPS, ROUNDS, SECONDS_PER_REP, REST_SECONDS, WARMUP, COOLDOWN,
} from '../training-data.js';
import {
  buildWorkout, chosenVariant, isVariantUnlocked, withEasierExercise, nextActiveStep, estimateSeconds,
  youtubeSearchUrl, easyVariant,
} from '../training.js';
import {
  canEditTasks, countsForXp, currentLevel, weekStartKey, weekSummary, TRAININGS_PER_WEEK, XP,
} from '../game.js';
import { withExerciseVariant, withBeepEnabled, withTrainingFinished } from '../store.js';
import { createFigure } from '../figure.js';
import { prepareSound, beep } from '../sound.js';
import { h, notice, pageHeader, formatShortDate } from '../ui.js';

const TICK_MS = 250;
/** 換到下一個動作後這段時間內的點擊不算（避免連點兩下跳過一個動作） */
const TAP_GUARD_MS = 600;
const PHASE_LABELS = { warmup: '暖身', cooldown: '收操', rest: '休息' };

// 訓練進行中的狀態。離開這一頁、或切到別的 App 會自動暫停；回來按「繼續」接著做。
let session = null;

function safetyNotice() {
  return notice('warn', h('p', { className: 'notice-title', text: '安全提示' }), SAFETY_TIPS.map((tip) => h('p', { text: tip })));
}

function demoLink(query) {
  if (!query) return null;
  return h('a', { className: 'chip-button chip-button-small demo-link', href: youtubeSearchUrl(query), target: '_blank', rel: 'noopener' }, '看真人示範 ↗');
}

const formatClock = (ms) => {
  const seconds = Math.max(Math.ceil(ms / 1000), 0);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const isOnTrainingPage = () => window.location.hash.replace(/^#\/?/, '').split('/')[0] === 'training';
const isActive = () => Boolean(session) && !session.finished;

// ---------- 保持螢幕亮著 ----------
function markWakeLockFailed(target) {
  if (session !== target || target.wakeLockFailed) return;
  target.wakeLockFailed = true;
  mountPlayer();
}

async function keepScreenOn() {
  if (!isActive() || session.wakeLock || session.wakeLockPending || document.visibilityState !== 'visible') return;
  const target = session;
  if (!('wakeLock' in navigator)) {
    markWakeLockFailed(target);
    return;
  }
  target.wakeLockPending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    // 等待的時候已經結束或離開這一頁：馬上放掉，免得螢幕一直亮著
    if (session !== target || target.finished || !isOnTrainingPage()) {
      lock.release().catch(() => {});
      return;
    }
    target.wakeLock = lock;
    target.wakeLockFailed = false;
    // iPhone 切走時會自動放掉；記下來，回來時再要一次
    lock.addEventListener?.('release', () => {
      if (target.wakeLock === lock) target.wakeLock = null;
    });
  } catch {
    markWakeLockFailed(target);
  } finally {
    target.wakeLockPending = false;
  }
}

function releaseScreen() {
  const lock = session?.wakeLock;
  if (!lock) return;
  session.wakeLock = null;
  lock.release?.().catch(() => {});
}

// ---------- 訓練流程 ----------
function startStep(now) {
  const step = session.steps[session.index];
  session.endsAt = step.mode === 'timed' ? now + step.amount * 1000 : null;
  session.paused = false;
  session.pausedRemaining = null;
  session.autoPaused = false;
  session.lastBeep = null;
  session.stepStartedAt = now;
  if (session.beepEnabled) beep(true);
}

/** fromIndex：按下去時畫面上是第幾個；byUser：是手按的（剛換動作時連點的第二下不算） */
function advance(fromIndex, { byUser = false } = {}) {
  if (!isActive() || session.index !== fromIndex) return;
  if (byUser && Date.now() - session.stepStartedAt < TAP_GUARD_MS) return;
  session.index += 1;
  if (session.index >= session.steps.length) {
    finish();
    return;
  }
  startStep(Date.now());
  mountPlayer();
}

/** 回傳 true = 這次真的暫停了；mount = false 時只改狀態不重畫（離開這一頁時用） */
function pause({ auto, mount = true }) {
  if (!isActive() || session.paused || session.endsAt === null) return false;
  session.paused = true;
  session.autoPaused = auto;
  session.pausedRemaining = Math.max(session.endsAt - Date.now(), 0);
  if (mount) mountPlayer();
  return true;
}

function resume() {
  if (!isActive() || !session.paused) return;
  prepareSound(); // 按「繼續」算是一次點擊，順便把被暫停的聲音叫醒
  session.paused = false;
  session.autoPaused = false;
  session.endsAt = Date.now() + session.pausedRemaining;
  session.pausedRemaining = null;
  mountPlayer();
}

function tick() {
  if (!isActive() || session.paused || session.endsAt === null) return;
  // 畫面上沒有訓練（例如切到別頁）就先停住，不要在背景自己做完
  if (!document.querySelector('[data-role="player"]')) {
    pause({ auto: true });
    return;
  }
  const remaining = session.endsAt - Date.now();
  const secondLeft = Math.ceil(remaining / 1000);
  if (session.beepEnabled && secondLeft >= 1 && secondLeft <= 3 && session.lastBeep !== secondLeft) {
    session.lastBeep = secondLeft;
    beep(false);
  }
  if (remaining <= 0) {
    advance(session.index);
    return;
  }
  const clock = document.querySelector('[data-role="clock"]');
  const text = formatClock(remaining);
  if (clock && clock.textContent !== text) clock.textContent = text;
}

function stopTimer() {
  if (session?.timer) clearInterval(session.timer);
  session?.figure?.stop();
}

function closeSession() {
  stopTimer();
  releaseScreen();
  session = null;
}

/** 打勾在「開始訓練的那天」：凌晨 4 點前開始、4 點後才做完，算前一天 */
function finish() {
  if (!isActive()) return;
  const { ctx } = session;
  stopTimer();
  releaseScreen();
  const now = ctx.getNow();
  const todayKey = toDateKey(getAppDate(now));
  const dayKey = canEditTasks(session.dayKey, todayKey) ? session.dayKey : todayKey;
  const defaultType = isDefaultTrainingDay(parseDateKey(dayKey)) ? 'training' : 'walk';
  const data = ctx.getData();
  session.finished = true;
  session.result = {
    dayKey,
    isToday: dayKey === todayKey,
    alreadyDone: data.days[dayKey]?.exercise?.trainingCompleted === true,
    earnsXp: countsForXp(dayKey, data.progress.startDate),
    saveFailed: false,
  };
  const saved = ctx.commit(withTrainingFinished(data, dayKey, defaultType, now.toISOString()));
  if (!saved && session) {
    session.result = { ...session.result, saveFailed: true };
    mountPlayer();
  }
}

function startSession(ctx, variants) {
  prepareSound();
  session = {
    ctx, steps: buildWorkout(variants), index: 0, dayKey: ctx.todayKey,
    endsAt: null, stepStartedAt: 0, paused: false, pausedRemaining: null, autoPaused: false, finished: false, lastBeep: null,
    beepEnabled: ctx.data.settings.beepEnabled, wakeLock: null, wakeLockPending: false, wakeLockFailed: false,
    figure: null, timer: null, result: null,
  };
  startStep(Date.now());
  session.timer = setInterval(tick, TICK_MS);
  ctx.refresh();
}

function makeEasier() {
  const step = session.steps[session.index];
  session.steps = withEasierExercise(session.steps, session.index, step.exerciseKey);
  const easier = session.steps[session.index];
  if (easier.mode === 'timed') {
    if (session.paused) session.pausedRemaining = easier.amount * 1000;
    else session.endsAt = Date.now() + easier.amount * 1000;
  }
  mountPlayer();
}

function quit() {
  // 確認視窗開著的時候先暫停，按「取消」時時間沒有被吃掉
  const pausedHere = pause({ auto: false, mount: false });
  if (!window.confirm('要結束這次訓練嗎？做到一半結束不會打勾。')) {
    if (pausedHere) resume();
    return;
  }
  const { ctx } = session;
  closeSession();
  ctx.refresh();
}

document.addEventListener('visibilitychange', () => {
  if (!isActive()) return;
  if (document.visibilityState === 'hidden') {
    // 鎖螢幕或切到別的 App：自動暫停，免得回來時動作已經被跳過
    pause({ auto: true });
    return;
  }
  if (isOnTrainingPage()) keepScreenOn();
});

// 這個監聽比 app.js 的重畫先執行（這個檔案比 app.js 的 init 先載入）
window.addEventListener('hashchange', () => {
  if (!session || isOnTrainingPage()) return;
  if (session.finished) {
    closeSession(); // 做完後去別頁，下次回來就是新的開始畫面
    return;
  }
  pause({ auto: true, mount: false });
  session.figure?.stop();
  releaseScreen();
});

// ---------- 畫面：訓練中 ----------
function phaseLabel(step) {
  if (step.kind === 'exercise') return `第 ${step.round} 輪／共 ${ROUNDS} 輪`;
  if (step.kind === 'rest') return `休息（第 ${step.round} 輪）`;
  return `${PHASE_LABELS[step.kind]} ${step.round}／${step.totalInPhase}`;
}

function stepControls(step) {
  const index = session.index;
  if (step.mode === 'reps') {
    return h('div', { className: 'player-actions' },
      h('button', {
        className: 'button', type: 'button', text: '完成，下一個', dataset: { focus: 'primary' },
        onClick: () => advance(index, { byUser: true }),
      }));
  }
  return h('div', { className: 'player-actions' },
    h('button', {
      className: 'button button-secondary', type: 'button',
      text: session.paused ? '繼續' : '暫停', dataset: { focus: 'primary' },
      onClick: () => (session.paused ? resume() : pause({ auto: false })),
    }),
    h('button', {
      className: 'button button-secondary', type: 'button',
      text: step.kind === 'rest' ? '跳過休息' : '跳過這個', dataset: { focus: 'skip' },
      onClick: () => advance(index, { byUser: true }),
    }));
}

function easierButton(step) {
  if (step.kind !== 'exercise') return null;
  const exercise = EXERCISES.find((e) => e.key === step.exerciseKey);
  const easy = easyVariant(exercise);
  if (!easy || easy.id === step.variantId) return null;
  return h('button', { className: 'link-button', type: 'button', text: `太難了，換簡單版（${easy.name}）`, onClick: makeEasier });
}

function playerView() {
  const step = session.steps[session.index];
  const next = nextActiveStep(session.steps, session.index);
  session.figure?.stop();
  session.figure = createFigure(step.anim, `${step.name}的示範動畫`);
  const remaining = session.paused ? session.pausedRemaining : (session.endsAt ?? 0) - Date.now();
  const progress = Math.round((session.index / session.steps.length) * 100);

  return h('section', { className: 'card player' },
    h('div', { className: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progress },
      h('div', { className: 'progress-fill', style: `width: ${progress}%` })),
    h('p', { className: 'player-phase', text: phaseLabel(step) }),
    h('h2', { className: 'player-name', text: step.name }),
    h('div', { className: 'figure-wrap' }, session.figure.element),
    step.mode === 'timed'
      ? h('p', { className: 'player-big', role: 'timer', 'data-role': 'clock', text: formatClock(remaining) })
      : h('p', { className: 'player-big', text: `目標 ${step.amount} 下` }),
    session.autoPaused ? notice('info', h('p', { text: '剛剛離開了畫面，已經自動暫停。按「繼續」接著做。' })) : null,
    step.mode === 'reps' ? h('p', { className: 'note', text: `跟著動畫的節奏，大約 ${SECONDS_PER_REP} 秒一下；做完按「完成」。` }) : null,
    stepControls(step),
    h('div', { className: 'choice-row' }, demoLink(step.search), easierButton(step)),
    h('p', { className: 'player-next', text: next ? `下一個：${next.name}` : '這是最後一個了！' }),
    session.wakeLockFailed
      ? notice('info', h('p', { text: '這支手機沒辦法讓螢幕保持亮著。螢幕暗掉時訓練會自動暫停：可以到 iPhone「設定 → 螢幕顯示與亮度 → 自動鎖定」暫時改成「永不」，練完再改回來。' }))
      : null,
    safetyNotice(),
    h('button', { className: 'link-button', type: 'button', text: '結束訓練', onClick: quit }));
}

/** 換畫面後把焦點放回同一個位置的按鈕（用 VoiceOver 時才不會跳回最上面） */
function mountPlayer() {
  const slot = document.querySelector('[data-role="player"]');
  if (!slot || !session) return;
  const active = document.activeElement;
  const hadFocus = slot.contains(active);
  const focusKey = active?.dataset?.focus ?? 'primary';
  slot.replaceChildren(session.finished ? finishView() : playerView());
  if (hadFocus) (slot.querySelector(`[data-focus="${focusKey}"]`) ?? slot.querySelector('[data-focus="primary"]'))?.focus();
}

function finishText(result) {
  if (result.saveFailed) return '剛剛沒有存成功。請回首頁，手動勾「早晨訓練」。';
  const day = result.isToday ? '今天' : formatShortDate(result.dayKey);
  if (result.alreadyDone) return `${day}已經打過勾了，這次不重複加分。`;
  if (result.earnsXp) return `${day}的「早晨訓練」已經打勾，+${XP.training} 經驗值。`;
  return `${day}的「早晨訓練」已經打勾。`;
}

function finishView() {
  const { ctx, result } = session;
  const done = () => {
    closeSession();
    ctx.navigate('#/');
  };
  return h('section', { className: 'card player-finish' },
    h('p', { className: 'celebrate-emoji', 'aria-hidden': 'true', text: '💪' }),
    h('h2', { text: '完成這次的訓練！' }),
    h('p', { text: finishText(result) }),
    h('p', { className: 'note', text: '肌肉痠痛是正常的；關節痛、胸悶、頭暈要休息，持續不舒服請看醫生。' }),
    h('button', { className: 'button', type: 'button', text: '回首頁', dataset: { focus: 'primary' }, onClick: done }));
}

// ---------- 畫面：開始前 ----------
/** 改設定會整頁重畫，重畫後把焦點放回剛剛改的那一格 */
function commitAndRefocus(ctx, nextData, id) {
  ctx.commit(nextData);
  document.getElementById(id)?.focus();
}

const phaseMinutes = (steps) => Math.round(steps.reduce((sum, step) => sum + step.seconds, 0) / 60);

function variantPicker(ctx, exercise, level, isStarted) {
  const current = chosenVariant(exercise, ctx.data.settings.exerciseVariants, level, isStarted);
  const id = `variant-${exercise.key}`;
  const onChange = (event) => commitAndRefocus(ctx, withExerciseVariant(ctx.getData(), exercise.key, event.target.value), id);
  return h('div', { className: 'variant-row' },
    h('label', { for: id, className: 'field-label', text: exercise.name }),
    h('select', { id, onChange },
      exercise.variants.map((variant) => {
        const unlocked = isVariantUnlocked(variant, level, isStarted);
        const amount = variant.mode === 'timed' ? `${variant.amount} 秒` : `${variant.amount} 下`;
        const tag = { easy: '簡單版', base: '起始版', advanced: unlocked ? '進階' : `Lv.${variant.unlockLevel} 解鎖` }[variant.kind];
        return h('option', { value: variant.id, disabled: !unlocked, selected: variant.id === current.id }, `${variant.name}・${amount}（${tag}）`);
      })),
    demoLink(current.search));
}

function introView(ctx) {
  const { data, todayKey } = ctx;
  const isStarted = Boolean(data.progress.startDate);
  const level = currentLevel(data, todayKey);
  const variants = Object.fromEntries(EXERCISES.map((e) => [e.key, chosenVariant(e, data.settings.exerciseVariants, level, isStarted)]));
  const minutes = Math.round(estimateSeconds(buildWorkout(variants)) / 60);
  const week = weekSummary(data.days, weekStartKey(todayKey));
  const doneToday = data.days[todayKey]?.exercise?.trainingCompleted === true;

  return [
    h('section', { className: 'card' },
      h('p', { text: `暖身 ${phaseMinutes(WARMUP)} 分鐘 → ${EXERCISES.length} 個動作輪流做一圈、共 ${ROUNDS} 圈（動作之間休息 ${REST_SECONDS} 秒）→ 收操 ${phaseMinutes(COOLDOWN)} 分鐘。` }),
      h('p', { className: 'note', text: `這次大約 ${minutes} 分鐘（實際時間依個人速度而定）。本週訓練 ${week.trainingCount}／${TRAININGS_PER_WEEK} 次。` }),
      doneToday ? notice('success', h('p', { text: '今天已經完成訓練 ✓（想再做一次也可以，不會重複加分）' })) : null,
      h('button', { className: 'button', type: 'button', text: '開始訓練', onClick: () => startSession(ctx, variants) })),
    safetyNotice(),
    h('section', { className: 'card' },
      h('h2', { text: '動作版本' }),
      h('p', { className: 'note', text: isStarted
        ? '每升 3 級解鎖一個進階版。不強迫換：目前這組做起來輕鬆再換。'
        : '進階版要正式開始闖關、等級夠了才會解鎖。' }),
      EXERCISES.map((exercise) => variantPicker(ctx, exercise, level, isStarted))),
    h('section', { className: 'card' },
      h('h2', { text: '提示音' }),
      h('label', { className: 'toggle-row' },
        h('input', {
          id: 'beep-toggle', type: 'checkbox', checked: data.settings.beepEnabled,
          onChange: (e) => commitAndRefocus(ctx, withBeepEnabled(ctx.getData(), e.target.checked), 'beep-toggle'),
        }),
        h('span', { text: '倒數 3、2、1 和換動作時「嗶」一聲' })),
      h('p', { className: 'note', text: '工具不內建音樂，可以一邊開 Spotify 等 App 放歌。手機開靜音模式時，提示音可能不會響。' })),
  ];
}

export function renderTraining(ctx) {
  if (isActive()) {
    session.ctx = ctx;
    keepScreenOn();
  }
  return [
    pageHeader('早晨訓練', '跟著動畫做，做完自動打勾'),
    h('div', { className: 'content' },
      session ? h('div', { 'data-role': 'player' }, session.finished ? finishView() : playerView()) : introView(ctx)),
  ];
}
