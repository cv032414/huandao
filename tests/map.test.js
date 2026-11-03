import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stationIndexForAverage, settlementHistory, currentStationIndex, latestSettlement, chaptersReached,
  newlyClearedChapters, nextStationHint, settlementMessage, isGoalReached,
} from '../map.js';
import { STATIONS, CHAPTERS } from '../map-data.js';
import { addDays } from '../day.js';

const nameAt = (index) => `${STATIONS[index].name}${STATIONS[index].kg}`;
const weigh = (weightKg) => ({ weighIn: { weightKg } });

/** 從某個週一開始，把指定的天（0=週一）填上體重 */
function weekOf(monday, weights) {
  return Object.fromEntries(weights.map(([offset, kg]) => [addDays(monday, offset), weigh(kg)]));
}

test('地圖資料：15 站加起點、每站差 1 公斤、三章的終點', () => {
  assert.equal(STATIONS.length, 16);
  STATIONS.forEach((station, i) => assert.equal(station.kg, 80 - i));
  assert.deepEqual(CHAPTERS.map((c) => STATIONS.find((s) => s.id === c.endStationId).kg), [75, 71, 65]);
  assert.equal(STATIONS.find((s) => s.name === '台南').note, 'BMI 回到正常');
});

test('平均落在哪一站：規格書的例子', () => {
  assert.equal(nameAt(stationIndexForAverage(77.6)), '新竹78');
  assert.equal(nameAt(stationIndexForAverage(76.8)), '苗栗77');
  assert.equal(nameAt(stationIndexForAverage(77.0)), '苗栗77');
  assert.equal(nameAt(stationIndexForAverage(77.04)), '苗栗77'); // 先四捨五入成 77.0
  assert.equal(nameAt(stationIndexForAverage(77.05)), '新竹78'); // 四捨五入成 77.1
  assert.equal(nameAt(stationIndexForAverage(65.0)), '台北65');
  assert.equal(nameAt(stationIndexForAverage(63)), '台北65');
  assert.equal(nameAt(stationIndexForAverage(80)), '台北80');
  assert.equal(nameAt(stationIndexForAverage(83.4)), '台北80');
});

test('結算：從開始日後第一個完整週算起，紀錄不足 3 天暫停，變重真的會退', () => {
  // 開始日 2026-10-07（週三）→ 第一個完整週是 10/12
  const days = {
    ...weekOf('2026-10-05', [[2, 70], [3, 70], [4, 70]]), // 開始日那週：不結算
    ...weekOf('2026-10-12', [[0, 78.2], [2, 77.8], [4, 77.9]]), // 平均 78.0 → 新竹
    ...weekOf('2026-10-19', [[0, 76], [1, 76]]), // 只有 2 天 → 暫停
    ...weekOf('2026-10-26', [[0, 76.9], [1, 76.8], [2, 76.7]]), // 76.8 → 苗栗
    ...weekOf('2026-11-02', [[0, 78.6], [1, 78.4], [2, 78.5]]), // 78.5 → 退回桃園
  };
  const history = settlementHistory(days, '2026-10-07', '2026-11-10');
  assert.deepEqual(history.map((r) => [r.weekStart, r.isValid, nameAt(r.to)]), [
    ['2026-10-12', true, '新竹78'],
    ['2026-10-19', false, '新竹78'],
    ['2026-10-26', true, '苗栗77'],
    ['2026-11-02', true, '桃園79'],
  ]);
  assert.equal(currentStationIndex(days, '2026-10-07', '2026-11-10'), 1);
  assert.match(settlementMessage(history[1]), /不足 3 天/);
  assert.match(settlementMessage(history[3]), /回到桃園/);
  assert.match(settlementMessage(history[0]), /前進到新竹/);
});

test('還沒開始、或還沒有結算過：停在台北起點', () => {
  const days = weekOf('2026-10-12', [[0, 70], [1, 70], [2, 70]]);
  assert.equal(currentStationIndex(days, null, '2026-11-10'), 0);
  assert.equal(currentStationIndex(days, '2026-11-03', '2026-11-05'), 0);
});

test('超過起點的公斤數：停在起點，用語不責備', () => {
  const days = weekOf('2026-10-12', [[0, 81], [1, 81.2], [2, 80.9]]);
  const [result] = settlementHistory(days, '2026-10-12', '2026-10-19');
  assert.equal(result.to, 0);
  assert.equal(settlementMessage(result), '上週平均 81.0 公斤，目前在起點，距離桃園還差 2.0 公斤。');
});

test('上週結果畫面只看「上週」那一次結算', () => {
  const days = weekOf('2026-10-12', [[0, 78], [1, 78], [2, 78]]);
  assert.equal(latestSettlement(days, '2026-10-12', '2026-10-20').weekStart, '2026-10-12');
  assert.equal(latestSettlement(days, '2026-10-12', '2026-10-27').weekStart, '2026-10-19');
  assert.equal(latestSettlement(days, '2026-10-12', '2026-10-15'), null);
  assert.equal(latestSettlement(days, null, '2026-10-20'), null);
});

test('過關：到了章節終點或更後面；第一次才算新過關', () => {
  assert.deepEqual(chaptersReached(4), []);
  assert.deepEqual(chaptersReached(5), [1]);
  assert.deepEqual(chaptersReached(10), [1, 2]);
  assert.deepEqual(chaptersReached(15), [1, 2, 3]);
  assert.deepEqual(newlyClearedChapters(10, [1]), [2]);
  assert.deepEqual(newlyClearedChapters(5, [1, 2]), []);
  assert.equal(isGoalReached(15), true);
  assert.equal(isGoalReached(14), false);
});

test('距離下一站還差幾公斤', () => {
  assert.deepEqual(nextStationHint(2, 77.6), { next: STATIONS[3], gap: 0.6 });
  assert.deepEqual(nextStationHint(2, 76.5), { next: STATIONS[3], gap: 0 });
  assert.deepEqual(nextStationHint(2, null), { next: STATIONS[3], gap: null });
  assert.deepEqual(nextStationHint(15, 64), { next: null, gap: null });
});

test('平均剛好在 0.05 時照四捨五入（不受小數誤差影響）', async () => {
  const { averageToTenth } = await import('../progress.js');
  assert.equal(averageToTenth([74.0, 74.1]), 74.1); // 74.05 → 74.1，還沒到嘉義 74
  assert.equal(averageToTenth([72.6, 75.3]), 74.0);
  assert.equal(averageToTenth([79.6, 65.3]), 72.5);
  assert.equal(averageToTenth([68.1, 67.8]), 68.0);
  const days = weekOf('2026-10-12', [[0, 74.0], [1, 74.1], [2, 74.0], [3, 74.1]]);
  const [result] = settlementHistory(days, '2026-10-12', '2026-10-19');
  assert.equal(result.avg, 74.1);
  assert.equal(nameAt(result.to), '彰化75');
});

test('環島完成的總結：開始體重、最後一週平均、花了幾週', async () => {
  const { journeySummary } = await import('../map.js');
  const days = {
    '2026-10-07': weigh(80.1), // 開始日（週三）
    ...weekOf('2026-10-12', [[0, 70], [1, 70], [2, 70]]), // 還沒到
    ...weekOf('2026-10-19', [[0, 64.9], [1, 64.8], [2, 64.7]]), // 平均 64.8 → 到終點
  };
  assert.equal(journeySummary(days, '2026-10-07', '2026-10-20'), null); // 還沒結算到
  assert.deepEqual(journeySummary(days, '2026-10-07', '2026-10-27'), { startWeight: 80.1, finalAvg: 64.8, lost: 15.3, weeks: 3 });
});
