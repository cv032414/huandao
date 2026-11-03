// 環島地圖的規則（規格書 v0.3.3「台灣環島地圖」第 1–5 點 + v0.4 開始日）：
// 每週（週一到週日）結算一次；一週至少 3 天有量體重，平均才算數；
// 平均先四捨五入到小數點後一位，停在「公斤數 ≥ 平均」的站裡公斤數最小的那站。
import { addDays } from './day.js';
import { endedWeekStarts, weekStartKey } from './game.js';
import { weekAverage, roundToTenth } from './progress.js';
import { STATIONS, CHAPTERS, START_KG } from './map-data.js';

export const MIN_WEIGH_INS_PER_WEEK = 3;
const START_INDEX = 0;

/** 一週平均落在哪一站（站的索引）；超過起點的公斤數就停在起點 */
export function stationIndexForAverage(avg) {
  const rounded = roundToTenth(avg);
  if (rounded > START_KG) return START_INDEX;
  let index = START_INDEX;
  STATIONS.forEach((station, i) => {
    if (station.kg >= rounded) index = i;
  });
  return index;
}

/**
 * 每一個已經過完、要結算的週的結果，依時間排。
 * 紀錄不足 3 天的週：地圖停在原地（位置跟上一週一樣）。
 */
export function settlementHistory(days, startDate, todayKey) {
  let position = START_INDEX;
  return endedWeekStarts(startDate, todayKey).map((weekStart) => {
    const { avg, count } = weekAverage(days, weekStart);
    const isValid = count >= MIN_WEIGH_INS_PER_WEEK;
    const from = position;
    if (isValid) position = stationIndexForAverage(avg);
    return { weekStart, avg, count, isValid, from, to: position };
  });
}

/** 目前在第幾站（還沒有第一次有效結算之前都在台北起點） */
export function currentStationIndex(days, startDate, todayKey) {
  const history = settlementHistory(days, startDate, todayKey);
  return history.length ? history[history.length - 1].to : START_INDEX;
}

/** 最近一次結算（上週）；還沒有就是 null */
export function latestSettlement(days, startDate, todayKey) {
  const history = settlementHistory(days, startDate, todayKey);
  const last = history[history.length - 1] ?? null;
  // 只有「上週」的結算才跳結果畫面；更早的週已經過去了
  return last && last.weekStart === addDays(weekStartKey(todayKey), -7) ? last : null;
}

/** 這一站完成了哪幾章（到了章節的最後一站，或更後面） */
export function chaptersReached(stationIndex) {
  return CHAPTERS
    .filter((chapter) => stationIndex >= STATIONS.findIndex((station) => station.id === chapter.endStationId))
    .map((chapter) => chapter.id);
}

/** 到了這站，第一次通過的章（要播大的過關畫面） */
export function newlyClearedChapters(stationIndex, chaptersCleared) {
  return chaptersReached(stationIndex).filter((id) => !chaptersCleared.includes(id));
}

export const isGoalReached = (stationIndex) => stationIndex === STATIONS.length - 1;

/**
 * 首頁的「本週目前平均 X 公斤，距離下一站還差 Y 公斤」。
 * avg 是 null（本週還沒量）時只顯示下一站。
 */
export function nextStationHint(stationIndex, avg) {
  const next = STATIONS[stationIndex + 1] ?? null;
  if (!next) return { next: null, gap: null };
  if (avg === null) return { next, gap: null };
  return { next, gap: Math.max(roundToTenth(avg - next.kg), 0) };
}

/** 結算結果的一句話（上週結果畫面和地圖頁共用） */
export function settlementMessage(result) {
  if (!result.isValid) {
    return `上週紀錄不足 ${MIN_WEIGH_INS_PER_WEEK} 天（只有 ${result.count} 天），地圖暫停一週，停在${STATIONS[result.to].name}。`;
  }
  const station = STATIONS[result.to];
  const where = `${station.name} ${station.kg} 公斤`;
  const avgText = `上週平均 ${result.avg.toFixed(1)} 公斤`;
  if (result.to > result.from) return `${avgText}，前進到${where}！`;
  if (result.to < result.from) return `${avgText}，這週先回到${where}。沒關係，重新出發就好。`;
  if (result.to === START_INDEX) {
    const nextKg = STATIONS[1].kg;
    return `${avgText}，目前在起點，距離${STATIONS[1].name}還差 ${roundToTenth(result.avg - nextKg).toFixed(1)} 公斤。`;
  }
  return `${avgText}，停在${where}。`;
}
