import { FloorView } from "./floorView.js";
import { FloorEditor } from "./floor-editor.js";
import { ChartRenderer } from "./chart.js";
import { FURNITURE_TYPES, FURNITURE_GRADES, CATEGORY_INFO, getFurnitureCost, getGradeTier } from "../systems/furniture-data.js";

export class UI {
  constructor(gameApp) {
    this.app = gameApp;
    this.logLines = [];
    this.currentTab = "overview";
    this.skillViewStaffId = null;
    this.floorView = null;
    this.floorEditor = null;
    this.chartRenderer = null;
    this._layoutCat = "table";
    this._layoutGrade = "tier3";
    this._layoutSelectedType = null;
    this._layoutEditing = false;
  }

  init() {
    this._cacheElements();
    this._bindButtons();
    this.render();
  }

  _cacheElements() {
    this.el = {
      date: document.getElementById("date"),
      time: document.getElementById("time"),
      period: document.getElementById("period"),
      money: document.getElementById("money"),
      reputation: document.getElementById("reputation"),
      todayRevenue: document.getElementById("today-revenue"),
      todayCost: document.getElementById("today-cost"),
      todayProfit: document.getElementById("today-profit"),
      todayCustomers: document.getElementById("today-customers"),
      staffCount: document.getElementById("staff-count"),
      tableStatus: document.getElementById("table-status"),
      log: document.getElementById("log"),
      btnTick: document.getElementById("btn-tick"),
      btnAutoPlay: document.getElementById("btn-auto"),
      btnEndDay: document.getElementById("btn-end-day"),
      btnSave: document.getElementById("btn-save"),
      dayReport: document.getElementById("day-report"),
      dayReportContent: document.getElementById("day-report-content"),
      btnCloseReport: document.getElementById("btn-close-report"),
      restName: document.getElementById("rest-name"),
      sidePanel: document.getElementById("side-panel"),
      activeEffects: document.getElementById("active-effects"),
      scenarioGoals: document.getElementById("scenario-goals"),
      tabBtns: document.querySelectorAll(".tab-btn")
    };
  }

  _bindButtons() {
    this.el.btnTick.addEventListener("click", () => this.app.doTick());
    this.el.btnAutoPlay.addEventListener("click", () => this.app.toggleAuto());
    this.el.btnEndDay.addEventListener("click", () => this.app.doEndDay());
    this.el.btnSave.addEventListener("click", () => this.app.doSave());
    this.el.btnCloseReport.addEventListener("click", () => this.el.dayReport.classList.add("hidden"));
    for (const btn of this.el.tabBtns) {
      btn.addEventListener("click", () => { this.currentTab = btn.dataset.tab; this.render(); });
    }

    // Tutorial
    document.getElementById("btn-tutorial-next")?.addEventListener("click", () => this.app.advanceTutorial());
    document.getElementById("btn-tutorial-skip")?.addEventListener("click", () => this.app.skipTutorial());

    // Floor view & editor
    const floorCanvas = document.getElementById("floor-canvas");
    if (floorCanvas) {
      this.floorView = new FloorView(floorCanvas);
      this.floorView.startAnimation(this.app.state, this.app.sim);
      if (this.app.furnitureMgr) {
        this.floorEditor = new FloorEditor(floorCanvas, this.app.furnitureMgr, this.app.state);
        this.floorEditor.onPlaced(() => this.render());
        this.floorEditor.onError((msg) => this.app.ui.addLog(`❌ ${msg}`));
      }
    }

    // Show tutorial if needed
    this._renderTutorial();
  }

  render() {
    const s = this.app.state;
    const t = s.time;
    this.el.restName.textContent = s.restaurant.name;
    this.el.date.textContent = `${t.year}年${t.month}月${t.day}日`;
    this.el.time.textContent = `${String(t.hour).padStart(2,"0")}:${String(t.minute).padStart(2,"0")}`;
    this.el.period.textContent = this._periodLabel(t.hour);
    this.el.money.textContent = `¥${s.restaurant.money.toLocaleString()}`;
    this.el.reputation.textContent = `${s.restaurant.reputation}/100`;

    const log = s.todayLog;
    this.el.todayRevenue.textContent = `¥${log.revenue.toLocaleString()}`;
    this.el.todayCost.textContent = `¥${log.cost.toLocaleString()}`;
    const p = log.revenue - log.cost;
    this.el.todayProfit.textContent = `¥${p.toLocaleString()}`;
    this.el.todayProfit.className = `stat-value ${p >= 0 ? "positive" : "negative"}`;
    this.el.todayCustomers.textContent = `${log.customers}人`;
    this.el.staffCount.textContent = `${s.staff.filter(st => st.shift !== "off").length}/${s.staff.length}`;

    // Season & format
    const season = this.app.seasonMgr.getSeasonInfo();
    document.getElementById("season-badge").textContent = `${season.icon}${season.name}`;
    document.getElementById("season-badge").style.color = season.color;
    const fmt = this.app.formatMgr.getCurrentFormat();
    document.getElementById("format-badge").textContent = `${fmt.icon}${fmt.name.replace(/レストラン|専門店|料理店/g, "")}`;
    // Awareness
    const mktSum = this.app.marketingMgr?.getSummary();
    if (mktSum) {
      const ab = document.getElementById("awareness-badge");
      if (ab) { ab.textContent = `${mktSum.awareness}%`; ab.style.color = mktSum.awareness < 20 ? "#c94040" : mktSum.awareness < 50 ? "#d4a843" : "#4aaa6a"; }
    }

    const locInfo = this.app.relocationMgr.getLocationInfo();
    const locBadge = document.getElementById("location-badge");
    if (locBadge) locBadge.textContent = `📍${locInfo.name.substring(0, 6)}`;

    this._renderTables();
    this._renderActiveEffects();
    this._renderGoals();
    this._renderSidePanel();
    this._renderTutorial();
    for (const btn of this.el.tabBtns) btn.classList.toggle("active", btn.dataset.tab === this.currentTab);
  }

  _periodLabel(h) {
    if (h < 10) return "開店前";
    if (h < 14) return "🌞 ランチ";
    if (h < 17) return "☕ アイドル";
    if (h < 21) return "🌙 ディナー";
    return "閉店間際";
  }

  _renderTables() {
    const tables = this.app.state.restaurant.tables;
    const occ = new Set((this.app.sim?.customers||[]).filter(c=>c.status==="seated"||c.status==="eating").map(c=>c.tableId));
    this.el.tableStatus.innerHTML = tables.map(t => {
      const c = this.app.sim?.customers?.find(c => c.tableId === t.id && (c.status==="seated"||c.status==="eating"));
      const icon = c ? c.typeIcon || "🍽" : "";
      return `<div class="table-cell ${occ.has(t.id)?"occupied":"empty"}">${t.seats}席${icon ? "<br>"+icon : ""}</div>`;
    }).join("");
  }

  _renderActiveEffects() {
    const effs = this.app.getActiveEffects();
    this.el.activeEffects.innerHTML = effs.length === 0
      ? '<span class="muted">効果なし</span>'
      : effs.map(e => `<div class="effect-tag">${e}</div>`).join("");
  }

  _renderGoals() {
    const goals = this.app.checkGoals();
    if (!goals) { this.el.scenarioGoals.innerHTML = ""; return; }
    this.el.scenarioGoals.innerHTML = goals.map(g => {
      const pct = Math.min(100, Math.round((g.current / g.target) * 100));
      return `<div class="goal-row"><span class="goal-label">${g.achieved?"✅":"⬜"} ${g.label}</span><div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div><span class="goal-pct">${pct}%</span></div>`;
    }).join("");
  }

  _renderSidePanel() {
    const sp = this.el.sidePanel;
    switch (this.currentTab) {
      case "overview": this._tabOverview(sp); break;
      case "staff": this._tabStaff(sp); break;
      case "shift": this._tabShift(sp); break;
      case "skill": this._tabSkill(sp); break;
      case "compat": this._tabCompat(sp); break;
      case "menu": this._tabMenu(sp); break;
      case "recipe": this._tabRecipe(sp); break;
      case "rival": this._tabRival(sp); break;
      case "upgrade": this._tabUpgrade(sp); break;
      case "marketing": this._tabMarketing(sp); break;
      case "ops": this._tabOps(sp); break;
      case "layout": this._tabLayout(sp); break;
      case "relocate": this._tabRelocate(sp); break;
      case "reserve": this._tabReserve(sp); break;
      case "custdb": this._tabCustDB(sp); break;
      case "account": this._tabAccount(sp); break;
      case "format": this._tabFormat(sp); break;
      case "chart": this._tabChart(sp); break;
      case "achieve": this._tabAchieve(sp); break;
    }
  }

