import { createInitialState } from "./engine/gameState.js";
import { Simulation } from "./engine/sim.js";
import { StaffManager } from "./systems/staffManager.js";
import { MenuManager } from "./systems/menuManager.js";
import { EventManager } from "./systems/eventManager.js";
import { ShiftManager } from "./systems/shiftManager.js";
import { SkillManager } from "./systems/skillManager.js";
import { CompatibilityManager } from "./systems/compatibilityManager.js";
import { MentorManager } from "./systems/mentorManager.js";
import { TurnoverManager } from "./systems/turnoverManager.js";
import { RivalManager } from "./systems/rivalManager.js";
import { RecipeManager } from "./systems/recipeManager.js";
import { PrestigeManager } from "./systems/prestigeManager.js";
import { AchievementManager } from "./systems/achievementManager.js";
import { SeasonManager } from "./systems/seasonManager.js";
import { FormatManager } from "./systems/formatManager.js";
import { TutorialManager } from "./systems/tutorialManager.js";
import { AbilityManager } from "./systems/abilityManager.js";
import { RelocationManager } from "./systems/relocationManager.js";
import { FurnitureManager } from "./systems/furniture.js";
import { MarketingManager } from "./systems/marketing.js";
import { CleaningManager } from "./systems/cleaning.js";
import { PreparationManager } from "./systems/preparation.js";
import { EquipmentManager } from "./systems/equipment.js";
// themes.json loaded inline below
import { ReservationManager } from "./systems/reservation.js";
import { CustomerDBManager } from "./systems/customerDB.js";
import { AccountingManager } from "./systems/accounting.js";
import { EndingManager } from "./systems/endingManager.js";
import { TownManager } from "./systems/townManager.js";
import { EffectManager } from "./render/effects.js";
import { UI } from "./render/ui.js";
import { saveGame, loadGame, hasSave, deleteSave } from "./save/saveManager.js";

