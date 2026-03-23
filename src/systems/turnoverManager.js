export class TurnoverManager {
  constructor(state, compatManager) {
    this.state = state;
    this.compatManager = compatManager;
  }

  getQuitRisk(staff) {
    let risk = 0;

    // Low morale = high risk
    if (staff.morale < 20) risk += 40;
    else if (staff.morale < 40) risk += 20;
    else if (staff.morale < 55) risk += 8;

    // High fatigue
    if (staff.fatigue > 90) risk += 15;
    else if (staff.fatigue > 75) risk += 8;

    // Low pay relative to level
    const expectedSalary = 160000 + (staff.level - 1) * 30000;
    if (staff.salary < expectedSalary * 0.8) risk += 15;
    else if (staff.salary < expectedSalary * 0.9) risk += 5;

    // Bad team relationships
    const otherStaff = this.state.staff.filter(s => s.id !== staff.id);
    if (otherStaff.length > 0) {
      let avgCompat = 0;
      for (const other of otherStaff) {
        avgCompat += this.compatManager.getCompatibility(staff.id, other.id);
      }
      avgCompat /= otherStaff.length;
      if (avgCompat < -30) risk += 15;
      else if (avgCompat < -10) risk += 5;
      else if (avgCompat > 30) risk -= 5;
    }

    // Long tenure = slightly lower risk (loyalty)
    if (staff.daysWorked > 60) risk -= 5;
    if (staff.daysWorked > 120) risk -= 5;

    // Always off = unhappy
    if (staff.shift === "off") risk -= 3; // rest helps

    return Math.max(0, Math.min(100, risk));
  }

  getRiskLevel(risk) {
    if (risk >= 50) return { level: "danger", label: "危険", color: "#c94040", icon: "🔴" };
    if (risk >= 30) return { level: "warning", label: "注意", color: "#d4a843", icon: "🟡" };
    if (risk >= 10) return { level: "caution", label: "やや不満", color: "#a09080", icon: "⚪" };
    return { level: "safe", label: "安定", color: "#4aaa6a", icon: "🟢" };
  }

  dailyCheck() {
    const events = [];
    const quitters = [];

    for (const staff of [...this.state.staff]) {
      const risk = this.getQuitRisk(staff);

      // Daily quit probability = risk / 500 (so 50 risk = 10% daily)
      if (risk > 0 && Math.random() < risk / 500) {
        // Warning first (unless risk is extreme)
        if (risk >= 50 || staff._quitWarning) {
          quitters.push(staff);
        } else {
          staff._quitWarning = true;
          events.push({
            type: "warning",
            staffId: staff.id,
            staffName: staff.name,
            message: `${staff.name}が不満を漏らしています。対処しないと辞めてしまうかも…`,
            risk
          });
        }
      } else {
        // Reset warning if morale recovers
        if (staff.morale > 60 && staff._quitWarning) {
          delete staff._quitWarning;
        }
      }
    }

    return { events, quitters };
  }

  processQuit(staff) {
    const index = this.state.staff.findIndex(s => s.id === staff.id);
    if (index === -1) return null;
    if (this.state.staff.length <= 1) return null; // Never leave 0 staff

    this.state.staff.splice(index, 1);

    return {
      name: staff.name,
      role: staff.role,
      level: staff.level,
      reason: this._getQuitReason(staff)
    };
  }

  _getQuitReason(staff) {
    if (staff.morale < 25) return "士気の低下が限界に達した";
    if (staff.fatigue > 85) return "過労による身体の限界";

    const expectedSalary = 160000 + (staff.level - 1) * 30000;
    if (staff.salary < expectedSalary * 0.8) return "給与への不満";

    const otherStaff = this.state.staff.filter(s => s.id !== staff.id);
    if (otherStaff.length > 0) {
      let avgCompat = 0;
      for (const other of otherStaff) {
        avgCompat += this.compatManager.getCompatibility(staff.id, other.id);
      }
      if (avgCompat / otherStaff.length < -25) return "人間関係のストレス";
    }

    return "環境への不満が蓄積";
  }

  raiseSalary(staffId, amount) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフが見つかりません" };
    if (amount <= 0) return { success: false, reason: "昇給額を指定してください" };

    staff.salary += amount;
    staff.morale = Math.min(100, staff.morale + Math.floor(amount / 5000));
    delete staff._quitWarning;

    return { success: true, newSalary: staff.salary };
  }
}