  // ─── OVERVIEW ───
  _tabOverview(el) {
    const s = this.app.state;

    // ── DASHBOARD ──
    const mkt = this.app.marketingMgr?.getSummary() || {};
    const cleanOverall = this.app.cleaningMgr?.getOverallCleanliness() || 0;
    const prepReady = this.app.prepMgr ? Math.round(this.app.prepMgr.getPrepReadiness() * 100) : 0;
    const failedEq = this.app.equipmentMgr?.getFailedEquipment() || [];
    const rsvCount = this.app.reservationMgr?.getTodayCount() || 0;
    const regulars = this.app.customerDBMgr?.getTotalRegulars() || 0;
    const acctSum = this.app.accountingMgr?.getSummary() || {};
    const season = this.app.seasonMgr?.getSeasonInfo() || {};
    const locInfo = this.app.relocationMgr?.getLocationInfo() || {};

    let h = `<div class="side-section"><h4>📊 経営ダッシュボード</h4>
      <div class="layout-score">
        <div class="ls-item"><div class="ls-label">認知度</div><div class="ls-val" style="color:${(mkt.awareness||0)<20?"var(--red)":(mkt.awareness||0)<50?"var(--gold)":"var(--green)"}">${mkt.awareness||0}%</div></div>
        <div class="ls-item"><div class="ls-label">清潔度</div><div class="ls-val" style="color:${cleanOverall<40?"var(--red)":cleanOverall<70?"var(--gold)":"var(--green)"}">${cleanOverall}%</div></div>
        <div class="ls-item"><div class="ls-label">仕込み</div><div class="ls-val" style="color:${prepReady<60?"var(--red)":prepReady<100?"var(--gold)":"var(--green)"}">${prepReady}%</div></div>
        <div class="ls-item"><div class="ls-label">口コミ</div><div class="ls-val">${(mkt.reviewScore||0)>0?"★"+(mkt.reviewScore||0).toFixed(1):"—"}</div></div>
        <div class="ls-item"><div class="ls-label">予約</div><div class="ls-val">${rsvCount}組</div></div>
        <div class="ls-item"><div class="ls-label">常連</div><div class="ls-val">${regulars}人</div></div>
        <div class="ls-item"><div class="ls-label">集客率</div><div class="ls-val">${mkt.trafficCoeff||0}%</div></div>
        <div class="ls-item"><div class="ls-label">借入</div><div class="ls-val" style="color:${(acctSum.totalDebt||0)>0?"var(--red)":"var(--text2)"}">${(acctSum.totalDebt||0)>0?"¥"+(acctSum.totalDebt/10000).toFixed(0)+"万":"なし"}</div></div>
      </div>
      ${failedEq.length>0?`<div class="turnover-danger">💥 故障設備: ${failedEq.map(e=>e.name).join(", ")}</div>`:""}
      ${this.app.cleaningMgr?.isShutdown()?'<div class="turnover-danger">🚫 営業停止中</div>':""}
      ${(acctSum.bankruptDays||0)>0?`<div class="turnover-danger">⚠ 倒産まで残${7-(acctSum.bankruptDays||0)}日</div>`:""}
    </div>`;

    // ── STAFF MINI LIST ──
    h += `<div class="side-section"><h4>👨‍🍳 スタッフ (${s.staff.length}人)</h4>`;
    h += s.staff.map(st => {
      const abl = this.app.abilityMgr.getStaffAbility(st);
      return `
      <div class="staff-card-mini">
        <div class="scm-top">
          <span class="staff-name">${st.name}${abl ? ` ${abl.icon}` : ""}</span>
          <span class="staff-role-badge ${st.role}">${st.role==="cook"?"料理":"ホール"} Lv.${st.level}</span>
          <span class="shift-icon">${this.app.shiftMgr.getShiftIcon(st.shift||"full", st)}</span>
        </div>
        <div class="staff-bars">
          <div class="bar-row"><span class="bar-label">体力</span><div class="bar"><div class="bar-fill fatigue" style="width:${100-st.fatigue}%"></div></div></div>
          <div class="bar-row"><span class="bar-label">士気</span><div class="bar"><div class="bar-fill morale" style="width:${st.morale}%"></div></div></div>
        </div>
      </div>`;
    }).join("");
    h += `</div>`;

    const active = this.app.menus.menus.filter(m => s.restaurant.activeMenuIds.includes(m.id));
    h += `<div class="side-section"><h4>🍱 メニュー (${active.length}品)</h4>`;
    h += active.map(m => `<div class="menu-row"><span>${m.name}</span><span class="menu-price-sm">¥${m.price}</span></div>`).join("");
    const rs = this.app.getResearchStatus();
    if (rs) h += `<div class="research-status">🔬 研究中: ${rs.menuName} (残${rs.daysLeft}日)</div>`;
    h += `</div>`;

    // Customer type log
    const ct = s.todayLog.customerTypes || {};
    if (Object.keys(ct).length > 0) {
      h += `<div class="side-section"><h4>👥 本日の客層</h4>`;
      h += Object.entries(ct).map(([k,v]) => `<div class="mini-stat">${k}: ${v}人</div>`).join("");
      h += `</div>`;
    }

    // Turnover warnings
    const atRisk = s.staff.filter(st2 => { const r = this.app.turnoverMgr.getQuitRisk(st2); return r >= 20; });
    if (atRisk.length > 0) {
      h += `<div class="side-section"><h4>⚠️ 離職リスク</h4>`;
      h += atRisk.map(st2 => {
        const risk = this.app.turnoverMgr.getQuitRisk(st2);
        const rl = this.app.turnoverMgr.getRiskLevel(risk);
        return `<div class="${risk>=50?"turnover-danger":"turnover-warn"}">${rl.icon} ${st2.name}: ${rl.label} (${risk}%)</div>`;
      }).join("");
      h += `</div>`;
    }

    // Rivals
    const rivals = this.app.rivalMgr.getActiveRivals();
    if (rivals.length > 0) {
      h += `<div class="side-section"><h4>⚔️ ライバル (${rivals.length}店)</h4>`;
      h += rivals.map(r => `<div class="mini-stat" style="color:var(--red)">${r.name}</div>`).join("");
      h += `</div>`;
    }

    // Town info
    const town = this.app.townMgr.getTownInfo();
    h += `<div class="side-section"><h4>${town.typeIcon} ${town.name}（${town.typeName}）</h4>
      <div class="muted">${town.description}</div>
      <div class="mini-stat">人口: ${town.population.toLocaleString()} / 発展度: ${town.development}/100</div>
      <div class="mini-stat">家賃: ¥${town.rent.toLocaleString()}/月</div>
    </div>`;

    const stt = s.stats;
    h += `<div class="side-section"><h4>📊 通算</h4>
      <div class="mini-stat">営業${stt.daysPlayed}日 / 来客${stt.totalCustomers.toLocaleString()}人</div>
      <div class="mini-stat">総売上¥${stt.totalRevenue.toLocaleString()} / 最高¥${stt.bestDayRevenue.toLocaleString()}</div>
      <div class="mini-stat">推定日人件費: ¥${this.app.shiftMgr.estimateDailyCost().toLocaleString()}</div>
    </div>`;
    el.innerHTML = h;
  }

  // ─── STAFF ───
  _tabStaff(el) {
    const s = this.app.state;
    let h = `<div class="side-section"><h4>👨‍🍳 スタッフ詳細</h4>`;
    h += s.staff.map(st => {
      const sk = this.app.skillMgr.getStaffSkillSummary(st);
      const ability = this.app.abilityMgr.getStaffAbility(st);
      return `<div class="staff-card-detail">
        <div class="scd-header">
          <span class="staff-name">${st.name}</span>
          <span class="staff-role-badge ${st.role}">${st.role==="cook"?"料理人":"ホール"} Lv.${st.level}</span>
        </div>
        ${ability ? `<div class="ability-badge" style="border-color:${this.app.abilityMgr.getRarityColor(ability.rarity)};color:${this.app.abilityMgr.getRarityColor(ability.rarity)}">${ability.icon} ${ability.name} <span class="muted">${ability.description}</span></div>` : ""}
        <div class="stat-grid-6">
          ${Object.entries(st.stats).map(([k,v])=>`<div class="stat-mini"><div class="stat-mini-label">${this._sl(k)}</div><div class="stat-mini-val">${v}</div></div>`).join("")}
        </div>
        <div class="scd-info">
          <span>¥${st.salary.toLocaleString()}/月</span>
          <span>勤続${st.daysWorked}日</span>
          <span>EXP ${st.experience}/${st.level*10}</span>
          ${sk.path ? `<span>🌳${sk.path.icon}${sk.path.name}</span>` : ""}
          ${sk.points > 0 ? `<span class="sp-badge">SP:${sk.points}</span>` : ""}
        </div>
        <button class="btn btn-sm danger fire-btn" data-id="${st.id}">解雇</button>
      </div>`;
    }).join("");
    h += `</div><div class="side-section"><h4>📋 採用</h4>
      <button class="btn btn-sm" id="btn-refresh-applicants">応募者を募集</button>
      <div id="applicant-list" style="margin-top:8px;"></div></div>`;
    el.innerHTML = h;

    for (const b of el.querySelectorAll(".fire-btn")) b.addEventListener("click", () => this.app.fireStaff(b.dataset.id));
    const rb = document.getElementById("btn-refresh-applicants");
    if (rb) rb.addEventListener("click", () => { this.app.refreshApplicants(); this._renderApplicants(); });
    this._renderApplicants();
  }

  _renderApplicants() {
    const list = document.getElementById("applicant-list");
    if (!list) return;
    const apps = this.app.getApplicants();
    if (apps.length === 0) { list.innerHTML = '<div class="muted">「応募者を募集」を押してください</div>'; return; }
    list.innerHTML = apps.map((a,i) => `
      <div class="applicant-card">
        <div class="app-header"><span class="staff-name">${a.name}</span><span class="staff-role-badge ${a.role}">${a.role==="cook"?"料理人":"ホール"}</span></div>
        <div class="app-desc">${a.description}</div>
        <div class="stat-grid-6">${Object.entries(a.stats).map(([k,v])=>`<div class="stat-mini"><div class="stat-mini-label">${this._sl(k)}</div><div class="stat-mini-val">${v}</div></div>`).join("")}</div>
        <div class="app-cost">採用費¥${a.hireCost.toLocaleString()} / 月給¥${a.salary.toLocaleString()}</div>
        <button class="btn btn-sm primary hire-btn" data-index="${i}">採用</button>
      </div>`).join("");
    for (const b of list.querySelectorAll(".hire-btn")) b.addEventListener("click", () => { this.app.hireStaff(parseInt(b.dataset.index)); this._renderApplicants(); });
  }

  // ─── SHIFT ───
  _tabShift(el) {
    const s = this.app.state;
    const sm = this.app.shiftMgr;
    const counts = sm.getStaffSummary();

    let h = `<div class="side-section"><h4>📅 シフト管理</h4>
      <div class="shift-summary">
        <span>🔵フル${counts.full}</span> <span>🌅午前${counts.morning}</span>
        <span>🌆午後${counts.evening}</span> <span>💤休${counts.off}</span>
      </div>
      <div class="muted" style="margin:6px 0">推定日人件費: ¥${sm.estimateDailyCost().toLocaleString()}</div>
    </div>`;

    h += s.staff.map(st => {
      const shifts = ["full","morning","evening","off"];
      const onBreak = sm.isOnBreak(st);
      return `<div class="shift-card ${onBreak ? "on-break" : ""}">
        <div class="scm-top">
          <span class="staff-name">${sm.getShiftIcon(st.shift, st)} ${st.name}</span>
          <span class="staff-role-badge ${st.role}">${st.role==="cook"?"料理":"ホール"} Lv.${st.level}</span>
        </div>
        <div class="shift-btns">
          ${shifts.map(sh => `<button class="shift-btn ${(st.shift||"full")===sh&&!onBreak?"selected":""}" data-id="${st.id}" data-shift="${sh}">${sm.getShiftIcon(sh)} ${sm.getShiftLabel(sh)}</button>`).join("")}
        </div>
        <div style="margin-top:4px;display:flex;gap:3px;align-items:center">
          ${onBreak
            ? `<span class="break-badge">☕ 休憩中 残${st.breakRemaining}分</span><button class="btn btn-sm break-cancel-btn" data-id="${st.id}">復帰</button>`
            : st.shift !== "off"
              ? `<button class="btn btn-sm break-btn" data-id="${st.id}" data-min="20">☕20分</button><button class="btn btn-sm break-btn" data-id="${st.id}" data-min="30">☕30分</button><button class="btn btn-sm break-btn" data-id="${st.id}" data-min="60">☕60分</button>`
              : ""
          }
        </div>
        <div class="bar-row" style="margin-top:4px"><span class="bar-label">疲</span><div class="bar"><div class="bar-fill fatigue" style="width:${100-st.fatigue}%"></div></div><span class="bar-label">気</span><div class="bar"><div class="bar-fill morale" style="width:${st.morale}%"></div></div></div>
        <div style="display:flex;gap:4px;margin-top:3px;font-size:8px;color:var(--text2);flex-wrap:wrap">
          <span>週${st.weeklyHours||0}h${(st.weeklyHours||0)>40?"⚠️":""}</span>
          ${st.overtimeHours>0?`<span style="color:var(--red)">残業${st.overtimeHours}h</span>`:""}
          <span>有給${st.paidLeave||0}日</span>
          ${st.isTrainee?`<span style="color:var(--blue)">🔰研修${st.traineeDay||0}/14日</span>`:""}
          ${(st._consecutiveWorkDays||0)>=5?`<span style="color:var(--gold)">${st._consecutiveWorkDays}連勤</span>`:""}
          ${(st.paidLeave||0)>0&&st.shift!=="off"?`<button class="btn btn-sm paid-leave-btn" data-id="${st.id}" style="font-size:8px;padding:1px 4px">🏖有給</button>`:""}
        </div>
      </div>`;
    }).join("");
    el.innerHTML = h;

    for (const b of el.querySelectorAll(".shift-btn")) {
      b.addEventListener("click", () => this.app.setShift(b.dataset.id, b.dataset.shift));
    }
    for (const b of el.querySelectorAll(".break-btn")) {
      b.addEventListener("click", () => this.app.sendOnBreak(b.dataset.id, parseInt(b.dataset.min)));
    }
    for (const b of el.querySelectorAll(".paid-leave-btn")) {
      b.addEventListener("click", () => this.app.usePaidLeave(b.dataset.id));
    }
    for (const b of el.querySelectorAll(".break-cancel-btn")) {
      b.addEventListener("click", () => this.app.cancelBreak(b.dataset.id));
    }
  }

