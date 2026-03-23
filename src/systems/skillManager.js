export class SkillManager {
  constructor(state, skillsData) {
    this.state = state;
    this.skillsData = skillsData;
    this._ensureSkillData();
  }

  _ensureSkillData() {
    for (const staff of this.state.staff) {
      if (!staff.skills) {
        staff.skills = {
          selectedPath: null,
          unlockedNodes: [],
          skillPoints: 0
        };
      }
    }
  }

  getPathsForRole(role) {
    if (role === "cook") return this.skillsData.cookPaths;
    if (role === "hall") return this.skillsData.hallPaths;
    return [];
  }

  selectPath(staffId, pathId) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフが見つかりません" };

    const paths = this.getPathsForRole(staff.role);
    const path = paths.find(p => p.id === pathId);
    if (!path) return { success: false, reason: "無効なスキルパスです" };

    if (staff.skills.selectedPath && staff.skills.unlockedNodes.length > 0) {
      return { success: false, reason: "すでにスキルを習得済みのため変更できません" };
    }

    staff.skills.selectedPath = pathId;
    return { success: true, path };
  }

  canUnlockNode(staff, nodeId) {
    if (!staff.skills.selectedPath) return false;

    const paths = this.getPathsForRole(staff.role);
    const path = paths.find(p => p.id === staff.skills.selectedPath);
    if (!path) return false;

    const node = path.nodes.find(n => n.id === nodeId);
    if (!node) return false;

    if (staff.skills.unlockedNodes.includes(nodeId)) return false;
    if (staff.level < node.level) return false;
    if (staff.skills.skillPoints < 1) return false;
    if (node.requires && !staff.skills.unlockedNodes.includes(node.requires)) return false;

    return true;
  }

  unlockNode(staffId, nodeId) {
    const staff = this.state.staff.find(s => s.id === staffId);
    if (!staff) return { success: false, reason: "スタッフが見つかりません" };

    if (!this.canUnlockNode(staff, nodeId)) {
      return { success: false, reason: "習得条件を満たしていません" };
    }

    const paths = this.getPathsForRole(staff.role);
    const path = paths.find(p => p.id === staff.skills.selectedPath);
    const node = path.nodes.find(n => n.id === nodeId);

    staff.skills.unlockedNodes.push(nodeId);
    staff.skills.skillPoints -= 1;

    if (node.effect.stat) {
      staff.stats[node.effect.stat] = Math.min(
        100,
        (staff.stats[node.effect.stat] || 0) + node.effect.bonus
      );
    }

    return { success: true, node, staff };
  }

  onLevelUp(staff) {
    staff.skills.skillPoints = (staff.skills.skillPoints || 0) + 1;
  }

  getStaffSkillSummary(staff) {
    if (!staff.skills || !staff.skills.selectedPath) {
      return { path: null, nodes: [], points: staff.skills?.skillPoints || 0 };
    }

    const paths = this.getPathsForRole(staff.role);
    const path = paths.find(p => p.id === staff.skills.selectedPath);
    if (!path) return { path: null, nodes: [], points: 0 };

    return {
      path,
      nodes: path.nodes.map(n => ({
        ...n,
        unlocked: staff.skills.unlockedNodes.includes(n.id),
        canUnlock: this.canUnlockNode(staff, n.id)
      })),
      points: staff.skills.skillPoints
    };
  }

  getActiveSpecials(staff) {
    if (!staff.skills?.selectedPath) return [];

    const paths = this.getPathsForRole(staff.role);
    const path = paths.find(p => p.id === staff.skills.selectedPath);
    if (!path) return [];

    return path.nodes
      .filter(n => staff.skills.unlockedNodes.includes(n.id) && n.effect.special)
      .map(n => n.effect.special);
  }

  getCookSpeedBonus(staff) {
    const specials = this.getActiveSpecials(staff);
    let bonus = 0;
    if (specials.includes("cook_speed_up_10")) bonus += 0.10;
    if (specials.includes("cook_speed_up_15")) bonus += 0.15;
    if (specials.includes("cook_speed_up_25")) bonus += 0.25;
    return bonus;
  }

  getCookQualityBonus(staff) {
    const specials = this.getActiveSpecials(staff);
    let bonus = 0;
    if (specials.includes("cook_quality_up_5")) bonus += 0.05;
    if (specials.includes("cook_quality_up_10")) bonus += 0.10;
    return bonus;
  }

  getResearchSpeedBonus() {
    let bonus = 0;
    for (const staff of this.state.staff) {
      if (staff.role !== "cook") continue;
      const specials = this.getActiveSpecials(staff);
      if (specials.includes("research_speed_up_20")) bonus = Math.max(bonus, 0.20);
    }
    return bonus;
  }

  getResearchCostBonus() {
    let bonus = 0;
    for (const staff of this.state.staff) {
      if (staff.role !== "cook") continue;
      const specials = this.getActiveSpecials(staff);
      if (specials.includes("research_cost_down_30")) bonus = Math.max(bonus, 0.30);
    }
    return bonus;
  }

  getCustomerFlowBonus() {
    let bonus = 0;
    for (const staff of this.state.staff) {
      const specials = this.getActiveSpecials(staff);
      if (specials.includes("customer_flow_up_5")) bonus += 0.05;
      if (specials.includes("customer_flow_up_15")) bonus += 0.15;
    }
    return bonus;
  }

  getReputationDailyBonus() {
    for (const staff of this.state.staff) {
      const specials = this.getActiveSpecials(staff);
      if (specials.includes("reputation_daily_bonus")) return 1;
    }
    return 0;
  }

  getIngredientCostBonus() {
    let bonus = 0;
    for (const staff of this.state.staff) {
      if (staff.role !== "cook") continue;
      const specials = this.getActiveSpecials(staff);
      if (specials.includes("prep_cost_down_10")) bonus = Math.max(bonus, 0.10);
    }
    return bonus;
  }
}
