// 環島地圖的圖：台灣外框、路線、站、原創的小車（全部自己畫，不用外部圖片）
import { STATIONS, TAIWAN_OUTLINE } from '../map-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LON0 = 119.9;
const LAT0 = 25.45;
const X_SCALE = 91.5; // 經度 1 度比緯度 1 度短（台灣的緯度約 24 度）
const Y_SCALE = 100;
const MARGIN = 14;
const WIDTH = 244;
const HEIGHT = 372;
const LABEL_GAP = 7;
const LABEL_PLACEMENT = Object.freeze({
  left: { dx: -LABEL_GAP, dy: 3.5, anchor: 'end' },
  right: { dx: LABEL_GAP, dy: 3.5, anchor: 'start' },
  below: { dx: 0, dy: 15, anchor: 'middle' },
  'below-right': { dx: 4, dy: 14, anchor: 'start' },
});

function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) el.setAttribute(key, String(value));
  }
  el.append(...children.filter(Boolean));
  return el;
}

const text = (attrs, content) => svg('text', attrs, document.createTextNode(content));

export function project(lon, lat) {
  return { x: MARGIN + (lon - LON0) * X_SCALE, y: MARGIN + (LAT0 - lat) * Y_SCALE };
}

const pointList = (coords) => coords.map(([lon, lat]) => {
  const { x, y } = project(lon, lat);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(' ');

/** 原創小車：圓圓的車身、一扇窗、兩個輪子、一個車燈 */
function carShape() {
  return svg('g', { class: 'car' },
    svg('rect', { class: 'car-body', x: -13, y: -9, width: 26, height: 10, rx: 4 }),
    svg('path', { class: 'car-roof', d: 'M-8,-9 Q-6,-17 1,-17 L5,-17 Q9,-17 10,-9 Z' }),
    svg('rect', { class: 'car-window', x: -4, y: -15, width: 10, height: 5, rx: 1.5 }),
    svg('circle', { class: 'car-light', cx: 11, cy: -5, r: 1.6 }),
    svg('circle', { class: 'car-wheel', cx: -7, cy: 2, r: 3.6 }),
    svg('circle', { class: 'car-wheel', cx: 7, cy: 2, r: 3.6 }));
}

/** 小車圖示（結算畫面用） */
export function carIcon(className) {
  return svg('svg', { class: className, viewBox: '-16 -20 32 26', 'aria-hidden': 'true' }, carShape());
}

function stationLabel(station, index, reached) {
  // 台北起點和終點在同一個位置，只寫一次（label: 'none'）
  const placement = LABEL_PLACEMENT[station.label];
  if (!placement) return null;
  const { x, y } = project(station.lon, station.lat);
  const label = index === 0 ? '台北 80／65' : `${station.name} ${station.kg}`;
  return text({
    class: `map-label${reached ? ' map-label-reached' : ''}`,
    x: x + placement.dx, y: y + placement.dy, 'text-anchor': placement.anchor,
  }, label);
}

/**
 * 整張地圖。stationIndex：小車停在第幾站。
 * 走過的路線用深色，還沒走的用淺色。
 */
export function taiwanMap(stationIndex, { label }) {
  const route = STATIONS.map((s) => [s.lon, s.lat]);
  const here = STATIONS[stationIndex];
  const car = project(here.lon, here.lat);
  return svg('svg', { class: 'map-svg', viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img', 'aria-label': label },
    svg('polygon', { class: 'map-land', points: pointList(TAIWAN_OUTLINE) }),
    svg('polyline', { class: 'map-route', points: pointList(route) }),
    stationIndex > 0 ? svg('polyline', { class: 'map-route-done', points: pointList(route.slice(0, stationIndex + 1)) }) : null,
    svg('g', {}, ...STATIONS.map((station, i) => {
      const { x, y } = project(station.lon, station.lat);
      return svg('circle', { class: `map-stop${i <= stationIndex ? ' map-stop-reached' : ''}`, cx: x, cy: y, r: 4 });
    })),
    svg('g', {}, ...STATIONS.map((station, i) => stationLabel(station, i, i <= stationIndex))),
    svg('g', { transform: `translate(${car.x.toFixed(1)},${(car.y - 6).toFixed(1)})` }, carShape()));
}
