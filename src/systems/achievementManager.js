export class AchievementManager {
  constructor(state, achievementsData) {
    this.state = state;
    this.achievements = achievementsData.achievements;
    if (!this.state.unlockedAchievements) this.state.unlockedAchievements = [];
  }

  checkAll(dayReport) {
    const newlyUnlocked = [];

    for (const ach of this.achievements) {
      if (this.state.unlockedAchievements.includes(ach.id)) continue;

      if (this._checkCondition(ach.check, dayReport)) {
        this.state.unlockedAchievements.push(ach.id);
        newlyUnlocked.push(ach);
      }
    }

    return newlyUnlocked;
  }

  _checkCondition(check, dayReport) {
    const s = this.state;
    switch (check.type) {
      case "days_played":
        return s.stats.daysPlayed >= check.value;
      case "daily_profit_positive":
        return dayReport && dayReport.profit > 0;
      case "daily_revenue":
        return dayReport && dayReport.revenue >= check.value;
      case "monthly_revenue":
        return dayReport?.monthSummary && dayReport.monthSummary.revenue >= check.value;
      case "money":
        return s.restaurant.money >= check.value;
      case "reputation":
        return s.restaurant.reputation >= check.value;
      case "staff_count":
        return s.staff.length >= check.value;
      case "staff_level":
        return s.staff.some(st => st.level >= check.value);
      case "has_mentor_pair":
        return s.staff.some(st => st.mentorId || st.apprenticeId);
      case "active_menus":
        return s.restaurant.activeMenuIds.length >= check.value;
      case "discovered_recipes":
        return (s.discoveredRecipes?.length || 0) >= check.value;
      case "total_customers":
        return s.stats.totalCustomers >= check.value;
      case "daily_no_lost":
        return dayReport && (dayReport.lostCustomers || 0) === 0 && dayReport.customers > 0;
      case "tables":
        return s.restaurant.tables.length >= check.value;
      case "prestige_level":
        return (s.prestige?.level || 0) >= check.value;
      case "consecutive_profit_days": {
        const hist = s.history || [];
        let streak = 0;
        for (let i = hist.length - 1; i >= 0; i--) {
          if (hist[i].profit > 0) streak++;
          else break;
        }
        return streak >= check.value;
      }
      case "all_customer_types": {
        const types = new Set();
        for (const d of (s.history || [])) {
          for (const k of Object.keys(d.customerTypes || {})) types.add(k);
        }
        return types.size >= 8;
      }
      case "daily_customers":
        return dayReport && dayReport.customers >= check.value;
      case "staff_all_level":
        return s.staff.length >= 2 && s.staff.every(st => st.level >= check.value);
      case "rival_count":
        return (s.rivals?.length || 0) >= check.value;
      case "total_recipes":
        return (s.discoveredRecipes?.length || 0) >= 20;
      case "format_changes":
        return (s.formatChangeCount || 0) >= check.value;
      case "seasons_experienced": {
        const months = new Set((s.history || []).map(d => d.date.month));
        let count = 0;
        if ([3,4,5].some(m => months.has(m))) count++;
        if ([6,7,8].some(m => months.has(m))) count++;
        if ([9,10,11].some(m => months.has(m))) count++;
        if ([12,1,2].some(m => months.has(m))) count++;
        return count >= Math.min(check.value, 4);
      }
      default:
        return false;
    }
  }

  getAll() {
    return this.achievements.map(a => ({
      ...a,
      unlocked: this.state.unlockedAchievements.includes(a.id)
    }));
  }

  getUnlockedCount() {
    return this.state.unlockedAchievements.length;
  }

  getTotalCount() {
    return this.achievements.length;
  }

  getByCategory() {
    const cats = {};
    for (const a of this.getAll()) {
      if (!cats[a.category]) cats[a.category] = [];
      cats[a.category].push(a);
    }
    return cats;
  }

  getCategoryLabel(cat) {
    const labels = {
      milestone: "マイルストーン",
      economy: "経済",
      reputation: "評判",
      staff: "スタッフ",
      menu: "メニュー",
      customer: "客",
      facility: "設備",
      prestige: "プレステージ"
    };
    return labels[cat] || cat;
  }
}
