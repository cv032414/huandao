import { withSettings, withBackupDone, countWeighIns } from '../store.js';
import { buildBackup, backupFileName, parseBackup, MAX_BACKUP_BYTES } from '../backup.js';
import { validateHeight } from '../weigh.js';
import { h, notice, pageHeader, formatDateTime } from '../ui.js';
import { startSection } from './start.js';

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = h('a', { href: url, download: file.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function exportBackup(ctx) {
  const now = new Date();
  const data = ctx.getData();
  const json = JSON.stringify(buildBackup(data, now.toISOString()));
  const file = new File([json], backupFileName(ctx.todayKey), { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '減重闖關備份' });
      ctx.commit(withBackupDone(ctx.getData(), now.toISOString()), { flash: `已送出備份檔 ${file.name}，請確認有存到「檔案」App` });
    } else {
      downloadFile(file);
      ctx.commit(withBackupDone(ctx.getData(), now.toISOString()), { flash: `已下載備份檔 ${file.name}，請到「檔案」App 的「下載項目」確認` });
    }
  } catch (err) {
    if (err.name === 'AbortError') return; // 使用者自己按了取消
    window.alert(`備份沒有完成：${err.message}`);
  }
}

async function importBackup(ctx, input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) {
    window.alert('這個檔案太大了，不像是減重闖關的備份檔。');
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch (err) {
    window.alert(`檔案讀不出來，請確認檔案已經下載到手機（${err.message}）。`);
    return;
  }
  const result = parseBackup(text, new Date().toISOString());
  if (!result.ok) {
    window.alert(`這個檔案不能匯入：${result.error}`);
    return;
  }
  const count = countWeighIns(result.data);
  const when = result.exportedAt ? formatDateTime(result.exportedAt) : '不明';
  const confirmed = window.confirm(
    `備份時間：${when}\n裡面有 ${count} 天的體重紀錄。\n\n匯入會「取代」目前手機裡的所有資料，確定要匯入嗎？`,
  );
  if (!confirmed) return;
  ctx.replaceAllData(result.data, { flash: '匯入完成' });
}

function restoreSafetyCopy(ctx) {
  const copy = ctx.loadSafetyCopy();
  if (!copy) {
    window.alert('找不到匯入前的資料。');
    return;
  }
  const confirmed = window.confirm(
    `匯入前的資料裡有 ${countWeighIns(copy)} 天的體重紀錄。\n\n還原會「取代」目前手機裡的所有資料，確定要還原嗎？`,
  );
  if (confirmed) ctx.replaceAllData(copy, { flash: '已還原匯入前的資料' });
}

function heightForm(ctx) {
  const onSubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = validateHeight(form.elements.heightCm.value);
    const errorEl = form.querySelector('.field-error');
    errorEl.textContent = result.ok ? '' : result.error;
    errorEl.hidden = result.ok;
    if (result.ok) ctx.commit(withSettings(ctx.getData(), { heightCm: result.value }, ctx.getNow().toISOString()), { flash: '身高已儲存' });
  };
  return h('form', { className: 'card form', novalidate: true, onSubmit },
    h('h2', { text: '身高' }),
    h('p', { className: 'note', text: '用來算 BMI，只存在這支手機裡。' }),
    h('div', { className: 'field' },
      h('div', { className: 'field-input' },
        h('input', { id: 'field-height', name: 'heightCm', type: 'text', inputmode: 'decimal', value: ctx.data.settings.heightCm, 'aria-label': '身高' }),
        h('span', { className: 'field-unit', text: '公分' })),
      h('p', { className: 'field-error', hidden: true })),
    h('button', { className: 'button button-secondary', type: 'submit', text: '儲存身高' }));
}

function backupSection(ctx) {
  const { data } = ctx;
  const fileInput = h('input', {
    type: 'file', accept: '.json,application/json', className: 'visually-hidden', id: 'import-file',
    onChange: (e) => importBackup(ctx, e.target),
  });
  const last = data.meta.lastBackupAt ? formatDateTime(data.meta.lastBackupAt) : '還沒有備份過';
  return h('section', { className: 'card' },
    h('h2', { text: '備份' }),
    h('p', { text: `上次備份：${last}` }),
    h('p', { className: 'note', text: `目前有 ${countWeighIns(data)} 天的體重紀錄。` }),
    h('button', { className: 'button', type: 'button', text: '備份匯出', onClick: () => exportBackup(ctx) }),
    h('p', { className: 'note', text: '在跳出的選單選「儲存到檔案」，才算真的存好。' }),
    h('label', { className: 'button button-secondary', for: 'import-file', text: '從備份匯入' }),
    fileInput,
    ctx.hasSafetyCopy()
      ? h('button', { className: 'button button-text', type: 'button', text: '匯錯了？還原匯入前的資料', onClick: () => restoreSafetyCopy(ctx) })
      : null,
    notice('warn',
      h('p', { className: 'notice-title', text: '刪除主畫面圖示前請先備份，否則資料會一起不見。' }),
      h('p', { text: '資料只存在這支手機的「減重闖關」圖示裡。建議每週備份一次，存到「檔案」App 的 iCloud 雲碟。' })));
}

export function renderSettings(ctx) {
  return [
    pageHeader('設定'),
    h('div', { className: 'content' },
      ctx.flash ? notice('success', h('p', { text: `${ctx.flash} ✓` })) : null,
      startSection(ctx),
      backupSection(ctx),
      heightForm(ctx),
      h('p', { className: 'footnote', text: '第 2 步・測試版' })),
  ];
}
