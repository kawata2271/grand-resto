export class RelocationManager {
  constructor(state, locationsData) {
    this.state = state;
    this.locations = locationsData.locations;
    this.unlockMoney = locationsData.unlockMoney;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.restaurant.locationId) {
      this.state.restaurant.locationId = null; // null = default/starting location
    }
    if (!this.state.restaurant.locationHistory) {
      this.state.restaurant.locationHistory = [];
    }
  }

  isUnlocked() {
    return this.state.restaurant.money >= this.unlockMoney || this.state.restaurant.locationId !== null;
  }

  getCurrentLocation() {
    if (!this.state.restaurant.locationId) return null;
    return this.locations.find(l => l.id === this.state.restaurant.locationId) || null;
  }

  getAvailableLocations() {
    return this.locations.map(l => ({
      ...l,
      isCurrent: l.id === this.state.restaurant.locationId,
      canAfford: this.state.restaurant.money >= l.landCost
    }));
  }

  relocate(locationId) {
    const loc = this.locations.find(l => l.id === locationId);
    if (!loc) return { success: false, reason: "移転先が見つかりません" };
    if (loc.id === this.state.restaurant.locationId) return { success: false, reason: "現在地と同じです" };
    if (this.state.restaurant.money < loc.landCost) return { success: false, reason: `資金不足（必要: ¥${loc.landCost.toLocaleString()}）` };

    // Pay cost
    this.state.restaurant.money -= loc.landCost;

    // Record history
    this.state.restaurant.locationHistory.push({
      fromId: this.state.restaurant.locationId,
      toId: loc.id,
      day: this.state.stats.daysPlayed,
      cost: loc.landCost
    });

    // Set new location
    this.state.restaurant.locationId = loc.id;

    // Reset reputation partially (new area, new reputation)
    const oldRep = this.state.restaurant.reputation;
    this.state.restaurant.reputation = Math.max(10, Math.floor(oldRep * 0.4));

    // Update trend with initial randomness
    loc._currentTrend = loc.trend + Math.floor((Math.random() - 0.5) * 4);

    return {
      success: true,
      location: loc,
      oldReputation: oldRep,
      newReputation: this.state.restaurant.reputation
    };
  }

  // Called each day to fluctuate trend
  dailyUpdate() {
    const loc = this.getCurrentLocation();
    if (!loc) return;

    // Trend fluctuation: ±1 every ~5 days
    if (Math.random() < 0.2) {
      const drift = Math.random() > 0.5 ? 1 : -1;
      loc._currentTrend = Math.max(0, Math.min(10, (loc._currentTrend || loc.trend) + drift));
    }
  }

  // Modifiers for game systems
  getTrafficMultiplier() {
    const loc = this.getCurrentLocation();
    if (!loc) return 1.0;
    return loc.baseTraffic / 50; // 50 = baseline, so range ~0.6-1.9
  }

  getWealthMultiplier() {
    const loc = this.getCurrentLocation();
    if (!loc) return 1.0;
    return 0.7 + (loc.wealthLevel / 10) * 0.6; // range 0.8-1.3
  }

  getCompetitionPenalty() {
    const loc = this.getCurrentLocation();
    if (!loc) return 1.0;
    return 1.0 - (loc.competition / 100) * 3; // high competition = up to -30%
  }

  getTrendBonus() {
    const loc = this.getCurrentLocation();
    if (!loc) return 1.0;
    const currentTrend = loc._currentTrend || loc.trend;
    return 1.0 + (currentTrend - 5) / 50; // ±10% range
  }

  getCrimeEventChance() {
    const loc = this.getCurrentLocation();
    if (!loc) return 0;
    return (loc.crimeRate / 10) * 0.05; // max 5% daily chance
  }

  getLocationInfo() {
    const loc = this.getCurrentLocation();
    if (!loc) return { name: "デフォルト立地", description: "開業時の場所", category: "default" };
    return {
      ...loc,
      currentTrend: loc._currentTrend || loc.trend
    };
  }

  getCategoryLabel(cat) {
    const labels = {
      premium: "超一等地", nightlife: "繁華街", office: "オフィス街",
      residential: "住宅街", tourist: "観光地", suburban: "郊外",
      special: "特殊立地", default: "初期立地"
    };
    return labels[cat] || cat;
  }

  getCategoryColor(cat) {
    const colors = {
      premium: "#f0c860", nightlife: "#c94040", office: "#4a88cc",
      residential: "#4aaa6a", tourist: "#d08030", suburban: "#a09080",
      special: "#9060c8"
    };
    return colors[cat] || "#a09080";
  }
}