class GameApp {
  async init() {
    const [config, menus, staffTemplates, eventsData, upgrades, customersData, skillsData, rivalsData, recipesData, achievementsData, seasonsData, formatsData, townsData, helpData, abilitiesData, locationsData, marketingData, cleaningData, ingredientsData, equipmentData, themesData] = await Promise.all([
      fetch("./src/data/config.json").then(r => r.json()),
      fetch("./src/data/menus.json").then(r => r.json()),
      fetch("./src/data/staff-templates.json").then(r => r.json()),
      fetch("./src/data/events.json").then(r => r.json()),
      fetch("./src/data/upgrades.json").then(r => r.json()),
      fetch("./src/data/customers.json").then(r => r.json()),
      fetch("./src/data/skills.json").then(r => r.json()),
      fetch("./src/data/rivals.json").then(r => r.json()),
      fetch("./src/data/recipes.json").then(r => r.json()),
      fetch("./src/data/achievements.json").then(r => r.json()),
      fetch("./src/data/seasons.json").then(r => r.json()),
      fetch("./src/data/formats.json").then(r => r.json()),
      fetch("./src/data/towns.json").then(r => r.json()),
      fetch("./src/data/help.json").then(r => r.json()),
      fetch("./src/data/abilities.json").then(r => r.json()),
      fetch("./src/data/locations.json").then(r => r.json()),
      fetch("./src/data/marketing.json").then(r => r.json()),
      fetch("./src/data/cleaning.json").then(r => r.json()),
      fetch("./src/data/ingredients.json").then(r => r.json()),
      fetch("./src/data/equipment.json").then(r => r.json()),
      fetch("./src/data/themes.json").then(r => r.json())
    ]);

    this.config = config;
    this.menus = menus;
    this.upgrades = upgrades;
    this.customerTypes = customersData.customerTypes;
    this.skillsData = skillsData;
    this.autoInterval = null;

    if (hasSave()) { const l = loadGame(); if (l) this.state = l; }
    if (!this.state) this.state = createInitialState(config, menus, staffTemplates);

    // Systems
    this.sim = new Simulation(this.state, config, menus);
    this.sim.setCustomerTypes(this.customerTypes);
    this.staffMgr = new StaffManager(this.state, staffTemplates);
    this.menuMgr = new MenuManager(this.state, menus);
    this.eventMgr = new EventManager(this.state, eventsData);
    this.shiftMgr = new ShiftManager(this.state, config);
    this.skillMgr = new SkillManager(this.state, skillsData);
    this.compatMgr = new CompatibilityManager(this.state);
    this.mentorMgr = new MentorManager(this.state, this.compatMgr);
    this.turnoverMgr = new TurnoverManager(this.state, this.compatMgr);
    this.rivalMgr = new RivalManager(this.state, rivalsData);
    this.recipeMgr = new RecipeManager(this.state, recipesData, menus);
    this.prestigeMgr = new PrestigeManager(this.state);
    this.achievementMgr = new AchievementManager(this.state, achievementsData);
    this.seasonMgr = new SeasonManager(this.state, seasonsData);
    this.formatMgr = new FormatManager(this.state, formatsData);
    this.tutorialMgr = new TutorialManager(this.state);
    this.abilityMgr = new AbilityManager(this.state, abilitiesData);
    this.relocationMgr = new RelocationManager(this.state, locationsData);
    this.furnitureMgr = new FurnitureManager(this.state);
    this.marketingMgr = new MarketingManager(this.state, marketingData);
    this.cleaningMgr = new CleaningManager(this.state, cleaningData);
    this.prepMgr = new PreparationManager(this.state, ingredientsData);
    this.equipmentMgr = new EquipmentManager(this.state, equipmentData);
    this.reservationMgr = new ReservationManager(this.state);
    this.customerDBMgr = new CustomerDBManager(this.state);
    this.accountingMgr = new AccountingManager(this.state, config);
    this.themesData = themesData;
    if (!this.state.restaurant.themeId) this.state.restaurant.themeId = "theme_none";
    if (!this.state.restaurant.themeCooldown) this.state.restaurant.themeCooldown = 0;
    if (!this.state.appliedSubsidies) this.state.appliedSubsidies = [];
    this.endingMgr = new EndingManager(this.state, this.achievementMgr);

    // Bridge: sim uses furniture tables instead of old tables
    this.sim.getTablesFromFurniture = () => this.furnitureMgr.getTablesForSim();
    this.townMgr = new TownManager(this.state, townsData, config);
    this.effects = new EffectManager();
    this.staffTemplates = staffTemplates;
    this.formatsData = formatsData;
    this.helpData = helpData;

    this.sim.setShiftManager(this.shiftMgr);
    this.sim.setSkillManager(this.skillMgr);
    this.sim.setCompatManager(this.compatMgr);
    this.sim.setMentorManager(this.mentorMgr);
    this._syncBonuses();

    this.ui = new UI(this);
    this.ui.init();
    this.ui.addLog("開店準備完了。いらっしゃいませ！");

    window.__debug = {
      getState: () => this.state,
      setMoney: n => { this.state.restaurant.money = n; this.ui.render(); },
      skipDay: () => this.doEndDay(),
      addExp: n => { this.state.staff.forEach(s => { s.experience += n; }); this.ui.render(); },
      addRep: n => { this.state.restaurant.reputation = Math.max(0, Math.min(100, this.state.restaurant.reputation + n)); this.ui.render(); },
    };
  }

  _syncBonuses() {
    const abilityTeam = this.abilityMgr.getTeamEffects();
    this.sim.skillFlowBonus = this.skillMgr.getCustomerFlowBonus() + (abilityTeam.customerFlow || 0);
    this.sim.skillCostBonus = this.skillMgr.getIngredientCostBonus() - (abilityTeam.ingredientCost || 0);
    this.sim.rivalFlowImpact = this.rivalMgr.getTotalCustomerFlowImpact() + (abilityTeam.rivalDefense || 0);
    this.sim.seasonFlowMult = this.seasonMgr.getCustomerFlowMult();
    this.sim.seasonCostMult = this.seasonMgr.getIngredientCostMult();
    this.sim.formatRateMult = this.formatMgr.getCustomerRateMult();
    this.sim.awarenessCoeff = this.marketingMgr.getTrafficCoefficient();
    this.sim.locationTrafficMult = this.relocationMgr.getTrafficMultiplier();
    this.sim.locationWealthMult = this.relocationMgr.getWealthMultiplier();
    this.sim.locationCompMult = this.relocationMgr.getCompetitionPenalty();
    this.sim.locationTrendMult = this.relocationMgr.getTrendBonus();
  }

