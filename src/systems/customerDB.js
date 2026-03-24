export class CustomerDBManager {
  constructor(state) {
    this.state = state;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.customerDB) {
      this.state.customerDB = {
        regulars: [],
        totalUniqueVisitors: 0,
        segments: {}
      };
    }
  }

  // Record a customer visit
  recordVisit(customerType, groupSize, satisfaction, spending) {
    const db = this.state.customerDB;
    db.totalUniqueVisitors++;

    // Track by segment
    if (!db.segments[customerType]) {
      db.segments[customerType] = { visits: 0, totalSpend: 0, avgSatisfaction: 0 };
    }
    const seg = db.segments[customerType];
    seg.visits += groupSize;
    seg.totalSpend += spending;
    seg.avgSatisfaction = (seg.avgSatisfaction * (seg.visits - groupSize) + satisfaction * groupSize) / seg.visits;

    // Chance to become regular (high satisfaction)
    if (satisfaction >= 80 && Math.random() < 0.05) {
      const existing = db.regulars.find(r => r.type === customerType && r.visits < 50);
      if (existing) {
        existing.visits++;
        existing.lastVisit = this.state.stats.daysPlayed;
        existing.totalSpend += spending;
      } else if (db.regulars.length < 100) {
        db.regulars.push({
          id: `reg_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
          type: customerType,
          name: this._generateName(),
          visits: 1,
          firstVisit: this.state.stats.daysPlayed,
          lastVisit: this.state.stats.daysPlayed,
          totalSpend: spending,
          satisfaction: satisfaction,
          favoriteMenu: null
        });
      }
    }
  }

  // Get regular customer natural visit count (adds to daily customers)
  getRegularVisitBonus() {
    let bonus = 0;
    for (const reg of this.state.customerDB.regulars) {
      const daysSinceVisit = this.state.stats.daysPlayed - reg.lastVisit;
      // Regulars visit roughly every 3-7 days
      if (daysSinceVisit >= 3 && Math.random() < 0.25) {
        bonus++;
        reg.lastVisit = this.state.stats.daysPlayed;
        reg.visits++;
      }
    }
    return bonus;
  }

  getRegulars() {
    return this.state.customerDB.regulars.sort((a, b) => b.visits - a.visits);
  }

  getSegmentAnalysis() {
    return Object.entries(this.state.customerDB.segments)
      .map(([type, data]) => ({
        type,
        visits: data.visits,
        totalSpend: Math.round(data.totalSpend),
        avgSatisfaction: Math.round(data.avgSatisfaction),
        avgSpend: data.visits > 0 ? Math.round(data.totalSpend / data.visits) : 0
      }))
      .sort((a, b) => b.visits - a.visits);
  }

  getTotalRegulars() { return this.state.customerDB.regulars.length; }
  getTotalVisitors() { return this.state.customerDB.totalUniqueVisitors; }

  _generateName() {
    const last = ["田中","佐藤","鈴木","高橋","伊藤","渡辺","山本","中村","小林","加藤","吉田","山田","松本","井上","木村"][Math.floor(Math.random()*15)];
    const first = ["さん","様"][Math.floor(Math.random()*2)];
    return `${last}${first}`;
  }
}
