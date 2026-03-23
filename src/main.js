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
import { EndingManager } from "./systems/endingManager.js";
import { TownManager } from "./systems/townManager.js";
import { EffectManager } from "./render/effects.js";
import { UI } from "./render/ui.js";
import { saveGame, loadGame, hasSave, deleteSave } from "./save/saveManager.js";

class GameApp {
  async init() {
    const [config, menus, staffTemplates, eventsData, upgrades, customersData, skillsData, rivalsData, recipesData, achievementsData, seasonsData, formatsData, townsData, helpData, abilitiesData] = await Promise.all([
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
      fetch("./src/data/abilities.json").then(r => r.json())
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
    this.endingMgr = new EndingManager(this.state, this.achievementMgr);
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

    // Format cooldown
    this.formatMgr.advanceDay();

    // Sync multipliers
    this.sim.customerFlowMult = this.eventMgr.getCustomerFlowMultiplier();
    this.sim.ingredientCostMult = this.eventMgr.getIngredientCostMultiplier();
    this._syncBonuses();

    const report = this.sim.endDay();

    this.eventMgr.advanceDay();
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

  // Shift & Skill & Break
  setShift(id, sh) { const r = this.shiftMgr.setShift(id, sh); if (r.success) this.ui.render(); else this.ui.addLog(`❌ ${r.reason}`); return r; }
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

  // Table
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

  // Tutorial
  advanceTutorial() { this.tutorialMgr.advance(); this.ui.render(); }
  skipTutorial() { this.tutorialMgr.skip(); this.ui.render(); }
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
