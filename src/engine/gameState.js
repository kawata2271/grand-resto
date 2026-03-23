export function createInitialState(config, menus, staffTemplates) {
  const namePool = staffTemplates.namePool;

  const initialStaff = staffTemplates.templates
    .filter(t => t.tier === 1)
    .map((tmpl, i) => ({
      id: `staff_${i}`,
      templateId: tmpl.id,
      name: `${namePool.lastNames[i]} ${namePool.firstNames[i]}`,
      role: tmpl.role,
      salary: tmpl.baseSalary,
      stats: { ...tmpl.stats },
      growthRate: tmpl.growthRate,
      morale: 70,
      fatigue: 0,
      experience: 0,
      level: 1,
      daysWorked: 0
    }));

  const activeMenuIds = menus.menus
    .filter(m => m.unlocked)
    .map(m => m.id);

  return {
    version: 2,
    restaurant: {
      name: "はじまりの食堂",
      money: config.economy.startingMoney,
      reputation: 30,
      tables: config.tables.default.map(t => ({ ...t })),
      activeMenuIds
    },
    staff: initialStaff,
    time: {
      year: 2026,
      month: 4,
      day: 1,
      hour: 10,
      minute: 0
    },
    stats: {
      totalRevenue: 0,
      totalCost: 0,
      totalCustomers: 0,
      daysPlayed: 0,
      bestDayRevenue: 0
    },
    todayLog: {
      revenue: 0,
      cost: 0,
      customers: 0,
      orders: [],
      events: [],
      lostCustomers: 0
    },
    history: [],
    prestige: {
      level: 0,
      totalRuns: 0
    }
  };
}
