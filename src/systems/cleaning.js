export class CleaningManager {
  constructor(state, cleaningData) {
    this.state = state;
    this.data = cleaningData;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.cleaning) {
      this.state.cleaning = {
        areas: {},
        hygieneScore: 70,
        completedToday: [],
        closingCompleted: [],
        periodicLastDone: {},
        outsourceContracts: [],
        ownedEquipment: [],
        activeConsumables: [],
        shutdownDays: 0,
        cleaningRotation: {},
        totalTasksDone: 0
      };
      for (const area of this.data.areas) {
        this.state.cleaning.areas[area.id] = 70;
      }
    }
    // Ensure staff stamina
    for (const staff of this.state.staff) {
      if (staff.stamina === undefined) staff.stamina = 100;
      if (staff.maxStamina === undefined) staff.maxStamina = 100;
      if (staff.cleaningTaskCount === undefined) staff.cleaningTaskCount = 0;
    }
  }

  // ═══ STAMINA ═══

  getStaffStamina(staff) {
    return staff.stamina || 100;
  }

  getStaminaStatus(staff) {
    const s = staff.stamina || 100;
    const cfg = this.data.staminaConfig;
    if (s <= cfg.criticalThreshold) return { level: "critical", label: "🥵限界", color: "#c94040" };
    if (s <= cfg.fatigueThreshold) return { level: "fatigue", label: "😓疲労", color: "#d4a843" };
    return { level: "ok", label: "", color: "#4aaa6a" };
  }

  getEffectiveStaminaCost(staff, baseCost) {
    let cost = baseCost;
    // Veteran reduction
    if (staff.daysWorked >= this.data.staminaConfig.veteranDaysThreshold) {
      cost *= (1 - this.data.staminaConfig.veteranReduction);
    }
    // Equipment reduction
    return Math.round(cost);
  }

  _getEquipmentReduction(taskId) {
    let reduction = 0;
    for (const eqId of this.state.cleaning.ownedEquipment) {
      const eq = this.data.cleaningEquipment.find(e => e.id === eqId);
      if (eq?.effect?.targets?.includes(taskId)) {
        reduction = Math.max(reduction, eq.effect.staminaReduction || 0);
      }
    }
    return reduction;
  }

  _getConsumableBonus() {
    const active = this.state.cleaning.activeConsumables;
    return {
      staminaAllPct: active.includes("con_gloves") ? 0.10 : 0,
      timeAllPct: active.includes("con_detergent") ? 0.20 : 0,
      hygieneBonus: active.includes("con_spray") ? 1 : 0,
      spillStamina: active.includes("con_paper_towel") ? 0.30 : 0,
      trashStamina: active.includes("con_trash_bags") ? 0.20 : 0,
      toiletExtend: active.includes("con_freshener")
    };
  }

  _isOutsourced(taskId) {
    for (const contractId of this.state.cleaning.outsourceContracts) {
      const pkg = this.data.outsourcePackages.find(p => p.id === contractId);
      if (pkg?.covers?.includes(taskId)) return pkg;
    }
    return null;
  }

  // ═══ TASK EXECUTION ═══

  doClosingTask(taskId, staffId) {
    const task = this.data.closingTasks.find(t => t.id === taskId);
    if (!task) return { success: false, reason: "タスクが見つかりません" };
    if (this.state.cleaning.closingCompleted.includes(taskId)) return { success: false, reason: "実施済み" };

    // Check outsource
    const outsourced = this._isOutsourced(taskId);
    if (outsourced) {
      this.state.cleaning.areas[task.area] = Math.min(100,
        (this.state.cleaning.areas[task.area] || 0) + Math.round(task.cleanAmount * outsourced.quality));
      this.state.cleaning.closingCompleted.push(taskId);
      return { success: true, outsourced: true, staffStamina: null };
    }

    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフを指定してください" };
    if (staff.stamina <= 0) return { success: false, reason: `${staff.name}は体力切れです` };

    // Calculate stamina cost
    let staminaCost = task.staminaCost;
    const eqReduction = this._getEquipmentReduction(taskId);
    staminaCost = Math.round(staminaCost * (1 - eqReduction));
    const consumables = this._getConsumableBonus();
    staminaCost = Math.round(staminaCost * (1 - consumables.staminaAllPct));
    staminaCost = this.getEffectiveStaminaCost(staff, staminaCost);

    staff.stamina = Math.max(0, staff.stamina - staminaCost);
    staff.cleaningTaskCount++;

    this.state.cleaning.areas[task.area] = Math.min(100,
      (this.state.cleaning.areas[task.area] || 0) + task.cleanAmount);
    this.state.cleaning.closingCompleted.push(taskId);
    this.state.cleaning.totalTasksDone++;

    // Rotation tracking
    if (!this.state.cleaning.cleaningRotation[staff.id]) this.state.cleaning.cleaningRotation[staff.id] = 0;
    this.state.cleaning.cleaningRotation[staff.id]++;

    return { success: true, outsourced: false, staminaCost, staffStamina: staff.stamina, staffName: staff.name };
  }

  doPeriodicTask(taskId, staffId) {
    const task = this.data.periodicTasks.find(t => t.id === taskId);
    if (!task) return { success: false, reason: "タスクが見つかりません" };

    const outsourced = this._isOutsourced(taskId);
    if (outsourced) {
      this.state.cleaning.areas[task.area] = Math.min(100,
        (this.state.cleaning.areas[task.area] || 0) + task.cleanAmount);
      this.state.cleaning.periodicLastDone[taskId] = this.state.stats.daysPlayed;
      return { success: true, outsourced: true };
    }

    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフを指定してください" };

    let staminaCost = this.getEffectiveStaminaCost(staff, task.staminaCost);
    const eqReduction = this._getEquipmentReduction(taskId);
    staminaCost = Math.round(staminaCost * (1 - eqReduction));

    if (staff.stamina < staminaCost) return { success: false, reason: `${staff.name}の体力が足りません` };

    staff.stamina = Math.max(0, staff.stamina - staminaCost);
    staff.cleaningTaskCount++;
    this.state.cleaning.areas[task.area] = Math.min(100,
      (this.state.cleaning.areas[task.area] || 0) + task.cleanAmount);
    this.state.cleaning.periodicLastDone[taskId] = this.state.stats.daysPlayed;
    this.state.cleaning.totalTasksDone++;

    return { success: true, staminaCost, staffStamina: staff.stamina };
  }

  // ═══ QUICK ACTIONS ═══

  quickCloseAll() {
    const results = [];
    const staff = this.state.staff.filter(s => s.shift !== "off" && s.stamina > 10);
    let staffIdx = 0;

    for (const task of this.data.closingTasks) {
      if (this.state.cleaning.closingCompleted.includes(task.id)) continue;
      if (this._isOutsourced(task.id)) {
        const r = this.doClosingTask(task.id, null);
        if (r.success) results.push({ task: task.name, outsourced: true });
        continue;
      }
      if (staff.length === 0) continue;
      const s = staff[staffIdx % staff.length];
      staffIdx++;
      const r = this.doClosingTask(task.id, s.id);
      if (r.success) results.push({ task: task.name, staff: r.staffName, stamina: r.staminaCost });
    }
    return results;
  }

  // ═══ OUTSOURCE & EQUIPMENT ═══

  subscribeOutsource(packageId) {
    const pkg = this.data.outsourcePackages.find(p => p.id === packageId);
    if (!pkg) return { success: false, reason: "プランが見つかりません" };
    if (pkg.oneshot) {
      if (this.state.restaurant.money < pkg.cost) return { success: false, reason: "資金不足" };
      this.state.restaurant.money -= pkg.cost;
      return { success: true, cost: pkg.cost };
    }
    if (this.state.cleaning.outsourceContracts.includes(packageId)) return { success: false, reason: "契約済み" };
    this.state.cleaning.outsourceContracts.push(packageId);
    return { success: true, monthlyCost: pkg.monthlyCost };
  }

  cancelOutsource(packageId) {
    const idx = this.state.cleaning.outsourceContracts.indexOf(packageId);
    if (idx === -1) return { success: false, reason: "契約なし" };
    this.state.cleaning.outsourceContracts.splice(idx, 1);
    return { success: true };
  }

  purchaseEquipment(eqId) {
    const eq = this.data.cleaningEquipment.find(e => e.id === eqId);
    if (!eq) return { success: false, reason: "設備が見つかりません" };
    if (this.state.cleaning.ownedEquipment.includes(eqId)) return { success: false, reason: "導入済み" };
    if (this.state.restaurant.money < eq.cost) return { success: false, reason: `資金不足（¥${eq.cost.toLocaleString()}）` };
    this.state.restaurant.money -= eq.cost;
    this.state.cleaning.ownedEquipment.push(eqId);
    return { success: true, equipment: eq };
  }

  toggleConsumable(conId) {
    const idx = this.state.cleaning.activeConsumables.indexOf(conId);
    if (idx >= 0) {
      this.state.cleaning.activeConsumables.splice(idx, 1);
      return { active: false };
    }
    this.state.cleaning.activeConsumables.push(conId);
    return { active: true };
  }

  // ═══ DAILY UPDATE ═══

  dailyUpdate() {
    const events = [];
    const day = this.state.stats.daysPlayed;
    const customers = this.state.todayLog?.customers || 0;
    const busyMult = customers > 30 ? 1.3 : 1.0;

    // Shutdown check
    if (this.state.cleaning.shutdownDays > 0) {
      this.state.cleaning.shutdownDays--;
      events.push(this.state.cleaning.shutdownDays > 0
        ? `🚫 営業停止中（残${this.state.cleaning.shutdownDays}日）`
        : `✅ 営業停止解除`);
    }

    // Hygiene score update
    const closingDone = this.state.cleaning.closingCompleted.length;
    const closingTotal = this.data.closingTasks.length;
    const missedTasks = closingTotal - closingDone;

    const cfg = this.data.hygieneScore;
    if (missedTasks === 0) {
      this.state.cleaning.hygieneScore = Math.min(100, this.state.cleaning.hygieneScore + cfg.allTasksBonus);
    } else {
      this.state.cleaning.hygieneScore = Math.max(0,
        this.state.cleaning.hygieneScore - missedTasks * cfg.missedTaskPenalty);
    }

    // Consumable hygiene bonus
    const conBonus = this._getConsumableBonus();
    this.state.cleaning.hygieneScore = Math.min(100, this.state.cleaning.hygieneScore + conBonus.hygieneBonus);

    // Outsource hygiene bonus
    for (const cid of this.state.cleaning.outsourceContracts) {
      const pkg = this.data.outsourcePackages.find(p => p.id === cid);
      if (pkg?.hygieneBonus) this.state.cleaning.hygieneScore = Math.min(100, this.state.cleaning.hygieneScore + pkg.hygieneBonus);
    }

    // Area decay
    for (const area of this.data.areas) {
      const decay = area.decayRate * busyMult;
      this.state.cleaning.areas[area.id] = Math.max(0,
        (this.state.cleaning.areas[area.id] || 0) - decay);
    }

    // Health inspection
    const hs = this.state.cleaning.hygieneScore;
    const inspData = this.data.healthInspection;
    const inspChance = hs < 40 ? inspData.baseChance * inspData.lowHygieneMultiplier : inspData.baseChance;
    if (Math.random() < inspChance) {
      if (hs < 20) {
        this.state.cleaning.shutdownDays = inspData.shutdownDays.shutdown;
        this.state.restaurant.reputation += inspData.penaltyReputation.shutdown;
        events.push(`🚨 保健所検査不合格！${inspData.shutdownDays.shutdown}日間営業停止`);
      } else if (hs < 40) {
        this.state.cleaning.shutdownDays = inspData.shutdownDays.order;
        this.state.restaurant.reputation += inspData.penaltyReputation.order;
        events.push(`⚠️ 保健所から改善命令（${inspData.shutdownDays.order}日間営業停止）`);
      } else {
        this.state.restaurant.reputation = Math.min(100, this.state.restaurant.reputation + 2);
        events.push(`✅ 保健所検査合格！衛生スコア${hs}%`);
      }
    }

    // Forced shutdown
    if (hs < cfg.forcedShutdownThreshold && this.state.cleaning.shutdownDays === 0) {
      this.state.cleaning.shutdownDays = 3;
      events.push(`🚫 衛生スコア${hs}%で強制営業停止！`);
    }

    // Monthly outsource cost
    let monthlyCost = 0;
    for (const cid of this.state.cleaning.outsourceContracts) {
      const pkg = this.data.outsourcePackages.find(p => p.id === cid);
      if (pkg?.monthlyCost) monthlyCost += pkg.monthlyCost;
    }
    // Consumable cost
    for (const conId of this.state.cleaning.activeConsumables) {
      const con = this.data.consumables.find(c => c.id === conId);
      if (con?.monthlyCost) monthlyCost += con.monthlyCost;
    }
    if (monthlyCost > 0) {
      this.state.restaurant.money -= Math.round(monthlyCost / 30);
    }

    // Staff stamina recovery (start of day)
    for (const staff of this.state.staff) {
      if (staff.shift === "off") {
        staff.stamina = staff.maxStamina || 100;
      } else {
        // Partial recovery
        const consecutive = staff._consecutiveWorkDays || 0;
        const penalties = this.data.staminaConfig.consecutiveWorkPenalty;
        const recoveryRate = penalties[Math.min(consecutive, penalties.length - 1)] || 0.4;
        staff.stamina = Math.min(staff.maxStamina || 100, Math.round((staff.maxStamina || 100) * recoveryRate));
      }
    }

    // Reset daily tracking
    this.state.cleaning.completedToday = [];
    this.state.cleaning.closingCompleted = [];

    return events;
  }

  // ═══ TICK (during service) ═══

  processTick(tickMinutes) {
    const events = [];
    const customers = this.state.todayLog?.customers || 0;
    const hour = this.state.time.hour;

    // Normal work stamina drain
    for (const staff of this.state.staff) {
      if (staff.shift === "off" || (staff.breakRemaining || 0) > 0) continue;
      const drain = customers > 20 ? this.data.staminaConfig.busyWorkDrain : this.data.staminaConfig.normalWorkDrain;
      staff.stamina = Math.max(0, (staff.stamina || 100) - drain * (tickMinutes / 60));

      // Critical stamina events
      if (staff.stamina <= 0 && !staff._sentHome) {
        staff._sentHome = true;
        events.push(`⚠️ ${staff.name}が体力切れで早退`);
      }
      if (staff.stamina <= 10 && staff.stamina > 0 && Math.random() < 0.1) {
        events.push(`💥 ${staff.name}がミス（体力${Math.round(staff.stamina)}）`);
      }
    }

    return events;
  }

  // ═══ GETTERS ═══

  getHygieneScore() { return Math.round(this.state.cleaning.hygieneScore); }
  getOverallCleanliness() {
    const areas = Object.values(this.state.cleaning.areas);
    return areas.length ? Math.round(areas.reduce((a, b) => a + b, 0) / areas.length) : 0;
  }
  isShutdown() { return this.state.cleaning.shutdownDays > 0; }

  getCustomerFlowModifier() {
    const hs = this.state.cleaning.hygieneScore;
    const cfg = this.data.hygieneScore;
    if (hs >= cfg.cleanBonusThreshold) return 1 + cfg.cleanBonusEffect;
    if (hs < cfg.dirtyThreshold) return 1 + cfg.dirtyPenaltyEffect;
    return 1.0;
  }

  getAreaSummaries() {
    return this.data.areas.map(a => ({
      ...a,
      cleanliness: Math.round(this.state.cleaning.areas[a.id] || 0)
    }));
  }

  getClosingTaskStatus() {
    return this.data.closingTasks.map(t => ({
      ...t,
      completed: this.state.cleaning.closingCompleted.includes(t.id),
      outsourced: !!this._isOutsourced(t.id),
      equipReduction: this._getEquipmentReduction(t.id)
    }));
  }

  getPeriodicTaskStatus() {
    const day = this.state.stats.daysPlayed;
    return this.data.periodicTasks.map(t => {
      const lastDone = this.state.cleaning.periodicLastDone[t.id] || 0;
      const daysSince = day - lastDone;
      const freqDays = t.frequency === "weekly" ? 7 : t.frequency === "biweekly" ? 14 : 30;
      return { ...t, lastDone, daysSince, overdue: daysSince >= freqDays, outsourced: !!this._isOutsourced(t.id) };
    });
  }

  getOutsourceStatus() {
    return this.data.outsourcePackages.map(p => ({
      ...p,
      active: this.state.cleaning.outsourceContracts.includes(p.id)
    }));
  }

  getEquipmentStatus() {
    return this.data.cleaningEquipment.map(e => ({
      ...e,
      owned: this.state.cleaning.ownedEquipment.includes(e.id)
    }));
  }

  getConsumableStatus() {
    return this.data.consumables.map(c => ({
      ...c,
      active: this.state.cleaning.activeConsumables.includes(c.id)
    }));
  }

  getSatisfactionModifier() {
    const hs = this.state.cleaning.hygieneScore;
    if (hs >= 80) return 5;
    if (hs < 40) return -15;
    if (hs < 60) return -5;
    return 0;
  }

  getMonthlyCost() {
    let cost = 0;
    for (const cid of this.state.cleaning.outsourceContracts) {
      const pkg = this.data.outsourcePackages.find(p => p.id === cid);
      if (pkg?.monthlyCost) cost += pkg.monthlyCost;
    }
    for (const conId of this.state.cleaning.activeConsumables) {
      const con = this.data.consumables.find(c => c.id === conId);
      if (con?.monthlyCost) cost += con.monthlyCost;
    }
    return cost;
  }
}
