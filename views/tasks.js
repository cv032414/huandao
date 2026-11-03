// 首頁的 5 項任務：量體重、訓練或走路、三餐
import { getAppDate, toDateKey, parseDateKey, isDefaultTrainingDay } from '../day.js';
import {
  canEditTasks, countsForXp, getDayType, getTaskResults, validateSteps, STEPS_FULL, STEPS_HALF, XP, MEAL_IDS, MEAL_LABELS,
} from '../game.js';
import { withDayType, withTrainingCompleted, withSteps, withMealStatus, withMealNote } from '../store.js';
import { MAX_NOTE_LENGTH } from '../schema.js';
import { mealSummary, mealKcal } from '../menu.js';
import { h } from '../ui.js';

/** 每次按按鈕都用當下時間重新確認還能不能改（畫面可能開著跨過凌晨 4 點） */
function update(ctx, dateKey, change) {
  const now = ctx.getNow();
  if (!canEditTasks(dateKey, toDateKey(getAppDate(now)))) {
    window.alert('超過 2 天的任務不能再勾或修改');
    ctx.navigate('#/');
    return;
  }
  ctx.commit(change(ctx.getData(), now.toISOString()));
}

function taskShell(done, xp, ...body) {
  return h('li', { className: done ? 'task task-done' : 'task' },
    h('span', { className: 'task-box', 'aria-hidden': 'true', text: done ? '✓' : '' }),
    h('div', { className: 'task-body' }, ...body),
    xp > 0 ? h('span', { className: 'task-xp', text: `+${xp}` }) : null);
}

function weighRow(dateKey, day, result) {
  const weighIn = day?.weighIn;
  let hint = '體重必填，其他 3 項可空著';
  if (weighIn) hint = `已記錄 ${weighIn.weightKg} 公斤${weighIn.isBackfill ? '（補登，不給分）' : ''}`;
  return h('li', { className: result.done ? 'task task-done' : 'task' },
    h('a', { className: 'task-link', href: `#/weigh/${dateKey}` },
      h('span', { className: 'task-box', 'aria-hidden': 'true', text: result.done ? '✓' : '' }),
      h('div', { className: 'task-body' },
        h('p', { className: 'task-label', text: '早上量體重' }),
        h('p', { className: 'task-hint', text: hint })),
      result.xp > 0 ? h('span', { className: 'task-xp', text: `+${result.xp}` }) : h('span', { className: 'chevron', 'aria-hidden': 'true', text: '›' })));
}

function swapButton(ctx, dateKey, dayType, editable) {
  if (!editable) return null;
  const target = dayType === 'training' ? 'walk' : 'training';
  const defaultType = isDefaultTrainingDay(parseDateKey(dateKey)) ? 'training' : 'walk';
  return h('button', {
    className: 'link-button', type: 'button',
    text: target === 'training' ? '改成訓練日' : '改成走路日',
    onClick: () => update(ctx, dateKey, (data, nowIso) => withDayType(data, dateKey, target, defaultType, nowIso)),
  });
}

function trainingControls(ctx, dateKey, done, editable) {
  if (!editable) return null;
  return h('button', {
    className: done ? 'chip-button chip-button-on' : 'chip-button', type: 'button',
    text: done ? '已完成（按一下取消）' : '做完了，打勾',
    onClick: () => update(ctx, dateKey, (data, nowIso) => withTrainingCompleted(data, dateKey, !done, nowIso)),
  });
}

function stepsControls(ctx, dateKey, steps, editable) {
  if (!editable) return null;
  const onSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = validateSteps(form.elements.steps.value);
    const errorEl = form.querySelector('.field-error');
    errorEl.textContent = result.ok ? '' : result.error;
    errorEl.hidden = result.ok;
    if (result.ok) update(ctx, dateKey, (data, nowIso) => withSteps(data, dateKey, result.value, nowIso));
  };
  return h('form', { className: 'inline-form', novalidate: true, onSubmit },
    h('div', { className: 'inline-row' },
      h('input', { name: 'steps', 'data-draft': `steps-${dateKey}`, type: 'text', inputmode: 'numeric', value: steps ?? '', placeholder: '步數', 'aria-label': '今天的步數', enterkeyhint: 'done' }),
      h('button', { className: 'chip-button', type: 'submit', text: '儲存' })),
    h('p', { className: 'field-error', hidden: true }));
}

