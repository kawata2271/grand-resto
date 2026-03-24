import { FURNITURE_TYPES, FURNITURE_GRADES, getFurnitureCost, getGradeTier } from "./furniture-data.js";

export class FurnitureManager {
  constructor(state) {
    this.state = state;
    this._ensureFloorData();
  }

  _ensureFloorData() {
    if (!this.state.floor) {
      this.state.floor = {
        gridSize: { cols: 16, rows: 12 },
        furniture: [],
        layoutScore: { total: 50, path: 50, space: 50, density: 50, comfort: 50, service: 50, aesthetic: 50, gradeHarmony: 50 }
      };
      // Migrate old tables to furniture
      this._migrateOldTables();
    }
  }

  _migrateOldTables() {
    const oldTables = this.state.restaurant.tables || [];
    if (oldTables.length === 0) return;

    let col = 2, row = 2;
    for (const t of oldTables) {
      const typeId = t.seats <= 2 ? "table_2seat" : t.seats <= 4 ? "table_4seat" : "table_6seat";
      const type = FURNITURE_TYPES[typeId];
      this.state.floor.furniture.push({
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: typeId,
        grade: "tier3",
        col, row,
        rotation: 0,
        condition: 80
      });
      col += type.size[0] + 1;
      if (col > 13) { col = 2; row += 3; }
    }

    // Add required register
    this.state.floor.furniture.push({
      id: "f_register_0",
      type: "register",
      grade: null,
      col: 1, row: 10,
      rotation: 0,
      condition: null
    });
  }

  // Get all furniture
  getAll() { return this.state.floor.furniture; }

  // Get seatable furniture (tables + counters)
  getSeatableFurniture() {
    return this.state.floor.furniture.filter(f => {
      const type = FURNITURE_TYPES[f.type];
      return type && type.capacity > 0;
    });
  }

  // Get total seats
  getTotalSeats() {
    return this.getSeatableFurniture().reduce((sum, f) => {
      const type = FURNITURE_TYPES[f.type];
      return sum + (type?.capacity || 0);
    }, 0);
  }

  // Get furniture tables for sim.js compatibility
  getTablesForSim() {
    return this.getSeatableFurniture().map(f => {
      const type = FURNITURE_TYPES[f.type];
      const grade = f.grade ? FURNITURE_GRADES[f.grade] : null;
      return {
        id: f.id,
        seats: type.capacity,
        type: f.type,
        grade: f.grade,
        comfort: grade ? grade.comfortBase + (type.bonusSatisfaction || 0) : 25,
        turnoverMod: (grade?.turnoverMod || 1.0) * (1 - (type.turnoverBonus || 0)),
        priceAppealMod: grade?.priceAppealMod || 1.0,
        satisfactionMod: (grade?.satisfactionMod || 0) + (type.bonusSatisfaction || 0),
        isCounter: type.category === "counter",
        singleCustomerBonus: type.singleCustomerBonus || 0,
        col: f.col, row: f.row
      };
    });
  }

  // Check if placement is valid
  canPlace(typeId, col, row, excludeId = null) {
    const type = FURNITURE_TYPES[typeId];
    if (!type) return false;
    const grid = this.state.floor.gridSize;
    const [w, h] = type.size;

    // Bounds check
    if (col < 0 || row < 0 || col + w > grid.cols || row + h > grid.rows) return false;
    // Entrance area (col=0)
    if (col === 0) return false;
    // Kitchen area (row=0) - only for functional items
    if (row === 0 && type.category !== "functional") return false;

    // Collision check
    for (const f of this.state.floor.furniture) {
      if (f.id === excludeId) continue;
      const ft = FURNITURE_TYPES[f.type];
      if (!ft) continue;
      const [fw, fh] = ft.size;
      if (col < f.col + fw && col + w > f.col && row < f.row + fh && row + h > f.row) return false;
    }

    return true;
  }

  // Place furniture
  placeFurniture(typeId, gradeId, col, row) {
    const type = FURNITURE_TYPES[typeId];
    if (!type) return { success: false, reason: "家具タイプが不正です" };

    // Grade validation
    if (type.allowedGrades && gradeId) {
      if (!type.allowedGrades.includes(gradeId)) return { success: false, reason: "このグレードは使用できません" };
      const grade = FURNITURE_GRADES[gradeId];
      if (grade && this.state.restaurant.reputation < grade.repReq) {
        return { success: false, reason: `評判${grade.repReq}以上が必要です` };
      }
    }

    // maxPerStore check
    if (type.maxPerStore) {
      const count = this.state.floor.furniture.filter(f => f.type === typeId).length;
      if (count >= type.maxPerStore) return { success: false, reason: `${type.name}は最大${type.maxPerStore}個まで` };
    }

    // Max total furniture
    if (this.state.floor.furniture.length >= 40) return { success: false, reason: "家具の上限(40個)に達しています" };

    if (!this.canPlace(typeId, col, row)) return { success: false, reason: "この場所には配置できません" };

    const cost = getFurnitureCost(typeId, gradeId);
    if (this.state.restaurant.money < cost) return { success: false, reason: `資金不足（必要¥${cost.toLocaleString()}）` };

    this.state.restaurant.money -= cost;
    const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const furniture = {
      id, type: typeId, grade: gradeId || null,
      col, row, rotation: 0,
      condition: type.allowedGrades ? (FURNITURE_GRADES[gradeId]?.durability || 80) : null
    };
    this.state.floor.furniture.push(furniture);

    return { success: true, furniture, cost };
  }

