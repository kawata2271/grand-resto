export class ShiftManager {
  constructor(state, config) {
    this.state = state;
    this.config = config;
    this._ensureShiftData();
  }

  _ensureShiftData() {
    for (const staff of this.state.staff) {
      if (!staff.shift) staff.shift = "full";
      if (staff.breakRemaining === undefined) staff.breakRemaining = 0;
      if (staff.weeklyHours === undefined) staff.weeklyHours = 0;
      if (staff.overtimeHours === undefined) staff.overtimeHours = 0;
      if (staff.paidLeave === undefined) staff.paidLeave = 0;
      if (staff.isTrainee === undefined) staff.isTrainee = false;
      if (staff.traineeDay === undefined) staff.traineeDay = 0;
    }
  }

  setShift(staffId, shift) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフが見つかりません" };

    const valid = ["full", "morning", "evening", "off"];
    if (!valid.includes(shift)) return { success: false, reason: "無効なシフトです" };

    const workingCount = this.state.staff.filter(s =>
      s.id !== staffId && s.shift !== "off"
    ).length;
    if (shift === "off" && workingCount === 0) {
      return { success: false, reason: "全員休みにはできません" };
    }

    staff.shift = shift;
    return { success: true };
  }

  // ─── 休憩システム ───
  sendOnBreak(staffId, minutes = 30) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフが見つかりません" };
    if (staff.shift === "off") return { success: false, reason: "休みのスタッフは休憩不要です" };
    if (staff.breakRemaining > 0) return { success: false, reason: "すでに休憩中です" };

    // Ensure at least 1 working staff of same role remains
    const hour = this.state.time?.hour || 12;
    const sameRoleWorking = this.state.staff.filter(s =>
      s.id !== staffId && s.role === staff.role && this.isWorking(s, hour) && s.breakRemaining <= 0
    );
    if (sameRoleWorking.length === 0) {
      return { success: false, reason: `他に稼働中の${staff.role === "cook" ? "料理人" : "ホール"}がいません` };
    }

    staff.breakRemaining = minutes;
    return { success: true, name: staff.name, minutes };
  }

  cancelBreak(staffId) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフが見つかりません" };
    if (staff.breakRemaining <= 0) return { success: false, reason: "休憩中ではありません" };

    staff.breakRemaining = 0;
    return { success: true, name: staff.name };
  }

  tickBreaks(tickMinutes) {
    const events = [];
    for (const staff of this.state.staff) {
      if (staff.breakRemaining > 0) {
        // Recover fatigue during break
        staff.fatigue = Math.max(0, staff.fatigue - 8);
        staff.morale = Math.min(100, staff.morale + 1);

        staff.breakRemaining -= tickMinutes;
        if (staff.breakRemaining <= 0) {
          staff.breakRemaining = 0;
          events.push(`☕ ${staff.name}が休憩から復帰`);
        }
      }
    }
    return events;
  }

  isOnBreak(staff) {
    return (staff.breakRemaining || 0) > 0;
  }

  getActiveStaff(hour) {
    return this.state.staff.filter(s => this.isWorking(s, hour) && !this.isOnBreak(s));
  }

  isWorking(staff, hour) {
    if (!staff.shift || staff.shift === "full") return true;
    if (staff.shift === "off") return false;

    const midpoint = Math.floor(
      (this.config.simulation.openHour + this.config.simulation.closeHour) / 2
    );

    if (staff.shift === "morning") return hour < midpoint;
    if (staff.shift === "evening") return hour >= midpoint;
    return true;
  }

  getDailySalaryMultiplier(staff) {
    switch (staff.shift) {
      case "off": return 0;
      case "morning": return 0.55;
      case "evening": return 0.55;
      default: return 1.0;
    }
  }

  getFatigueMult(staff) {
    switch (staff.shift) {
      case "off": return 0;
      case "morning": return 0.6;
      case "evening": return 0.6;
      default: return 1.0;
    }
  }

  getShiftLabel(shift, staff) {
    if (staff && this.isOnBreak(staff)) return `休憩中(残${staff.breakRemaining}分)`;
    const labels = {
      full: "フル出勤",
      morning: "午前のみ",
      evening: "午後のみ",
      off: "休み"
    };
    return labels[shift] || shift;
  }

  getShiftIcon(shift, staff) {
    if (staff && this.isOnBreak(staff)) return "☕";
    const icons = { full: "🔵", morning: "🌅", evening: "🌆", off: "💤" };
    return icons[shift] || "?";
  }

  getStaffSummary() {
    const counts = { full: 0, morning: 0, evening: 0, off: 0 };
    for (const s of this.state.staff) {
      counts[s.shift || "full"]++;
    }
    return counts;
  }

  estimateDailyCost() {
    let total = 0;
    for (const s of this.state.staff) {
      total += (s.salary / 30) * this.getDailySalaryMultiplier(s);
      // Overtime premium (25% extra)
      if (s.overtimeHours > 0) total += (s.salary / 30 / 8) * s.overtimeHours * 0.25;
    }
    return Math.round(total);
  }

  // ─── 労基法対応 ───

  // Get working hours for shift type (per day)
  getShiftHours(shift) {
    switch (shift) {
      case "full": return 10; // 10:00-22:00 with breaks = ~10h working
      case "morning": return 6;
      case "evening": return 6;
      case "off": return 0;
      default: return 8;
    }
  }

  // Daily update: track weekly hours, overtime, trainee progress
  dailyLaborUpdate() {
    const events = [];
    const WEEKLY_LIMIT = 40;
    const OVERTIME_WARN = 35;

    for (const s of this.state.staff) {
      const hours = this.getShiftHours(s.shift);

      // Track weekly hours (reset every 7 days)
      if ((this.state.stats.daysPlayed % 7) === 0) {
        s.weeklyHours = 0;
        s.overtimeHours = 0;
      }
      s.weeklyHours += hours;

      // Overtime calculation
      if (s.weeklyHours > WEEKLY_LIMIT) {
        const overtime = s.weeklyHours - WEEKLY_LIMIT;
        s.overtimeHours = overtime;
        if (overtime > 10) {
          s.morale = Math.max(0, s.morale - 3);
          events.push(`⚠️ ${s.name}の残業が${overtime}hに。離職リスク上昇`);
        }
      }

      // Overtime warning
      if (s.weeklyHours >= OVERTIME_WARN && s.weeklyHours < WEEKLY_LIMIT) {
        events.push(`⏰ ${s.name}の週労働${s.weeklyHours}h（上限${WEEKLY_LIMIT}h）`);
      }

      // Paid leave accrual (1 day per 30 working days)
      if (s.daysWorked > 0 && s.daysWorked % 30 === 0) {
        s.paidLeave = Math.min(20, (s.paidLeave || 0) + 1);
      }

      // Trainee progress
      if (s.isTrainee) {
        s.traineeDay++;
        if (s.traineeDay >= 14) {
          s.isTrainee = false;
          events.push(`🎓 ${s.name}の研修期間が終了。即戦力に！`);
        }
      }

      // Mandatory rest: if worked 6+ days in a row, force off
      if (s.shift !== "off" && s._consecutiveWorkDays === undefined) s._consecutiveWorkDays = 0;
      if (s.shift !== "off") {
        s._consecutiveWorkDays = (s._consecutiveWorkDays || 0) + 1;
        if (s._consecutiveWorkDays >= 6) {
          events.push(`⚠️ ${s.name}は6連勤。法定休日を取らせてください`);
          s.morale = Math.max(0, s.morale - 2);
        }
      } else {
        s._consecutiveWorkDays = 0;
      }
    }

    return events;
  }

  // Take paid leave
  usePaidLeave(staffId) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフが見つかりません" };
    if ((staff.paidLeave || 0) <= 0) return { success: false, reason: "有給休暇がありません" };
    if (staff.shift === "off") return { success: false, reason: "すでに休みです" };

    staff.paidLeave--;
    staff.shift = "off";
    staff.morale = Math.min(100, staff.morale + 8);
    staff.fatigue = Math.max(0, staff.fatigue - 20);
    return { success: true, remaining: staff.paidLeave };
  }

  // Mark new hire as trainee
  markAsTrainee(staffId) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (staff) {
      staff.isTrainee = true;
      staff.traineeDay = 0;
    }
  }

  // Get trainee efficiency (50% during training)
  getTraineeEfficiency(staff) {
    return staff.isTrainee ? 0.5 : 1.0;
  }

  // Get labor law summary
  getLaborSummary() {
    return this.state.staff.map(s => ({
      id: s.id,
      name: s.name,
      weeklyHours: s.weeklyHours || 0,
      overtimeHours: s.overtimeHours || 0,
      paidLeave: s.paidLeave || 0,
      isTrainee: s.isTrainee || false,
      traineeDay: s.traineeDay || 0,
      consecutiveWork: s._consecutiveWorkDays || 0,
      isOvertime: (s.weeklyHours || 0) > 40,
      needsRest: (s._consecutiveWorkDays || 0) >= 6
    }));
  }
}