  // ─── SKILL ───
  _tabSkill(el) {
    const s = this.app.state;
    if (!this.skillViewStaffId || !s.staff.find(st => st.id === this.skillViewStaffId)) {
      this.skillViewStaffId = s.staff[0]?.id;
    }

    let h = `<div class="side-section"><h4>🌳 スキルツリー</h4>
      <div class="skill-staff-select">`;
    h += s.staff.map(st =>
      `<button class="btn btn-sm ${st.id===this.skillViewStaffId?"primary":""} skill-staff-btn" data-id="${st.id}">${st.name}</button>`
    ).join(" ");
    h += `</div></div>`;

    const staff = s.staff.find(st => st.id === this.skillViewStaffId);
    if (staff) {
      const sk = this.app.skillMgr.getStaffSkillSummary(staff);
      h += `<div class="side-section">
        <div class="skill-header">${staff.name} (${staff.role==="cook"?"料理人":"ホール"} Lv.${staff.level}) — SP: ${sk.points}</div>`;

      if (!sk.path) {
        const paths = this.app.skillMgr.getPathsForRole(staff.role);
        h += `<div class="muted" style="margin:8px 0">スキルパスを選択してください:</div>`;
        h += paths.map(p => `
          <div class="path-card">
            <div class="path-header">${p.icon} ${p.name}</div>
            <div class="muted">${p.description}</div>
            <button class="btn btn-sm primary select-path-btn" data-staff="${staff.id}" data-path="${p.id}">選択</button>
          </div>`).join("");
      } else {
        h += `<div class="path-badge">${sk.path.icon} ${sk.path.name}</div>`;
        h += `<div class="skill-tree">`;
        h += sk.nodes.map(n => `
          <div class="skill-node ${n.unlocked?"unlocked":""} ${n.canUnlock?"available":""}">
            <div class="sn-header">
              <span>${n.unlocked?"✅":"⬜"} ${n.name}</span>
              <span class="sn-level">Lv.${n.level}</span>
            </div>
            <div class="sn-desc">${n.description}</div>
            ${n.canUnlock ? `<button class="btn btn-sm primary unlock-node-btn" data-staff="${staff.id}" data-node="${n.id}">習得 (1SP)</button>` : ""}
          </div>`).join("");
        h += `</div>`;
      }
      h += `</div>`;
    }
    el.innerHTML = h;

    for (const b of el.querySelectorAll(".skill-staff-btn")) {
      b.addEventListener("click", () => { this.skillViewStaffId = b.dataset.id; this.render(); });
    }
    for (const b of el.querySelectorAll(".select-path-btn")) {
      b.addEventListener("click", () => this.app.selectPath(b.dataset.staff, b.dataset.path));
    }
    for (const b of el.querySelectorAll(".unlock-node-btn")) {
      b.addEventListener("click", () => this.app.unlockSkillNode(b.dataset.staff, b.dataset.node));
    }
  }

  // ─── MENU ───
  _tabMenu(el) {
    const s = this.app.state;
    const all = this.app.menus.menus;
    const active = all.filter(m => s.restaurant.activeMenuIds.includes(m.id));

    let h = `<div class="side-section"><h4>🍱 提供中 (${active.length}品)</h4>`;
    h += active.map(m => `
      <div class="menu-detail-row">
        <div class="mdr-top"><span class="menu-name">${m.name}</span><span class="genre-tag">${this._genreLabel(m.genre)}</span></div>
        <div class="price-row">
          <button class="price-btn price-down" data-id="${m.id}" data-delta="-50">-</button>
          <span class="price-val">¥${m.price}</span>
          <button class="price-btn price-up" data-id="${m.id}" data-delta="50">+</button>
          <span class="muted" style="margin-left:4px">原¥${m.cost} 利¥${m.price-m.cost}</span>
        </div>
      </div>`).join("");
    h += `</div>`;

    const unlocked = all.filter(m => m.unlocked && !s.restaurant.activeMenuIds.includes(m.id));
    if (unlocked.length > 0) {
      h += `<div class="side-section"><h4>📦 停止中</h4>`;
      h += unlocked.map(m => `<div class="menu-detail-row"><span>${m.name} (¥${m.price})</span><button class="btn btn-sm activate-menu-btn" data-id="${m.id}">提供開始</button></div>`).join("");
      h += `</div>`;
    }

    const rs = this.app.getResearchStatus();
    h += `<div class="side-section"><h4>🔬 メニュー研究</h4>`;
    if (rs) {
      const pct = Math.round(((rs.totalDays - rs.daysLeft) / rs.totalDays) * 100);
      h += `<div class="research-card"><div>研究中: <strong>${rs.menuName}</strong></div><div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div><div class="muted">残り${rs.daysLeft}日</div></div>`;
    } else {
      const researchable = this.app.getResearchableMenus();
      if (researchable.length === 0) {
        h += '<div class="muted">研究可能メニューなし（料理人Lvを上げましょう）</div>';
      } else {
        h += researchable.map(m => `
          <div class="research-option">
            <div class="ro-top"><strong>${m.name}</strong> <span class="genre-tag">${this._genreLabel(m.genre)}</span> ¥${m.price}</div>
            <div class="muted">${m.description}</div>
            <div class="ro-cost">費用¥${m.effectiveResearchCost.toLocaleString()} / ${m.effectiveResearchDays}日 / 要Lv.${m.requiredCookLevel||1}</div>
            <button class="btn btn-sm primary research-btn" data-id="${m.id}">研究開始</button>
          </div>`).join("");
      }
    }
    h += `</div>`;
    el.innerHTML = h;

    for (const b of el.querySelectorAll(".research-btn")) b.addEventListener("click", () => this.app.startResearch(b.dataset.id));
    for (const b of el.querySelectorAll(".activate-menu-btn")) b.addEventListener("click", () => { this.app.menuMgr.toggleMenu(b.dataset.id); this.render(); });
    for (const b of el.querySelectorAll(".price-btn")) {
      b.addEventListener("click", () => {
        const menu = this.app.menus.menus.find(m => m.id === b.dataset.id);
        if (menu) this.app.setMenuPrice(b.dataset.id, menu.price + parseInt(b.dataset.delta));
      });
    }
  }

  // ─── UPGRADE ───
  _tabUpgrade(el) {
    const s = this.app.state;
    const tables = s.restaurant.tables;
    const max = this.app.upgrades.maxTables;

    let h = `<div class="side-section"><h4>🪑 テーブル (${tables.length}/${max})</h4>`;
    if (tables.length >= max) {
      h += '<div class="muted">上限到達</div>';
    } else {
      h += this.app.upgrades.tables.map(t => `
        <div class="upgrade-card">
          <div class="uc-top"><strong>${t.name}</strong> (${t.seats}人席) <span class="menu-price">¥${t.cost.toLocaleString()}</span></div>
          <div class="muted">${t.description}</div>
          <button class="btn btn-sm primary buy-table-btn" data-type="${t.id}">購入</button>
        </div>`).join("");
    }
    h += `</div>`;

    const seatCounts = {};
    for (const t of tables) seatCounts[t.seats] = (seatCounts[t.seats]||0) + 1;
    h += `<div class="side-section"><h4>現在の構成</h4>`;
    h += Object.entries(seatCounts).map(([s,c])=>`<div class="mini-stat">${s}人席 × ${c}</div>`).join("");
    h += `<div class="mini-stat" style="color:var(--gold)">合計 ${tables.reduce((s,t)=>s+t.seats,0)}席</div></div>`;
    el.innerHTML = h;

    for (const b of el.querySelectorAll(".buy-table-btn")) b.addEventListener("click", () => this.app.buyTable(b.dataset.type));
  }

  // ─── COMPAT + MENTOR ───
  _tabCompat(el) {
    const s = this.app.state;
    const cm = this.app.compatMgr;
    const mm = this.app.mentorMgr;

    // Mentor pairs
    const pairs = mm.getMentorPairs();
    let h = `<div class="side-section"><h4>🎓 師弟関係</h4>`;
    if (pairs.length > 0) {
      h += pairs.map(p => `
        <div class="mentor-pair">
          <span class="staff-name">${p.mentor.name}</span> <span class="mp-arrow">→</span> <span class="staff-name">${p.apprentice.name}</span>
          <div class="muted">弟子の成長+50% / 師匠の効率-10%</div>
          <button class="btn btn-sm danger dissolve-btn" data-id="${p.mentor.id}">解消</button>
        </div>`).join("");
    } else {
      h += '<div class="muted">師弟関係なし</div>';
    }

    // Create new pair
    const mentors = s.staff.filter(st => mm.canBeMentor(st));
    const apprentices = s.staff.filter(st => mm.canBeApprentice(st));
    if (mentors.length > 0 && apprentices.length > 0) {
      h += `<div style="margin-top:8px"><div class="muted">新しい師弟関係を作る:</div>
        <select id="sel-mentor" class="sel-small">${mentors.map(m => `<option value="${m.id}">${m.name}(Lv.${m.level})</option>`).join("")}</select>
        <span class="mp-arrow">→</span>
        <select id="sel-apprentice" class="sel-small">${apprentices.map(a => `<option value="${a.id}">${a.name}(Lv.${a.level})</option>`).join("")}</select>
        <button class="btn btn-sm primary" id="btn-assign-mentor">設定</button></div>`;
    }
    h += `</div>`;

    // Compatibility list
    h += `<div class="side-section"><h4>💞 スタッフ相性</h4>`;
    const allPairs = cm.getAllPairs();
    if (allPairs.length === 0) {
      h += '<div class="muted">スタッフが2人以上必要です</div>';
    } else {
      h += allPairs.map(p => {
        const combos = cm.getComboEffects(p.staff1, p.staff2);
        return `<div class="compat-pair" style="border-left-color:${p.color}">
          <span class="cp-names">${p.staff1.name} × ${p.staff2.name}</span>
          <span class="cp-val" style="color:${p.color}">${p.value > 0 ? "+" : ""}${p.value}</span>
          <span class="cp-label">${p.icon} ${p.label}</span>
          ${combos.map(c => `<div class="combo-effect">${c.name}: ${c.desc}</div>`).join("")}
        </div>`;
      }).join("");
    }
    h += `</div>`;

    // Turnover risks with raise option
    h += `<div class="side-section"><h4>⚠️ 離職リスク・昇給</h4>`;
    h += s.staff.map(st => {
      const risk = this.app.turnoverMgr.getQuitRisk(st);
      const rl = this.app.turnoverMgr.getRiskLevel(risk);
      return `<div class="staff-card-mini">
        <div class="scm-top"><span class="staff-name">${st.name}</span><span style="color:${rl.color}">${rl.icon} ${rl.label} ${risk}%</span></div>
        <div class="muted">月給 ¥${st.salary.toLocaleString()}</div>
        <button class="btn btn-sm raise-btn" data-id="${st.id}" data-amount="10000">+1万</button>
        <button class="btn btn-sm raise-btn" data-id="${st.id}" data-amount="30000">+3万</button>
      </div>`;
    }).join("");
    h += `</div>`;

    el.innerHTML = h;

    for (const b of el.querySelectorAll(".dissolve-btn")) b.addEventListener("click", () => this.app.dissolveMentor(b.dataset.id));
    for (const b of el.querySelectorAll(".raise-btn")) b.addEventListener("click", () => this.app.raiseSalary(b.dataset.id, parseInt(b.dataset.amount)));
    const amBtn = document.getElementById("btn-assign-mentor");
    if (amBtn) amBtn.addEventListener("click", () => {
      const mid = document.getElementById("sel-mentor").value;
      const aid = document.getElementById("sel-apprentice").value;
      this.app.assignMentor(mid, aid);
    });
  }

