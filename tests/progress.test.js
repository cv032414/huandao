import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundToTenth, dailyPoints, weekAverage, weeklyAveragePoints, rangeDomain, pointsInDomain,
  niceValueDomain, valueTicks, changeSummary, buildSampleDays,
} from '../progress.js';
import { seededRandom } from '../menu.js';

// 2026-11-02 是週一
const day = (weightKg, extra = {}) => ({ weighIn: { weightKg, bodyFatPct: null, skeletalMusclePct: null, visceralFatLevel: null, ...extra } });

test('四捨五入到小數點後一位', () => {
  assert.equal(roundToTenth(77.65), 77.7);
  assert.equal(roundToTenth(77.64), 77.6);
  assert.equal(roundToTenth(80), 80);
});

test('每日點：只有有填的日子有點、依日期排、不含未來', () => {
  const days = {
    '2026-11-03': day(79.5, { bodyFatPct: 26 }),
    '2026-11-01': day(80),
    '2026-11-02': { weighIn: null },
    '2026-11-09': day(78),
  };
  assert.deepEqual(dailyPoints(days, 'weightKg', '2026-11-05').map((p) => p.date), ['2026-11-01', '2026-11-03']);
  assert.deepEqual(dailyPoints(days, 'bodyFatPct', '2026-11-05'), [{ date: '2026-11-03', value: 26 }]);
});

test('一週平均：週一到週日、四捨五入、記錄天數', () => {
  const days = {
    '2026-11-01': day(90), // 上週日，不算
    '2026-11-02': day(78.1),
    '2026-11-04': day(77.6),
    '2026-11-08': day(77.4), // 週日，算
    '2026-11-09': day(70), // 下週一，不算
  };
  assert.deepEqual(weekAverage(days, '2026-11-02'), { weekStart: '2026-11-02', avg: 77.7, count: 3 });
  assert.deepEqual(weekAverage({}, '2026-11-02'), { weekStart: '2026-11-02', avg: null, count: 0 });
});

test('一週平均線：每週一點，畫在週四', () => {
  const points = [
    { date: '2026-11-02', value: 80 },
    { date: '2026-11-03', value: 79 },
    { date: '2026-11-10', value: 78 },
  ];
  assert.deepEqual(weeklyAveragePoints(points), [
    { date: '2026-11-05', weekStart: '2026-11-02', value: 79.5, count: 2 },
    { date: '2026-11-12', weekStart: '2026-11-09', value: 78, count: 1 },
  ]);
});

test('時間範圍：4 週、3 個月、全部；至少 7 天寬', () => {
  const points = [{ date: '2026-06-01', value: 80 }, { date: '2026-11-01', value: 78 }];
  assert.deepEqual(rangeDomain('4w', points, '2026-11-03'), { from: '2026-10-07', to: '2026-11-03' });
  assert.deepEqual(rangeDomain('all', points, '2026-11-03'), { from: '2026-06-01', to: '2026-11-03' });
  assert.deepEqual(rangeDomain('all', [{ date: '2026-11-02', value: 80 }], '2026-11-03'), { from: '2026-10-28', to: '2026-11-03' });
  assert.deepEqual(rangeDomain('壞掉的', [], '2026-11-03'), rangeDomain('3m', [], '2026-11-03'));
  assert.deepEqual(pointsInDomain(points, { from: '2026-10-07', to: '2026-11-03' }), [points[1]]);
});

test('上下範圍取整齊的數字，刻度包住所有點', () => {
  const domain = niceValueDomain([77.3, 79.8], 2);
  assert.ok(domain.min <= 77.3 && domain.max >= 79.8);
  const ticks = valueTicks(domain);
  assert.equal(ticks[0], domain.min);
  assert.equal(ticks[ticks.length - 1], domain.max);
  assert.ok(ticks.length <= 6);
  const flat = niceValueDomain([12, 12], 1);
  assert.ok(flat.min < 12 && flat.max > 12);
});

test('範圍內的變化：第一筆到最後一筆', () => {
  assert.equal(changeSummary([{ date: 'a', value: 80 }]), null);
  assert.equal(changeSummary([{ date: 'a', value: 80 }, { date: 'b', value: 78.7 }]).diff, -1.3);
});

test('試玩假資料：大約 4 個月、往下的趨勢、數值合理、開始日在範圍內', () => {
  const { days, startDate } = buildSampleDays('2026-11-03', seededRandom(7));
  const keys = Object.keys(days).sort();
  assert.ok(keys.length > 80 && keys.length <= 120);
  assert.ok(keys[keys.length - 1] <= '2026-11-03');
  assert.ok(startDate > keys[0] && startDate < '2026-11-03');
  const weights = keys.map((key) => days[key].weighIn.weightKg);
  assert.ok(weights.every((w) => w > 70 && w < 82));
  assert.ok(weights.slice(-10).reduce((a, b) => a + b) / 10 < weights.slice(0, 10).reduce((a, b) => a + b) / 10);
});

test('平滑線：不會超出前後兩點的高低，轉折點是平的', async () => {
  const { monotoneSlopes } = await import('../chart.js');
  assert.deepEqual(monotoneSlopes([0, 1, 2], [0, 1, 2]), [1, 1, 1]); // 直線還是直線
  assert.equal(monotoneSlopes([0, 1, 2], [0, 1, 0])[1], 0); // 山頂是平的
  assert.deepEqual(monotoneSlopes([0, 1], [5, 3]), [-2, -2]);
  assert.deepEqual(monotoneSlopes([0], [5]), [0]);
});
