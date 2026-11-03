// 自製的簡單人形動畫：每個動作有兩個姿勢（A、B），在兩者之間來回變化。
// 座標在 200×200 的畫布裡，地面在 y = 182；側面的動作都面向右邊。
const SVG_NS = 'http://www.w3.org/2000/svg';

const STAND = {
  head: [100, 32], neck: [100, 48], hip: [100, 104],
  kneeA: [103, 142], footA: [100, 180], kneeB: [97, 142], footB: [96, 180],
  elbowA: [104, 76], handA: [106, 102], elbowB: [96, 76], handB: [94, 102],
};

const pose = (changes) => ({ ...STAND, ...changes });

// 每個動畫：[姿勢 A, 姿勢 B, 一個來回幾毫秒, 額外的道具線條]
const ANIMATIONS = {
  rest: [STAND, pose({ head: [100, 31], neck: [100, 47] }), 4000],
  march: [
    pose({ kneeA: [118, 122], footA: [112, 156], elbowA: [92, 74], handA: [86, 96], elbowB: [110, 72], handB: [120, 88] }),
    pose({ kneeB: [118, 122], footB: [112, 156], elbowB: [92, 74], handB: [86, 96], elbowA: [110, 72], handA: [120, 88] }),
    1400,
  ],
  shoulder: [
    pose({ elbowA: [116, 62], handA: [104, 50], elbowB: [84, 62], handB: [96, 50] }),
    pose({ elbowA: [110, 82], handA: [104, 52], elbowB: [90, 82], handB: [96, 52] }),
    2000,
  ],
  twist: [
    pose({ elbowA: [120, 64], handA: [140, 66], elbowB: [80, 64], handB: [60, 66] }),
    pose({ elbowA: [84, 66], handA: [66, 74], elbowB: [116, 66], handB: [134, 74] }),
    2400,
  ],
  squat: [
    pose({ elbowA: [118, 64], handA: [138, 66], elbowB: [116, 66], handB: [136, 68] }),
    pose({
      head: [112, 66], neck: [104, 80], hip: [78, 132], kneeA: [112, 140], footA: [104, 180], kneeB: [110, 142], footB: [100, 180],
      elbowA: [124, 88], handA: [144, 90], elbowB: [122, 90], handB: [142, 92],
    }),
    3000,
  ],
  kneePushup: [
    {
      head: [166, 118], neck: [152, 128], hip: [96, 146], kneeA: [70, 178], footA: [42, 164], kneeB: [68, 178], footB: [40, 166],
      elbowA: [152, 154], handA: [152, 180], elbowB: [150, 154], handB: [150, 180],
    },
    {
      head: [168, 150], neck: [154, 158], hip: [98, 164], kneeA: [70, 178], footA: [42, 164], kneeB: [68, 178], footB: [40, 166],
      elbowA: [136, 166], handA: [152, 180], elbowB: [134, 166], handB: [150, 180],
    },
    3000,
  ],
  pushup: [
    {
      head: [166, 112], neck: [152, 122], hip: [100, 140], kneeA: [70, 158], footA: [38, 176], kneeB: [70, 160], footB: [36, 178],
      elbowA: [152, 150], handA: [152, 180], elbowB: [150, 150], handB: [150, 180],
    },
    {
      head: [168, 148], neck: [154, 156], hip: [102, 166], kneeA: [70, 172], footA: [38, 178], kneeB: [70, 173], footB: [36, 179],
      elbowA: [136, 164], handA: [152, 180], elbowB: [134, 164], handB: [150, 180],
    },
    3000,
  ],
  wallPushup: [
    pose({ head: [128, 40], neck: [122, 54], hip: [96, 108], kneeA: [90, 144], footA: [84, 180], kneeB: [88, 144], footB: [80, 180], elbowA: [142, 62], handA: [160, 60], elbowB: [140, 64], handB: [160, 62] }),
    pose({ head: [140, 44], neck: [134, 58], hip: [100, 110], kneeA: [92, 144], footA: [84, 180], kneeB: [90, 144], footB: [80, 180], elbowA: [140, 80], handA: [160, 60], elbowB: [138, 82], handB: [160, 62] }),
    3000,
    [[[162, 20], [162, 182]]],
  ],
  bridge: [
    {
      head: [36, 168], neck: [50, 170], hip: [104, 172], kneeA: [132, 140], footA: [150, 180], kneeB: [130, 142], footB: [148, 180],
      elbowA: [76, 176], handA: [98, 178], elbowB: [74, 177], handB: [96, 179],
    },
    {
      head: [36, 168], neck: [50, 170], hip: [108, 140], kneeA: [136, 132], footA: [150, 180], kneeB: [134, 134], footB: [148, 180],
      elbowA: [76, 176], handA: [98, 178], elbowB: [74, 177], handB: [96, 179],
    },
    3000,
  ],
  plank: [
    {
      head: [166, 140], neck: [150, 148], hip: [96, 156], kneeA: [64, 166], footA: [32, 176], kneeB: [64, 168], footB: [30, 178],
      elbowA: [148, 178], handA: [172, 178], elbowB: [146, 179], handB: [170, 179],
    },
    {
      head: [166, 139], neck: [150, 147], hip: [96, 152], kneeA: [64, 164], footA: [32, 176], kneeB: [64, 166], footB: [30, 178],
      elbowA: [148, 178], handA: [172, 178], elbowB: [146, 179], handB: [170, 179],
    },
    3000,
  ],
  kneePlank: [
    {
      head: [166, 140], neck: [150, 148], hip: [100, 158], kneeA: [70, 178], footA: [44, 166], kneeB: [68, 178], footB: [42, 168],
      elbowA: [148, 178], handA: [172, 178], elbowB: [146, 179], handB: [170, 179],
    },
    {
      head: [166, 139], neck: [150, 147], hip: [100, 155], kneeA: [70, 178], footA: [44, 166], kneeB: [68, 178], footB: [42, 168],
      elbowA: [148, 178], handA: [172, 178], elbowB: [146, 179], handB: [170, 179],
    },
    3000,
  ],
  quad: [
    pose({ kneeB: [98, 142], footB: [76, 118], elbowB: [88, 92], handB: [78, 116], elbowA: [112, 70], handA: [124, 60] }),
    pose({ kneeB: [98, 142], footB: [74, 116], elbowB: [88, 92], handB: [76, 114], elbowA: [112, 70], handA: [124, 58] }),
    3000,
  ],
  hamstring: [
    pose({
      head: [126, 58], neck: [118, 70], hip: [96, 108], kneeA: [118, 142], footA: [134, 180], kneeB: [92, 144], footB: [90, 180],
      elbowA: [124, 96], handA: [122, 128], elbowB: [120, 98], handB: [118, 130],
    }),
    pose({
      head: [134, 70], neck: [124, 80], hip: [94, 108], kneeA: [118, 142], footA: [134, 180], kneeB: [92, 144], footB: [90, 180],
      elbowA: [128, 108], handA: [128, 140], elbowB: [124, 110], handB: [124, 142],
    }),
    3000,
  ],
  back: [
    pose({ head: [142, 112], neck: [134, 100], elbowA: [138, 128], handA: [142, 152], elbowB: [136, 130], handB: [140, 154] }),
    pose({ head: [146, 120], neck: [138, 106], elbowA: [142, 136], handA: [146, 162], elbowB: [140, 138], handB: [144, 164] }),
    3000,
  ],
};

