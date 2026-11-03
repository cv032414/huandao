// 早晨訓練的流程與動作版本規則
import {
  EXERCISES, WARMUP, COOLDOWN, ROUNDS, REST_SECONDS, SECONDS_PER_REP,
} from './training-data.js';

export const exerciseByKey = (key) => EXERCISES.find((exercise) => exercise.key === key) ?? null;

export function findVariant(variantId) {
  for (const exercise of EXERCISES) {
    const variant = exercise.variants.find((v) => v.id === variantId);
    if (variant) return { exercise, variant };
  }
  return null;
}

/** 這個版本能不能用：簡單版、起始版隨時可用；進階版要正式開始後、等級夠 */
export function isVariantUnlocked(variant, level, isStarted) {
  if (variant.kind !== 'advanced') return true;
  return isStarted && level >= variant.unlockLevel;
}

export const baseVariant = (exercise) => exercise.variants.find((v) => v.kind === 'base');
export const easyVariant = (exercise) => exercise.variants.find((v) => v.kind === 'easy') ?? null;

/** 目前選用的版本；沒選、找不到或還沒解鎖就用起始版 */
export function chosenVariant(exercise, choices, level, isStarted) {
  const chosen = exercise.variants.find((v) => v.id === choices?.[exercise.key]);
  return chosen && isVariantUnlocked(chosen, level, isStarted) ? chosen : baseVariant(exercise);
}

/** 所有進階版，依解鎖等級排列 */
export function advancedVariants() {
  return EXERCISES.flatMap((exercise) => exercise.variants
    .filter((v) => v.kind === 'advanced')
    .map((variant) => ({ exercise, variant })))
    .sort((a, b) => a.variant.unlockLevel - b.variant.unlockLevel);
}

/** 剛好在這一級解鎖的進階版（升級畫面用） */
export const unlockedAtLevel = (level) => advancedVariants().filter(({ variant }) => variant.unlockLevel === level);

export function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

const exerciseStep = (exercise, variant, round) => ({
  kind: 'exercise',
  exerciseKey: exercise.key,
  variantId: variant.id,
  name: variant.name,
  mode: variant.mode,
  amount: variant.amount,
  anim: variant.anim,
  search: variant.search,
  round,
});

const timedStep = (kind, item, index, total) => ({
  kind, name: item.name, mode: 'timed', amount: item.seconds, anim: item.anim, search: null, round: index + 1, totalInPhase: total,
});

/**
 * 整套訓練的每一步：暖身 → 4 個動作輪流做一圈、共 3 圈（動作之間休息 30 秒）→ 收操。
 * variants：{ squat: variant, pushup: variant, ... }
 */
export function buildWorkout(variants) {
  const warmup = WARMUP.map((item, i) => timedStep('warmup', item, i, WARMUP.length));
  const main = [];
  for (let round = 1; round <= ROUNDS; round += 1) {
    EXERCISES.forEach((exercise, i) => {
      main.push(exerciseStep(exercise, variants[exercise.key], round));
      const isLast = round === ROUNDS && i === EXERCISES.length - 1;
      if (!isLast) main.push({ kind: 'rest', name: '休息', mode: 'timed', amount: REST_SECONDS, anim: 'rest', search: null, round });
    });
  }
  const cooldown = COOLDOWN.map((item, i) => timedStep('cooldown', item, i, COOLDOWN.length));
  return [...warmup, ...main, ...cooldown];
}

/** 把之後幾圈的同一個動作換成簡單版（訓練中按「太難了」） */
export function withEasierExercise(steps, fromIndex, exerciseKey) {
  const easy = easyVariant(exerciseByKey(exerciseKey));
  if (!easy) return steps;
  return steps.map((step, i) => (i >= fromIndex && step.kind === 'exercise' && step.exerciseKey === exerciseKey
    ? exerciseStep(exerciseByKey(exerciseKey), easy, step.round)
    : step));
}

/** 下一個不是休息的步驟（「下一個動作」預告用） */
export function nextActiveStep(steps, index) {
  return steps.slice(index + 1).find((step) => step.kind !== 'rest') ?? null;
}

/** 大約幾秒：做幾下的動作以每下 3 秒估 */
export function estimateSeconds(steps) {
  return steps.reduce((sum, step) => sum + (step.mode === 'reps' ? step.amount * SECONDS_PER_REP : step.amount), 0);
}
