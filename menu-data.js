// 菜單庫（規格書 v0.4 第 4 節）。熱量都是大約數字，取整到 10 大卡。
// 依據：衛福部食藥署食品營養成分資料庫、常見包裝營養標示；便當、小吃依份量估算。
// 要改菜單只要改這個檔案：每一項 { id, name, kcal }，meals 可限制只出現在哪幾餐。

export const MEAL_ORDER = Object.freeze(['breakfast', 'lunch', 'dinner']);

export const CELL_LABELS = Object.freeze({ protein: '蛋白質', staple: '主食', veg: '蔬果', drink: '飲料' });

export const DAILY_KCAL_RANGE = Object.freeze({ min: 1600, max: 1700 });

const B = ['breakfast'];
const LD = ['lunch', 'dinner'];

export const STORES = Object.freeze([
  {
    id: 'breakfast-shop',
    name: '早餐店',
    meals: B,
    tip: '蛋餅、吐司不加醬（美乃滋、甜辣醬），飲料選無糖。',
    vegCount: 1,
    cells: {
      protein: [
        { id: 'bs-egg', name: '荷包蛋 1 顆（請老闆少油）', kcal: 90 },
        { id: 'bs-tuna', name: '鮪魚（美乃滋請少）', kcal: 130 },
        { id: 'bs-pork', name: '煎里肌肉片（不要炸的）', kcal: 170 },
        { id: 'bs-cheese-egg', name: '起司蛋（1 顆蛋＋1 片起司）', kcal: 160 },
      ],
      staple: [
        { id: 'bs-toast', name: '全麥吐司 2 片', kcal: 170 },
        { id: 'bs-danbing', name: '原味蛋餅（不加醬）', kcal: 250 },
        { id: 'bs-mantou', name: '雜糧饅頭半顆', kcal: 150 },
      ],
      veg: [
        { id: 'bs-lettuce', name: '吐司夾生菜＋番茄片', kcal: 20 },
        { id: 'bs-salad', name: '生菜沙拉（醬另外放、少加）', kcal: 70 },
        { id: 'bs-fruit', name: '水果（香蕉 1 根或蘋果半顆）', kcal: 90 },
      ],
      drink: [
        { id: 'bs-soy', name: '無糖豆漿（中杯）', kcal: 120 },
        { id: 'bs-tea', name: '無糖紅茶', kcal: 0 },
        { id: 'bs-milktea', name: '無糖鮮奶茶（中杯）', kcal: 150 },
      ],
    },
  },
  {
    id: 'cvs',
    name: '超商',
    meals: ['breakfast', 'lunch', 'dinner'],
    tip: '看包裝上的營養標示；醬料只加一半。',
    vegCount: 1,
    cells: {
      protein: [
        { id: 'cvs-tea-egg', name: '茶葉蛋 2 顆', kcal: 150 },
        { id: 'cvs-chicken', name: '即食雞胸肉 1 包', kcal: 120 },
        { id: 'cvs-oden', name: '關東煮：豆腐＋蛋', kcal: 130 },
        { id: 'cvs-edamame', name: '鹽味毛豆 1 盒', kcal: 150 },
        { id: 'cvs-yogurt', name: '無糖優格 1 杯', kcal: 100, meals: B },
      ],
      staple: [
        { id: 'cvs-sweet-potato', name: '烤地瓜（中）', kcal: 220 },
        { id: 'cvs-onigiri', name: '鮭魚飯糰 1 個', kcal: 200 },
        { id: 'cvs-corn', name: '水煮玉米 1 根', kcal: 150 },
        { id: 'cvs-bread', name: '全麥雜糧麵包（小）', kcal: 180 },
      ],
      veg: [
        { id: 'cvs-salad', name: '生菜沙拉（醬料只加一半）', kcal: 60 },
        { id: 'cvs-radish', name: '關東煮：白蘿蔔＋高麗菜捲', kcal: 50 },
        { id: 'cvs-fruit-cup', name: '水果杯（小）', kcal: 80 },
        { id: 'cvs-veg-box', name: '溫沙拉／蔬菜盒', kcal: 90 },
        { id: 'cvs-banana', name: '香蕉 1 根', kcal: 100 },
      ],
      drink: [
        { id: 'cvs-soy', name: '無糖豆漿（400 毫升）', kcal: 140 },
        { id: 'cvs-green-tea', name: '無糖綠茶', kcal: 0 },
        { id: 'cvs-milk', name: '低脂鮮乳（290 毫升）', kcal: 130 },
        { id: 'cvs-water', name: '水', kcal: 0 },
      ],
    },
  },
  {
    id: 'bento',
    name: '便當店',
    meals: LD,
    tip: '主菜選滷、烤、蒸，不選炸的；飯只吃半碗。',
    vegCount: 1,
    cells: {
      protein: [
        { id: 'bento-braised-chicken', name: '滷雞腿（去皮）', kcal: 260 },
        { id: 'bento-mackerel', name: '烤鯖魚', kcal: 320 },
        { id: 'bento-steamed-fish', name: '清蒸魚', kcal: 200 },
        { id: 'bento-roast-chicken', name: '烤雞腿', kcal: 300 },
        { id: 'bento-tofu-egg', name: '滷豆腐＋滷蛋', kcal: 220 },
      ],
      staple: [
        { id: 'bento-rice-half', name: '白飯半碗', kcal: 140 },
        { id: 'bento-grain-half', name: '五穀飯半碗', kcal: 150 },
      ],
      veg: [
        { id: 'bento-sides', name: '便當附的配菜（選青菜，避開炸物和勾芡）', kcal: 130 },
        { id: 'bento-greens', name: '附菜＋加點一份燙青菜', kcal: 190 },
      ],
      drink: [
        { id: 'bento-water', name: '水或無糖茶', kcal: 0 },
        { id: 'bento-soup', name: '附湯（只喝湯、不吃料）', kcal: 20 },
      ],
    },
  },
  {
    id: 'buffet',
    name: '自助餐',
    meals: LD,
    tip: '照 211 餐盤：蔬菜一半、蛋白質四分之一、飯四分之一；至少三種青菜，菜湯不要撈進去。',
    vegCount: 3,
    cells: {
      protein: [
        { id: 'buffet-tofu', name: '滷豆腐 2 塊', kcal: 130 },
        { id: 'buffet-steamed-egg', name: '蒸蛋', kcal: 110 },
        { id: 'buffet-fish', name: '清蒸魚 1 塊', kcal: 170 },
        { id: 'buffet-chicken', name: '滷雞腿（去皮）', kcal: 240 },
        { id: 'buffet-white-chicken', name: '白斬雞（小份）', kcal: 190 },
      ],
      staple: [
        { id: 'buffet-rice', name: '白飯半碗', kcal: 140 },
        { id: 'buffet-brown-rice', name: '糙米飯半碗', kcal: 150 },
        { id: 'buffet-pumpkin', name: '蒸南瓜 1 塊（代替飯）', kcal: 90 },
        { id: 'buffet-sweet-potato', name: '蒸地瓜 1 塊（代替飯）', kcal: 130 },
      ],
      veg: [
        { id: 'buffet-cabbage', name: '炒高麗菜', kcal: 60 },
        { id: 'buffet-bok-choy', name: '炒青江菜', kcal: 50 },
        { id: 'buffet-yam-leaves', name: '燙地瓜葉', kcal: 50 },
        { id: 'buffet-cucumber', name: '涼拌小黃瓜', kcal: 40 },
        { id: 'buffet-spinach', name: '炒菠菜', kcal: 50 },
        { id: 'buffet-broccoli', name: '炒花椰菜', kcal: 60 },
        { id: 'buffet-napa', name: '滷白菜', kcal: 60 },
        { id: 'buffet-sprouts', name: '炒豆芽菜', kcal: 50 },
      ],
      drink: [
        { id: 'buffet-water', name: '水或無糖茶', kcal: 0 },
        { id: 'buffet-soup', name: '清湯（不撈料）', kcal: 20 },
      ],
    },
  },
  {
    id: 'noodle',
    name: '麵店小吃',
    meals: LD,
    tip: '麵點小碗，多點一份燙青菜和一份蛋白質；肉燥、辣油少加。',
    vegCount: 1,
    cells: {
      protein: [
        { id: 'noodle-egg', name: '滷蛋', kcal: 80 },
        { id: 'noodle-tofu', name: '滷豆干 2 片', kcal: 80 },
        { id: 'noodle-chicken', name: '白斬雞（小份）', kcal: 180 },
        { id: 'noodle-liver', name: '豬肝湯 1 碗', kcal: 130 },
        { id: 'noodle-lean-pork', name: '燙瘦肉片（小份）', kcal: 150 },
      ],
      staple: [
        { id: 'noodle-soup-noodle', name: '陽春湯麵（小碗）', kcal: 300 },
        { id: 'noodle-rice-noodle', name: '米粉湯（小碗）', kcal: 240 },
        { id: 'noodle-dry-noodle', name: '乾麵（小碗，少油）', kcal: 340 },
        { id: 'noodle-dumplings', name: '水餃 8 顆', kcal: 400 },
        { id: 'noodle-kway', name: '粿仔條湯（小碗）', kcal: 270 },
      ],
      veg: [
        { id: 'noodle-greens', name: '燙青菜（不加肉燥、醬少）', kcal: 70 },
        { id: 'noodle-yam-leaves', name: '燙地瓜葉', kcal: 60 },
        { id: 'noodle-kelp', name: '滷海帶 2 片', kcal: 30 },
      ],
      drink: [
        { id: 'noodle-water', name: '水或無糖茶', kcal: 0 },
        { id: 'noodle-clear-soup', name: '清湯', kcal: 20 },
      ],
    },
  },
  {
    id: 'fastfood',
    name: '速食店',
    meals: ['breakfast', 'lunch', 'dinner'],
    tip: '比較不踩雷的選法：主餐選不炸的，不點薯條和含糖飲料。',
    vegCount: 1,
    cells: {
      protein: [
        { id: 'ff-egg-burger', name: '蛋堡（不加培根）', kcal: 290, meals: B },
        { id: 'ff-chicken-egg-burger', name: '烤雞肉蛋堡', kcal: 360, meals: B },
        { id: 'ff-grilled-chicken-burger', name: '烤雞腿堡（不炸，醬料少）', kcal: 430, meals: LD },
        { id: 'ff-grilled-chicken-wrap', name: '烤雞捲餅', kcal: 390, meals: LD },
        { id: 'ff-chicken-salad', name: '烤雞沙拉主餐（醬料只加一半）', kcal: 260, meals: LD },
      ],
      staple: [
        { id: 'ff-bread-included', name: '主餐的麵包／餅皮就是主食，不另點', kcal: 0 },
      ],
      veg: [
        { id: 'ff-side-salad', name: '小份生菜沙拉（醬料少）', kcal: 60 },
        { id: 'ff-corn-cup', name: '玉米杯（小）', kcal: 100 },
        { id: 'ff-apple', name: '蘋果片', kcal: 50 },
      ],
      drink: [
        { id: 'ff-green-tea', name: '無糖綠茶', kcal: 0 },
        { id: 'ff-black-coffee', name: '黑咖啡', kcal: 10 },
        { id: 'ff-milk', name: '鮮乳', kcal: 130 },
      ],
    },
  },
]);
