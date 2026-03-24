// ═══════════════════════════════════════════════════════════════
// 家具グレード定義（Tier 1〜10）
// ═══════════════════════════════════════════════════════════════
export const FURNITURE_GRADES = {
  tier1:  { name: "パイプ",       emoji: "🪑", costMult: 1.0,  comfortBase: 5,   satisfactionMod: -10, turnoverMod: 1.20, priceAppealMod: 0.85, durability: 30,  cleanSpeed: 1.0,  aesthetic: 5,   repReq: 0,   description: "安い折りたたみ椅子とスチールテーブル。学食レベル。" },
  tier2:  { name: "プラスチック",  emoji: "🪑", costMult: 1.5,  comfortBase: 12,  satisfactionMod: -5,  turnoverMod: 1.15, priceAppealMod: 0.90, durability: 50,  cleanSpeed: 1.0,  aesthetic: 10,  repReq: 0,   description: "フードコートでよく見るやつ。まあ座れる。" },
  tier3:  { name: "ファミレス標準",emoji: "🍽", costMult: 2.0,  comfortBase: 25,  satisfactionMod: 0,   turnoverMod: 1.00, priceAppealMod: 1.00, durability: 80,  cleanSpeed: 0.9,  aesthetic: 20,  repReq: 10,  description: "ザ・定番。どこにでもあるファミレスのソファ席。" },
  tier4:  { name: "カフェ風",      emoji: "☕", costMult: 3.0,  comfortBase: 35,  satisfactionMod: 5,   turnoverMod: 0.95, priceAppealMod: 1.05, durability: 70,  cleanSpeed: 0.9,  aesthetic: 35,  repReq: 20,  description: "木目調テーブルと布張り椅子。おしゃれ感が出る。" },
  tier5:  { name: "ビストロ",      emoji: "🍷", costMult: 5.0,  comfortBase: 45,  satisfactionMod: 10,  turnoverMod: 0.90, priceAppealMod: 1.12, durability: 90,  cleanSpeed: 0.85, aesthetic: 50,  repReq: 30,  description: "鉄脚テーブルと革張りチェア。一気にレストラン感。" },
  tier6:  { name: "ダイニング",    emoji: "🍽", costMult: 8.0,  comfortBase: 58,  satisfactionMod: 15,  turnoverMod: 0.85, priceAppealMod: 1.20, durability: 100, cleanSpeed: 0.80, aesthetic: 65,  repReq: 45,  description: "無垢材テーブルと上質なクッション。記念日にも使える。" },
  tier7:  { name: "プレミアム",    emoji: "✨", costMult: 12.0, comfortBase: 70,  satisfactionMod: 20,  turnoverMod: 0.80, priceAppealMod: 1.30, durability: 120, cleanSpeed: 0.75, aesthetic: 78,  repReq: 60,  description: "大理石天板と名作チェアのレプリカ。高級感漂う。" },
  tier8:  { name: "ラグジュアリー",emoji: "💎", costMult: 20.0, comfortBase: 82,  satisfactionMod: 28,  turnoverMod: 0.72, priceAppealMod: 1.42, durability: 150, cleanSpeed: 0.70, aesthetic: 88,  repReq: 75,  description: "本革ソファとウォールナット。ホテルダイニング級。" },
  tier9:  { name: "ロイヤル",      emoji: "👑", costMult: 35.0, comfortBase: 92,  satisfactionMod: 35,  turnoverMod: 0.65, priceAppealMod: 1.55, durability: 200, cleanSpeed: 0.65, aesthetic: 95,  repReq: 88,  description: "アンティーク調の一点もの。ミシュランクラス。" },
  tier10: { name: "至高",          emoji: "🏛", costMult: 60.0, comfortBase: 100, satisfactionMod: 45,  turnoverMod: 0.55, priceAppealMod: 1.75, durability: 300, cleanSpeed: 0.60, aesthetic: 100, repReq: 95,  description: "オーダーメイド。もはや美術品。客が写真を撮る。" },
};