  doTick() {
    // Process breaks
    const breakEvts = this.shiftMgr.tickBreaks(this.config.simulation.tickMinutes);
    for (const e of breakEvts) this.ui.addLog(e);

    const r = this.sim.tick();
    if (r.type === "closed") { this.ui.addLog("営業時間外。閉店処理をどうぞ。"); if (this.autoInterval) this.toggleAuto(); return; }
    if (r.waiting > 0 || r.eating > 0) {
      this.ui.addLog(`客:待${r.waiting} 店内${r.eating} | 調理待${r.pendingOrders} | 厨${r.activeCooks} ホ${r.activeHall}`);
    }
    this.ui.render();
  }

  doEndDay() {
    while (this.state.time.hour < this.config.simulation.closeHour) this.sim.tick();

    // Daily event
    const evt = this.eventMgr.rollDailyEvent();
    if (evt) { this.ui.addLog(`📰 ${evt.name}`); this.effects.eventFlash("📰", evt.name); }

    // Menu research
    const rs = this.menuMgr.advanceDay();
    if (rs) this.ui.addLog(rs.completed ? `🍳 新メニュー「${rs.menuName}」完成！` : `🔬 「${rs.menuName}」研究中…残${rs.daysLeft}日`);

    // Compatibility & Mentor daily
    const compatEvts = this.compatMgr.dailyUpdate();
    for (const e of compatEvts) this.ui.addLog(`💬 ${e}`);
    const mentorEvts = this.mentorMgr.dailyUpdate();
    for (const e of mentorEvts) this.ui.addLog(`🎓 ${e}`);

    // Rival check
    const newRivals = this.rivalMgr.checkNewRivals();
    for (const e of newRivals) { this.ui.addLog(e.message); this.effects.rivalAppear(e.rival.name); }
    const rivalEvts = this.rivalMgr.dailyUpdate();
    for (const e of rivalEvts) this.ui.addLog(e.message);

    // Turnover check
    const turnover = this.turnoverMgr.dailyCheck();
    for (const e of turnover.events) this.ui.addLog(`⚠️ ${e.message}`);
    for (const q of turnover.quitters) {
      const result = this.turnoverMgr.processQuit(q);
      if (result) {
        this.ui.addLog(`😢 ${result.name}が退職しました（理由: ${result.reason}）`);
        this.mentorMgr.onStaffRemoved(q.id);
        this.compatMgr.cleanupRemovedStaff();
      }
    }

    // Ability accidents
    const accidents = this.abilityMgr.checkDailyAccidents();
    for (const a of accidents) this.ui.addLog(`💥 ${a}`);

    // Ability team effects → reputation
    const abilityTeam = this.abilityMgr.getTeamEffects();
    if (abilityTeam.reputation) {
      this.state.restaurant.reputation = Math.max(0, Math.min(100,
        this.state.restaurant.reputation + Math.round(abilityTeam.reputation)));
    }
    if (abilityTeam.teamMorale) {
      for (const s of this.state.staff) {
        if (s.shift !== "off") s.morale = Math.min(100, Math.max(0, s.morale + Math.round(abilityTeam.teamMorale)));
      }
    }

    // Marketing daily update
    const mktEvts = this.marketingMgr.dailyUpdate();
    for (const e of mktEvts) this.ui.addLog(e);

    // Process customer reviews
    if (this.state.todayLog.customers > 0) {
      const avgSatisfaction = 60 + this.state.restaurant.reputation * 0.3;
      const review = this.marketingMgr.processReview(avgSatisfaction);
      if (review) {
        const stars = "★".repeat(review.stars) + "☆".repeat(5 - review.stars);
        this.ui.addLog(`📝 口コミ投稿: ${stars}（平均${review.newAvg.toFixed(1)}点 / ${review.totalReviews}件）`);
      }
    }

    // Labor law daily update
    const laborEvts = this.shiftMgr.dailyLaborUpdate();
    for (const e of laborEvts) this.ui.addLog(e);

    // Reservation processing
    const noShows = this.reservationMgr.processNoShows();
    for (const e of noShows) this.ui.addLog(e);
    this.reservationMgr.clearDaily();
    const rsvEvts = this.reservationMgr.generateDailyReservations();
    for (const e of rsvEvts) this.ui.addLog(e);

    // Customer DB tracking
    if (this.state.todayLog.customers > 0) {
      const types = this.state.todayLog.customerTypes || {};
      for (const [type, count] of Object.entries(types)) {
        const satisfaction = 60 + this.state.restaurant.reputation * 0.3;
        const spending = (this.state.todayLog.revenue / Math.max(1, this.state.todayLog.customers)) * count;
        this.customerDBMgr.recordVisit(type, count, satisfaction, spending);
      }
    }

    // Accounting
    this.accountingMgr.recordCashFlow();
    const bankCheck = this.accountingMgr.checkBankruptcy();
    if (bankCheck.bankrupt) {
      this.ui.addLog(`💀 ${bankCheck.message}`);
      this._showGameOver();
      return; // Stop processing
    } else if (bankCheck.warning) {
      this.ui.addLog(bankCheck.warning);
    }

    // Cleaning daily update
    const cleanEvts = this.cleaningMgr.dailyUpdate();
    for (const e of cleanEvts) this.ui.addLog(e);

    // Inventory daily update
    const invEvts = this.prepMgr.dailyUpdate();
    for (const e of invEvts) this.ui.addLog(e);

    // Equipment daily update
    const eqEvts = this.equipmentMgr.dailyUpdate();
    for (const e of eqEvts) this.ui.addLog(e);

    // Furniture maintenance
    const isBusy = (this.state.todayLog.customers || 0) > 30;
    const furnMaint = this.furnitureMgr.dailyMaintenance(isBusy);
    for (const e of furnMaint.events) this.ui.addLog(e);

    // Location
    this.relocationMgr.dailyUpdate();
    const crimeChance = this.relocationMgr.getCrimeEventChance();
    if (crimeChance > 0 && Math.random() < crimeChance) {
      const crimes = ["食い逃げが発生！（-¥5,000）","深夜に不審者が…（修理費-¥8,000）","落書きされた（清掃費-¥3,000）"];
      const crime = crimes[Math.floor(Math.random() * crimes.length)];
      const cost = crime.includes("8,000") ? 8000 : crime.includes("5,000") ? 5000 : 3000;
      this.state.restaurant.money -= cost;
      this.ui.addLog(`🚨 ${crime}`);
    }

    // Format cooldown
    this.formatMgr.advanceDay();

    // Sync multipliers
    this.sim.customerFlowMult = this.eventMgr.getCustomerFlowMultiplier();
    this.sim.ingredientCostMult = this.eventMgr.getIngredientCostMultiplier();
    this._syncBonuses();

    const report = this.sim.endDay();

    const restoreEvts = this.eventMgr.advanceDay();
    for (const e of restoreEvts) this.ui.addLog(`🔧 ${e}`);
    this.sim.customerFlowMult = this.eventMgr.getCustomerFlowMultiplier();
    this.sim.ingredientCostMult = this.eventMgr.getIngredientCostMultiplier();
    this._syncBonuses();

    // Achievement check
    const newAch = this.achievementMgr.checkAll(report);
    for (const a of newAch) {
      this.ui.addLog(`🏆 実績解除！「${a.name}」`);
      this.effects.achievement(a.icon, a.name);
    }

    // Ending check
    const newEndings = this.endingMgr.checkAndUnlockNew();
    for (const e of newEndings) {
      this.ui.addLog(`🎬 エンディング解放！「${e.title}」`);
      this.effects.notify(e.icon, e.title, e.description, 5000);
    }

    // Town development
    if (report.profit > 0) {
      const devEvts = this.townMgr.developTown(1);
      for (const e of devEvts) this.ui.addLog(`🏘 ${e}`);
    }

    // Takeout/delivery revenue
    const takeoutRev = this.marketingMgr.getTakeoutRevenue(report.customers);
    if (takeoutRev > 0) {
      this.state.restaurant.money += takeoutRev;
      report.takeoutRevenue = takeoutRev;
      this.ui.addLog(`🥡 テイクアウト/デリバリー売上: ¥${takeoutRev.toLocaleString()}`);
    }

    // Theme daily cost
    const currentTheme = this.themesData.themes.find(t => t.id === this.state.restaurant.themeId);
    if (currentTheme?.dailyCost) {
      this.state.restaurant.money -= currentTheme.dailyCost;
    }
    if (this.state.restaurant.themeCooldown > 0) this.state.restaurant.themeCooldown--;

    // Monthly accounting
    if (report.isNewMonth) {
      const pl = this.accountingMgr.generateMonthlyPL();
      if (pl) {
        this.ui.addLog(`📊 ${pl.month}月 P/L: 売上¥${pl.revenue.toLocaleString()} 純利益¥${pl.netProfit.toLocaleString()} 食材率${pl.foodCostRatio}%`);
        if (pl.tax > 0) this.ui.addLog(`🏛 税金¥${pl.tax.toLocaleString()}`);
      }
      const loanEvts = this.accountingMgr.processLoanPayments();
      for (const e of loanEvts) this.ui.addLog(e);
    }

    saveGame(this.state);
    this.ui.showDayReport(report, evt, newAch);
    const ps = report.profit >= 0 ? `+¥${report.profit.toLocaleString()}` : `-¥${Math.abs(report.profit).toLocaleString()}`;
    this.ui.addLog(`--- ${report.date.month}/${report.date.day} 閉店 --- ${ps}`);
    this.ui.render();
    if (this.autoInterval) this.toggleAuto();
  }

