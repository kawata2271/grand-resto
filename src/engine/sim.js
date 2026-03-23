export class Simulation {
  constructor(state, config, menus) {
    this.state = state;
    this.config = config;
    this.menus = menus;
    this.customers = [];
    this.nextCustomerId = 0;
    this.pendingOrders = [];
    this.customerFlowMult = 1.0;
    this.ingredientCostMult = 1.0;
    this.skillFlowBonus = 0;
    this.skillCostBonus = 0;
    this.rivalFlowImpact = 1.0;
    this.seasonFlowMult = 1.0;
    this.seasonCostMult = 1.0;
    this.formatRateMult = 1.0;
    this.customerTypes = [];
    this.shiftManager = null;
    this.skillManager = null;
    this.compatManager = null;
    this.mentorManager = null;
  }

  setCustomerTypes(types) { this.customerTypes = types; }
  setShiftManager(m) { this.shiftManager = m; }
  setSkillManager(m) { this.skillManager = m; }
  setCompatManager(m) { this.compatManager = m; }
  setMentorManager(m) { this.mentorManager = m; }

  tick() {
    const time = this.state.time;
    const sim = this.config.simulation;
    time.minute += sim.tickMinutes;
    if (time.minute >= 60) { time.hour += Math.floor(time.minute / 60); time.minute %= 60; }
    if (time.hour < sim.openHour || time.hour >= sim.closeHour) return { type: "closed", time: { ...time } };

    const cooks = this._getActive("cook");
    const hall = this._getActive("hall");
    this._generateCustomers();
    this._processSeating(hall);
    this._processOrders(cooks);
    this._processEating(hall);
    this._updateStaffFatigue();

    return { type: "open", time: { ...time }, customers: this.customers.length,
      waiting: this.customers.filter(c => c.status === "waiting").length,
      eating: this.customers.filter(c => c.status === "eating" || c.status === "seated").length,
      pendingOrders: this.pendingOrders.length, activeCooks: cooks.length, activeHall: hall.length };
  }

  _getActive(role) {
    const h = this.state.time.hour;
    const list = this.shiftManager ? this.shiftManager.getActiveStaff(h) : this.state.staff;
    return list.filter(s => s.role === role);
  }

  _getTimePeriod() {
    const h = this.state.time.hour, s = this.config.simulation;
    if (h >= s.peakLunchStart && h < s.peakLunchEnd) return "lunch";
    if (h >= s.peakDinnerStart && h < s.peakDinnerEnd) return "dinner";
    return "idle";
  }

  _getCustomerRate() {
    const sim = this.config.simulation;
    const period = this._getTimePeriod();
    let rate = sim.baseCustomerRate;
    if (period === "lunch" || period === "dinner") rate *= sim.peakMultiplier;
    else rate *= sim.idleMultiplier;
    rate *= (0.5 + this.state.restaurant.reputation / 100);
    rate *= this.customerFlowMult * (1 + this.skillFlowBonus) * this.rivalFlowImpact;
    rate *= this.seasonFlowMult * this.formatRateMult;

    const hall = this._getActive("hall");
    if (hall.length === 0) { rate *= 0.5; }
    else { rate *= (0.8 + hall.reduce((s, st) => s + st.stats.communication, 0) / hall.length / 250); }

    // Team compatibility bonus
    if (this.compatManager) {
      const working = this.shiftManager
        ? this.shiftManager.getActiveStaff(this.state.time.hour)
        : this.state.staff;
      const bonus = this.compatManager.getTeamBonus(working.map(s => s.id));
      rate *= (1 + bonus.efficiency);
    }

    return rate;
  }

  _pickCustomerType() {
    if (!this.customerTypes?.length) return null;
    const hour = this.state.time.hour;
    const rep = this.state.restaurant.reputation;
    const eligible = this.customerTypes.filter(ct => rep >= ct.reputationMin);
    if (!eligible.length) return null;
    const weighted = eligible.map(ct => ({ type: ct, weight: ct.weight * (ct.peakHours.includes(hour) ? 2.5 : 1) }));
    const total = weighted.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * total;
    for (const w of weighted) { roll -= w.weight; if (roll <= 0) return w.type; }
    return weighted[0].type;
  }

  _generateCustomers() {
    const rate = this._getCustomerRate();
    const count = Math.floor(rate + (Math.random() < (rate % 1) ? 1 : 0));
    for (let i = 0; i < count; i++) {
      const ct = this._pickCustomerType();
      const c = ct ? {
        groupSize: Math.max(ct.groupSize.min, Math.min(ct.groupSize.max, Math.round(ct.groupSize.avg + (Math.random() - 0.5) * (ct.groupSize.max - ct.groupSize.min)))),
        waitTolerance: ct.waitTolerance, orderMult: ct.orderPerPerson,
        eatSpeedMult: ct.eatSpeedMult, preferredGenres: ct.preferredGenres,
        budget: ct.budget, typeName: ct.name, typeIcon: ct.icon
      } : {
        groupSize: Math.max(1, Math.round(2.2 + (Math.random() - 0.5) * 2)),
        waitTolerance: 20, orderMult: 1.3, eatSpeedMult: 1.0,
        preferredGenres: [], budget: "medium", typeName: "一般客", typeIcon: "👤"
      };
      this.customers.push({ id: this.nextCustomerId++, ...c, status: "waiting", tableId: null, orders: [], waitedMinutes: 0, eatTimeLeft: 0, satisfaction: 80 });
    }
  }

  _processSeating(hall) {
    const tables = this.state.restaurant.tables;
    const tickMin = this.config.simulation.tickMinutes;
    const occ = new Set(this.customers.filter(c => c.status === "seated" || c.status === "eating").map(c => c.tableId));
    const cap = Math.max(1, hall.length * 2);
    let seated = 0;
    for (const c of this.customers.filter(c => c.status === "waiting")) {
      if (seated >= cap) { c.waitedMinutes += tickMin; if (c.waitedMinutes >= c.waitTolerance) { c.status = "left_angry"; c.satisfaction = 0; this.state.todayLog.lostCustomers = (this.state.todayLog.lostCustomers || 0) + c.groupSize; } continue; }
      const t = tables.find(t => !occ.has(t.id) && t.seats >= c.groupSize);
      if (t) { c.status = "seated"; c.tableId = t.id; occ.add(t.id); this._generateOrders(c); seated++; }
      else { c.waitedMinutes += tickMin; if (c.waitedMinutes >= c.waitTolerance) { c.status = "left_angry"; c.satisfaction = 0; this.state.todayLog.lostCustomers = (this.state.todayLog.lostCustomers || 0) + c.groupSize; } }
    }
  }

  _generateOrders(customer) {
    const active = this.menus.menus.filter(m => this.state.restaurant.activeMenuIds.includes(m.id));
    if (!active.length) return;
    const count = Math.max(1, Math.round(customer.groupSize * customer.orderMult));
    for (let i = 0; i < count; i++) {
      const weights = active.map(m => {
        let w = m.popularity;
        if (customer.preferredGenres.length && customer.preferredGenres.includes(m.genre)) w *= 1.8;
        if (customer.budget === "low" && m.price > 800) w *= 0.3;
        if (customer.budget === "premium" && m.price > 1000) w *= 2.0;
        return w;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * total;
      let sel = active[0];
      for (let j = 0; j < active.length; j++) { roll -= weights[j]; if (roll <= 0) { sel = active[j]; break; } }
      const costM = this.ingredientCostMult * this.seasonCostMult * (1 - this.skillCostBonus);
      this.pendingOrders.push({ customerId: customer.id, menuId: sel.id, menuName: sel.name, price: sel.price, cost: Math.round(sel.cost * costM), cookTime: sel.cookTime, status: "pending" });
      customer.orders.push(this.pendingOrders[this.pendingOrders.length - 1]);
    }
  }

  _processOrders(cooks) {
    if (!cooks.length) return;
    const tickMin = this.config.simulation.tickMinutes;
    let cap = cooks.length * tickMin;
    // Mentor penalty
    if (this.mentorManager) {
      for (const c of cooks) {
        cap += tickMin * this.mentorManager.getEfficiencyPenalty(c);
      }
    }
    for (const o of this.pendingOrders.filter(o => o.status === "pending")) {
      if (cap <= 0) break;
      const cook = cooks[Math.floor(Math.random() * cooks.length)];
      const spd = cook.stats.dexterity / 100;
      const skillSpd = this.skillManager ? this.skillManager.getCookSpeedBonus(cook) : 0;
      const eff = o.cookTime * (1 - spd * 0.3 - skillSpd);
      if (cap >= eff) {
        o.status = "served"; cap -= eff;
        this.state.todayLog.revenue += o.price;
        this.state.todayLog.cost += o.cost;
        this.state.todayLog.orders.push({ menuId: o.menuId, menuName: o.menuName, price: o.price, cost: o.cost });
        cook.experience += 1;
        const cust = this.customers.find(c => c.id === o.customerId);
        if (cust?.status === "seated") {
          cust.status = "eating";
          const ec = this.config.customer;
          cust.eatTimeLeft = (ec.minEatTime + Math.random() * (ec.maxEatTime - ec.minEatTime)) * cust.eatSpeedMult;
        }
      }
    }
    this.pendingOrders = this.pendingOrders.filter(o => o.status === "pending");
  }

  _processEating(hall) {
    const tickMin = this.config.simulation.tickMinutes;
    for (const c of this.customers) {
      if (c.status === "eating") {
        c.eatTimeLeft -= tickMin;
        if (c.eatTimeLeft <= 0) {
          c.status = "finished";
          this.state.todayLog.customers += c.groupSize;
          this.state.stats.totalCustomers += c.groupSize;
          if (!this.state.todayLog.customerTypes) this.state.todayLog.customerTypes = {};
          this.state.todayLog.customerTypes[c.typeName] = (this.state.todayLog.customerTypes[c.typeName] || 0) + c.groupSize;
          for (const s of hall) s.experience += 1;
        }
      }
    }
    this.customers = this.customers.filter(c => c.status !== "finished" && c.status !== "left_angry");
  }

  _updateStaffFatigue() {
    const h = this.state.time.hour;
    for (const s of this.state.staff) {
      const working = this.shiftManager ? this.shiftManager.isWorking(s, h) : true;
      if (working) {
        const fm = this.shiftManager ? this.shiftManager.getFatigueMult(s) : 1.0;
        s.fatigue = Math.min(100, s.fatigue + 2 * fm);
        if (s.fatigue > 80) s.morale = Math.max(0, s.morale - 1);
      }
    }
  }

  endDay() {
    const eco = this.config.economy;
    const log = this.state.todayLog;
    let totalSalary = 0;
    for (const s of this.state.staff) {
      const m = this.shiftManager ? this.shiftManager.getDailySalaryMultiplier(s) : 1.0;
      totalSalary += (s.salary / 30) * m;
    }
    log.cost += eco.dailyFixedCost + Math.round(totalSalary);
    const dayProfit = log.revenue - log.cost;
    this.state.restaurant.money += dayProfit;
    if (log.revenue > this.state.stats.bestDayRevenue) this.state.stats.bestDayRevenue = log.revenue;
    this.state.stats.totalRevenue += log.revenue;
    this.state.stats.totalCost += log.cost;
    this.state.stats.daysPlayed += 1;

    // Reputation
    if (log.customers > 0) {
      let rep = dayProfit > 0 ? 1 : -1;
      if (this.skillManager) rep += this.skillManager.getReputationDailyBonus();
      this.state.restaurant.reputation = Math.max(0, Math.min(100, this.state.restaurant.reputation + rep));
    }

    // Staff end-of-day
    for (const s of this.state.staff) {
      const off = s.shift === "off";
      s.fatigue = Math.max(0, s.fatigue - (off ? 70 : 40));
      if (off) s.morale = Math.min(100, s.morale + 5);
      s.daysWorked += off ? 0 : 1;

      // Compatibility morale effect
      if (this.compatManager && !off) {
        const working = this.state.staff.filter(st => st.id !== s.id && st.shift !== "off");
        for (const other of working) {
          const compat = this.compatManager.getCompatibility(s.id, other.id);
          if (compat > 40) s.morale = Math.min(100, s.morale + 1);
          if (compat < -40) s.morale = Math.max(0, s.morale - 1);
        }
      }

      // Growth with mentor bonus
      const growthMult = this.mentorManager ? this.mentorManager.getGrowthMultiplier(s) : 1.0;
      const expNeeded = s.level * 10;
      if (s.experience >= expNeeded) {
        s.level += 1; s.experience = 0;
        const key = s.role === "cook" ? "dexterity" : "communication";
        s.stats[key] = Math.min(100, s.stats[key] + Math.round(3 * s.growthRate * growthMult));
        s.stats.stamina = Math.min(100, s.stats.stamina + 1);
        log.events.push(`${s.name}がLv.${s.level}に成長！`);
        if (this.skillManager) { this.skillManager.onLevelUp(s); log.events.push(`${s.name}がSPを獲得`); }
      }
    }

    const summary = { date: { ...this.state.time }, revenue: log.revenue, cost: log.cost,
      profit: dayProfit, customers: log.customers, orders: log.orders.length,
      lostCustomers: log.lostCustomers || 0, customerTypes: log.customerTypes || {} };
    this.state.history.push(summary);
    const result = { ...summary, staffEvents: [...log.events] };

    this.state.todayLog = { revenue: 0, cost: 0, customers: 0, orders: [], events: [], lostCustomers: 0, customerTypes: {} };
    this.state.time.day += 1;
    if (this.state.time.day > 30) {
      this.state.time.day = 1; this.state.time.month += 1;
      if (this.state.time.month > 12) { this.state.time.month = 1; this.state.time.year += 1; }
      result.isNewMonth = true;
      this.state.restaurant.money -= eco.rentPerMonth;
      result.rentPaid = eco.rentPerMonth;
      result.monthSummary = this._calcMonthSummary();
    }
    this.state.time.hour = this.config.simulation.openHour;
    this.state.time.minute = 0;
    this.customers = [];
    this.pendingOrders = [];
    return result;
  }

  _calcMonthSummary() {
    const lm = this.state.time.month === 1 ? 12 : this.state.time.month;
    const days = this.state.history.filter(h => h.date.month === lm);
    if (!days.length) return null;
    const rev = days.reduce((s, d) => s + d.revenue, 0);
    const cost = days.reduce((s, d) => s + d.cost, 0);
    const cust = days.reduce((s, d) => s + d.customers, 0);
    const best = days.reduce((b, d) => d.profit > b.profit ? d : b, days[0]);
    const ta = {};
    for (const d of days) for (const [k, v] of Object.entries(d.customerTypes || {})) ta[k] = (ta[k] || 0) + v;
    return { month: lm, days: days.length, revenue: rev, cost, profit: rev - cost, customers: cust, avgDailyRevenue: Math.round(rev / days.length), bestDayProfit: best.profit, customerTypes: ta };
  }
}
