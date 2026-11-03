import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../training-data.js';
import {
  buildWorkout, chosenVariant, isVariantUnlocked, advancedVariants, unlockedAtLevel, withEasierExercise,
  nextActiveStep, estimateSeconds, youtubeSearchUrl, exerciseByKey, baseVariant, findVariant,
} from '../training.js';

const baseChoices = () => Object.fromEntries(EXERCISES.map((e) => [e.key, baseVariant(e)]));

test('整套流程：暖身 3 → 4 個動作 × 3 圈（中間休息）→ 收操 3', () => {
  const steps = buildWorkout(baseChoices());
  assert.deepEqual(steps.slice(0, 3).map((s) => s.kind), ['warmup', 'warmup', 'warmup']);
  assert.deepEqual(steps.slice(-3).map((s) => s.kind), ['cooldown', 'cooldown', 'cooldown']);
  const exercises = steps.filter((s) => s.kind === 'exercise');
  assert.equal(exercises.length, 12);
  assert.deepEqual(exercises.slice(0, 4).map((s) => s.name), ['深蹲', '跪姿伏地挺身', '臀橋', '棒式']);
  assert.deepEqual(exercises.map((s) => s.round), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  assert.equal(steps.filter((s) => s.kind === 'rest').length, 11);
  assert.equal(steps.find((s) => s.kind === 'rest').amount, 30);
});

test('起始版份量：深蹲 10、跪姿伏地挺身 8、臀橋 12、棒式 20 秒', () => {
  const [squat, pushup, bridge, plank] = buildWorkout(baseChoices()).filter((s) => s.kind === 'exercise');
  assert.deepEqual([squat.amount, pushup.amount, bridge.amount, plank.amount], [10, 8, 12, 20]);
  assert.equal(plank.mode, 'timed');
  assert.equal(squat.mode, 'reps');
});

test('大約 15 分鐘（做幾下的動作以每下 3 秒估）', () => {
  const minutes = estimateSeconds(buildWorkout(baseChoices())) / 60;
  assert.ok(minutes >= 14 && minutes <= 18, `${minutes}`);
});

test('進階版：每 3 級解鎖一個，共 6 個', () => {
  assert.deepEqual(advancedVariants().map(({ variant }) => variant.unlockLevel), [3, 6, 9, 12, 15, 18]);
  assert.deepEqual(unlockedAtLevel(3).map(({ variant }) => variant.name), ['標準伏地挺身']);
  assert.deepEqual(unlockedAtLevel(4), []);
});

test('解鎖條件：要正式開始而且等級夠；簡單版、起始版隨時可用', () => {
  const { variant: standard } = findVariant('pushup-standard');
  assert.equal(isVariantUnlocked(standard, 3, true), true);
  assert.equal(isVariantUnlocked(standard, 2, true), false);
  assert.equal(isVariantUnlocked(standard, 9, false), false);
  assert.equal(isVariantUnlocked(findVariant('pushup-wall').variant, 1, false), true);
});

test('選用的版本：沒解鎖或找不到就用起始版', () => {
  const pushup = exerciseByKey('pushup');
  assert.equal(chosenVariant(pushup, { pushup: 'pushup-standard' }, 3, true).id, 'pushup-standard');
  assert.equal(chosenVariant(pushup, { pushup: 'pushup-standard' }, 2, true).id, 'pushup-knee');
  assert.equal(chosenVariant(pushup, { pushup: 'pushup-wall' }, 1, false).id, 'pushup-wall');
  assert.equal(chosenVariant(pushup, { pushup: 'nope' }, 1, false).id, 'pushup-knee');
  assert.equal(chosenVariant(pushup, {}, 1, false).id, 'pushup-knee');
});

test('太難了：之後的同一個動作都換成簡單版，之前的不變', () => {
  const steps = buildWorkout(baseChoices());
  const firstPushup = steps.findIndex((s) => s.exerciseKey === 'pushup');
  const easier = withEasierExercise(steps, firstPushup, 'pushup');
  const pushups = easier.filter((s) => s.exerciseKey === 'pushup').map((s) => s.name);
  assert.deepEqual(pushups, ['雙手扶牆伏地挺身', '雙手扶牆伏地挺身', '雙手扶牆伏地挺身']);
  assert.equal(easier[0], steps[0]);
  // 臀橋沒有簡單版：不變
  assert.equal(withEasierExercise(steps, 0, 'bridge'), steps);
});

test('下一個動作預告會跳過休息', () => {
  const steps = buildWorkout(baseChoices());
  const firstSquat = steps.findIndex((s) => s.exerciseKey === 'squat');
  assert.equal(nextActiveStep(steps, firstSquat).name, '跪姿伏地挺身');
  assert.equal(nextActiveStep(steps, steps.length - 1), null);
});

test('看真人示範用 YouTube 搜尋連結', () => {
  assert.equal(youtubeSearchUrl('深蹲 正確姿勢'), 'https://www.youtube.com/results?search_query=%E6%B7%B1%E8%B9%B2%20%E6%AD%A3%E7%A2%BA%E5%A7%BF%E5%8B%A2');
});

test('跳過的動作超過一半才要問「有實際做完嗎？」（休息不算動作）', async () => {
  const { isMostlySkipped } = await import('../training.js');
  const steps = [{ kind: 'warmup' }, { kind: 'exercise' }, { kind: 'rest' }, { kind: 'exercise' }, { kind: 'cooldown' }];
  assert.equal(isMostlySkipped(steps, new Set()), false);
  assert.equal(isMostlySkipped(steps, new Set([1, 3])), false); // 2／4 剛好一半，不問
  assert.equal(isMostlySkipped(steps, new Set([0, 1, 3])), true); // 3／4
  assert.equal(isMostlySkipped(steps, new Set([2])), false); // 跳過休息不算
});
