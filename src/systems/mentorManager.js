export class MentorManager {
  constructor(state, compatManager) {
    this.state = state;
    this.compatManager = compatManager;
    this._ensureData();
  }

  _ensureData() {
    for (const staff of this.state.staff) {
      if (staff.mentorId === undefined) staff.mentorId = null;
      if (staff.apprenticeId === undefined) staff.apprenticeId = null;
    }
  }

  canBeMentor(staff) {
    return staff.level >= 3 && staff.apprenticeId === null && staff.mentorId === null;
  }

  canBeApprentice(staff) {
    return staff.level < 5 && staff.mentorId === null && staff.apprenticeId === null;
  }

  assignMentor(mentorId, apprenticeId) {
    const mentor = this.state.staff.find(s => s.id === mentorId);
    const apprentice = this.state.staff.find(s => s.id === apprenticeId);

    if (!mentor || !apprentice) return { success: false, reason: "スタッフが見つかりません" };
    if (mentor.role !== apprentice.role) return { success: false, reason: "同じ役職でないと師弟になれません" };
    if (!this.canBeMentor(mentor)) return { success: false, reason: "師匠の条件を満たしていません（Lv.3以上・他の師弟関係なし）" };
    if (!this.canBeApprentice(apprentice)) return { success: false, reason: "弟子の条件を満たしていません（Lv.5未満・他の師弟関係なし）" };

    mentor.apprenticeId = apprenticeId;
    apprentice.mentorId = mentorId;

    // Boost compatibility
    this.compatManager.changeCompatibility(mentorId, apprenticeId, 10);

    return { success: true, mentor, apprentice };
  }

  dissolvePair(staffId) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフが見つかりません" };

    let partnerId = staff.mentorId || staff.apprenticeId;
    if (!partnerId) return { success: false, reason: "師弟関係がありません" };

    const partner = this.state.staff.find(s => s.id === partnerId);
    staff.mentorId = null;
    staff.apprenticeId = null;
    if (partner) {
      partner.mentorId = null;
      partner.apprenticeId = null;
    }

    return { success: true };
  }

  getMentorPairs() {
    const pairs = [];
    const seen = new Set();
    for (const staff of this.state.staff) {
      if (staff.apprenticeId && !seen.has(staff.id)) {
        const apprentice = this.state.staff.find(s => s.id === staff.apprenticeId);
        if (apprentice) {
          pairs.push({ mentor: staff, apprentice });
          seen.add(staff.id);
          seen.add(apprentice.id);
        }
      }
    }
    return pairs;
  }

  dailyUpdate() {
    const events = [];
    const pairs = this.getMentorPairs();

    for (const { mentor, apprentice } of pairs) {
      // Both must be working (not off)
      if (mentor.shift === "off" || apprentice.shift === "off") continue;

      // Apprentice gets growth bonus
      const growthBonus = Math.max(1, Math.floor(mentor.level / 2));
      apprentice.experience += growthBonus;

      // Mentor's efficiency penalty (fatigue increase)
      mentor.fatigue = Math.min(100, mentor.fatigue + 5);

      // Compatibility improvement
      this.compatManager.changeCompatibility(mentor.id, apprentice.id, 1);

      // Random teaching events
      if (Math.random() < 0.1) {
        const statKeys = Object.keys(apprentice.stats);
        const rndStat = statKeys[Math.floor(Math.random() * statKeys.length)];
        const bonus = Math.floor(Math.random() * 3) + 1;
        apprentice.stats[rndStat] = Math.min(100, apprentice.stats[rndStat] + bonus);
        events.push(`${mentor.name}の指導で${apprentice.name}の${this._statLabel(rndStat)}が+${bonus}！`);
      }

      // Check if apprentice graduated
      if (apprentice.level >= 5) {
        events.push(`🎓 ${apprentice.name}が${mentor.name}の元を卒業！`);
        this.compatManager.changeCompatibility(mentor.id, apprentice.id, 15);
        mentor.apprenticeId = null;
        apprentice.mentorId = null;
      }
    }

    return events;
  }

  getEfficiencyPenalty(staff) {
    if (staff.apprenticeId) return -0.10; // Mentor: -10% efficiency
    return 0;
  }

  getGrowthMultiplier(staff) {
    if (staff.mentorId) return 1.5; // Apprentice: +50% growth
    return 1.0;
  }

  onStaffRemoved(staffId) {
    for (const staff of this.state.staff) {
      if (staff.mentorId === staffId) staff.mentorId = null;
      if (staff.apprenticeId === staffId) staff.apprenticeId = null;
    }
  }

  _statLabel(k) {
    return { stamina: "体力", dexterity: "器用さ", memory: "記憶力", strength: "筋力", communication: "接客力", sense: "感覚" }[k] || k;
  }
}
