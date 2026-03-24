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
        completedToday: [],
        lastGrillTrap: 0,
        lastDuct: 0,
        lastPest: 0,
        shutdownDays: 0
      };
      for (const area of this.data.areas) {
        this.state.cleaning.areas[area.id] = 70; // Start at 70% cleanliness
      }
    }
  }

  // Get cleanliness of an area (0-100)
  getCleanliness(areaId) {
    return this.state.cleaning.areas[areaId] || 0;
  }

  // Get overall cleanliness average
  getOverallCleanliness() {
    const areas = Object.values(this.state.cleaning.areas);
    if (areas.length === 0) return 0;
    return Math.round(areas.reduce((a, b) => a + b, 0) / areas.length);
  }

  // Get available tasks for today
  getAvailableTasks() {
    const day = this.state.stats.daysPlayed;
    const dayOfWeek = (this.state.time.day - 1) % 7; // 0-6

    return this.data.tasks.map(t => {
      let available = true;
      let reason = "";

      if (t.dayRestriction && !t.dayRestriction.includes(dayOfWeek)) {
        available = false;
        reason = "今日はゴミ収集日ではありません";
      }

      const completed = this.state.cleaning.completedToday.includes(t.id);
      const areaClean = this.state.cleaning.areas[t.area] || 0;

      return {
        ...t,
        available,
        reason,
        completed,
        areaClean: Math.round(areaClean),
        isOutsource: !!t.outsourceCost
      };
    });
  }

  // Execute a cleaning task
  doTask(taskId, staffId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task) return { success: false, reason: "タスクが見つかりません" };

    if (this.state.cleaning.completedToday.includes(taskId)) {
      return { success: false, reason: "今日はすでに実施済みです" };
    }

    // Outsource tasks
    if (task.outsourceCost) {
      if (this.state.restaurant.money < task.outsourceCost) {
        return { success: false, reason: `資金不足（¥${task.outsourceCost.toLocaleString()}）` };
      }
      this.state.restaurant.money -= task.outsourceCost;
      this.state.cleaning.areas[task.area] = Math.min(100,
        (this.state.cleaning.areas[task.area] || 0) + task.cleanAmount);
      this.state.cleaning.completedToday.push(taskId);

      if (task.id === "task_grease_trap") this.state.cleaning.lastGrillTrap = this.state.stats.daysPlayed;
      if (task.id === "task_duct") this.state.cleaning.lastDuct = this.state.stats.daysPlayed;
      if (task.id === "task_pest_control") this.state.cleaning.lastPest = this.state.stats.daysPlayed;

      return { success: true, outsourced: true, cost: task.outsourceCost, area: task.area };
    }

    // Staff task
    if (staffId) {
      const staff = this.state.staff.find(s => s.id === staffId);
      if (!staff) return { success: false, reason: "スタッフが見つかりません" };
      staff.fatigue = Math.min(100, staff.fatigue + Math.round(task.time / 5));
    }

    // Apply cleaning
    this.state.cleaning.areas[task.area] = Math.min(100,
      (this.state.cleaning.areas[task.area] || 0) + task.cleanAmount);
    this.state.cleaning.completedToday.push(taskId);

    if (task.id === "task_grease_trap") this.state.cleaning.lastGrillTrap = this.state.stats.daysPlayed;

    return { success: true, outsourced: false, area: task.area, cleanAmount: task.cleanAmount };
  }

  // Quick clean all daily tasks (auto-assign)
  quickCleanAll() {
    const results = [];
    const dailyTasks = this.data.tasks.filter(t => t.daily && !t.outsourceCost);
    let staffIdx = 0;
    const availableStaff = this.state.staff.filter(s => s.shift !== "off");

    for (const task of dailyTasks) {
      if (this.state.cleaning.completedToday.includes(task.id)) continue;

      const staff = availableStaff[staffIdx % availableStaff.length];
      staffIdx++;
      if (staff) {
        const r = this.doTask(task.id, staff.id);
        if (r.success) results.push(task.name);
      }
    }

    return results;
  }

  // Daily decay + events
  dailyUpdate() {
    const events = [];
    const day = this.state.stats.daysPlayed;

    // Shutdown check
    if (this.state.cleaning.shutdownDays > 0) {
      this.state.cleaning.shutdownDays--;
      if (this.state.cleaning.shutdownDays > 0) {
        events.push(`🚫 営業停止中（残${this.state.cleaning.shutdownDays}日）`);
      } else {
        events.push(`✅ 営業停止が解除されました`);
      }
    }

    // Decay cleanliness
    const customerCount = this.state.todayLog?.customers || 0;
    const busyMult = customerCount > 30 ? 1.5 : 1.0;

    for (const area of this.data.areas) {
      const decay = area.decayRate * busyMult;
      this.state.cleaning.areas[area.id] = Math.max(0,
        (this.state.cleaning.areas[area.id] || 0) - decay);
    }

    // Reset daily completed
    this.state.cleaning.completedToday = [];

    // Grease trap skip penalty
    if (day - this.state.cleaning.lastGrillTrap > 10) {
      const pestData = this.data.pestRisk;
      const kitchenClean = this.state.cleaning.areas.kitchen || 0;
      const chance = pestData.baseChance * (kitchenClean < 30 ? pestData.dirtyMultiplier : 1);
      if (Math.random() < chance) {
        events.push(`🪳 害虫が発生！駆除費用¥${pestData.costToRemove.toLocaleString()} / 評判${pestData.reputationHit}`);
        this.state.restaurant.money -= pestData.costToRemove;
        this.state.restaurant.reputation = Math.max(0, this.state.restaurant.reputation + pestData.reputationHit);
      }
    }

    // Health inspection (random)
    const inspData = this.data.healthInspection;
    if (Math.random() < inspData.baseChance) {
      const overall = this.getOverallCleanliness();
      if (overall < inspData.failThreshold) {
        let severity;
        if (overall < 20) severity = "critical";
        else if (overall < 30) severity = "major";
        else severity = "minor";

        this.state.cleaning.shutdownDays = inspData.shutdownDays[severity];
        this.state.restaurant.reputation = Math.max(0,
          this.state.restaurant.reputation + inspData.penaltyReputation[severity]);
        events.push(`🏥 保健所検査不合格！（${severity}）${this.state.cleaning.shutdownDays}日間の営業停止`);
      } else {
        events.push(`🏥 保健所の抜き打ち検査——合格！清潔度${overall}%`);
        this.state.restaurant.reputation = Math.min(100, this.state.restaurant.reputation + 2);
      }
    }

    return events;
  }

  // Is the store shut down?
  isShutdown() {
    return this.state.cleaning.shutdownDays > 0;
  }

  // Customer satisfaction modifier from cleanliness
  getSatisfactionModifier() {
    let mod = 0;
    for (const area of this.data.areas) {
      const clean = this.state.cleaning.areas[area.id] || 0;
      // 70+ = no impact, below 70 = penalty, below 40 = severe
      if (clean < 40) mod -= area.customerImpact * 30;
      else if (clean < 70) mod -= area.customerImpact * 10;
      else if (clean >= 90) mod += area.customerImpact * 5;
    }
    return Math.round(mod);
  }

  // Get area summaries for UI
  getAreaSummaries() {
    return this.data.areas.map(a => ({
      ...a,
      cleanliness: Math.round(this.state.cleaning.areas[a.id] || 0)
    }));
  }
}
