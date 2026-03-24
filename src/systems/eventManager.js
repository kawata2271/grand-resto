export class EventManager {
  constructor(state, eventsData) {
    this.state = state;
    this.events = eventsData.events;
    this.activeEffects = []; // { type, multiplier/value, daysLeft }
  }

  rollDailyEvent() {
    const totalWeight = this.events.reduce((sum, e) => sum + e.weight, 0);
    const eventChance = 0.5; // 50% chance per day (increased for 500 events)

    if (Math.random() > eventChance) return null;

    let roll = Math.random() * totalWeight;
    for (const evt of this.events) {
      roll -= evt.weight;
      if (roll <= 0) {
        this._applyEffects(evt.effects);
        return evt;
      }
    }
    return null;
  }

  _applyEffects(effects) {
    for (const eff of effects) {
      switch (eff.type) {
        case "money":
          this.state.restaurant.money += eff.value;
          break;
        case "reputation":
          this.state.restaurant.reputation = Math.max(0,
            Math.min(100, this.state.restaurant.reputation + eff.value));
          break;
        case "staff_morale":
          for (const staff of this.state.staff) {
            if (eff.target === "all" || !eff.target) {
              staff.morale = Math.max(0, Math.min(100, staff.morale + eff.value));
            }
          }
          break;
        case "staff_fatigue":
          for (const staff of this.state.staff) {
            staff.fatigue = Math.max(0, Math.min(100, staff.fatigue + eff.value));
          }
          break;
        case "staff_exp":
          for (const staff of this.state.staff) {
            staff.experience = Math.max(0, staff.experience + eff.value);
          }
          break;
        case "staff_stat": {
          // Boost a specific stat for all or random staff
          const targets = eff.target === "random"
            ? [this.state.staff[Math.floor(Math.random() * this.state.staff.length)]]
            : this.state.staff;
          for (const staff of targets) {
            if (staff && staff.stats[eff.stat]) {
              staff.stats[eff.stat] = Math.max(1, Math.min(100, staff.stats[eff.stat] + eff.value));
            }
          }
          break;
        }
        case "customer_flow":
        case "ingredient_cost":
          this.activeEffects.push({
            type: eff.type,
            multiplier: eff.multiplier,
            daysLeft: eff.duration
          });
          break;
        case "table_damage": {
          // Temporarily remove a table
          const tables = this.state.restaurant.tables;
          if (tables.length > 1) {
            const removed = tables.pop();
            this.activeEffects.push({
              type: "table_restore",
              table: removed,
              daysLeft: eff.duration || 3
            });
          }
          break;
        }
        case "menu_popularity": {
          // Temporarily boost all menu popularity via customer_flow
          this.activeEffects.push({
            type: "customer_flow",
            multiplier: eff.multiplier || 1.2,
            daysLeft: eff.duration || 3
          });
          break;
        }
        case "cook_speed":
          this.activeEffects.push({
            type: "cook_speed",
            multiplier: eff.multiplier,
            daysLeft: eff.duration
          });
          break;
      }
    }
  }

  getCustomerFlowMultiplier() {
    let mult = 1.0;
    for (const eff of this.activeEffects) {
      if (eff.type === "customer_flow") mult *= eff.multiplier;
    }
    return mult;
  }

  getIngredientCostMultiplier() {
    let mult = 1.0;
    for (const eff of this.activeEffects) {
      if (eff.type === "ingredient_cost") mult *= eff.multiplier;
    }
    return mult;
  }

  getCookSpeedMultiplier() {
    let mult = 1.0;
    for (const eff of this.activeEffects) {
      if (eff.type === "cook_speed") mult *= eff.multiplier;
    }
    return mult;
  }

  advanceDay() {
    const restored = [];
    this.activeEffects = this.activeEffects
      .map(e => ({ ...e, daysLeft: e.daysLeft - 1 }))
      .filter(e => {
        if (e.daysLeft <= 0 && e.type === "table_restore" && e.table) {
          this.state.restaurant.tables.push(e.table);
          restored.push("修理完了：テーブルが復旧しました");
        }
        return e.daysLeft > 0;
      });
    return restored;
  }

  getActiveEffectsSummary() {
    return this.activeEffects
      .filter(e => e.type !== "table_restore")
      .map(e => {
        const labels = { customer_flow: "客足", ingredient_cost: "食材コスト", cook_speed: "調理速度" };
        const label = labels[e.type] || e.type;
        const pct = Math.round((e.multiplier - 1) * 100);
        const sign = pct >= 0 ? "+" : "";
        return `${label} ${sign}${pct}% (残${e.daysLeft}日)`;
      });
  }
}