  // ─── RECIPE ───
  _tabRecipe(el) {
    const rm = this.app.recipeMgr;
    if (!this._recipeSelection) this._recipeSelection = { ingredients: [], method: null };
    const sel = this._recipeSelection;

    let h = `<div class="side-section"><h4>🔬 料理錬成</h4>
      <div class="muted">食材3つ×調理法1つを選んで研究。隠しレシピを発見しよう！</div></div>`;

    // Ingredients
    const available = rm.getAvailableIngredients();
    h += `<div class="side-section"><h4>🧂 食材を選択 (${sel.ingredients.length}/3)</h4>
      <div class="recipe-grid">
        ${available.map(i => `<div class="recipe-ing ${sel.ingredients.includes(i.id)?"selected":""}" data-id="${i.id}">${i.name}<br><span class="muted">¥${i.cost}</span></div>`).join("")}
      </div></div>`;

    // Locked ingredients
    const locked = rm.getLockedIngredients();
    if (locked.length > 0) {
      h += `<div class="side-section"><h4>🔒 未開拓の食材</h4>
        <div class="recipe-grid">
          ${locked.map(i => `<div class="recipe-ing" style="opacity:0.5"><span>${i.name}</span><br><button class="btn btn-sm unlock-ing-btn" data-id="${i.id}">¥${(i.cost*50).toLocaleString()}で開拓</button></div>`).join("")}
        </div></div>`;
    }

    // Methods
    h += `<div class="side-section"><h4>🔥 調理法を選択</h4>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${rm.getCookingMethods().map(m => `<div class="recipe-method ${sel.method===m.id?"selected":""}" data-id="${m.id}">${m.name}</div>`).join("")}
      </div></div>`;

    // Try button
    const canTry = sel.ingredients.length === 3 && sel.method;
    h += `<div class="side-section">
      <button class="btn ${canTry?"primary":""}" id="btn-try-recipe" ${canTry?"":"disabled"}>🔬 研究する</button>
    </div>`;

    // Hint
    const hint = rm.getHintForUndiscovered();
    if (hint) h += `<div class="side-section"><div class="muted">💡 ${hint.hint}（未発見: ${hint.totalUndiscovered}種）</div></div>`;

    // Discovered
    const discovered = rm.getDiscoveredRecipes();
    if (discovered.length > 0) {
      h += `<div class="side-section"><h4>📜 発見済みレシピ (${discovered.length})</h4>`;
      h += discovered.map(m => `<div class="menu-row"><span>${m.name}</span><span class="menu-price-sm">¥${m.price}</span></div>`).join("");
      h += `</div>`;
    }

    el.innerHTML = h;

    // Bind ingredient clicks
    for (const b of el.querySelectorAll(".recipe-ing:not([style])")) {
      if (!b.querySelector("button")) {
        b.addEventListener("click", () => {
          const id = b.dataset.id;
          const idx = sel.ingredients.indexOf(id);
          if (idx >= 0) sel.ingredients.splice(idx, 1);
          else if (sel.ingredients.length < 3) sel.ingredients.push(id);
          this.render();
        });
      }
    }
    for (const b of el.querySelectorAll(".recipe-method")) {
      b.addEventListener("click", () => { sel.method = b.dataset.id; this.render(); });
    }
    for (const b of el.querySelectorAll(".unlock-ing-btn")) {
      b.addEventListener("click", (e) => { e.stopPropagation(); this.app.unlockIngredient(b.dataset.id); });
    }
    const tryBtn = document.getElementById("btn-try-recipe");
    if (tryBtn) tryBtn.addEventListener("click", () => {
      const r = this.app.tryRecipe(sel.ingredients, sel.method);
      if (r.discovered) { sel.ingredients = []; sel.method = null; }
      this.render();
    });
  }

  // ─── RIVAL ───
  _tabRival(el) {
    const rivals = this.app.rivalMgr.getActiveRivals();
    const effects = this.app.rivalMgr.getActiveEffects();

    let h = `<div class="side-section"><h4>⚔️ ライバル店 (${rivals.length})</h4>`;
    if (rivals.length === 0) {
      h += '<div class="muted">まだライバルは出現していません。営業を続けていると近隣に出店してきます。</div>';
    } else {
      h += rivals.map(r => `
        <div class="rival-card">
          <div class="rival-name">${r.name}</div>
          <div class="rival-info">${r.description}</div>
          <div class="rival-info">ジャンル: ${this._genreLabel(r.genre)} / 価格帯: ${r.priceRange} / 攻撃性: ${Math.round(r.aggressiveness*100)}%</div>
          <div class="rival-info">客奪取率: ${Math.round(r.customerSteal*100)}% / ターゲット: ${r.targetCustomers.join(", ")}</div>
        </div>`).join("");
    }
    h += `</div>`;

    if (effects.length > 0) {
      h += `<div class="side-section"><h4>📢 ライバルの動き</h4>`;
      h += effects.map(e => `<div class="effect-tag" style="border-color:var(--red)">${e}</div>`).join("");
      h += `</div>`;
    }

    h += `<div class="side-section"><h4>💡 対策のヒント</h4>
      <div class="muted">・評判を上げて客の信頼を勝ち取る</div>
      <div class="muted">・ライバルと異なるジャンルのメニューで差別化</div>
      <div class="muted">・スタッフの待遇を良くして引き抜きを防ぐ</div>
      <div class="muted">・錬成で隠しメニューを開発し独自性を出す</div>
    </div>`;
    el.innerHTML = h;
  }

  // ─── OPS (清掃・仕込み・設備) ───
  _tabOps(el) {
    const cm = this.app.cleaningMgr;
    const pm = this.app.prepMgr;
    const em = this.app.equipmentMgr;
    if (!cm || !pm || !em) { el.innerHTML = '<div class="muted">運営システム未初期化</div>'; return; }

    let h = "";

    // ── CLEANING ──
    const areas = cm.getAreaSummaries();
    const overall = cm.getOverallCleanliness();
    h += `<div class="side-section"><h4>🧹 清掃 (清潔度: ${overall}%)</h4>`;
    h += `<div class="layout-score">`;
    h += areas.map(a => `<div class="ls-item"><div class="ls-label">${a.icon}${a.name}</div><div class="ls-val" style="color:${a.cleanliness<40?"var(--red)":a.cleanliness<70?"var(--gold)":"var(--green)"}">${a.cleanliness}%</div></div>`).join("");
    h += `</div>`;
    if (cm.isShutdown()) h += `<div class="turnover-danger">🚫 営業停止中！</div>`;
    h += `<button class="btn btn-sm primary" id="btn-quick-clean">🧹 一括清掃（スタッフ自動割当）</button>`;

    const tasks = cm.getAvailableTasks().filter(t => !t.completed && t.available && !t.isOutsource);
    if (tasks.length > 0) {
      h += `<div style="margin-top:4px;max-height:80px;overflow-y:auto">`;
      h += tasks.slice(0, 5).map(t => `<div class="placed-item"><span>${t.name} (${t.area})</span><button class="btn btn-sm clean-task-btn" data-id="${t.id}">実行</button></div>`).join("");
      h += `</div>`;
    }

    // Outsource options
    const outsource = cm.getAvailableTasks().filter(t => t.isOutsource && !t.completed);
    if (outsource.length > 0) {
      h += outsource.map(t => `<div class="placed-item"><span>${t.name}</span><button class="btn btn-sm outsource-btn" data-id="${t.id}">業者委託¥${(t.outsourceCost||0).toLocaleString()}</button></div>`).join("");
    }
    h += `</div>`;

    // ── PREPARATION ──
    const stocks = pm.getStockSummary();
    const lowStock = stocks.filter(s => s.quantity <= 3);
    const prepReady = pm.getPrepReadiness();
    h += `<div class="side-section"><h4>🍳 仕込み・在庫 (準備度: ${Math.round(prepReady * 100)}%)</h4>`;

    if (lowStock.length > 0) {
      h += `<div class="turnover-warn">⚠ 在庫不足: ${lowStock.map(s => s.name).join(", ")}</div>`;
    }

    h += `<div style="display:flex;gap:4px;margin:4px 0">`;
    h += `<button class="btn btn-sm primary" id="btn-auto-restock">📦 自動発注</button>`;
    h += `<button class="btn btn-sm" id="btn-quick-prep">🔪 一括仕込み</button>`;
    h += `<button class="btn btn-sm" id="btn-makanai">🍚 賄い</button>`;
    h += `</div>`;

    h += `<div style="max-height:80px;overflow-y:auto;font-size:9px">`;
    h += stocks.map(s => {
      const color = s.quantity <= 0 ? "var(--red)" : s.expiringSoon ? "var(--gold)" : "var(--text2)";
      return `<span style="color:${color};margin-right:6px">${s.name}:${s.quantity}${s.unit}</span>`;
    }).join("");
    h += `</div></div>`;

    // ── EQUIPMENT ──
    const owned = em.getOwnedEquipment();
    const failed = em.getFailedEquipment();
    h += `<div class="side-section"><h4>⚙ 設備管理</h4>`;

    if (failed.length > 0) {
      h += `<div class="turnover-danger">💥 故障中: ${failed.map(e => e.name).join(", ")}</div>`;
    }

    h += `<div style="max-height:100px;overflow-y:auto">`;
    h += owned.map(eq => `
      <div class="placed-item">
        <span style="color:${eq.condPct<30?"var(--red)":eq.condPct<60?"var(--gold)":"var(--text)"}">${eq.icon} ${eq.name} ${eq.condPct}%${eq.failed?" 💥":""}</span>
        ${eq.needsMaintenance && !eq.failed ? `<button class="btn btn-sm maint-btn" data-id="${eq.id}">整備</button>` : ""}
        ${eq.failed ? `<button class="btn btn-sm danger repair-eq-btn" data-id="${eq.id}">修理¥${eq.failureCost.toLocaleString()}</button>` : ""}
      </div>
    `).join("");
    h += `</div>`;

    // Buy new
    const unowned = em.getUnownedEquipment();
    if (unowned.length > 0) {
      h += `<div class="muted" style="margin-top:4px">未導入:</div>`;
      h += unowned.map(eq => `<div class="placed-item"><span>${eq.icon} ${eq.name}</span><button class="btn btn-sm primary buy-eq-btn" data-id="${eq.id}">購入¥${eq.baseCost.toLocaleString()}</button></div>`).join("");
    }
    h += `</div>`;

    el.innerHTML = h;

    // Bind events
    document.getElementById("btn-quick-clean")?.addEventListener("click", () => {
      const r = this.app.cleaningMgr.quickCleanAll();
      if (r.length) this.app.ui.addLog(`🧹 清掃完了: ${r.join(", ")}`);
      else this.app.ui.addLog("🧹 清掃するタスクがありません");
      this.render();
    });
    document.getElementById("btn-auto-restock")?.addEventListener("click", () => {
      const r = this.app.prepMgr.autoRestock();
      if (r.length) { for (const o of r) this.app.ui.addLog(`📦 ${o.name}×${o.qty} 発注（¥${o.cost.toLocaleString()}）`); }
      else this.app.ui.addLog("📦 在庫は十分です");
      this.render();
    });
    document.getElementById("btn-quick-prep")?.addEventListener("click", () => {
      const est = Math.max(10, this.app.state.stats.daysPlayed > 0 ? Math.round(this.app.state.stats.totalCustomers / this.app.state.stats.daysPlayed) : 10);
      const r = this.app.prepMgr.quickPrepAll(est);
      if (r.length) { for (const p of r) this.app.ui.addLog(`🔪 ${p.task} ×${p.amount}`); }
      else this.app.ui.addLog("🔪 仕込み済みです");
      this.render();
    });
    document.getElementById("btn-makanai")?.addEventListener("click", () => {
      const r = this.app.prepMgr.doMakanai();
      if (r.success) this.app.ui.addLog(`🍚 賄い提供（${r.used.join(",")}）士気+${r.moraleBonus}`);
      else this.app.ui.addLog(`❌ ${r.reason}`);
      this.render();
    });
    for (const b of el.querySelectorAll(".clean-task-btn")) {
      b.addEventListener("click", () => {
        const staff = this.app.state.staff.find(s => s.shift !== "off");
        const r = this.app.cleaningMgr.doTask(b.dataset.id, staff?.id);
        if (r.success) this.app.ui.addLog(`🧹 清掃完了`);
        else this.app.ui.addLog(`❌ ${r.reason}`);
        this.render();
      });
    }
    for (const b of el.querySelectorAll(".outsource-btn")) {
      b.addEventListener("click", () => {
        const r = this.app.cleaningMgr.doTask(b.dataset.id);
        if (r.success) this.app.ui.addLog(`🧹 業者委託完了（¥${r.cost.toLocaleString()}）`);
        else this.app.ui.addLog(`❌ ${r.reason}`);
        this.render();
      });
    }
    for (const b of el.querySelectorAll(".maint-btn")) {
      b.addEventListener("click", () => {
        const r = this.app.equipmentMgr.doMaintenance(b.dataset.id);
        if (r.success) this.app.ui.addLog(`⚙ 整備完了（¥${r.cost.toLocaleString()}）`);
        else this.app.ui.addLog(`❌ ${r.reason}`);
        this.render();
      });
    }
    for (const b of el.querySelectorAll(".repair-eq-btn")) {
      b.addEventListener("click", () => {
        const r = this.app.equipmentMgr.repairFailed(b.dataset.id);
        if (r.success) this.app.ui.addLog(`🔧 修理完了（¥${r.cost.toLocaleString()}）`);
        else this.app.ui.addLog(`❌ ${r.reason}`);
        this.render();
      });
    }
    for (const b of el.querySelectorAll(".buy-eq-btn")) {
      b.addEventListener("click", () => {
        const r = this.app.equipmentMgr.purchaseEquipment(b.dataset.id);
        if (r.success) this.app.ui.addLog(`⚙ ${r.equipment.name}を導入`);
        else this.app.ui.addLog(`❌ ${r.reason}`);
        this.render();
      });
    }
  }

