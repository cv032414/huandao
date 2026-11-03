// 備份檔：匯出、匯入時的檢查，以及「該備份了」的提醒
import { isPlainObject, isValidTimestamp, sanitizeData } from './schema.js';

export const BACKUP_APP_ID = 'huandao';
export const BACKUP_REMINDER_DAYS = 7;
// 每天約 3 KB（含菜單），10 MB 大約夠用 9 年
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildBackup(data, nowIso) {
  return { app: BACKUP_APP_ID, exportedAt: nowIso, data };
}

export function backupFileName(todayKey) {
  return `huandao-backup-${todayKey}.json`;
}

/** 讀備份檔文字；回傳 { ok, data, exportedAt } 或 { ok: false, error } */
export function parseBackup(text, nowIso) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    return { ok: false, error: '檔案內容不是備份格式' };
  }
  if (!isPlainObject(backup) || backup.app !== BACKUP_APP_ID) {
    return { ok: false, error: '這不是「減重闖關」的備份檔' };
  }
  const result = sanitizeData(backup.data, nowIso);
  if (!result.ok) return { ok: false, error: result.error };
  // 匯入的這份檔案本身就是一份備份，所以上次備份時間 = 檔案匯出時間
  const exportedAt = isValidTimestamp(backup.exportedAt, nowIso) ? backup.exportedAt : null;
  return {
    ok: true,
    exportedAt,
    data: { ...result.data, meta: { ...result.data.meta, lastBackupAt: exportedAt } },
  };
}

/** 距離上次備份幾天；從沒備份過就從開始使用那天算 */
export function daysSinceBackup(data, now) {
  const since = data.meta.lastBackupAt ?? data.meta.createdAt;
  return Math.floor((now.getTime() - Date.parse(since)) / MS_PER_DAY);
}

export function needsBackupReminder(data, now) {
  const hasRecords = Object.values(data.days).some((day) => day.weighIn);
  if (!hasRecords) return false;
  const days = daysSinceBackup(data, now);
  return !Number.isFinite(days) || days >= BACKUP_REMINDER_DAYS;
}