// ═══════════════════════════════════════════════════════════════
// 家具タイプ定義（38種）
// ═══════════════════════════════════════════════════════════════
export const FURNITURE_TYPES = {
  // ━━━ テーブル系（10種）━━━
  table_2seat:       { name: "2人席テーブル",    category: "table",   size: [2,1], capacity: 2, baseCost: 5000,   allowedGrades: ["tier1","tier2","tier3","tier4","tier5","tier6","tier7","tier8","tier9","tier10"], description: "デート・友達同士の定番。回転が速い。" },
  table_4seat:       { name: "4人席テーブル",    category: "table",   size: [2,2], capacity: 4, baseCost: 12000,  allowedGrades: ["tier1","tier2","tier3","tier4","tier5","tier6","tier7","tier8","tier9","tier10"], description: "ファミリー・グループの主力席。万能選手。" },
  table_6seat:       { name: "6人席ボックス",    category: "table",   size: [3,2], capacity: 6, baseCost: 25000,  allowedGrades: ["tier2","tier3","tier4","tier5","tier6","tier7","tier8","tier9","tier10"], description: "大人数向け。宴会や団体に。" },
  table_round:       { name: "丸テーブル",       category: "table",   size: [2,2], capacity: 4, baseCost: 15000,  allowedGrades: ["tier4","tier5","tier6","tier7","tier8","tier9","tier10"], description: "会話が弾む円卓。満足度+3。", bonusSatisfaction: 3 },
  table_highTop:     { name: "ハイテーブル",     category: "table",   size: [1,1], capacity: 2, baseCost: 7000,   allowedGrades: ["tier2","tier3","tier4","tier5","tier6","tier7"], description: "立ち飲み風。回転率最速。滞在-20%。", turnoverBonus: 0.20 },
  table_kotatsu:     { name: "掘りごたつ席",     category: "table",   size: [3,2], capacity: 4, baseCost: 30000,  allowedGrades: ["tier4","tier5","tier6","tier7","tier8","tier9"], description: "冬の満足度+20。和食でcomfort+15。" },
  table_terrace:     { name: "テラス席",         category: "table",   size: [2,2], capacity: 4, baseCost: 18000,  allowedGrades: ["tier3","tier4","tier5","tier6","tier7","tier8"], description: "開放感抜群！天候で使用可否が変わる。" },
  table_vip_booth:   { name: "VIPブース",        category: "table",   size: [3,3], capacity: 6, baseCost: 50000,  allowedGrades: ["tier6","tier7","tier8","tier9","tier10"], description: "半個室。VIP客専用。プライバシー最高。", bonusSatisfaction: 10 },
  table_private_room:{ name: "完全個室",         category: "table",   size: [4,3], capacity: 8, baseCost: 120000, allowedGrades: ["tier7","tier8","tier9","tier10"], description: "扉付き完全個室。接待・プロポーズに。", bonusSatisfaction: 25 },
  table_tatami:      { name: "座敷席",           category: "table",   size: [4,3], capacity: 8, baseCost: 45000,  allowedGrades: ["tier4","tier5","tier6","tier7","tier8","tier9"], description: "大広間の座敷。団体・宴会に最適。" },

  // ━━━ カウンター系（6種）━━━
  counter_mini:      { name: "ミニカウンター",   category: "counter", size: [2,1], capacity: 2, baseCost: 10000,  allowedGrades: ["tier1","tier2","tier3","tier4","tier5","tier6","tier7","tier8","tier9","tier10"], description: "省スペース2席カウンター。", singleCustomerBonus: 8 },
  counter_straight:  { name: "直線カウンター",   category: "counter", size: [4,1], capacity: 4, baseCost: 20000,  allowedGrades: ["tier2","tier3","tier4","tier5","tier6","tier7","tier8","tier9","tier10"], description: "キッチン前の定番。一人客に人気。", singleCustomerBonus: 15, chefViewBonus: 0.05 },
  counter_L:         { name: "L字カウンター",    category: "counter", size: [4,3], capacity: 6, baseCost: 35000,  allowedGrades: ["tier3","tier4","tier5","tier6","tier7","tier8","tier9","tier10"], description: "角を活かしたL字。コーナー席が人気。", singleCustomerBonus: 18, chefViewBonus: 0.08 },
  counter_bar:       { name: "バーカウンター",   category: "counter", size: [5,1], capacity: 5, baseCost: 40000,  allowedGrades: ["tier5","tier6","tier7","tier8","tier9","tier10"], description: "ドリンク特化。夜間営業で真価発揮。", singleCustomerBonus: 20, drinkSalesBonus: 0.30, nightBonus: 1.5 },
  counter_sushi:     { name: "寿司カウンター",   category: "counter", size: [6,1], capacity: 6, baseCost: 80000,  allowedGrades: ["tier7","tier8","tier9","tier10"], description: "職人の技を目の前で。和食で超高単価。", singleCustomerBonus: 25, chefViewBonus: 0.15 },
  counter_teppan:    { name: "鉄板カウンター",   category: "counter", size: [5,2], capacity: 5, baseCost: 100000, allowedGrades: ["tier7","tier8","tier9","tier10"], description: "目の前で焼く鉄板焼き演出。", singleCustomerBonus: 20, chefViewBonus: 0.25 },

  // ━━━ 椅子・ベンチ系（5種）━━━
  chair_extra:       { name: "追加チェア",       category: "chair",   size: [1,1], capacity: 0, baseCost: 1500,   allowedGrades: ["tier1","tier2","tier3","tier4","tier5"], description: "テーブル隣に置くと+1席。comfort-10。" },
  bench_long:        { name: "ロングベンチ",     category: "chair",   size: [3,1], capacity: 0, baseCost: 8000,   allowedGrades: ["tier2","tier3","tier4","tier5","tier6","tier7"], description: "壁際に置くと3テーブル分の片側席に。" },
  sofa_booth:        { name: "ソファブース",     category: "chair",   size: [2,1], capacity: 0, baseCost: 18000,  allowedGrades: ["tier5","tier6","tier7","tier8","tier9","tier10"], description: "テーブル横に置くとcomfort+20。" },
  zaisu:             { name: "座椅子",           category: "chair",   size: [1,1], capacity: 0, baseCost: 5000,   allowedGrades: ["tier3","tier4","tier5","tier6","tier7","tier8"], description: "座敷・掘りごたつ用。和の雰囲気UP。" },
  baby_chair:        { name: "ベビーチェア",     category: "chair",   size: [1,1], capacity: 0, baseCost: 3000,   allowedGrades: ["tier2","tier3","tier4","tier5"], description: "ファミリー来店率+10%、満足度+8。", maxPerStore: 4 },

  // ━━━ 装飾家具（12種）━━━
  plant_small:       { name: "観葉植物（小）",   category: "decor",   size: [1,1], capacity: 0, baseCost: 2000,   allowedGrades: null, description: "周囲2マスのcomfort+5。", comfortRadius: 2, comfortBonus: 5, aestheticBonus: 3 },
  plant_large:       { name: "観葉植物（大）",   category: "decor",   size: [1,2], capacity: 0, baseCost: 6000,   allowedGrades: null, description: "周囲3マスにcomfort+10。目隠しにも。", comfortRadius: 3, comfortBonus: 10, aestheticBonus: 8 },
  partition:         { name: "パーテーション",   category: "decor",   size: [1,2], capacity: 0, baseCost: 4000,   allowedGrades: null, description: "隣接テーブルのprivacy+15。", aestheticBonus: 5 },
  partition_glass:   { name: "ガラスパーテーション",category:"decor", size: [1,2], capacity: 0, baseCost: 12000,  allowedGrades: null, description: "見通し保ちつつプライバシー確保。", aestheticBonus: 12 },
  aquarium:          { name: "アクアリウム",     category: "decor",   size: [2,1], capacity: 0, baseCost: 30000,  allowedGrades: null, description: "周囲3マスにcomfort+15。子供+10。", comfortRadius: 3, comfortBonus: 15, aestheticBonus: 15, dailyCost: 200 },
  fireplace:         { name: "暖炉",             category: "decor",   size: [2,1], capacity: 0, baseCost: 50000,  allowedGrades: null, description: "冬に周囲4マスのcomfort+25。", comfortRadius: 4, aestheticBonus: 20, dailyCost: 300, maxPerStore: 2 },
  jukebox:           { name: "ジュークボックス", category: "decor",   size: [1,1], capacity: 0, baseCost: 15000,  allowedGrades: null, description: "周囲3マスの学生滞在-10%。", comfortRadius: 3, comfortBonus: 5, aestheticBonus: 8, maxPerStore: 2 },
  neon_sign:         { name: "ネオンサイン",     category: "decor",   size: [2,1], capacity: 0, baseCost: 8000,   allowedGrades: null, description: "若者来店率+5%。", aestheticBonus: 10, dailyCost: 100 },
  flower_vase:       { name: "生花アレンジメント",category: "decor",  size: [1,1], capacity: 0, baseCost: 3000,   allowedGrades: null, description: "テーブル隣接でcomfort+8。7日で枯れる。", comfortBonus: 8, aestheticBonus: 5, dailyCost: 500, witherDays: 7 },
  kids_space:        { name: "キッズスペース",   category: "decor",   size: [3,2], capacity: 0, baseCost: 25000,  allowedGrades: null, description: "ファミリー来店率+20%。", maxPerStore: 1 },
  waiting_area:      { name: "待合スペース",     category: "decor",   size: [2,1], capacity: 0, baseCost: 8000,   allowedGrades: null, description: "満席時に客が待てる。待合なしだと即離脱。", waitCapacity: 3 },
  lucky_cat:         { name: "招き猫",           category: "decor",   size: [1,1], capacity: 0, baseCost: 5000,   allowedGrades: null, description: "入口横配置で来客率+3%。", aestheticBonus: 2 },

  // ━━━ 機能設備（7種）━━━
  register:          { name: "レジ",             category: "functional", size: [1,1], capacity: 0, baseCost: 0,     allowedGrades: null, description: "会計処理。必ず1つ配置必須。", required: true },
  self_register:     { name: "セルフレジ",       category: "functional", size: [1,1], capacity: 0, baseCost: 50000, allowedGrades: null, description: "会計渋滞を防止。" },
  salad_bar:         { name: "サラダバー",       category: "functional", size: [3,1], capacity: 0, baseCost: 35000, allowedGrades: null, description: "セルフサービスで回転率UP。", dailyCost: 150 },
  drink_bar:         { name: "ドリンクバー",     category: "functional", size: [2,1], capacity: 0, baseCost: 20000, allowedGrades: null, description: "学生来店率+15%。追加注文¥200/人。", dailyCost: 100 },
  dessert_showcase:  { name: "デザートショーケース",category:"functional",size:[2,1], capacity: 0, baseCost: 25000, allowedGrades: null, description: "来店率+10%。デザート注文率+25%。", dailyCost: 100 },
  wine_cellar:       { name: "ワインセラー",     category: "functional", size: [2,2], capacity: 0, baseCost: 80000, allowedGrades: null, description: "ワイン注文で客単価+30%。VIP来店+15%。", dailyCost: 200 },
  open_kitchen_window:{ name: "オープンキッチン窓",category:"functional",size:[3,1], capacity: 0, baseCost: 40000, allowedGrades: null, description: "キッチンが見える窓。全席chefView+0.05。" },
};