  toggleAuto() {
    if (this.autoInterval) { clearInterval(this.autoInterval); this.autoInterval = null; this.ui.updateAutoButton(false); }
    else { this.autoInterval = setInterval(() => this.doTick(), 200); this.ui.updateAutoButton(true); }
  }

  doSave() { saveGame(this.state) ? this.ui.addLog("💾 セーブ完了！") : this.ui.addLog("セーブ失敗…"); }

  // Staff
  getApplicants() { return this.staffMgr.applicants; }
  refreshApplicants() { return this.staffMgr.generateApplicants(3); }
  hireStaff(i) {
    const r = this.staffMgr.hire(i);
    if (r.success) {
      this.shiftMgr._ensureShiftData(); this.skillMgr._ensureSkillData(); this.mentorMgr._ensureData();
      this.shiftMgr.markAsTrainee(r.staff.id); // New hire = trainee for 14 days
      // Roll for special ability
      const ability = this.abilityMgr.rollAbility(r.staff.role);
      if (ability) {
        r.staff.abilityId = ability.id;
        const color = this.abilityMgr.getRarityColor(ability.rarity);
        this.ui.addLog(`👤 ${r.staff.name}を採用 — ${ability.icon}【${ability.name}】持ち！`);
        this.effects.notify(ability.icon, `特殊能力！`, `${r.staff.name}: ${ability.name}\n${ability.description}`, 3000);
      } else {
        this.ui.addLog(`👤 ${r.staff.name}を採用`);
      }
    }
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  fireStaff(id) {
    const r = this.staffMgr.fire(id);
    if (r.success) { this.mentorMgr.onStaffRemoved(id); this.compatMgr.cleanupRemovedStaff(); this.ui.addLog(`👤 ${r.name}を解雇（退職金¥${r.severancePay.toLocaleString()}）`); }
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  raiseSalary(id, amount) {
    const r = this.turnoverMgr.raiseSalary(id, amount);
    if (r.success) this.ui.addLog(`💰 昇給→¥${r.newSalary.toLocaleString()}/月`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }

  // Shift & Skill & Break & Labor
  setShift(id, sh) { const r = this.shiftMgr.setShift(id, sh); if (r.success) this.ui.render(); else this.ui.addLog(`❌ ${r.reason}`); return r; }
  usePaidLeave(id) {
    const r = this.shiftMgr.usePaidLeave(id);
    if (r.success) this.ui.addLog(`🏖 有給休暇取得（残${r.remaining}日）`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  sendOnBreak(id, minutes) {
    const r = this.shiftMgr.sendOnBreak(id, minutes);
    if (r.success) this.ui.addLog(`☕ ${r.name}を${r.minutes}分休憩に`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  cancelBreak(id) {
    const r = this.shiftMgr.cancelBreak(id);
    if (r.success) this.ui.addLog(`${r.name}を休憩から復帰させました`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  selectPath(sid, pid) { const r = this.skillMgr.selectPath(sid, pid); if (r.success) { this.ui.addLog(`🌳 ${r.path.name}の道を選択`); this.ui.render(); } else this.ui.addLog(`❌ ${r.reason}`); return r; }
  unlockSkillNode(sid, nid) { const r = this.skillMgr.unlockNode(sid, nid); if (r.success) { this.ui.addLog(`⭐ ${r.staff.name}が「${r.node.name}」習得！`); this._syncBonuses(); this.ui.render(); } else this.ui.addLog(`❌ ${r.reason}`); return r; }

  // Mentor
  assignMentor(mid, aid) { const r = this.mentorMgr.assignMentor(mid, aid); if (r.success) this.ui.addLog(`🎓 ${r.mentor.name} → ${r.apprentice.name}の師弟関係成立`); else this.ui.addLog(`❌ ${r.reason}`); this.ui.render(); return r; }
  dissolveMentor(id) { const r = this.mentorMgr.dissolvePair(id); if (r.success) this.ui.addLog("師弟関係を解消しました"); else this.ui.addLog(`❌ ${r.reason}`); this.ui.render(); return r; }

  // Menu & Research
  getResearchableMenus() {
    const maxLv = this.staffMgr.getMaxCookLevel();
    const cb = this.skillMgr.getResearchCostBonus(), sb = this.skillMgr.getResearchSpeedBonus();
    return this.menuMgr.getResearchableMenus(maxLv).map(m => ({ ...m,
      effectiveResearchCost: Math.round(m.researchCost * (1 - cb)),
      effectiveResearchDays: Math.max(1, Math.round(m.researchDays * (1 - sb)))
    }));
  }
  startResearch(menuId) {
    const menu = this.menus.menus.find(m => m.id === menuId);
    if (!menu) return;
    const cb = this.skillMgr.getResearchCostBonus(), sb = this.skillMgr.getResearchSpeedBonus();
    const oc = menu.researchCost, od = menu.researchDays;
    menu.researchCost = Math.round(oc * (1 - cb));
    menu.researchDays = Math.max(1, Math.round(od * (1 - sb)));
    const r = this.menuMgr.startResearch(menuId);
    menu.researchCost = oc; menu.researchDays = od;
    if (r.success) this.ui.addLog(`🔬 「${menu.name}」の研究を開始`); else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  getResearchStatus() { return this.menuMgr.researching; }

  // Recipe
  tryRecipe(ingIds, methodId) {
    const r = this.recipeMgr.tryResearch(ingIds, methodId);
    if (r.discovered) { this.ui.addLog(`🌟 新レシピ発見！「${r.menuName}」— ${r.message}`); this.effects.recipeDiscovered(r.menuName); }
    else if (r.nearMiss) this.ui.addLog(`🔍 ${r.reason}`);
    else if (r.success) this.ui.addLog(`🔍 ${r.reason}（費用¥${r.cost.toLocaleString()}）`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  unlockIngredient(id) {
    const r = this.recipeMgr.unlockIngredient(id);
    if (r.success) this.ui.addLog(`🧂 「${r.ingredient.name}」を仕入れルート開拓（¥${r.cost.toLocaleString()}）`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }

  // Furniture
  placeFurniture(typeId, gradeId, col, row) {
    const r = this.furnitureMgr.placeFurniture(typeId, gradeId, col, row);
    if (r.success) { this.ui.addLog(`🪑 ${r.furniture.type}を配置（¥${r.cost.toLocaleString()}）`); this.effects.floatText(`-¥${r.cost.toLocaleString()}`, window.innerWidth / 2, 60, "#c94040"); }
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  removeFurniture(id) {
    const r = this.furnitureMgr.removeFurniture(id);
    if (r.success) this.ui.addLog(`🗑 家具を撤去（返金¥${r.refund.toLocaleString()}）`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  repairFurniture(id) {
    const r = this.furnitureMgr.repair(id);
    if (r.success) this.ui.addLog(`🔧 修理完了（¥${r.cost.toLocaleString()}）`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  upgradeGrade(id, newGrade) {
    const r = this.furnitureMgr.upgradeGrade(id, newGrade);
    if (r.success) this.ui.addLog(`⬆️ グレード変更（差額¥${r.cost.toLocaleString()}）`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }

  // Table (legacy)
  buyTable(type) {
    const td = this.upgrades.tables.find(t => t.id === type);
    if (!td) return;
    if (this.state.restaurant.tables.length >= this.upgrades.maxTables) { this.ui.addLog("❌ テーブル上限"); return; }
    if (this.state.restaurant.money < td.cost) { this.ui.addLog("❌ 資金不足"); return; }
    this.state.restaurant.money -= td.cost;
    this.state.restaurant.tables.push({ id: `table_${Date.now()}`, seats: td.seats });
    this.ui.addLog(`🪑 ${td.name}追加`); this.ui.render();
  }

  checkGoals() {
    const sc = this.upgrades.scenarios.find(s => s.unlocked);
    if (!sc) return null;
    const ms = this.sim._calcMonthSummary();
    return sc.goals.map(g => {
      let c = 0;
      if (g.type === "monthly_revenue" && ms) c = ms.revenue;
      if (g.type === "reputation") c = this.state.restaurant.reputation;
      return { ...g, current: c, achieved: c >= g.target };
    });
  }

  getActiveEffects() { return [...this.eventMgr.getActiveEffectsSummary(), ...this.rivalMgr.getActiveEffects()]; }

  // Prestige
  canPrestige() { return this.prestigeMgr.canPrestige(); }
  getPrestigePreview() { return this.prestigeMgr.getPrestigePreview(); }
  doPrestige() {
    const result = this.prestigeMgr.executePrestige(this.config, this.menus, this.staffTemplates);
    saveGame(this.state);
    location.reload();
    return result;
  }

  // Menu pricing
  setMenuPrice(menuId, newPrice) {
    const menu = this.menus.menus.find(m => m.id === menuId);
    if (!menu) return;
    const min = Math.floor(menu.cost * 1.1);
    const max = Math.floor(menu.cost * 5);
    menu.price = Math.max(min, Math.min(max, newPrice));
    if (!this.state.customPrices) this.state.customPrices = {};
    this.state.customPrices[menuId] = menu.price;
    this.ui.render();
  }

  // Format
  changeFormat(formatId) {
    const r = this.formatMgr.changeFormat(formatId);
    if (r.success) {
      const removed = this.formatMgr.removeRestrictedMenus(this.menus);
      this.ui.addLog(`🏪 業態変更: ${r.format.name}`);
      if (removed.length) this.ui.addLog(`📋 提供停止: ${removed.join(", ")}`);
      this._syncBonuses();
    } else {
      this.ui.addLog(`❌ ${r.reason}`);
    }
    this.ui.render();
    return r;
  }

  // Theme
  changeTheme(themeId) {
    const theme = this.themesData.themes.find(t => t.id === themeId);
    if (!theme) return { success: false, reason: "テーマが見つかりません" };
    if (this.state.restaurant.themeCooldown > 0) return { success: false, reason: `クールダウン中（残${this.state.restaurant.themeCooldown}日）` };
    if (theme.repReq && this.state.restaurant.reputation < theme.repReq) return { success: false, reason: `評判${theme.repReq}以上が必要` };
    const cost = theme.cost + this.themesData.changeCost;
    if (this.state.restaurant.money < cost) return { success: false, reason: `資金不足（¥${cost.toLocaleString()}）` };
    this.state.restaurant.money -= cost;
    this.state.restaurant.themeId = themeId;
    this.state.restaurant.themeCooldown = this.themesData.changeCooldownDays;
    this.ui.addLog(`🎨 内装テーマ変更: ${theme.name}（¥${cost.toLocaleString()}）`);
    this.effects.notify(theme.icon, "内装変更！", theme.name, 2000);
    this.ui.render(); return { success: true, theme };
  }

  // Review reply
  replyToReview(index, quality) {
    const r = this.marketingMgr.replyToReview(index, quality);
    if (r.success) this.ui.addLog(`💬 口コミ返信: ${r.effect}`);
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }

  // Subsidies
  applyForSubsidy(subId) {
    const sub = this.themesData.subsidies.find(s => s.id === subId);
    if (!sub) return { success: false, reason: "補助金が見つかりません" };
    if (this.state.appliedSubsidies.includes(subId)) return { success: false, reason: "すでに受給済みです" };
    // Check conditions
    const c = sub.condition;
    if (c.maxDays && this.state.stats.daysPlayed > c.maxDays) return { success: false, reason: "申請期限切れ" };
    if (c.minDays && this.state.stats.daysPlayed < c.minDays) return { success: false, reason: `営業${c.minDays}日以上が必要` };
    if (c.minStaff && this.state.staff.length < c.minStaff) return { success: false, reason: `スタッフ${c.minStaff}人以上が必要` };
    if (c.minReputation && this.state.restaurant.reputation < c.minReputation) return { success: false, reason: `評判${c.minReputation}以上が必要` };
    if (c.minCleanliness && (this.cleaningMgr?.getOverallCleanliness() || 0) < c.minCleanliness) return { success: false, reason: `清潔度${c.minCleanliness}以上が必要` };
    if (c.hasWebsite && !this.state.marketing?.activeCampaigns?.some(ac => ac.id === "campaign_website")) return { success: false, reason: "ホームページ開設が必要" };

    this.state.restaurant.money += sub.amount;
    this.state.appliedSubsidies.push(subId);
    this.ui.addLog(`🏛 ${sub.name} ¥${sub.amount.toLocaleString()}を受給！`);
    this.effects.notify(sub.icon, "補助金受給！", `${sub.name} ¥${sub.amount.toLocaleString()}`, 3000);
    this.ui.render(); return { success: true, amount: sub.amount };
  }

  // Accounting
  applyForLoan(amount) {
    const r = this.accountingMgr.applyForLoan(amount);
    if (r.success) { this.ui.addLog(`🏦 融資¥${r.loan.principal.toLocaleString()}承認！月¥${r.loan.monthlyPayment.toLocaleString()}返済`); this.effects.notify("🏦", "融資承認", `¥${r.loan.principal.toLocaleString()}`, 2000); }
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }

  // Marketing
  startCampaign(id) {
    const r = this.marketingMgr.startCampaign(id);
    if (r.success) { this.ui.addLog(`📢 「${r.campaign.name}」を開始（¥${r.cost.toLocaleString()}）`); this.effects.eventFlash("📢", r.campaign.name); this._syncBonuses(); }
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }
  stopCampaign(id) {
    const r = this.marketingMgr.stopCampaign(id);
    if (r.success) { this.ui.addLog("📢 施策を停止しました"); this._syncBonuses(); }
    else this.ui.addLog(`❌ ${r.reason}`);
    this.ui.render(); return r;
  }

  // Game Over
  _showGameOver() {
    const s = this.state.stats;
    const overlay = document.getElementById("gameover-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    document.getElementById("gameover-message").textContent = "7日連続の資金不足により、お店は閉店しました…\nしかし、あなたの経験は次の挑戦に活きるはずです。";
    document.getElementById("gameover-stats").innerHTML = `
      <div class="report-grid">
        <div class="report-item"><span>営業日数</span><span>${s.daysPlayed}日</span></div>
        <div class="report-item"><span>総来客数</span><span>${s.totalCustomers.toLocaleString()}人</span></div>
        <div class="report-item"><span>総売上</span><span>¥${s.totalRevenue.toLocaleString()}</span></div>
        <div class="report-item"><span>最高日売上</span><span>¥${s.bestDayRevenue.toLocaleString()}</span></div>
        <div class="report-item"><span>実績解除</span><span>${this.achievementMgr.getUnlockedCount()}/${this.achievementMgr.getTotalCount()}</span></div>
        <div class="report-item"><span>常連数</span><span>${this.customerDBMgr?.getTotalRegulars() || 0}人</span></div>
      </div>`;
    document.getElementById("btn-gameover-restart")?.addEventListener("click", () => {
      localStorage.removeItem("grand_resto_save");
      location.reload();
    });
    this.effects.notify("💀", "GAME OVER", "倒産", 4000);
  }

  // Tutorial
  advanceTutorial() { this.tutorialMgr.advance(); this.ui.render(); }
  skipTutorial() { this.tutorialMgr.skip(); this.ui.render(); }

  // Relocation
  relocate(locationId) {
    const r = this.relocationMgr.relocate(locationId);
    if (r.success) {
      this.ui.addLog(`🏠 ${r.location.name}に移転！（費用¥${r.location.landCost.toLocaleString()}）`);
      this.ui.addLog(`📊 評判: ${r.oldReputation} → ${r.newReputation}（新天地でやり直し）`);
      this.effects.notify("🏠", "店舗移転完了！", `${r.location.name}での新生活スタート`, 3000);
      this._syncBonuses();
    } else {
      this.ui.addLog(`❌ ${r.reason}`);
    }
    this.ui.render();
    return r;
  }
}

import { TitleScreen } from "./render/titleScreen.js";

// Hide main game UI initially
document.querySelector(".main").style.display = "none";
document.querySelector(".header").style.display = "none";

const title = new TitleScreen((isNew) => {
  document.querySelector(".main").style.display = "";
  document.querySelector(".header").style.display = "";
  if (isNew) { localStorage.removeItem("grand_resto_save"); }
  const app = new GameApp();
  app.init().catch(e => { console.error("Init failed:", e); document.body.innerHTML = `<div style="color:red;padding:40px;">起動エラー: ${e.message}</div>`; });
});
title.show();