const LIMBS = [['neck', 'hip'], ['hip', 'kneeA', 'footA'], ['hip', 'kneeB', 'footB'], ['neck', 'elbowA', 'handA'], ['neck', 'elbowB', 'handB']];

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const toPoints = (joints, names) => names.map((name) => joints[name].join(',')).join(' ');

/** 建立一個人形動畫；回傳 { element, stop } */
export function createFigure(animName, label) {
  const [poseA, poseB, period, props = []] = ANIMATIONS[animName] ?? ANIMATIONS.rest;
  const svg = svgEl('svg', { viewBox: '0 0 200 200', class: 'figure', role: 'img', 'aria-label': label });
  svg.append(svgEl('line', { x1: 10, y1: 182, x2: 190, y2: 182, class: 'figure-ground' }));
  for (const [from, to] of props) svg.append(svgEl('line', { x1: from[0], y1: from[1], x2: to[0], y2: to[1], class: 'figure-prop' }));
  const limbs = LIMBS.map((names) => {
    const line = svgEl('polyline', { class: 'figure-limb' });
    svg.append(line);
    return { line, names };
  });
  const head = svgEl('circle', { r: 11, class: 'figure-head' });
  svg.append(head);

  const draw = (t) => {
    const joints = Object.fromEntries(Object.keys(poseA).map((name) => [name, mix(poseA[name], poseB[name], t)]));
    for (const { line, names } of limbs) line.setAttribute('points', toPoints(joints, names));
    head.setAttribute('cx', joints.head[0]);
    head.setAttribute('cy', joints.head[1]);
  };

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let frame = null;
  const tick = (now) => {
    // 0 → 1 → 0 平順來回
    const phase = (now % period) / period;
    draw((1 - Math.cos(phase * 2 * Math.PI)) / 2);
    frame = requestAnimationFrame(tick);
  };
  draw(reduceMotion ? 1 : 0);
  if (!reduceMotion) frame = requestAnimationFrame(tick);

  return {
    element: svg,
    stop: () => { if (frame) cancelAnimationFrame(frame); frame = null; },
  };
}

export const ANIMATION_NAMES = Object.freeze(Object.keys(ANIMATIONS));
