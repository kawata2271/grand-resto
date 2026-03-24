export class EquipmentManager {
  constructor(state, equipmentData) {
    this.state = state;
    this.data = equipmentData;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.equipment) {
      this.state.equipment = {
        owned: {},
        failedToday: []
      };
      // Start with basic kitchen equipment
      for (const eq of this.data.equipment.filter(e => e.category === "kitchen").slice(0, 3)) {
        this.state.equipment.owned[eq.id] = {
          condition: eq.durability,
          maxCondition: eq.durability,
          lastMaintenance: 0,
          failed: false
        };
      }
      // Basic hall equipment
      this.state.equipment.owned["eq_aircon"] = { condition: 365, maxCondition: 365, lastMaintenance: 0, failed: false };
      this.state.equipment.owned["eq_pos"] = { condition: 400, maxCondition: 400, lastMaintenance: 0, failed: false };
    }
  }

  getOwnedEquipment() {
    return this.data.equipment.filter(eq => this.state.equipment.owned[eq.id]).map(eq => {
      const owned = this.state.equipment.owned[eq.id];
      const condPct = Math.round((owned.condition / owned.maxCondition) * 100);
      return { ...eq, ...owned, condPct, needsMaintenance: condPct < 30 };
    });
  }

  getUnownedEquipment() {
    return this.data.equipment.filter(eq => !this.state.equipment.owned[eq.id]);
  }

  purchaseEquipment(eqId) {
    const eq = this.data.equipment.find(e => e.id === eqId);
    if (!eq) return { success: false, reason: "設備が見つかりません" };
    if (this.state.equipment.owned[eqId]) return { success: false, reason: "すでに所有しています" };
    if (this.state.restaurant.money < eq.baseCost) return { success: false, reason: `資金不足（¥${eq.baseCost.toLocaleString()}）` };

    this.state.restaurant.money -= eq.baseCost;
    this.state.equipment.owned[eqId] = {
      condition: eq.durability,
      maxCondition: eq.durability,
      lastMaintenance: this.state.stats.daysPlayed,
      failed: false
    };
    return { success: true, equipment: eq };
  }

  doMaintenance(eqId) {
    const eq = this.data.equipment.find(e => e.id === eqId);
    const owned = this.state.equipment.owned[eqId];
    if (!eq || !owned) return { success: false, reason: "設備が見つかりません" };

    const cost = Math.round(eq.baseCost * this.data.maintenanceSchedule.preventiveCost);
    if (this.state.restaurant.money < cost) return { success: false, reason: `資金不足（¥${cost.toLocaleString()}）` };

    this.state.restaurant.money -= cost;
    owned.condition = owned.maxCondition;
    owned.lastMaintenance = this.state.stats.daysPlayed;
    owned.failed = false;
    return { success: true, cost };
  }

  repairFailed(eqId) {
    const eq = this.data.equipment.find(e => e.id === eqId);
    const owned = this.state.equipment.owned[eqId];
    if (!eq || !owned || !owned.failed) return { success: false, reason: "修理不要です" };

    if (this.state.restaurant.money < eq.failureCost) return { success: false, reason: `資金不足（¥${eq.failureCost.toLocaleString()}）` };

    this.state.restaurant.money -= eq.failureCost;
    owned.condition = Math.round(owned.maxCondition * 0.7);
    owned.failed = false;
    return { success: true, cost: eq.failureCost };
  }

  dailyUpdate() {
    const events = [];
    const day = this.state.stats.daysPlayed;
    let totalMonthlyCost = 0;
    this.state.equipment.failedToday = [];

    for (const eq of this.data.equipment) {
      const owned = this.state.equipment.owned[eq.id];
      if (!owned) continue;

      // Monthly running cost (daily portion)
      totalMonthlyCost += eq.monthlyCost;

      if (owned.failed) continue;

      // Condition decay
      owned.condition -= 1;

      // Failure check
      if (owned.condition <= 0) {
        owned.failed = true;
        this.state.equipment.failedToday.push(eq.id);
        events.push(`💥 ${eq.name}が故障！修理費¥${eq.failureCost.toLocaleString()}`);
        this._applyFailureEffect(eq);
      } else if (owned.condition < owned.maxCondition * 0.2) {
        // Random failure when condition is low
        const chance = this.data.maintenanceSchedule.failureChanceBase +
          (1 - owned.condition / owned.maxCondition) * this.data.maintenanceSchedule.failureChancePerDayOverdue;
        if (Math.random() < chance) {
          owned.failed = true;
          this.state.equipment.failedToday.push(eq.id);
          events.push(`💥 ${eq.name}が突然故障！`);
          this._applyFailureEffect(eq);
        }
      }
    }

    // Deduct monthly costs (daily)
    this.state.restaurant.money -= Math.round(totalMonthlyCost / 30);

    return events;
  }

  _applyFailureEffect(eq) {
    switch (eq.failureEffect) {
      case "food_spoil":
        // Handled by preparation manager
        break;
      case "cook_speed_down":
      case "menu_limit":
        // Reduces cooking capacity - handled in sim via getSpeedModifier
        break;
      case "satisfaction_down":
        for (const s of this.state.staff) s.morale = Math.max(0, s.morale - 5);
        break;
    }
  }

  getSpeedModifier() {
    let mod = 1.0;
    const stove = this.state.equipment.owned["eq_stove"];
    if (stove?.failed) mod *= 0.5;
    else if (stove) {
      const eq = this.data.equipment.find(e => e.id === "eq_stove");
      mod *= (1 + (eq?.speedBonus || 0));
    }
    return mod;
  }

  getFailedEquipment() {
    return this.data.equipment.filter(eq => this.state.equipment.owned[eq.id]?.failed);
  }

  hasEquipment(eqId) {
    const owned = this.state.equipment.owned[eqId];
    return owned && !owned.failed;
  }
}