function exerciseRow(ctx, dateKey, day, result, editable, showXp) {
  const dayType = getDayType(dateKey, day);
  const isTraining = dayType === 'training';
  const steps = day?.exercise?.steps ?? null;
  let hint;
  if (isTraining) hint = '約 15–18 分鐘。到「訓練」分頁跟著做，做完自動打勾。';
  else if (steps === null) hint = showXp
    ? `看 iPhone「健康」App 輸入步數：${STEPS_FULL} 步 +${XP.walkFull}、${STEPS_HALF} 步以上 +${XP.walkHalf}`
    : `看 iPhone「健康」App 輸入步數；${STEPS_HALF} 步以上算完成`;
  else hint = `已記錄 ${steps} 步${result.done ? '' : `（${STEPS_HALF} 步以上才算完成）`}`;

  return taskShell(result.done, result.xp,
    h('div', { className: 'task-title-row' },
      h('p', { className: 'task-label', text: isTraining ? '早晨訓練' : `走路 ${STEPS_FULL} 步` }),
      swapButton(ctx, dateKey, dayType, editable)),
    h('p', { className: 'task-hint', text: hint }),
    isTraining ? trainingControls(ctx, dateKey, result.done, editable) : stepsControls(ctx, dateKey, steps, editable));
}

function noteForm(ctx, dateKey, mealId, note) {
  const onSubmit = (event) => {
    event.preventDefault();
    const text = event.currentTarget.elements.note.value.trim().slice(0, MAX_NOTE_LENGTH);
    update(ctx, dateKey, (data, nowIso) => withMealNote(data, dateKey, mealId, text, nowIso));
  };
  return h('form', { className: 'inline-form', onSubmit },
    h('textarea', { name: 'note', 'data-draft': `note-${dateKey}-${mealId}`, rows: 2, maxlength: MAX_NOTE_LENGTH, placeholder: '實際吃了什麼？（可不填）', 'aria-label': `${MEAL_LABELS[mealId]}實際吃了什麼` }, note),
    h('button', { className: 'chip-button', type: 'submit', text: '儲存備註' }));
}

function planLine(dateKey, todayKey, planned) {
  if (!planned) return null;
  const text = `菜單 ${mealSummary(planned)}（約 ${mealKcal(planned)} 大卡）`;
  return dateKey === todayKey
    ? h('a', { className: 'task-plan', href: '#/menu' }, text)
    : h('p', { className: 'task-plan', text });
}

function mealRow(ctx, dateKey, mealId, { meal, planned }, result, editable, showXp) {
  const status = meal?.status ?? null;
  const choose = (next) => () => {
    // 取消勾選會一起清掉備註，有寫備註時先確認
    if (next === null && meal?.note && !window.confirm(`取消勾選會一起刪掉備註「${meal.note}」，確定嗎？`)) return;
    update(ctx, dateKey, (data, nowIso) => withMealStatus(data, dateKey, mealId, next, nowIso));
  };
  const hintByStatus = {
    followed: meal?.note ? `照菜單 ✓（備註：${meal.note}）` : '照菜單 ✓',
    deviated: meal?.note ? `有吃但沒照 △：${meal.note}` : '有吃但沒照 △',
  };
  return taskShell(result.done, result.xp,
    h('p', { className: 'task-label', text: MEAL_LABELS[mealId] }),
    planLine(dateKey, ctx.todayKey, planned),
    h('p', { className: 'task-hint', text: hintByStatus[status] ?? (showXp ? `照菜單 ✓ +${XP.mealFollowed}，有吃但沒照 △ +${XP.mealDeviated}` : '照菜單 ✓，或有吃但沒照 △') }),
    editable
      ? h('div', { className: 'choice-row' },
        h('button', { className: status === 'followed' ? 'chip-button chip-button-on' : 'chip-button', type: 'button', text: '✓ 照菜單', onClick: choose(status === 'followed' ? null : 'followed') }),
        h('button', { className: status === 'deviated' ? 'chip-button chip-button-on' : 'chip-button', type: 'button', text: '△ 沒照', onClick: choose(status === 'deviated' ? null : 'deviated') }))
      : null,
    editable && status === 'deviated' ? noteForm(ctx, dateKey, mealId, meal.note) : null);
}

export function taskList(ctx, dateKey) {
  const day = ctx.data.days[dateKey];
  // 準備期與開始日之前不顯示分數
  const showXp = countsForXp(dateKey, ctx.data.progress.startDate);
  const results = Object.fromEntries(Object.entries(getTaskResults(dateKey, day))
    .map(([id, result]) => [id, showXp ? result : { ...result, xp: 0 }]));
  const editable = canEditTasks(dateKey, ctx.todayKey);
  return h('ol', { className: 'tasks' },
    weighRow(dateKey, day, results.weigh),
    exerciseRow(ctx, dateKey, day, results.exercise, editable, showXp),
    MEAL_IDS.map((id) => {
      const meal = day?.meals?.[id] ?? null;
      const planned = meal?.planned ?? day?.menuPlan?.[id] ?? null;
      return mealRow(ctx, dateKey, id, { meal, planned }, results[id], editable, showXp);
    }));
}
