export class CompatibilityManager {
  constructor(state) {
    this.state = state;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.compatibility) {
      this.state.compatibility = {};
    }
  }

  _pairKey(id1, id2) {
    return id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
  }

  getCompatibility(id1, id2) {
    const key = this._pairKey(id1, id2);
    if (this.state.compatibility[key] !== undefined) {
      return this.state.compatibility[key];
    }
    // Generate deterministic compatibility from IDs + slight randomness on first meeting
    const seed = this._hashPair(id1, id2);
    const value = Math.floor((seed % 81) - 40); // -40 to +40 initial range
    this.state.compatibility[key] = value;
    return value;
  }

  _hashPair(id1, id2) {
    const str = this._pairKey(id1, id2);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  changeCompatibility(id1, id2, delta) {
    const key = this._pairKey(id1, id2);
    const current = this.getCompatibility(id1, id2);
    this.state.compatibility[key] = Math.max(-100, Math.min(100, current + delta));
    return this.state.compatibility[key];
  }

  getRelationshipLabel(value) {
    if (value >= 60) return { label: "親友", icon: "💖", color: "#ff69b4" };
    if (value >= 30) return { label: "良好", icon: "😊", color: "#4aaa6a" };
    if (value >= -10) return { label: "普通", icon: "😐", color: "#a09080" };
    if (value >= -40) return { label: "不仲", icon: "😤", color: "#d4a843" };
    return { label: "険悪", icon: "💢", color: "#c94040" };
  }

  getTeamBonus(staffIds) {
    if (staffIds.length < 2) return { efficiency: 0, morale: 0 };

    let totalCompat = 0;
    let pairCount = 0;

    for (let i = 0; i < staffIds.length; i++) {
      for (let j = i + 1; j < staffIds.length; j++) {
        totalCompat += this.getCompatibility(staffIds[i], staffIds[j]);
        pairCount++;
      }
    }

    if (pairCount === 0) return { efficiency: 0, morale: 0 };

    const avgCompat = totalCompat / pairCount;
    // -100~+100 → efficiency bonus -15%~+15%
    const efficiency = avgCompat / 100 * 0.15;
    // morale daily change based on team chemistry
    const morale = Math.round(avgCompat / 20);

    return { efficiency, morale, avgCompat: Math.round(avgCompat) };
  }

  getComboEffects(staff1, staff2) {
    const compat = this.getCompatibility(staff1.id, staff2.id);
    const effects = [];

    if (compat >= 50 && staff1.role === staff2.role) {
      effects.push({ name: "息ぴったり", desc: "同じ役職の良コンビ。効率+10%", bonus: 0.10 });
    }
    if (compat >= 70) {
      effects.push({ name: "最強タッグ", desc: "抜群の連携。効率+15%、士気UP", bonus: 0.15, morale: 2 });
    }
    if (compat <= -50) {
      effects.push({ name: "犬猿の仲", desc: "一緒に働くと効率ダウン。士気低下", bonus: -0.10, morale: -3 });
    }
    if (compat <= -80) {
      effects.push({ name: "修羅場", desc: "深刻な対立。チーム全体に悪影響", bonus: -0.20, morale: -5 });
    }

    return effects;
  }

  dailyUpdate() {
    const staff = this.state.staff;
    const events = [];

    // Working together changes compatibility
    const working = staff.filter(s => s.shift !== "off");
    for (let i = 0; i < working.length; i++) {
      for (let j = i + 1; j < working.length; j++) {
        const current = this.getCompatibility(working[i].id, working[j].id);
        // Small daily drift based on morale similarity
        const moraleDiff = Math.abs(working[i].morale - working[j].morale);
        const drift = moraleDiff < 20 ? 1 : (moraleDiff > 50 ? -1 : 0);
        // Random small changes
        const random = Math.random() < 0.15 ? (Math.random() > 0.5 ? 2 : -2) : 0;

        if (drift !== 0 || random !== 0) {
          this.changeCompatibility(working[i].id, working[j].id, drift + random);
        }

        // Trigger events for extreme relationships
        const newVal = this.getCompatibility(working[i].id, working[j].id);
        if (newVal >= 60 && current < 60) {
          events.push(`${working[i].name}と${working[j].name}が意気投合！連携ボーナス発動`);
        }
        if (newVal <= -50 && current > -50) {
          events.push(`${working[i].name}と${working[j].name}の関係が悪化…注意が必要`);
        }
      }
    }

    return events;
  }

  getAllPairs() {
    const staff = this.state.staff;
    const pairs = [];
    for (let i = 0; i < staff.length; i++) {
      for (let j = i + 1; j < staff.length; j++) {
        const val = this.getCompatibility(staff[i].id, staff[j].id);
        const rel = this.getRelationshipLabel(val);
        pairs.push({
          staff1: staff[i],
          staff2: staff[j],
          value: val,
          ...rel
        });
      }
    }
    return pairs.sort((a, b) => b.value - a.value);
  }

  cleanupRemovedStaff() {
    const ids = new Set(this.state.staff.map(s => s.id));
    for (const key of Object.keys(this.state.compatibility)) {
      const [a, b] = key.split(":");
      if (!ids.has(a) || !ids.has(b)) {
        delete this.state.compatibility[key];
      }
    }
  }
}
