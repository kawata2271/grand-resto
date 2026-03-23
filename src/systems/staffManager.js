export class StaffManager {
  constructor(state, templates) {
    this.state = state;
    this.templates = templates;
    this.applicants = [];
  }

  generateApplicants(count = 3) {
    this.applicants = [];
    const pool = this.templates.templates;
    const namePool = this.templates.namePool;
    const usedNames = new Set(this.state.staff.map(s => s.name));

    for (let i = 0; i < count; i++) {
      const tmpl = pool[Math.floor(Math.random() * pool.length)];
      let name;
      let attempts = 0;
      do {
        const last = namePool.lastNames[Math.floor(Math.random() * namePool.lastNames.length)];
        const first = namePool.firstNames[Math.floor(Math.random() * namePool.firstNames.length)];
        name = `${last} ${first}`;
        attempts++;
      } while (usedNames.has(name) && attempts < 20);

      usedNames.add(name);

      const variance = () => Math.floor((Math.random() - 0.5) * 10);
      const stats = {};
      for (const [key, val] of Object.entries(tmpl.stats)) {
        stats[key] = Math.max(5, Math.min(100, val + variance()));
      }

      this.applicants.push({
        templateId: tmpl.id,
        name,
        role: tmpl.role,
        salary: tmpl.baseSalary + Math.floor((Math.random() - 0.3) * 20000),
        hireCost: tmpl.hireCost,
        stats,
        growthRate: tmpl.growthRate + (Math.random() - 0.5) * 0.2,
        description: tmpl.description,
        tier: tmpl.tier
      });
    }
    return this.applicants;
  }

  hire(applicantIndex) {
    const app = this.applicants[applicantIndex];
    if (!app) return { success: false, reason: "応募者が見つかりません" };

    if (this.state.restaurant.money < app.hireCost) {
      return { success: false, reason: "資金が不足しています" };
    }

    const nextId = `staff_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newStaff = {
      id: nextId,
      templateId: app.templateId,
      name: app.name,
      role: app.role,
      salary: app.salary,
      stats: { ...app.stats },
      growthRate: app.growthRate,
      morale: 75,
      fatigue: 0,
      experience: 0,
      level: 1,
      daysWorked: 0
    };

    this.state.staff.push(newStaff);
    this.state.restaurant.money -= app.hireCost;
    this.applicants.splice(applicantIndex, 1);

    return { success: true, staff: newStaff };
  }

  fire(staffId) {
    const index = this.state.staff.findIndex(s => s.id === staffId);
    if (index === -1) return { success: false, reason: "スタッフが見つかりません" };

    if (this.state.staff.length <= 1) {
      return { success: false, reason: "最後の1人は解雇できません" };
    }

    const staff = this.state.staff[index];
    const severancePay = Math.floor(staff.salary * 0.5);
    this.state.restaurant.money -= severancePay;
    this.state.staff.splice(index, 1);

    return { success: true, name: staff.name, severancePay };
  }

  getMaxCookLevel() {
    const cooks = this.state.staff.filter(s => s.role === "cook");
    if (cooks.length === 0) return 0;
    return Math.max(...cooks.map(s => s.level));
  }
}