// ═══════════════════════════════════════════════════════════════
// 客タイプ別グレード許容範囲
// ═══════════════════════════════════════════════════════════════
export const CUSTOMER_GRADE_PREFERENCES = {
  salaryman:      { sweetSpot: [3,6],  minAccept: 1,  maxAccept: 8  },
  family:         { sweetSpot: [3,5],  minAccept: 2,  maxAccept: 7  },
  student:        { sweetSpot: [1,4],  minAccept: 1,  maxAccept: 5  },
  couple:         { sweetSpot: [5,8],  minAccept: 3,  maxAccept: 10 },
  solo_gourmet:   { sweetSpot: [5,9],  minAccept: 4,  maxAccept: 10 },
  elderly:        { sweetSpot: [4,6],  minAccept: 2,  maxAccept: 8  },
  business_group: { sweetSpot: [8,10], minAccept: 7,  maxAccept: 10 },
  tourist:        { sweetSpot: [4,8],  minAccept: 2,  maxAccept: 10 },
};

// ═══════════════════════════════════════════════════════════════
// カテゴリラベル
// ═══════════════════════════════════════════════════════════════
export const CATEGORY_INFO = {
  table:      { name: "テーブル",   icon: "🍽", color: "#d4a843" },
  counter:    { name: "カウンター", icon: "🪑", color: "#4a88cc" },
  chair:      { name: "椅子",       icon: "💺", color: "#4aaa6a" },
  decor:      { name: "装飾",       icon: "🌿", color: "#9060c8" },
  functional: { name: "設備",       icon: "⚙",  color: "#d08030" },
};

export function getGradeTier(gradeId) {
  return parseInt(gradeId?.replace("tier", "") || "0");
}

export function getFurnitureCost(typeId, gradeId) {
  const type = FURNITURE_TYPES[typeId];
  if (!type) return 0;
  if (!gradeId || !type.allowedGrades) return type.baseCost;
  const grade = FURNITURE_GRADES[gradeId];
  if (!grade) return type.baseCost;
  return Math.round(type.baseCost * grade.costMult);
}
