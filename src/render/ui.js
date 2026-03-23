import { FloorView } from "./floorView.js";
import { ChartRenderer } from "./chart.js";

export class UI {
  constructor(gameApp) {
    this.app = gameApp;
    this.logLines = [];
    this.currentTab = "overview";
    this.skillViewStaffId = null;
    this.floorView = null;
    this.chartRenderer = null;
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

    // Floor view
    const floorCanvas = document.getElementById("floor-canvas");
    if (floorCanvas) {
      this.floorView = new FloorView(floorCanvas);
      this.floorView.startAnimation(this.app.state, this.app.sim);
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
      case "format": this._tabFormat(sp); break;
      case "chart": this._tabChart(sp); break;
      case "achieve": this._tabAchieve(sp); break;
    }
  }

  // ─── OVERVIEW ───
  _tabOverview(el) {
    const s = this.app.state;
    let h = `<div class="side-section"><h4>👨‍🍳 スタッフ (${s.staff.length}人)</h4>`;
    h += s.staff.map(st => `
      <div class="staff-card-mini">
        <div class="scm-top">
          <span class="staff-name">${st.name}</span>
          <span class="staff-role-badge ${st.role}">${st.role==="cook"?"料理":"ホール"} Lv.${st.level}</span>
          <span class="shift-icon">${this.app.shiftMgr.getShiftIcon(st.shift||"full", st)}</span>
        </div>
        <div class="staff-bars">
          <div class="bar-row"><span class="bar-label">体力</span><div class="bar"><div class="bar-fill fatigue" style="width:${100-st.fatigue}%"></div></div></div>
          <div class="bar-row"><span class="bar-label">士気</span><div class="bar"><div class="bar-fill morale" style="width:${st.morale}%"></div></div></div>
        </div>
      </div>`).join("");
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
      return `<div class="staff-card-detail">
        <div class="scd-header">
          <span class="staff-name">${st.name}</span>
          <span class="staff-role-badge ${st.role}">${st.role==="cook"?"料理人":"ホール"} Lv.${st.level}</span>
        </div>
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
      </div>`;
    }).join("");
    el.innerHTML = h;

    for (const b of el.querySelectorAll(".shift-btn")) {
      b.addEventListener("click", () => this.app.setShift(b.dataset.id, b.dataset.shift));
    }
    for (const b of el.querySelectorAll(".break-btn")) {
      b.addEventListener("click", () => this.app.sendOnBreak(b.dataset.id, parseInt(b.dataset.min)));
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

    el.innerHTML = h;
    for (const b of el.querySelectorAll(".change-format-btn")) {
      b.addEventListener("click", () => this.app.changeFormat(b.dataset.id));
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