  // ─── MARKETING ───
  _tabMarketing(el) {
    const mm = this.app.marketingMgr;
    if (!mm) { el.innerHTML = '<div class="muted">集客システム未初期化</div>'; return; }

    const sum = mm.getSummary();
    const campaigns = mm.getAvailableCampaigns();
    const active = this.app.state.marketing.activeCampaigns;

    let h = `<div class="side-section"><h4>📢 集客・マーケティング</h4>
      <div class="mkt-summary">
        <div class="mkt-stat"><div class="ms-label">認知度</div><div class="ms-val" style="color:${sum.awareness<20?"var(--red)":sum.awareness<50?"var(--gold)":"var(--green)"}">${sum.awareness}%</div></div>
        <div class="mkt-stat"><div class="ms-label">ブランド力</div><div class="ms-val">${sum.brandPower}</div></div>
        <div class="mkt-stat"><div class="ms-label">口コミ</div><div class="ms-val">${sum.reviewScore > 0 ? "★" + sum.reviewScore.toFixed(1) : "—"}<span style="font-size:8px;color:var(--text2)"> (${sum.reviewCount}件)</span></div></div>
        <div class="mkt-stat"><div class="ms-label">集客係数</div><div class="ms-val">${sum.trafficCoeff}%</div></div>
        <div class="mkt-stat"><div class="ms-label">実施中</div><div class="ms-val">${sum.activeCampaigns}件</div></div>
        <div class="mkt-stat"><div class="ms-label">減衰</div><div class="ms-val">-0.4/日</div></div>
      </div>
    </div>`;

    // Active campaigns
    if (active.length > 0) {
      h += `<div class="side-section"><h4>📊 実施中の施策</h4>`;
      h += active.map(ac => `
        <div class="campaign-card active">
          <div class="cc-header"><span class="cc-name">${ac.name}</span><span class="cc-status cc-active">${ac.remainingDays === -1 ? "継続中" : `残${ac.remainingDays}日`}</span></div>
          ${ac.type === "persistent" ? `<button class="btn btn-sm danger stop-campaign-btn" data-id="${ac.id}">停止</button>` : ""}
        </div>`).join("");
      h += `</div>`;
    }

    // Available campaigns by category
    const cats = { analog: "アナログ集客", digital: "デジタル集客", mass: "マス広告", price: "価格施策" };
    for (const [catKey, catName] of Object.entries(cats)) {
      const items = campaigns.filter(c => c.category === catKey);
      if (items.length === 0) continue;

      h += `<div class="side-section"><h4>${catName}</h4>`;
      h += items.map(c => {
        const isActive = c.isActive;
        const disabled = c.locked || !c.canAfford || c.cooldownLeft > 0 || isActive;
        return `<div class="campaign-card ${isActive?"active":""} ${c.locked?"locked":""}">
          <div class="cc-header">
            <span class="cc-name">${c.icon} ${c.name}</span>
            <span class="cc-cost">${c.initialCost > 0 ? "¥" + c.initialCost.toLocaleString() : "無料"}</span>
          </div>
          <div class="cc-desc">${c.description}</div>
          ${c.locked ? `<div class="muted">🔒 ${c.lockReason}</div>` : ""}
          ${c.cooldownLeft > 0 ? `<span class="cc-status cc-cooldown">CD ${c.cooldownLeft}日</span>` : ""}
          ${!disabled ? `<button class="btn btn-sm primary start-campaign-btn" data-id="${c.id}">実行</button>` : ""}
          ${!c.canAfford && !c.locked && !isActive ? '<div class="muted" style="color:var(--red)">💰 資金不足</div>' : ""}
        </div>`;
      }).join("");
      h += `</div>`;
    }

    // Review replies
    const reviews = this.app.marketingMgr?.getRecentReviews() || [];
    const unreplied = reviews.filter(r => !r.replied && r.stars <= 3);
    if (unreplied.length > 0) {
      h += `<div class="side-section"><h4>📝 口コミ返信（未対応${unreplied.length}件）</h4>`;
      h += reviews.slice(0, 5).map((r, i) => {
        const stars = "★".repeat(r.stars) + "☆".repeat(5 - r.stars);
        return `<div class="campaign-card ${r.replied?"":""}">
          <div class="cc-header"><span style="color:${r.stars>=4?"var(--green)":r.stars>=3?"var(--gold)":"var(--red)"}">${stars}</span><span class="muted">${r.day}日目</span></div>
          <div class="cc-desc">"${r.text}"</div>
          ${!r.replied ? `<div style="display:flex;gap:3px"><button class="btn btn-sm reply-btn" data-idx="${i}" data-q="1">定型返信</button><button class="btn btn-sm primary reply-btn" data-idx="${i}" data-q="2">丁寧に返信</button><button class="btn btn-sm reply-btn" data-idx="${i}" data-q="3">個別対応</button></div>` : `<span class="cc-status cc-active">返信済</span>`}
        </div>`;
      }).join("");
      h += `</div>`;
    }

    h += `<div class="side-section"><div class="muted">💡 認知度が低いとお客さんが来ません。看板やチラシで認知度を上げましょう。何もしないと毎日-0.3ずつ減衰します。</div></div>`;

    el.innerHTML = h;

    for (const b of el.querySelectorAll(".start-campaign-btn")) {
      b.addEventListener("click", () => this.app.startCampaign(b.dataset.id));
    }
    for (const b of el.querySelectorAll(".stop-campaign-btn")) {
      b.addEventListener("click", () => this.app.stopCampaign(b.dataset.id));
    }
    for (const b of el.querySelectorAll(".reply-btn")) {
      b.addEventListener("click", () => this.app.replyToReview(parseInt(b.dataset.idx), parseInt(b.dataset.q)));
    }
  }

  // ─── LAYOUT ───
  _tabLayout(el) {
    const fm = this.app.furnitureMgr;
    if (!fm) { el.innerHTML = '<div class="muted">家具システム未初期化</div>'; return; }

    const isOpen = this.app.state.time.hour >= this.app.config.simulation.openHour && this.app.state.time.hour < this.app.config.simulation.closeHour;
    const score = fm.calculateLayoutScore();
    const furniture = fm.getAll();

    let h = `<div class="side-section"><h4>🏗 レイアウト編集</h4>`;

    // Layout score
    h += `<div class="layout-score">
      <div class="ls-item"><div class="ls-label">総合</div><div class="ls-val" style="color:var(--gold)">${score.total}</div></div>
      <div class="ls-item"><div class="ls-label">動線</div><div class="ls-val">${score.path}</div></div>
      <div class="ls-item"><div class="ls-label">空間</div><div class="ls-val">${score.space}</div></div>
      <div class="ls-item"><div class="ls-label">席密度</div><div class="ls-val">${score.density}</div></div>
      <div class="ls-item"><div class="ls-label">快適性</div><div class="ls-val">${score.comfort}</div></div>
      <div class="ls-item"><div class="ls-label">配膳</div><div class="ls-val">${score.service}</div></div>
      <div class="ls-item"><div class="ls-label">美観</div><div class="ls-val">${score.aesthetic}</div></div>
      <div class="ls-item"><div class="ls-label">調和</div><div class="ls-val">${score.gradeHarmony}</div></div>
    </div>`;

    h += `<div class="muted">家具: ${furniture.length}/40 | 席数: ${fm.getTotalSeats()} | 平均グレード: ${fm.getAverageGradeTier().toFixed(1)}</div>`;

    if (isOpen) {
      h += `<div class="turnover-warn">⚠ 営業中は編集できません</div></div>`;
    } else {
      // Edit toggle
      h += `<button class="btn btn-sm ${this._layoutEditing?"danger":"primary"}" id="btn-toggle-edit">${this._layoutEditing?"✅ 編集終了":"🏗 編集開始"}</button></div>`;

      if (this._layoutEditing) {
        // Category filter
        h += `<div class="side-section"><div class="loc-filter">`;
        for (const [cat, info] of Object.entries(CATEGORY_INFO)) {
          h += `<button class="loc-filter-btn ${this._layoutCat===cat?"active":""}" data-cat="${cat}">${info.icon} ${info.name}</button>`;
        }
        h += `</div>`;

        // Furniture shop
        const items = Object.entries(FURNITURE_TYPES).filter(([, t]) => t.category === this._layoutCat);
        h += `<div class="furn-shop-grid">`;
        h += items.map(([id, t]) => {
          const cost = getFurnitureCost(id, this._layoutGrade);
          const grade = t.allowedGrades ? FURNITURE_GRADES[this._layoutGrade] : null;
          const canAfford = this.app.state.restaurant.money >= cost;
          return `<div class="furn-shop-item ${this._layoutSelectedType===id?"selected":""} ${!canAfford?"cant-afford":""}" data-type="${id}">
            <div class="fsi-name">${CATEGORY_INFO[t.category]?.icon||""} ${t.name}</div>
            <div class="fsi-info">${t.capacity > 0 ? t.capacity + "席" : ""} ${t.size[0]}×${t.size[1]}</div>
            <div class="fsi-info">${grade ? grade.name : ""} ¥${cost.toLocaleString()}</div>
          </div>`;
        }).join("");
        h += `</div>`;

        // Grade selector (only for graded items)
        const selType = this._layoutSelectedType ? FURNITURE_TYPES[this._layoutSelectedType] : null;
        if (selType?.allowedGrades) {
          h += `<div class="side-section"><h4>グレード選択</h4><div class="grade-select">`;
          for (const gId of selType.allowedGrades) {
            const g = FURNITURE_GRADES[gId];
            const locked = this.app.state.restaurant.reputation < g.repReq;
            const cost = getFurnitureCost(this._layoutSelectedType, gId);
            h += `<button class="grade-btn ${this._layoutGrade===gId?"selected":""} ${locked?"locked":""}" data-grade="${gId}" ${locked?"disabled":""}>${g.emoji} ${g.name} ¥${(cost/1000).toFixed(0)}K${locked?" 🔒":""}</button>`;
          }
          h += `</div>`;

          // Selected grade stats
          const sg = FURNITURE_GRADES[this._layoutGrade];
          if (sg) {
            h += `<div class="muted" style="margin-top:4px">快適:${sg.comfortBase} 回転:×${sg.turnoverMod} 単価:×${sg.priceAppealMod} 耐久:${sg.durability}日 美観:${sg.aesthetic}</div>`;
          }
          h += `</div>`;
        }

        // Instruction
        h += `<div class="muted" style="margin:4px 0">家具を選んでキャンバスをクリックで配置</div>`;
      }
    }

    // Placed furniture list
    h += `<div class="side-section"><h4>配置済み家具</h4><div class="placed-list">`;
    h += furniture.map(f => {
      const t = FURNITURE_TYPES[f.type];
      if (!t) return "";
      const g = f.grade ? FURNITURE_GRADES[f.grade] : null;
      const condStr = f.condition !== null ? ` [${f.condition}%]` : "";
      const condClass = f.condition !== null && f.condition <= 30 ? ' style="color:var(--red)"' : "";
      return `<div class="placed-item">
        <span${condClass}>${CATEGORY_INFO[t.category]?.icon||""} ${t.name} ${g ? g.name : ""}${condStr}</span>
        ${this._layoutEditing && !t.required ? `<button class="btn btn-sm danger remove-furn-btn" data-id="${f.id}">🗑</button>` : ""}
        ${f.condition !== null && f.condition <= 50 ? `<button class="btn btn-sm repair-furn-btn" data-id="${f.id}">🔧</button>` : ""}
      </div>`;
    }).join("");
    h += `</div></div>`;

    el.innerHTML = h;

    // Bind events
    document.getElementById("btn-toggle-edit")?.addEventListener("click", () => {
      this._layoutEditing = !this._layoutEditing;
      if (this.floorEditor) {
        this.floorEditor.setEditing(this._layoutEditing);
        if (this._layoutEditing) {
          this.floorView?.stopAnimation();
          this.floorEditor.render();
        } else {
          this.floorView?.startAnimation(this.app.state, this.app.sim);
          this.app.furnitureMgr.calculateLayoutScore();
        }
      }
      this.render();
    });

    for (const b of el.querySelectorAll(".loc-filter-btn")) {
      b.addEventListener("click", () => { this._layoutCat = b.dataset.cat; this.render(); });
    }
    for (const b of el.querySelectorAll(".furn-shop-item")) {
      b.addEventListener("click", () => {
        this._layoutSelectedType = b.dataset.type;
        if (this.floorEditor) {
          this.floorEditor.selectedType = b.dataset.type;
          this.floorEditor.selectedGrade = this._layoutGrade;
        }
        this.render();
      });
    }
    for (const b of el.querySelectorAll(".grade-btn:not(.locked)")) {
      b.addEventListener("click", () => {
        this._layoutGrade = b.dataset.grade;
        if (this.floorEditor) this.floorEditor.selectedGrade = b.dataset.grade;
        this.render();
      });
    }
    for (const b of el.querySelectorAll(".remove-furn-btn")) {
      b.addEventListener("click", () => { this.app.removeFurniture(b.dataset.id); if (this.floorEditor) this.floorEditor.render(); });
    }
    for (const b of el.querySelectorAll(".repair-furn-btn")) {
      b.addEventListener("click", () => this.app.repairFurniture(b.dataset.id));
    }
  }

