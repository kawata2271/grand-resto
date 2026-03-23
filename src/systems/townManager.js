export class TownManager {
  constructor(state, townsData, config) {
    this.state = state;
    this.townsData = townsData;
    this.config = config;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.town) {
      this.state.town = this._generateTown();
    }
  }

  _generateTown() {
    const types = this.townsData.townTypes;
    const prestige = this.state.prestige?.level || 0;

    // Random selection with slight bias toward different types each run
    const seed = prestige * 7 + Math.floor(Math.random() * types.length);
    const selected = types[seed % types.length];

    // Generate population variation
    const popMult = 0.8 + Math.random() * 0.4; // 0.8-1.2

    return {
      typeId: selected.id,
      name: this._generateTownName(selected),
      population: Math.round(50000 * popMult),
      development: 30 + Math.floor(Math.random() * 30), // 30-60
      events: []
    };
  }

  _generateTownName(type) {
    const prefixes = ["東", "西", "南", "北", "新", "上", "中", "大", "小", "若"];
    const suffixes_map = {
      town_business: ["橋", "町", "丁目", "通り"],
      town_residential: ["ヶ丘", "台", "野", "園"],
      town_station: ["駅前", "中央", "本町"],
      town_university: ["ヶ丘", "台", "園"],
      town_seaside: ["浜", "浦", "崎", "港"],
      town_suburb: ["野", "原", "川", "谷"],
      town_entertainment: ["町", "通り", "横丁"],
      town_historic: ["寺", "宮", "社", "堂"]
    };
    const suffixes = suffixes_map[type.id] || ["町"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${prefix}${suffix}`;
  }

  getCurrentTown() {
    return this.state.town;
  }

  getTownType() {
    return this.townsData.townTypes.find(t => t.id === this.state.town.typeId)
      || this.townsData.townTypes[0];
  }

  getCustomerTypeMult(customerTypeId) {
    const type = this.getTownType();
    return type.customerMult[customerTypeId] || 1.0;
  }

  getBaseCustomerRate() {
    return this.getTownType().baseCustomerRate;
  }

  getPeakMult(period) {
    const type = this.getTownType();
    if (period === "lunch") return type.peakLunchMult;
    if (period === "dinner") return type.peakDinnerMult;
    return 1.0;
  }

  getRent() {
    return this.getTownType().rent;
  }

  getRivalChance() {
    return this.getTownType().rivalChance;
  }

  getSeasonMult(seasonId) {
    const type = this.getTownType();
    return type.seasonMult?.[seasonId] || 1.0;
  }

  getGenreBonus(genre) {
    const type = this.getTownType();
    return type.genreBonus?.[genre] || 1.0;
  }

  developTown(amount = 1) {
    this.state.town.development = Math.min(100, this.state.town.development + amount);

    // Development milestones
    const dev = this.state.town.development;
    const events = [];
    if (dev === 50) events.push("街の発展度が50に到達。新しい住民が増えています");
    if (dev === 70) events.push("街の発展度が70に。商業施設が充実してきました");
    if (dev === 90) events.push("街の発展度が90！この街を代表する繁華街に");

    return events;
  }

  getDevelopmentBonus() {
    const dev = this.state.town.development;
    return {
      customerRate: 1 + (dev - 30) / 200, // 30dev=1.0, 100dev=1.35
      reputation: Math.floor(dev / 25) // 0-4 daily bonus chance
    };
  }

  getTownInfo() {
    const type = this.getTownType();
    const town = this.state.town;
    return {
      name: town.name,
      typeName: type.name,
      typeIcon: type.icon,
      description: type.description,
      population: town.population,
      development: town.development,
      rent: type.rent
    };
  }

  regenerateForPrestige() {
    this.state.town = this._generateTown();
    return this.state.town;
  }
}