  // Remove furniture
  removeFurniture(furnitureId) {
    const idx = this.state.floor.furniture.findIndex(f => f.id === furnitureId);
    if (idx === -1) return { success: false, reason: "家具が見つかりません" };
    const f = this.state.floor.furniture[idx];
    const type = FURNITURE_TYPES[f.type];
    if (type?.required) return { success: false, reason: `${type.name}は撤去できません` };

    // Refund 30%
    const cost = getFurnitureCost(f.type, f.grade);
    const refund = Math.floor(cost * 0.3);
    this.state.restaurant.money += refund;
    this.state.floor.furniture.splice(idx, 1);

    return { success: true, refund };
  }

  // Move furniture
  moveFurniture(furnitureId, newCol, newRow) {
    const f = this.state.floor.furniture.find(f => f.id === furnitureId);
    if (!f) return false;
    if (!this.canPlace(f.type, newCol, newRow, furnitureId)) return false;
    f.col = newCol;
    f.row = newRow;
    return true;
  }

  // Upgrade grade
  upgradeGrade(furnitureId, newGrade) {
    const f = this.state.floor.furniture.find(fi => fi.id === furnitureId);
    if (!f) return { success: false, reason: "家具が見つかりません" };
    const type = FURNITURE_TYPES[f.type];
    if (!type?.allowedGrades?.includes(newGrade)) return { success: false, reason: "このグレードは使用できません" };
    const grade = FURNITURE_GRADES[newGrade];
    if (grade && this.state.restaurant.reputation < grade.repReq) return { success: false, reason: `評判${grade.repReq}以上が必要` };

    const oldCost = getFurnitureCost(f.type, f.grade);
    const newCost = getFurnitureCost(f.type, newGrade);
    const diff = newCost - oldCost;

    if (diff > 0 && this.state.restaurant.money < diff) return { success: false, reason: `資金不足（差額¥${diff.toLocaleString()}）` };

    if (diff > 0) this.state.restaurant.money -= diff;
    else this.state.restaurant.money += Math.floor(Math.abs(diff) * 0.5); // 50% refund on downgrade

    f.grade = newGrade;
    f.condition = grade.durability;
    return { success: true, cost: diff };
  }

  // Daily maintenance
  dailyMaintenance(isBusy) {
    const events = [];
    let totalCost = 0;

    for (const f of this.state.floor.furniture) {
      const type = FURNITURE_TYPES[f.type];
      if (!type) continue;

      // Daily maintenance cost
      if (type.dailyCost) {
        totalCost += type.dailyCost;
      }

      // Condition decay
      if (f.condition !== null) {
        f.condition -= isBusy ? 2 : 1;
        if (f.condition <= 0) {
          f.condition = 0;
          events.push(`⚠️ ${type.name}が使用不可に！修理が必要です`);
        } else if (f.condition <= 30 && f.condition > 28) {
          events.push(`⚠️ ${type.name}が劣化しています`);
        }
      }

      // Flower withering
      if (type.witherDays && f._witherCount === undefined) f._witherCount = 0;
      if (type.witherDays) {
        f._witherCount = (f._witherCount || 0) + 1;
        if (f._witherCount >= type.witherDays) {
          f._witherCount = 0;
          totalCost += type.baseCost; // auto-replace cost
          events.push(`🌸 ${type.name}を交換しました（¥${type.baseCost.toLocaleString()}）`);
        }
      }
    }

    if (totalCost > 0) {
      this.state.restaurant.money -= totalCost;
    }

    return { events, totalCost };
  }

  // Repair furniture
  repair(furnitureId) {
    const f = this.state.floor.furniture.find(fi => fi.id === furnitureId);
    if (!f || f.condition === null) return { success: false, reason: "修理対象ではありません" };
    const grade = f.grade ? FURNITURE_GRADES[f.grade] : null;
    const maxCondition = grade?.durability || 80;
    if (f.condition >= maxCondition * 0.8) return { success: false, reason: "まだ修理不要です" };

    const cost = Math.floor(getFurnitureCost(f.type, f.grade) * 0.2);
    if (this.state.restaurant.money < cost) return { success: false, reason: `資金不足（修理費¥${cost.toLocaleString()}）` };

    this.state.restaurant.money -= cost;
    f.condition = maxCondition;
    return { success: true, cost };
  }