  // ─── RELOCATE ───
  _tabRelocate(el) {
    const rm = this.app.relocationMgr;
    if (!this._locFilter) this._locFilter = "all";

    if (!rm.isUnlocked()) {
      el.innerHTML = `<div class="side-section"><h4>🏠 店舗移転</h4><div class="muted">所持金が¥${rm.unlockMoney.toLocaleString()}以上で解放されます</div></div>`;
      return;
    }

    const current = rm.getCurrentLocation();
    const locs = rm.getAvailableLocations();
    const cats = ["all", "premium", "nightlife", "office", "residential", "tourist", "suburban", "special"];
    const filtered = this._locFilter === "all" ? locs : locs.filter(l => l.category === this._locFilter);

    let h = `<div class="side-section"><h4>🏠 店舗移転</h4>
      <div class="muted">現在地: ${current ? `${current.name}（${rm.getCategoryLabel(current.category)}）` : "初期立地"}</div>
    </div>`;

    // Filter buttons
    h += `<div class="loc-filter">`;
    h += cats.map(c => `<button class="loc-filter-btn ${this._locFilter===c?"active":""}" data-cat="${c}">${c==="all"?"全て":rm.getCategoryLabel(c)}</button>`).join("");
    h += `</div>`;

    // Location cards
    h += filtered.map(l => {
      const color = rm.getCategoryColor(l.category);
      return `<div class="loc-card ${l.isCurrent?"current":""} ${!l.canAfford&&!l.isCurrent?"cant-afford":""}">
        <div class="loc-card-header">
          <span class="loc-name">${l.name}</span>
          <span class="loc-cat" style="background:${color}20;color:${color};border:1px solid ${color}">${rm.getCategoryLabel(l.category)}</span>
        </div>
        <div class="loc-desc">${l.description}</div>
        <div class="loc-stats">
          <div class="loc-stat"><div class="loc-stat-label">集客</div><div class="loc-stat-val">${l.baseTraffic}</div></div>
          <div class="loc-stat"><div class="loc-stat-label">客層</div><div class="loc-stat-val">${l.wealthLevel}</div></div>
          <div class="loc-stat"><div class="loc-stat-label">競合</div><div class="loc-stat-val">${l.competition}</div></div>
          <div class="loc-stat"><div class="loc-stat-label">治安</div><div class="loc-stat-val">${10-l.crimeRate}</div></div>
          <div class="loc-stat"><div class="loc-stat-label">流行</div><div class="loc-stat-val">${l.trend}</div></div>
          <div class="loc-stat"><div class="loc-stat-label">費用</div><div class="loc-stat-val">¥${(l.landCost/10000).toFixed(0)}万</div></div>
        </div>
        <div class="loc-special">${l.specialTrait}</div>
        ${l.isCurrent ? '<div class="muted" style="margin-top:4px;color:var(--green)">📍 現在地</div>'
          : !l.canAfford ? '<div class="muted" style="margin-top:4px;color:var(--red)">💰 資金不足</div>'
          : `<button class="btn btn-sm primary relocate-btn" data-id="${l.id}" style="margin-top:4px;width:100%">🏠 ここに移転する（¥${l.landCost.toLocaleString()}）</button>`}
      </div>`;
    }).join("");

    el.innerHTML = h;

    // Bind filter buttons
    for (const b of el.querySelectorAll(".loc-filter-btn")) {
      b.addEventListener("click", () => { this._locFilter = b.dataset.cat; this.render(); });
    }

    // Bind relocate buttons
    for (const b of el.querySelectorAll(".relocate-btn")) {
      b.addEventListener("click", () => {
        const loc = rm.locations.find(l => l.id === parseInt(b.dataset.id));
        if (loc && confirm(`${loc.name}に移転しますか？\n費用: ¥${loc.landCost.toLocaleString()}\n※評判が大幅にリセットされます`)) {
          this.app.relocate(parseInt(b.dataset.id));
        }
      });
    }
  }

  // ─── RESERVE ───
  _tabReserve(el) {
    const rm = this.app.reservationMgr;
    if (!rm) { el.innerHTML = '<div class="muted">予約システム未初期化</div>'; return; }
    const sum = rm.getSummary();
    const rsvs = this.app.state.reservations?.list || [];

    let h = `<div class="side-section"><h4>📋 予約管理</h4>
      <div class="mkt-summary">
        <div class="mkt-stat"><div class="ms-label">本日予約</div><div class="ms-val">${sum.today}組</div></div>
        <div class="mkt-stat"><div class="ms-label">累計</div><div class="ms-val">${sum.total}</div></div>
        <div class="mkt-stat"><div class="ms-label">ノーショー</div><div class="ms-val">${sum.noShows}</div></div>
      </div></div>`;

    // Cancel policy
    h += `<div class="side-section"><h4>キャンセルポリシー</h4>
      <div style="display:flex;gap:4px">
        <button class="policy-btn ${sum.policy==="none"?"active":""}" data-policy="none">なし</button>
        <button class="policy-btn ${sum.policy==="deposit"?"active":""}" data-policy="deposit">デポジット</button>
        <button class="policy-btn ${sum.policy==="strict"?"active":""}" data-policy="strict">厳格</button>
      </div>
      <div class="muted" style="margin-top:3px">${sum.policy==="none"?"ノーショー率15%":sum.policy==="deposit"?"ノーショー率10%（前金制）":"ノーショー率5%（全額前払い）"}</div>
    </div>`;

    // Today's reservations
    h += `<div class="side-section"><h4>本日の予約一覧</h4>`;
    if (rsvs.length === 0) {
      h += '<div class="muted">予約はありません</div>';
    } else {
      h += rsvs.map(r => `
        <div class="rsv-card ${r.isVIP?"vip":""}">
          <span>${r.hour}:00 — ${r.groupSize}名${r.isVIP?" 👑VIP":""}</span>
        </div>`).join("");
    }
    h += `</div>`;

    h += `<div class="side-section"><div class="muted">💡 評判と認知度が高いほど予約が増えます。キャンセルポリシーを厳しくするとノーショーが減りますが、予約数自体も減る可能性があります。</div></div>`;

    el.innerHTML = h;
    for (const b of el.querySelectorAll(".policy-btn")) {
      b.addEventListener("click", () => { this.app.reservationMgr.setCancelPolicy(b.dataset.policy); this.render(); });
    }
  }

  // ─── CUSTOMER DB ───
  _tabCustDB(el) {
    const db = this.app.customerDBMgr;
    if (!db) { el.innerHTML = '<div class="muted">顧客DB未初期化</div>'; return; }

    const regulars = db.getRegulars().slice(0, 20);
    const segments = db.getSegmentAnalysis();

    let h = `<div class="side-section"><h4>👥 顧客データベース</h4>
      <div class="mkt-summary">
        <div class="mkt-stat"><div class="ms-label">累計来店</div><div class="ms-val">${db.getTotalVisitors().toLocaleString()}</div></div>
        <div class="mkt-stat"><div class="ms-label">常連</div><div class="ms-val">${db.getTotalRegulars()}人</div></div>
        <div class="mkt-stat"><div class="ms-label">セグメント</div><div class="ms-val">${segments.length}種</div></div>
      </div></div>`;

    // Segment analysis
    if (segments.length > 0) {
      h += `<div class="side-section"><h4>📊 客層分析</h4>`;
      h += segments.map(s => `
        <div class="seg-row">
          <span>${s.type}</span>
          <span>${s.visits}人</span>
          <span>¥${s.avgSpend}/人</span>
          <span>満足${s.avgSatisfaction}%</span>
        </div>`).join("");
      h += `</div>`;
    }

    // Regulars
    h += `<div class="side-section"><h4>⭐ 常連客 TOP20</h4>`;
    if (regulars.length === 0) {
      h += '<div class="muted">常連客はまだいません。高い満足度で来店するとリピーターが生まれます。</div>';
    } else {
      h += `<div style="max-height:200px;overflow-y:auto">`;
      h += regulars.map((r, i) => `
        <div class="regular-card">
          <span class="rc-name">${i + 1}. ${r.name}</span>
          <span class="rc-info">${r.type} / ${r.visits}回 / ¥${r.totalSpend.toLocaleString()}</span>
        </div>`).join("");
      h += `</div>`;
    }
    h += `</div>`;

    h += `<div class="side-section"><div class="muted">💡 満足度80%以上の来店客が5%の確率で常連になります。常連は3-7日周期で自然に再来店します。</div></div>`;

    el.innerHTML = h;
  }

