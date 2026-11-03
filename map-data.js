// 台灣環島地圖的資料（規格書 v0.3.3）：15 站、每站 1 公斤、三章。
// 座標是大約的經緯度，只用來畫示意圖，不是精確地圖。

export const START_KG = 80;
export const GOAL_KG = 65;

export const CHAPTERS = Object.freeze([
  { id: 1, title: '第一章・北部出發', endStationId: 'changhua' },
  { id: 2, title: '第二章・一路向南', endStationId: 'kenting' },
  { id: 3, title: '第三章・東部回家', endStationId: 'taipei-goal' },
]);

/** chapter 0 是起點；note 是這站的特別說明；label 是站名寫在點的哪一邊（避免字疊在一起） */
export const STATIONS = Object.freeze([
  { id: 'taipei-start', name: '台北', kg: 80, chapter: 0, lon: 121.56, lat: 25.04, note: '起點', label: 'below-right' },
  { id: 'taoyuan', name: '桃園', kg: 79, chapter: 1, lon: 121.30, lat: 24.99, label: 'below' },
  { id: 'hsinchu', name: '新竹', kg: 78, chapter: 1, lon: 120.97, lat: 24.80, label: 'left' },
  { id: 'miaoli', name: '苗栗', kg: 77, chapter: 1, lon: 120.82, lat: 24.56, label: 'right' },
  { id: 'taichung', name: '台中', kg: 76, chapter: 1, lon: 120.68, lat: 24.15, label: 'right' },
  { id: 'changhua', name: '彰化', kg: 75, chapter: 1, lon: 120.54, lat: 24.08, label: 'below-right' },
  { id: 'chiayi', name: '嘉義', kg: 74, chapter: 2, lon: 120.45, lat: 23.48, label: 'left' },
  { id: 'tainan', name: '台南', kg: 73, chapter: 2, lon: 120.20, lat: 23.00, note: 'BMI 回到正常', label: 'left' },
  { id: 'kaohsiung', name: '高雄', kg: 72, chapter: 2, lon: 120.31, lat: 22.63, label: 'left' },
  { id: 'kenting', name: '墾丁', kg: 71, chapter: 2, lon: 120.80, lat: 21.95, label: 'left' },
  { id: 'taitung', name: '台東', kg: 70, chapter: 3, lon: 121.15, lat: 22.76, label: 'right' },
  { id: 'hualien', name: '花蓮', kg: 69, chapter: 3, lon: 121.60, lat: 23.98, label: 'right' },
  { id: 'suao', name: '蘇澳', kg: 68, chapter: 3, lon: 121.86, lat: 24.60, label: 'right' },
  { id: 'yilan', name: '宜蘭', kg: 67, chapter: 3, lon: 121.75, lat: 24.75, label: 'right' },
  { id: 'keelung', name: '基隆', kg: 66, chapter: 3, lon: 121.74, lat: 25.13, label: 'right' },
  { id: 'taipei-goal', name: '台北', kg: 65, chapter: 3, lon: 121.56, lat: 25.04, note: '目標達成', label: 'none' },
]);

/** 台灣本島外框的大約形狀（經度、緯度），順時針 */
export const TAIWAN_OUTLINE = Object.freeze([
  [121.54, 25.30], [121.75, 25.16], [122.00, 25.01], [121.85, 24.72], [121.87, 24.57], [121.75, 24.30],
  [121.63, 23.98], [121.50, 23.50], [121.40, 23.10], [121.20, 22.75], [120.95, 22.35], [120.85, 21.90],
  [120.70, 21.95], [120.62, 22.30], [120.50, 22.42], [120.27, 22.60], [120.15, 22.95], [120.08, 23.10],
  [120.12, 23.45], [120.20, 23.80], [120.42, 24.10], [120.55, 24.35], [120.70, 24.62], [120.90, 24.85],
  [121.05, 25.05], [121.40, 25.18],
]);
