export class RivalManager {
  constructor(state, rivalsData) {
    this.state = state;
    this.rivalsData = rivalsData;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.rivals) this.state.rivals = [];
    if (!this.state.rivalEffects) this.state.rivalEffects = [];
  }

  checkNewRivals() {
    const day = this.state.stats.daysPlayed;
    const rep = this.state.restaurant.reputation;
    const existing = new Set(this.state.rivals.map(r => r.templateId));
    const events = [];

    for (const tmpl of this.rivalsData.rivalTemplates) {
      if (existing.has(tmpl.id)) continue;

      const cond = tmpl.openCondition;
      if (day < (cond.minDay || 0)) continue;
      if (rep < (cond.minReputation || 0)) continue;

      // Probability increases over time past condition
      const overdue = day - cond.minDay;
      const chance = Math.min(0.3, 0.02 + overdue * 0.005);
      if (Math.random() > chance) continue;

      const rival = {
        id: `rival_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        templateId: tmpl.id,
        name: tmpl.name,
        type: tmpl.type,
        genre: tmpl.genre,
        priceRange: tmpl.priceRange,
        customerSteal: tmpl.baseCustomerSteal,
        aggressiveness: tmpl.aggressiveness,
        targetCustomers: tmpl.targetCustomers,
        health: 100,
        openDay: day,
        actionCooldown: 0
      };

      this.state.rivals.push(rival);
      events.push({
        type: "rival_open",
        rival,
        message: `🏪 ${tmpl.name}が近隣にオープン！ ${tmpl.description}`
      });
    }

    return events;
  }

  dailyUpdate() {
    const events = [];

    for (const rival of this.state.rivals) {
      // Cooldown
      if (rival.actionCooldown > 0) {
        rival.actionCooldown--;
        continue;
      }

      // Rival takes action?
      if (Math.random() < rival.aggressiveness * 0.1) {
        const action = this._pickAction();
        if (action) {
          events.push(this._applyAction(rival, action));
          rival.actionCooldown = 5 + Math.floor(Math.random() * 10);
        }
      }
    }

    // Update active effects
    this.state.rivalEffects = this.state.rivalEffects
      .map(e => ({ ...e, daysLeft: e.daysLeft - 1 }))
      .filter(e => e.daysLeft > 0);

    return events;
  }

  _pickAction() {
    const actions = this.rivalsData.rivalActions;
    const total = actions.reduce((s, a) => s + a.weight, 0);
    let roll = Math.random() * total;
    for (const a of actions) {
      roll -= a.weight;
      if (roll <= 0) return a;
    }
    return actions[0];
  }

  _applyAction(rival, action) {
    if (action.effect.customerStealMult !== undefined) {
      this.state.rivalEffects.push({
        rivalId: rival.id,
        rivalName: rival.name,
        actionName: action.name,
        customerStealMult: action.effect.customerStealMult,
        targetCustomers: rival.targetCustomers,
        daysLeft: action.effect.duration || 5
      });
    }

    return {
      type: "rival_action",
      rivalName: rival.name,
      actionName: action.name,
      message: `⚔️ ${rival.name}の動き: ${action.name} — ${action.description}`
    };
  }

  getCustomerStealRate(customerTypeId) {
    let totalSteal = 0;

    // Base steal from active rivals
    for (const rival of this.state.rivals) {
      if (rival.targetCustomers.includes(customerTypeId)) {
        totalSteal += rival.customerSteal;
      }
    }

    // Effect multiplier
    for (const eff of this.state.rivalEffects) {
      if (eff.targetCustomers.includes(customerTypeId)) {
        totalSteal *= eff.customerStealMult;
      }
    }

    // Cap at 50%
    return Math.min(0.5, totalSteal);
  }

  getTotalCustomerFlowImpact() {
    let impact = 1.0;
    for (const rival of this.state.rivals) {
      impact -= rival.customerSteal * 0.5;
    }
    // Active effects
    for (const eff of this.state.rivalEffects) {
      if (eff.customerStealMult > 1.0) {
        impact -= 0.05;
      } else if (eff.customerStealMult < 1.0) {
        impact += 0.03;
      }
    }
    return Math.max(0.4, impact);
  }

  getActiveRivals() {
    return this.state.rivals.map(r => {
      const tmpl = this.rivalsData.rivalTemplates.find(t => t.id === r.templateId);
      return { ...r, description: tmpl?.description || "" };
    });
  }

  getActiveEffects() {
    return this.state.rivalEffects.map(e =>
      `${e.rivalName}: ${e.actionName} (残${e.daysLeft}日)`
    );
  }
}