  // ─── ACCOUNTING ───
  _tabAccount(el) {
    const am = this.app.accountingMgr;
    if (!am) { el.innerHTML = '<div class="muted">会計システム未初期化</div>'; return; }
    const sum = am.getSummary();
    const pl = sum.latestPL;
    const loans = am.getActiveLoans();

    let h = `<div class="side-section"><h4>💰 会計・経理</h4>
      <div class="mkt-summary">
        <div class="mkt-stat"><div class="ms-label">残高</div><div class="ms-val" style="color:${sum.balance>=0?"var(--green)":"var(--red)"}">¥${sum.balance.toLocaleString()}</div></div>
        <div class="mkt-stat"><div class="ms-label">借入</div><div class="ms-val">${sum.totalDebt > 0 ? "¥" + sum.totalDebt.toLocaleString() : "なし"}</div></div>
        <div class="mkt-stat"><div class="ms-label">累計税金</div><div class="ms-val">¥${sum.taxPaid.toLocaleString()}</div></div>
      </div>
      ${sum.bankruptDays > 0 ? `<div class="turnover-danger">⚠ 倒産まで残${7 - sum.bankruptDays}日！資金を確保してください</div>` : ""}
    </div>`;

    // P/L
    if (pl) {
      h += `<div class="side-section"><h4>📊 ${pl.month}月 損益計算書</h4>
        <table class="pl-table">
          <tr class="pl-header"><td>項目</td><td>金額</td></tr>
          <tr><td>売上高</td><td class="positive">¥${pl.revenue.toLocaleString()}</td></tr>
          <tr><td>食材原価</td><td class="negative">¥${pl.foodCost.toLocaleString()}</td></tr>
          <tr class="pl-total"><td>粗利益</td><td class="${pl.grossProfit>=0?"positive":"negative"}">¥${pl.grossProfit.toLocaleString()}</td></tr>
          <tr><td>人件費</td><td class="negative">¥${pl.laborCost.toLocaleString()}</td></tr>
          <tr><td>家賃</td><td class="negative">¥${pl.rent.toLocaleString()}</td></tr>
          <tr><td>設備費</td><td class="negative">¥${pl.equipmentCost.toLocaleString()}</td></tr>
          <tr><td>広告費</td><td class="negative">¥${pl.marketingCost.toLocaleString()}</td></tr>
          <tr class="pl-total"><td>営業利益</td><td class="${pl.operatingProfit>=0?"positive":"negative"}">¥${pl.operatingProfit.toLocaleString()}</td></tr>
          <tr><td>税金</td><td class="negative">¥${pl.tax.toLocaleString()}</td></tr>
          <tr class="pl-total"><td>純利益</td><td class="${pl.netProfit>=0?"positive":"negative"}">¥${pl.netProfit.toLocaleString()}</td></tr>
        </table>
        <div class="muted">食材原価率: ${pl.foodCostRatio}% / 人件費率: ${pl.laborCostRatio}%</div>
      </div>`;
    } else {
      h += `<div class="side-section"><div class="muted">P/Lは月末に自動生成されます</div></div>`;
    }

    // Loans
    h += `<div class="side-section"><h4>🏦 融資</h4>`;
    if (loans.length > 0) {
      h += loans.map(l => `
        <div class="loan-card">
          <div>融資額: ¥${l.principal.toLocaleString()} / 残: ¥${l.remaining.toLocaleString()}</div>
          <div class="muted">月返済 ¥${l.monthlyPayment.toLocaleString()} / 残${l.monthsLeft}ヶ月</div>
        </div>`).join("");
    }
    if (loans.length < 3) {
      h += `<div class="loan-input">
        <input type="number" id="loan-amount" placeholder="融資額" min="100000" max="5000000" step="100000" value="500000">
        <button class="btn btn-sm primary" id="btn-apply-loan">融資申請</button>
      </div>
      <div class="muted">10万〜500万円。評判と営業日数で審査。年利5%、12ヶ月返済。</div>`;
    } else {
      h += '<div class="muted">融資上限（3件）に達しています</div>';
    }
    h += `</div>`;

    // Subsidies
    const subsidies = this.app.themesData?.subsidies || [];
    const applied = this.app.state.appliedSubsidies || [];
    const availableSubs = subsidies.filter(s => !applied.includes(s.id));
    if (availableSubs.length > 0 || applied.length > 0) {
      h += `<div class="side-section"><h4>🏛 助成金・補助金</h4>`;
      h += availableSubs.map(s => `
        <div class="loan-card"><span>${s.icon} ${s.name} ¥${s.amount.toLocaleString()}</span>
        <div class="muted">${s.description}</div>
        <button class="btn btn-sm primary apply-sub-btn" data-id="${s.id}">申請</button></div>`).join("");
      if (applied.length > 0) h += `<div class="muted">受給済: ${applied.length}件</div>`;
      h += `</div>`;
    }

    // Cash flow mini chart
    const cfHistory = this.app.state.accounting?.cashFlowHistory || [];
    if (cfHistory.length > 5) {
      h += `<div class="side-section"><h4>💹 資金推移（${cfHistory.length}日分）</h4>
        <canvas class="chart-canvas" id="chart-cashflow" width="340" height="120"></canvas>
      </div>`;
    }

    el.innerHTML = h;

    // Bind loan button
    document.getElementById("btn-apply-loan")?.addEventListener("click", () => {
      const input = document.getElementById("loan-amount");
      const amount = parseInt(input?.value || "500000");
      this.app.applyForLoan(amount);
    });

    // Bind subsidy buttons
    for (const b of el.querySelectorAll(".apply-sub-btn")) {
      b.addEventListener("click", () => this.app.applyForSubsidy(b.dataset.id));
    }

    // Draw cash flow chart
    requestAnimationFrame(() => {
      const canvas = document.getElementById("chart-cashflow");
      if (canvas && cfHistory.length > 2) {
        if (!this.chartRenderer) { const { ChartRenderer } = { ChartRenderer: class { init(c){this.canvas=c;this.ctx=c.getContext("2d")} } }; }
        // Use existing chart renderer
        if (this.chartRenderer) {
          this.chartRenderer.init(canvas);
          const data = cfHistory.map(cf => ({ balance: cf.balance, label: `${cf.day}` }));
          this.chartRenderer.drawLineChart(data, { series: [{ key: "balance", color: "#d4a843", label: "残高" }] });
        }
      }
    });
  }

  // ─── FORMAT ───
  _tabFormat(el) {
    const fm = this.app.formatMgr;
    const current = fm.getCurrentFormat();
    const available = fm.getAvailableFormats();
    const season = this.app.seasonMgr.getSeasonInfo();

    let h = `<div class="side-section"><h4>🏪 業態変更</h4>
      <div class="muted">現在: ${current.icon} ${current.name}</div>
      ${!fm.canChangeFormat() ? `<div class="muted" style="color:var(--red)">クールダウン中 残${this.app.state.restaurant.formatCooldown}日</div>` : `<div class="muted">変更費用: ¥${this.app.formatsData.changeCost.toLocaleString()}</div>`}
    </div>`;

    h += available.map(f => `
      <div class="format-card ${f.id === current.id ? "current" : ""}">
        <div class="format-icon">${f.icon}</div>
        <div class="format-name">${f.name} ${f.id === current.id ? "(現在)" : ""}</div>
        <div class="muted">${f.description}</div>
        ${f.genreRestriction.length ? `<div class="muted" style="color:var(--red)">提供不可: ${f.genreRestriction.map(g => this._genreLabel(g)).join(" ")}</div>` : ""}
        ${f.id !== current.id && fm.canChangeFormat() ? `<button class="btn btn-sm primary change-format-btn" data-id="${f.id}">変更する</button>` : ""}
      </div>`).join("");

    h += `<div class="side-section"><h4>${season.icon} 季節情報: ${season.name}</h4>
      <div class="muted">${season.description}</div>
      <div class="muted">客足: ×${this.app.seasonMgr.getCustomerFlowMult()} / 食材コスト: ×${this.app.seasonMgr.getIngredientCostMult()}</div>
    </div>`;

    // Interior theme
    const themes = this.app.themesData?.themes || [];
    const currentTheme = themes.find(t => t.id === this.app.state.restaurant.themeId) || themes[0];
    h += `<div class="side-section"><h4>🎨 内装テーマ</h4>
      <div class="muted">現在: ${currentTheme.icon} ${currentTheme.name}</div>
      ${this.app.state.restaurant.themeCooldown > 0 ? `<div class="muted" style="color:var(--red)">変更CD ${this.app.state.restaurant.themeCooldown}日</div>` : ""}
    </div>`;
    h += themes.filter(t => t.id !== "theme_none").map(t => {
      const isCurrent = t.id === currentTheme.id;
      const locked = t.repReq && this.app.state.restaurant.reputation < t.repReq;
      const canChange = !isCurrent && !locked && this.app.state.restaurant.themeCooldown <= 0;
      const cost = t.cost + (this.app.themesData.changeCost || 0);
      return `<div class="format-card ${isCurrent?"current":""} ${locked?"locked":""}">
        <span class="format-icon">${t.icon}</span>
        <div class="format-name">${t.name} ${isCurrent?"(現在)":""}${locked?" 🔒":""}</div>
        <div class="muted">${t.description}</div>
        <div class="muted">満足度${t.satisfactionMod>=0?"+":""}${t.satisfactionMod} / 美観+${t.aestheticBonus}${t.dailyCost ? ` / 維持¥${t.dailyCost}/日` : ""}</div>
        ${canChange ? `<button class="btn btn-sm primary change-theme-btn" data-id="${t.id}">変更 ¥${cost.toLocaleString()}</button>` : ""}
      </div>`;
    }).join("");

    el.innerHTML = h;
    for (const b of el.querySelectorAll(".change-format-btn")) {
      b.addEventListener("click", () => this.app.changeFormat(b.dataset.id));
    }
    for (const b of el.querySelectorAll(".change-theme-btn")) {
      b.addEventListener("click", () => this.app.changeTheme(b.dataset.id));
    }
  }