  // Get average grade tier
  getAverageGradeTier() {
    const graded = this.state.floor.furniture.filter(f => f.grade);
    if (graded.length === 0) return 0;
    return graded.reduce((sum, f) => sum + getGradeTier(f.grade), 0) / graded.length;
  }

  // Get aesthetic score
  getAestheticScore() {
    let score = 0;
    for (const f of this.state.floor.furniture) {
      const type = FURNITURE_TYPES[f.type];
      if (!type) continue;
      if (type.aestheticBonus) score += type.aestheticBonus;
      if (f.grade) {
        const grade = FURNITURE_GRADES[f.grade];
        if (grade) score += grade.aesthetic / 10;
      }
    }
    return Math.min(100, Math.round(score));
  }

  // Get grade harmony (standard deviation based)
  getGradeHarmony() {
    const graded = this.state.floor.furniture.filter(f => f.grade);
    if (graded.length <= 1) return 100;
    const tiers = graded.map(f => getGradeTier(f.grade));
    const avg = tiers.reduce((a, b) => a + b, 0) / tiers.length;
    const variance = tiers.reduce((sum, t) => sum + (t - avg) ** 2, 0) / tiers.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.round(100 - stdDev * 20));
  }

  // Calculate full layout score
  calculateLayoutScore() {
    const furniture = this.state.floor.furniture;
    const seats = this.getSeatableFurniture();

    const path = this._calcPathScore();
    const space = this._calcSpaceScore();
    const density = seats.length > 0 ? Math.min(100, seats.length * 8) : 0;
    const comfort = this._calcComfortScore();
    const service = this._calcServiceScore();
    const aesthetic = this.getAestheticScore();
    const gradeHarmony = this.getGradeHarmony();

    const total = Math.round(
      path * 0.25 + space * 0.15 + density * 0.10 +
      comfort * 0.15 + service * 0.15 + aesthetic * 0.10 + gradeHarmony * 0.10
    );

    this.state.floor.layoutScore = { total, path, space, density, comfort, service, aesthetic, gradeHarmony };
    return this.state.floor.layoutScore;
  }

  _calcPathScore() {
    // Simplified: check that entrance area is clear and register exists
    const hasRegister = this.state.floor.furniture.some(f => f.type === "register");
    if (!hasRegister) return 0;
    // Check for basic navigability
    const grid = this.state.floor.gridSize;
    const occupied = new Set();
    for (const f of this.state.floor.furniture) {
      const type = FURNITURE_TYPES[f.type];
      if (!type) continue;
      for (let c = f.col; c < f.col + type.size[0]; c++) {
        for (let r = f.row; r < f.row + type.size[1]; r++) {
          occupied.add(`${c},${r}`);
        }
      }
    }
    // Check a path from entrance (0,6) to register
    let pathClear = 0;
    for (let c = 0; c < grid.cols; c++) {
      if (!occupied.has(`${c},6`)) pathClear++;
    }
    return Math.min(100, Math.round((pathClear / grid.cols) * 120));
  }

  _calcSpaceScore() {
    const grid = this.state.floor.gridSize;
    const totalCells = (grid.cols - 1) * (grid.rows - 1); // exclude entrance col and kitchen row
    let usedCells = 0;
    for (const f of this.state.floor.furniture) {
      const type = FURNITURE_TYPES[f.type];
      if (!type) continue;
      usedCells += type.size[0] * type.size[1];
    }
    const ratio = usedCells / totalCells;
    // Optimal: 40-60%
    if (ratio >= 0.4 && ratio <= 0.6) return 100;
    if (ratio < 0.4) return Math.round((ratio / 0.4) * 100);
    return Math.round(Math.max(0, 100 - (ratio - 0.6) * 200));
  }

  _calcComfortScore() {
    const seats = this.getSeatableFurniture();
    if (seats.length === 0) return 0;
    let totalComfort = 0;
    for (const f of seats) {
      const grade = f.grade ? FURNITURE_GRADES[f.grade] : null;
      totalComfort += grade?.comfortBase || 25;
    }
    return Math.min(100, Math.round(totalComfort / seats.length));
  }

  _calcServiceScore() {
    // Based on average distance from kitchen (row=0) to tables
    const seats = this.getSeatableFurniture();
    if (seats.length === 0) return 50;
    const avgRow = seats.reduce((sum, f) => sum + f.row, 0) / seats.length;
    // Closer to kitchen = better service
    return Math.max(0, Math.round(100 - avgRow * 7));
  }
}
