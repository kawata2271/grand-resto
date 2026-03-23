export class AbilityManager {
  constructor(state, abilitiesData) {
    this.state = state;
    this.abilities = abilitiesData.abilities;
    this.rarityChance = abilitiesData.rarityChance;
  }

  // Roll ability for a new hire. Returns ability object or null
  rollAbility(roleRestriction = null) {
    // First decide if they get an ability at all
    const roll = Math.random();
    let cumulative = 0;
    let selectedRarity = null;

    for (const [rarity, chance] of Object.entries(this.rarityChance)) {
      cumulative += chance;
      if (roll < cumulative) {
        selectedRarity = rarity;
        break;
      }
    }

    if (!selectedRarity || selectedRarity === "none") return null;

    // Filter by rarity and role
    const candidates = this.abilities.filter(a => {
      if (a.rarity !== selectedRarity) return false;
      if (a.roleRestriction && a.roleRestriction !== roleRestriction) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  getAbilityById(id) {
    return this.abilities.find(a => a.id === id) || null;
  }

  getStaffAbility(staff) {
    if (!staff.abilityId) return null;
    return this.getAbilityById(staff.abilityId);
  }

  getRarityColor(rarity) {
    const colors = {
      common: "#a09080",
      uncommon: "#4aaa6a",
      rare: "#4a88cc",
      epic: "#9060c8",
      legendary: "#f0c860"
    };
    return colors[rarity] || "#a09080";
  }

  getRarityLabel(rarity) {
    const labels = {
      common: "コモン",
      uncommon: "アンコモン",
      rare: "レア",
      epic: "エピック",
      legendary: "レジェンダリー"
    };
    return labels[rarity] || rarity;
  }

  // Aggregate effects from all staff abilities
  getTeamEffects() {
    const totals = {
      cookSpeed: 0,
      cookQuality: 0,
      customerFlow: 0,
      reputation: 0,
      ingredientCost: 0,
      teamMorale: 0,
      rivalDefense: 0,
      menuPopularity: 0
    };

    for (const staff of this.state.staff) {
      const ability = this.getStaffAbility(staff);
      if (!ability) continue;
      if (staff.shift === "off") continue;

      for (const [key, val] of Object.entries(ability.effects)) {
        if (totals[key] !== undefined) totals[key] += val;
      }
    }

    return totals;
  }

  // Get individual staff modifiers
  getStaffModifiers(staff) {
    const ability = this.getStaffAbility(staff);
    if (!ability) return {};
    return { ...ability.effects };
  }

  getCookSpeedBonus(staff) {
    return this.getStaffModifiers(staff).cookSpeed || 0;
  }

  getCookQualityBonus(staff) {
    return this.getStaffModifiers(staff).cookQuality || 0;
  }

  getFatigueMult(staff) {
    return this.getStaffModifiers(staff).fatigueMult || 1.0;
  }

  getExpMult(staff) {
    return this.getStaffModifiers(staff).expMult || 1.0;
  }

  getSalaryMult(staff) {
    return this.getStaffModifiers(staff).salaryMult || 1.0;
  }

  getTurnoverRiskMod(staff) {
    return this.getStaffModifiers(staff).turnoverRisk || 0;
  }

  getBreakRecoveryMult(staff) {
    return this.getStaffModifiers(staff).breakRecovery || 1.0;
  }

  // Daily accident check from negative abilities
  checkDailyAccidents() {
    const events = [];
    for (const staff of this.state.staff) {
      if (staff.shift === "off") continue;
      const mods = this.getStaffModifiers(staff);
      if (mods.accidentChance && Math.random() < mods.accidentChance) {
        const accidents = [
          `${staff.name}が食器を割ってしまった（修理費 -¥3,000）`,
          `${staff.name}が食材を無駄にしてしまった（損失 -¥2,000）`,
          `${staff.name}のミスで客にクレームが入った`,
          `${staff.name}が厨房で小さなボヤを起こした（-¥5,000）`,
          `${staff.name}がオーダーを間違えてやり直しに`
        ];
        const msg = accidents[Math.floor(Math.random() * accidents.length)];
        const cost = msg.includes("5,000") ? 5000 : msg.includes("3,000") ? 3000 : msg.includes("2,000") ? 2000 : 0;
        if (cost > 0) this.state.restaurant.money -= cost;
        if (msg.includes("クレーム")) {
          this.state.restaurant.reputation = Math.max(0, this.state.restaurant.reputation - 1);
        }
        events.push(msg);
      }
    }
    return events;
  }
}