  // ─── CHART ───
  _tabChart(el) {
    const history = this.app.state.history;
    const last30 = history.slice(-30);

    let h = `<div class="side-section"><h4>📈 売上推移（直近30日）</h4>
      <canvas class="chart-canvas" id="chart-daily" width="340" height="160"></canvas></div>`;

    h += `<div class="side-section"><h4>📊 利益推移</h4>
      <canvas class="chart-canvas" id="chart-profit" width="340" height="160"></canvas></div>`;

    // Customer type breakdown (bar)
    const types = {};
    for (const d of last30) {
      for (const [k, v] of Object.entries(d.customerTypes || {})) types[k] = (types[k] || 0) + v;
    }
    if (Object.keys(types).length > 0) {
      h += `<div class="side-section"><h4>👥 客層分布（30日合計）</h4>
        <canvas class="chart-canvas" id="chart-customers" width="340" height="160"></canvas></div>`;
    }

    el.innerHTML = h;

    // Draw charts after DOM update
    requestAnimationFrame(() => {
      if (!this.chartRenderer) this.chartRenderer = new ChartRenderer();

      const dailyCanvas = document.getElementById("chart-daily");
      if (dailyCanvas && last30.length > 0) {
        this.chartRenderer.init(dailyCanvas);
        const data = last30.map(d => ({
          revenue: d.revenue,
          cost: d.cost,
          label: `${d.date.month}/${d.date.day}`
        }));
        this.chartRenderer.drawLineChart(data, {
          series: [
            { key: "revenue", color: "#4aaa6a", label: "売上" },
            { key: "cost", color: "#c94040", label: "経費" }
          ]
        });
      }

      const profitCanvas = document.getElementById("chart-profit");
      if (profitCanvas && last30.length > 0) {
        this.chartRenderer.init(profitCanvas);
        const data = last30.map(d => ({
          profit: d.profit,
          label: `${d.date.month}/${d.date.day}`
        }));
        this.chartRenderer.drawLineChart(data, {
          series: [{ key: "profit", color: "#d4a843", label: "利益" }]
        });
      }

      const custCanvas = document.getElementById("chart-customers");
      if (custCanvas && Object.keys(types).length > 0) {
        this.chartRenderer.init(custCanvas);
        const colors = ["#d4a843", "#4aaa6a", "#4a88cc", "#c94040", "#9060c8", "#f0c860", "#80a0d0", "#d08030"];
        const data = Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({
          value: v,
          label: k,
          color: colors[i % colors.length]
        }));
        this.chartRenderer.drawBarChart(data);
      }
    });
  }

  // ─── TUTORIAL ───
  _renderTutorial() {
    const tm = this.app.tutorialMgr;
    const overlay = document.getElementById("tutorial-overlay");
    if (!overlay) return;

    if (!tm.isActive()) {
      overlay.classList.add("hidden");
      return;
    }

    const step = tm.getCurrentStep();
    overlay.classList.remove("hidden");
    document.getElementById("tutorial-step").textContent = `ステップ ${step.index + 1} / ${step.total}`;
    document.getElementById("tutorial-title").textContent = step.title;
    document.getElementById("tutorial-message").textContent = step.message;
  }

  // ─── ACHIEVE ───
  _tabAchieve(el) {
    const am = this.app.achievementMgr;
    const cats = am.getByCategory();
    let h = `<div class="side-section"><h4>🏆 実績</h4>
      <div class="ach-progress">${am.getUnlockedCount()} / ${am.getTotalCount()} 解除</div></div>`;

    for (const [cat, achs] of Object.entries(cats)) {
      h += `<div class="side-section"><h4>${am.getCategoryLabel(cat)}</h4>`;
      h += achs.map(a => `
        <div class="ach-card ${a.unlocked ? "unlocked" : "locked"}">
          <span class="ach-icon">${a.unlocked ? a.icon : "🔒"}</span>
          <div><div class="ach-name">${a.unlocked ? a.name : "???"}</div><div class="ach-desc">${a.unlocked ? a.description : "条件を達成すると解除"}</div></div>
        </div>`).join("");
      h += `</div>`;
    }

    // Prestige section
    const pm = this.app.prestigeMgr;
    const pLevel = this.app.state.prestige?.level || 0;
    h += `<div class="side-section"><h4>🔄 プレステージ (Lv.${pLevel})</h4>`;
    if (this.app.canPrestige()) {
      const preview = this.app.getPrestigePreview();
      h += `<div class="prestige-box">
        <div class="prestige-title">のれん分け可能！</div>
        <div class="muted">新レベル: ${preview.newLevel} / 難易度: ${preview.difficultyIncrease}</div>
        <div class="muted">引き継ぎスタッフ: ${preview.inheritStaff.map(s => s.name).join(", ") || "なし"}</div>
        <div class="muted">引き継ぎレシピ: ${preview.inheritRecipes}種</div>
        <div class="muted">初期評判: +${preview.inheritReputation}</div>
        <div style="margin-top:6px"><strong>解放ボーナス:</strong></div>
        ${preview.bonuses.map(b => `<div class="prestige-bonus">${b.name}: ${b.description}</div>`).join("")}
        <button class="btn primary" id="btn-prestige" style="width:100%;margin-top:8px">🔄 のれん分けする</button>
      </div>`;
    } else {
      h += `<div class="muted">シナリオ目標を達成するとのれん分けが可能になります</div>`;
    }
    h += `</div>`;

    // Endings
    const endings = this.app.endingMgr.checkEndings();
    const unlockedEndings = this.app.endingMgr.getUnlockedEndings();
    if (unlockedEndings.length > 0) {
      h += `<div class="side-section"><h4>🎬 エンディング</h4>`;
      h += endings.filter(e => unlockedEndings.includes(e.id)).map(e => `
        <div class="ach-card unlocked" style="border-left-color:var(--purple)">
          <span class="ach-icon">${e.icon}</span>
          <div><div class="ach-name">${e.title}</div><div class="ach-desc">${e.description}</div></div>
        </div>`).join("");
      h += `</div>`;
    }

    el.innerHTML = h;
    const pb = document.getElementById("btn-prestige");
    if (pb) pb.addEventListener("click", () => { if (confirm("のれん分けを実行しますか？ゲームがリセットされます。")) this.app.doPrestige(); });
  }

  // ─── HELPERS ───
  _sl(k) { return {stamina:"体力",dexterity:"器用",memory:"記憶",strength:"筋力",communication:"接客",sense:"感覚"}[k]||k; }
  _genreLabel(g) { return {japanese:"和",western:"洋",chinese:"中",dessert:"甘",drink:"飲"}[g]||g; }

  _helpButton(tabKey) {
    const data = this.app.helpData?.tabs?.[tabKey];
    if (!data) return "";
    const tips = data.tips.map(t => `• ${t}`).join("\\n");
    return `<button class="btn btn-sm help-btn" onclick="alert('${data.title}\\n\\n${tips.replace(/'/g, "\\'")}')">❓ ヘルプ</button>`;
  }

  addLog(msg) {
    const t = this.app.state.time;
    this.logLines.push(`[${String(t.hour).padStart(2,"0")}:${String(t.minute).padStart(2,"0")}] ${msg}`);
    if (this.logLines.length > 100) this.logLines.shift();
    this.el.log.innerHTML = this.logLines.map(l=>`<div>${l}</div>`).join("");
    this.el.log.scrollTop = this.el.log.scrollHeight;
  }

  showDayReport(report, event, newAchievements) {
    const p = report.profit;
    let h = `<h3>${report.date.year}年${report.date.month}月${report.date.day}日 日報</h3>
      <div class="report-grid">
        <div class="report-item"><span>売上</span><span class="positive">¥${report.revenue.toLocaleString()}</span></div>
        <div class="report-item"><span>経費</span><span class="negative">¥${report.cost.toLocaleString()}</span></div>
        <div class="report-item"><span>利益</span><span class="${p>=0?"positive":"negative"}">¥${p.toLocaleString()}</span></div>
        <div class="report-item"><span>来客</span><span>${report.customers}人</span></div>
        <div class="report-item"><span>注文</span><span>${report.orders}件</span></div>
        ${report.lostCustomers>0?`<div class="report-item"><span>帰宅客</span><span class="negative">${report.lostCustomers}人</span></div>`:""}
      </div>`;

    // Customer type breakdown
    if (report.customerTypes && Object.keys(report.customerTypes).length > 0) {
      h += `<div class="report-customers"><div class="rc-title">客層内訳</div>`;
      h += Object.entries(report.customerTypes).map(([k,v]) => `<span class="ct-tag">${k} ${v}人</span>`).join(" ");
      h += `</div>`;
    }

    // ── 運営状況サマリー ──
    h += `<div style="margin:8px 0;padding:8px;background:var(--bg3);border-radius:6px;border:1px solid var(--border)">`;
    h += `<div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:4px">📋 運営レポート</div>`;
    h += `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;font-size:9px">`;

    // Awareness & marketing
    const mktS = this.app.marketingMgr?.getSummary();
    if (mktS) {
      h += `<div style="padding:2px 4px;background:var(--bg);border-radius:3px">📢 認知度: ${mktS.awareness}% (集客${mktS.trafficCoeff}%)</div>`;
      h += `<div style="padding:2px 4px;background:var(--bg);border-radius:3px">⭐ 口コミ: ${mktS.reviewScore>0?"★"+mktS.reviewScore.toFixed(1):"—"} (${mktS.reviewCount}件)</div>`;
    }

    // Cleaning
    const cleanO = this.app.cleaningMgr?.getOverallCleanliness();
    if (cleanO !== undefined) {
      const cleanColor = cleanO < 40 ? "var(--red)" : cleanO < 70 ? "var(--gold)" : "var(--green)";
      h += `<div style="padding:2px 4px;background:var(--bg);border-radius:3px">🧹 清潔度: <span style="color:${cleanColor}">${cleanO}%</span></div>`;
    }

    // Prep readiness
    const prepR = this.app.prepMgr ? Math.round(this.app.prepMgr.getPrepReadiness() * 100) : null;
    if (prepR !== null) {
      h += `<div style="padding:2px 4px;background:var(--bg);border-radius:3px">🍳 仕込み: ${prepR}%</div>`;
    }

    // Equipment
    const failedE = this.app.equipmentMgr?.getFailedEquipment() || [];
    h += `<div style="padding:2px 4px;background:var(--bg);border-radius:3px">⚙ 設備: ${failedE.length > 0 ? `<span style="color:var(--red)">${failedE.length}件故障</span>` : "正常"}</div>`;

    // Reservations
    const rsvS = this.app.reservationMgr?.getSummary();
    if (rsvS) {
      h += `<div style="padding:2px 4px;background:var(--bg);border-radius:3px">📋 予約: ${rsvS.today}組 / 常連: ${this.app.customerDBMgr?.getTotalRegulars() || 0}人</div>`;
    }

    // Labor
    const overtime = this.app.state.staff.filter(s => (s.weeklyHours || 0) > 40);
    if (overtime.length > 0) {
      h += `<div style="padding:2px 4px;background:var(--bg);border-radius:3px;color:var(--red)">⏰ 残業: ${overtime.length}名</div>`;
    }

    // Accounting
    const debt = this.app.accountingMgr?.getTotalDebt() || 0;
    if (debt > 0) {
      h += `<div style="padding:2px 4px;background:var(--bg);border-radius:3px">🏦 借入残: ¥${debt.toLocaleString()}</div>`;
    }

    h += `</div></div>`;

    if (event) {
      h += `<div class="report-event"><div class="re-title">📰 ${event.name}</div><div class="re-desc">${event.description.replace(/\n/g,"<br>")}</div></div>`;
    }
    if (report.staffEvents?.length > 0) {
      h += `<div class="report-staff-events">${report.staffEvents.map(e=>`<div class="rse-item">🌟 ${e}</div>`).join("")}</div>`;
    }
    if (report.isNewMonth && report.monthSummary) {
      const ms = report.monthSummary;
      h += `<div class="month-summary"><h4>${ms.month}月 月次決算</h4>
        <div class="report-grid">
          <div class="report-item"><span>月間売上</span><span class="positive">¥${ms.revenue.toLocaleString()}</span></div>
          <div class="report-item"><span>月間経費</span><span class="negative">¥${ms.cost.toLocaleString()}</span></div>
          <div class="report-item"><span>月間利益</span><span class="${ms.profit>=0?"positive":"negative"}">¥${ms.profit.toLocaleString()}</span></div>
          <div class="report-item"><span>来客</span><span>${ms.customers.toLocaleString()}人</span></div>
          <div class="report-item"><span>日平均売上</span><span>¥${ms.avgDailyRevenue.toLocaleString()}</span></div>
        </div>`;
      if (ms.customerTypes && Object.keys(ms.customerTypes).length > 0) {
        h += `<div class="report-customers"><div class="rc-title">月間客層</div>`;
        h += Object.entries(ms.customerTypes).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="ct-tag">${k} ${v}人</span>`).join(" ");
        h += `</div>`;
      }
      h += `<div class="report-note">家賃 ¥${report.rentPaid.toLocaleString()}</div></div>`;
    }

    // Achievements
    if (newAchievements?.length > 0) {
      h += `<div style="margin-top:8px">`;
      h += newAchievements.map(a => `<div class="ach-card unlocked"><span class="ach-icon">${a.icon}</span><div><div class="ach-name">🏆 ${a.name}</div><div class="ach-desc">${a.description}</div></div></div>`).join("");
      h += `</div>`;
    }

    this.el.dayReportContent.innerHTML = h;
    this.el.dayReport.classList.remove("hidden");
  }

  updateAutoButton(on) {
    this.el.btnAutoPlay.textContent = on ? "⏸ 停止" : "▶ 自動";
    this.el.btnAutoPlay.classList.toggle("active", on);
  }
}
