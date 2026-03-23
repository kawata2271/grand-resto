export class EventManager {
  constructor(state, eventsData) {
    this.state = state;
    this.events = eventsData.events;
    this.activeEffects = []; // { type, multiplier/value, daysLeft }
  }

  rollDailyEvent() {
    const totalWeight = this.events.reduce((sum, e) => sum + e.weight, 0);
    const eventChance = 0.4; // 40% chance per day

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
            staff.morale = Math.max(0, Math.min(100, staff.morale + eff.value));
          }
          break;
        case "customer_flow":
        case "ingredient_cost":
          this.activeEffects.push({
            type: eff.type,
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
      if (eff.type === "customer_flow") {
        mult *= eff.multiplier;
      }
    }
    return mult;
  }

  getIngredientCostMultiplier() {
    let mult = 1.0;
    for (const eff of this.activeEffects) {
      if (eff.type === "ingredient_cost") {
        mult *= eff.multiplier;
      }
    }
    return mult;
  }

  advanceDay() {
    this.activeEffects = this.activeEffects
      .map(e => ({ ...e, daysLeft: e.daysLeft - 1 }))
      .filter(e => e.daysLeft > 0);
  }

  getActiveEffectsSummary() {
    return this.activeEffects.map(e => {
      const label = e.type === "customer_flow" ? "客足" : "食材コスト";
      const pct = Math.round((e.multiplier - 1) * 100);
      const sign = pct >= 0 ? "+" : "";
      return `${label} ${sign}${pct}% (残${e.daysLeft}日)`;
    });
  }
}
