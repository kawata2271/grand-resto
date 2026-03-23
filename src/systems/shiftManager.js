export class ShiftManager {
  constructor(state, config) {
    this.state = state;
    this.config = config;
    this._ensureShiftData();
  }

  _ensureShiftData() {
    for (const staff of this.state.staff) {
      if (!staff.shift) {
        staff.shift = "full"; // full, morning, evening, off
      }
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

  getActiveStaff(hour) {
    return this.state.staff.filter(s => this.isWorking(s, hour));
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

  getShiftLabel(shift) {
    const labels = {
      full: "フル出勤",
      morning: "午前のみ",
      evening: "午後のみ",
      off: "休み"
    };
    return labels[shift] || shift;
  }

  getShiftIcon(shift) {
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
    }
    return Math.round(total);
  }
}
