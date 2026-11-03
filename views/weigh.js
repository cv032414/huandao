import { isDateKey, daysBetween, getAppDate, toDateKey } from '../day.js';
import { withWeighIn, withoutWeighIn } from '../store.js';
import {
  WEIGH_FIELDS, validateWeighIn, calcBmi, bmiLabel, getEditAccess, findPreviousWeighIn, isWeightUp,
  isBackfillEntry, isBackfilledToday,
} from '../weigh.js';
import { h, notice, pageHeader, formatShortDate } from '../ui.js';

function dateLabel(dateKey, todayKey) {
  const daysAgo = daysBetween(dateKey, todayKey);
  if (daysAgo === 0) return '今天';
  if (daysAgo === 1) return '昨天';
  return formatShortDate(dateKey);
}

function fieldRow(field, value, disabled) {
  const id = `field-${field.key}`;
  return h('div', { className: 'field' },
    h('label', { for: id },
      h('span', { className: 'field-label', text: field.label }),
      h('span', { className: 'field-tag', text: field.required ? '必填' : '可空著' })),
    h('div', { className: 'field-input' },
      h('input', {
        id, name: field.key, type: 'text', inputmode: 'decimal', autocomplete: 'off',
        value: value ?? '', disabled, enterkeyhint: 'done',
      }),
      h('span', { className: 'field-unit', text: field.unit })),
    h('p', { className: 'field-error', 'data-error-for': field.key, hidden: true }));
}

function showErrors(form, errors) {
  for (const el of form.querySelectorAll('[data-error-for]')) {
    const message = errors[el.dataset.errorFor];
    el.textContent = message ?? '';
    el.hidden = !message;
  }
}

function resultPanel(record, previous, heightCm) {
  if (!record) return null;
  const bmi = calcBmi(record.weightKg, heightCm);
  return h('section', { className: 'card result' },
    h('p', { className: 'result-label', text: 'BMI（身高 ' + heightCm + ' 公分）' }),
    h('p', { className: 'result-value' }, String(bmi), h('span', { className: 'result-tag', text: bmiLabel(bmi) })),
    isWeightUp(previous?.weighIn, record)
      ? notice('info', h('p', { text: `比上一筆（${formatShortDate(previous.dateKey)} ${previous.weighIn.weightKg} 公斤）重了一點。每天上下 0.5–1 公斤是正常波動，看一週平均就好。` }))
      : null);
}

/** 按下按鈕的當下重新檢查權限（畫面可能開著跨過凌晨 4 點） */
function currentAccess(ctx, dateKey) {
  const now = ctx.getNow();
  const todayKey = toDateKey(getAppDate(now));
  const record = ctx.getData().days[dateKey]?.weighIn ?? null;
  return { now, todayKey, record, access: getEditAccess(dateKey, todayKey, record) };
}

function onSubmit(event, ctx, dateKey) {
  event.preventDefault();
  const form = event.currentTarget;
  const { now, todayKey, access } = currentAccess(ctx, dateKey);
  if (!access.canSave) {
    window.alert(access.reason);
    ctx.navigate(`#/weigh/${todayKey}`);
    return;
  }
  const raw = Object.fromEntries(WEIGH_FIELDS.map((field) => [field.key, form.elements[field.key].value]));
  const result = validateWeighIn(raw);
  showErrors(form, result.errors);
  if (!result.ok) return;
  const next = withWeighIn(ctx.getData(), dateKey, result.values, { todayKey, nowIso: now.toISOString() });
  ctx.commit(next, { flash: '已儲存' });
}

function onDelete(ctx, dateKey) {
  const { now, record, access } = currentAccess(ctx, dateKey);
  if (!record || !access.canDelete) {
    window.alert(access.reason ?? '這筆紀錄不能刪除');
    return;
  }
  const confirmed = window.confirm(
    `確定要刪除 ${formatShortDate(dateKey)} 的體重紀錄（${record.weightKg} 公斤）嗎？\n刪除後無法復原。`,
  );
  if (!confirmed) return;
  ctx.commit(withoutWeighIn(ctx.getData(), dateKey, now.toISOString()), { flash: '已刪除' });
}

function entryNote(dateKey, todayKey, record, access) {
  if (!access.canSave) return null;
  if (!record && isBackfillEntry(dateKey, todayKey)) {
    return '這是補登（超過 2 天）：會留下紀錄並標「補登」，但不給經驗值。補登當天還可以修改、刪除，明天起鎖住。';
  }
  if (record && isBackfilledToday(record, todayKey)) return '這筆是今天補登的：今天還可以修改、刪除，明天起鎖住。';
  return null;
}

export function renderWeigh(ctx, requestedKey) {
  const { data, todayKey, flash } = ctx;
  const isValidPastKey = isDateKey(requestedKey) && daysBetween(requestedKey, todayKey) >= 0;
  const dateKey = isValidPastKey ? requestedKey : todayKey;
  const record = data.days[dateKey]?.weighIn ?? null;
  const previous = findPreviousWeighIn(data.days, dateKey);
  const access = getEditAccess(dateKey, todayKey, record);
  const note = entryNote(dateKey, todayKey, record, access);
  const prefill = record ?? previous?.weighIn ?? null;
  const isPrefilledFromPrevious = !record && previous !== null;

  const form = h('form', { className: 'card form', novalidate: true, onSubmit: (e) => onSubmit(e, ctx, dateKey) },
    h('div', { className: 'field' },
      h('label', { for: 'field-date' }, h('span', { className: 'field-label', text: '日期' })),
      h('input', {
        id: 'field-date', type: 'date', value: dateKey, max: todayKey,
        onChange: (e) => {
          // 清空日期或選到未來時，恢復原本的日期
          if (isDateKey(e.target.value) && e.target.value <= todayKey) ctx.navigate(`#/weigh/${e.target.value}`);
          else e.target.value = dateKey;
        },
      })),
    isPrefilledFromPrevious && access.canSave
      ? h('p', { className: 'note', text: `已先帶入 ${formatShortDate(previous.dateKey)} 的數字，請改成這次量到的。` })
      : null,
    WEIGH_FIELDS.map((field) => fieldRow(field, prefill?.[field.key], !access.canSave)),
    access.canSave
      ? h('button', { className: 'button', type: 'submit', text: record ? '更新紀錄' : '儲存' })
      : notice('info', h('p', { text: access.reason })),
    access.canDelete
      ? h('button', { className: 'button button-danger', type: 'button', text: '刪除這筆紀錄', onClick: () => onDelete(ctx, dateKey) })
      : null,
    note ? h('p', { className: 'note', text: note }) : null);

  return [
    pageHeader('量體重', `${dateLabel(dateKey, todayKey)}・量測時機：起床、上完廁所、還沒吃喝之前`),
    h('div', { className: 'content' },
      flash ? notice('success', h('p', { text: `${flash} ✓` })) : null,
      form,
      resultPanel(record, previous, data.settings.heightCm)),
  ];
}
