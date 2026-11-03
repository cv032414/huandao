// 早晨訓練的內容（規格書 v0.4 第 5 節）
// 每個主訓練動作有：簡單版（太難時的替代）、起始版、升級解鎖的進階版（每 3 級一個，共 6 個）。

export const ROUNDS = 3;
export const REST_SECONDS = 30;
export const SECONDS_PER_REP = 3;

export const WARMUP = Object.freeze([
  { id: 'march', name: '原地踏步', seconds: 40, anim: 'march' },
  { id: 'shoulder', name: '轉肩', seconds: 40, anim: 'shoulder' },
  { id: 'twist', name: '轉腰', seconds: 40, anim: 'twist' },
]);

export const COOLDOWN = Object.freeze([
  { id: 'quad', name: '伸展大腿前側（每邊 20 秒）', seconds: 40, anim: 'quad' },
  { id: 'hamstring', name: '伸展大腿後側（每邊 20 秒）', seconds: 40, anim: 'hamstring' },
  { id: 'back', name: '彎腰拉背', seconds: 40, anim: 'back' },
]);

/**
 * kind：'easy' 太難時的替代、'base' 起始版、'advanced' 升級解鎖。
 * mode：'reps' 做幾下（做完按「完成」）、'timed' 做幾秒（倒數）。
 */
export const EXERCISES = Object.freeze([
  {
    key: 'squat',
    name: '深蹲',
    variants: [
      { id: 'squat-chair', kind: 'easy', name: '坐椅子再站起來', mode: 'reps', amount: 10, anim: 'squat', search: '椅子 坐站 運動' },
      { id: 'squat-base', kind: 'base', name: '深蹲', mode: 'reps', amount: 10, anim: 'squat', search: '深蹲 正確姿勢' },
      { id: 'squat-15', kind: 'advanced', unlockLevel: 9, name: '深蹲 15 下', mode: 'reps', amount: 15, anim: 'squat', search: '深蹲 正確姿勢' },
      { id: 'squat-split', kind: 'advanced', unlockLevel: 15, name: '分腿蹲（每邊 8 下）', mode: 'reps', amount: 16, anim: 'squat', search: '分腿蹲 正確姿勢' },
    ],
  },
  {
    key: 'pushup',
    name: '伏地挺身',
    variants: [
      { id: 'pushup-wall', kind: 'easy', name: '雙手扶牆伏地挺身', mode: 'reps', amount: 8, anim: 'wallPushup', search: '扶牆伏地挺身' },
      { id: 'pushup-knee', kind: 'base', name: '跪姿伏地挺身', mode: 'reps', amount: 8, anim: 'kneePushup', search: '跪姿伏地挺身 正確姿勢' },
      { id: 'pushup-standard', kind: 'advanced', unlockLevel: 3, name: '標準伏地挺身', mode: 'reps', amount: 8, anim: 'pushup', search: '伏地挺身 正確姿勢' },
      { id: 'pushup-12', kind: 'advanced', unlockLevel: 18, name: '標準伏地挺身 12 下', mode: 'reps', amount: 12, anim: 'pushup', search: '伏地挺身 正確姿勢' },
    ],
  },
  {
    key: 'bridge',
    name: '臀橋',
    variants: [
      { id: 'bridge-base', kind: 'base', name: '臀橋', mode: 'reps', amount: 12, anim: 'bridge', search: '臀橋 正確姿勢' },
      { id: 'bridge-single', kind: 'advanced', unlockLevel: 12, name: '單腳臀橋（每邊 8 下）', mode: 'reps', amount: 16, anim: 'bridge', search: '單腳臀橋 正確姿勢' },
    ],
  },
  {
    key: 'plank',
    name: '棒式',
    variants: [
      { id: 'plank-knee', kind: 'easy', name: '棒式（膝蓋著地）', mode: 'timed', amount: 20, anim: 'kneePlank', search: '跪姿棒式' },
      { id: 'plank-base', kind: 'base', name: '棒式', mode: 'timed', amount: 20, anim: 'plank', search: '棒式 正確姿勢' },
      { id: 'plank-30', kind: 'advanced', unlockLevel: 6, name: '棒式 30 秒', mode: 'timed', amount: 30, anim: 'plank', search: '棒式 正確姿勢' },
    ],
  },
]);

export const SAFETY_TIPS = Object.freeze([
  '肌肉痠痛是正常的。',
  '關節痛、胸悶、頭暈：立刻停止休息。',
]);
