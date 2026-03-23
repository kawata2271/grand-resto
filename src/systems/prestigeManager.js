export class PrestigeManager {
  constructor(state) {
    this.state = state;
    if (!this.state.prestige) this.state.prestige = { level: 0, totalRuns: 0, unlockedBonuses: [], inheritedRecipes: [], inheritedStaff: [] };
  }

  canPrestige() {
    const goals = this._checkAllGoals();
    return goals.every(g => g.achieved);
  }

  _checkAllGoals() {
    return [
      { label: "評判80以上", achieved: this.state.restaurant.reputation >= 80 },
      { label: "営業30日以上", achieved: this.state.stats.daysPlayed >= 30 }
    ];
  }

  getPrestigePreview() {
    const level = this.state.prestige.level + 1;
    const bonuses = this._getBonusesForLevel(level);
    const inheritStaff = this.state.staff
      .filter(s => s.level >= 3)
      .sort((a, b) => b.level - a.level)
      .slice(0, Math.min(2, Math.floor(level / 2) + 1));
    const inheritRecipes = this.state.discoveredRecipes || [];
    const inheritReputation = Math.floor(this.state.restaurant.reputation * 0.3);

    return {
      newLevel: level,
      bonuses,
      inheritStaff: inheritStaff.map(s => ({ name: s.name, role: s.role, level: s.level })),
      inheritRecipes: inheritRecipes.length,
      inheritReputation,
      difficultyIncrease: `+${level * 10}%`
    };
  }

  _getBonusesForLevel(level) {
    const all = [
      { level: 1, id: "start_money_up", name: "初期資金+20%", description: "のれん分けの資金で少し余裕がある" },
      { level: 1, id: "reputation_start", name: "初期評判+10", description: "前の店の評判が少し引き継がれる" },
      { level: 2, id: "research_speed", name: "研究速度+10%", description: "経験から研究のコツを掴んでいる" },
      { level: 2, id: "hire_discount", name: "採用費-20%", description: "業界でのコネが効く" },
      { level: 3, id: "unlock_chinese", name: "中華業態解放", description: "中華メニューが最初から研究可能" },
      { level: 3, id: "staff_growth_up", name: "スタッフ成長+15%", description: "育成ノウハウの蓄積" },
      { level: 4, id: "unlock_special", name: "特殊業態解放", description: "深夜営業・星付きレストランが解放" },
      { level: 5, id: "master_bonus", name: "マスター経営者", description: "全パラメータ微増。伝説の始まり" }
    ];
    return all.filter(b => b.level <= level);
  }

  executePrestige(config, menus, staffTemplates) {
    const preview = this.getPrestigePreview();
    const newLevel = preview.newLevel;

    // Save prestige data
    const prestigeData = {
      level: newLevel,
      totalRuns: this.state.prestige.totalRuns + 1,
      unlockedBonuses: preview.bonuses.map(b => b.id),
      inheritedRecipes: [...(this.state.discoveredRecipes || [])],
      inheritedStaff: preview.inheritStaff
    };

    // Calculate starting conditions
    let startMoney = config.economy.startingMoney;
    if (prestigeData.unlockedBonuses.includes("start_money_up")) startMoney = Math.floor(startMoney * 1.2);

    let startRep = 30;
    if (prestigeData.unlockedBonuses.includes("reputation_start")) startRep += 10;
    startRep += preview.inheritReputation;
    startRep = Math.min(60, startRep);

    // Reset state
    const namePool = staffTemplates.namePool;
    const initialStaff = staffTemplates.templates
      .filter(t => t.tier === 1)
      .map((tmpl, i) => ({
        id: `staff_${i}`,
        templateId: tmpl.id,
        name: `${namePool.lastNames[i + newLevel * 2]} ${namePool.firstNames[i + newLevel * 2]}`,
        role: tmpl.role,
        salary: tmpl.baseSalary,
        stats: { ...tmpl.stats },
        growthRate: tmpl.growthRate,
        morale: 75,
        fatigue: 0,
        experience: 0,
        level: 1,
        daysWorked: 0,
        shift: "full"
      }));

    // Add inherited staff (reduced level)
    for (const is of prestigeData.inheritedStaff) {
      const tmpl = staffTemplates.templates.find(t => t.role === is.role) || staffTemplates.templates[0];
      initialStaff.push({
        id: `staff_inherit_${Date.now()}_${Math.random()}`,
        templateId: tmpl.id,
        name: is.name,
        role: is.role,
        salary: tmpl.baseSalary + 20000,
        stats: { ...tmpl.stats },
        growthRate: tmpl.growthRate,
        morale: 80,
        fatigue: 0,
        experience: 0,
        level: Math.max(1, Math.floor(is.level * 0.5)),
        daysWorked: 0,
        shift: "full"
      });
    }

    const activeMenuIds = menus.menus.filter(m => m.unlocked).map(m => m.id);

    // Build new state (preserving prestige)
    Object.assign(this.state, {
      version: 2,
      restaurant: {
        name: `${this.state.restaurant.name} ${newLevel > 1 ? newLevel + "号店" : "新店"}`,
        money: startMoney,
        reputation: startRep,
        tables: config.tables.default.map(t => ({ ...t })),
        activeMenuIds
      },
      staff: initialStaff,
      time: { year: 2026 + newLevel, month: 4, day: 1, hour: 10, minute: 0 },
      stats: { totalRevenue: 0, totalCost: 0, totalCustomers: 0, daysPlayed: 0, bestDayRevenue: 0 },
      todayLog: { revenue: 0, cost: 0, customers: 0, orders: [], events: [], lostCustomers: 0, customerTypes: {} },
      history: [],
      prestige: prestigeData,
      compatibility: {},
      rivals: [],
      rivalEffects: [],
      discoveredRecipes: prestigeData.inheritedRecipes
    });

    return { newLevel, bonuses: preview.bonuses };
  }
}
