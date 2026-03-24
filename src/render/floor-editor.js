import { FURNITURE_TYPES, FURNITURE_GRADES, CATEGORY_INFO, getFurnitureCost, getGradeTier } from "../systems/furniture-data.js";

export class FloorEditor {
  constructor(canvas, furnitureMgr, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mgr = furnitureMgr;
    this.state = state;
    this.cellSize = 40;
    this.gridCols = 16;
    this.gridRows = 12;
    this.editing = false;
    this.selectedType = null;
    this.selectedGrade = "tier3";
    this.hoveredCell = null;
    this.dragging = null;
    this.selectedFurniture = null;
    this.categoryFilter = "table";
    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener("click", (e) => this._onClick(e));
    this.canvas.addEventListener("mousemove", (e) => this._onMouseMove(e));
    this.canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); this._onRightClick(e); });
  }

  _getCell(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return {
      col: Math.floor(x / this.cellSize),
      row: Math.floor(y / this.cellSize)
    };
  }

  _onClick(e) {
    if (!this.editing) return;
    const { col, row } = this._getCell(e);

    // Check if clicking on existing furniture
    const existing = this._getFurnitureAt(col, row);
    if (existing && !this.selectedType) {
      this.selectedFurniture = existing;
      return;
    }

    // Place new furniture
    if (this.selectedType) {
      const result = this.mgr.placeFurniture(this.selectedType, this.selectedGrade, col, row);
      if (result.success) {
        this._onPlaced?.(result);
        this.selectedType = null;
      } else {
        this._onError?.(result.reason);
      }
    }
  }

  _onMouseMove(e) {
    if (!this.editing) return;
    this.hoveredCell = this._getCell(e);
  }

  _onRightClick(e) {
    if (!this.editing) return;
    const { col, row } = this._getCell(e);
    const f = this._getFurnitureAt(col, row);
    if (f) {
      this.selectedFurniture = f;
    }
  }

  _getFurnitureAt(col, row) {
    for (const f of this.mgr.getAll()) {
      const type = FURNITURE_TYPES[f.type];
      if (!type) continue;
      if (col >= f.col && col < f.col + type.size[0] && row >= f.row && row < f.row + type.size[1]) return f;
    }
    return null;
  }

  setEditing(on) {
    this.editing = on;
    this.selectedType = null;
    this.selectedFurniture = null;
  }

  onPlaced(cb) { this._onPlaced = cb; }
  onError(cb) { this._onError = cb; }

  render() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    this.canvas.width = this.gridCols * cs;
    this.canvas.height = this.gridRows * cs;

    // Background
    ctx.fillStyle = "#1a1710";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid
    ctx.strokeStyle = "#2a2418";
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= this.gridCols; c++) {
      ctx.beginPath(); ctx.moveTo(c * cs, 0); ctx.lineTo(c * cs, this.gridRows * cs); ctx.stroke();
    }
    for (let r = 0; r <= this.gridRows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cs); ctx.lineTo(this.gridCols * cs, r * cs); ctx.stroke();
    }

    // Zones
    // Entrance (col=0)
    ctx.fillStyle = "rgba(74,136,204,0.1)";
    ctx.fillRect(0, 0, cs, this.gridRows * cs);
    ctx.fillStyle = "#4a88cc";
    ctx.font = "10px 'Noto Sans JP'";
    ctx.textAlign = "center";
    ctx.fillText("入口", cs / 2, this.gridRows * cs / 2);

    // Kitchen (row=0)
    ctx.fillStyle = "rgba(212,168,67,0.1)";
    ctx.fillRect(cs, 0, (this.gridCols - 1) * cs, cs);
    ctx.fillStyle = "#d4a843";
    ctx.fillText("厨房", this.gridCols * cs / 2, cs / 2 + 4);

    // Furniture
    for (const f of this.mgr.getAll()) {
      this._drawFurniture(ctx, f, f.id === this.selectedFurniture?.id);
    }

    // Hover preview
    if (this.editing && this.selectedType && this.hoveredCell) {
      const type = FURNITURE_TYPES[this.selectedType];
      if (type) {
        const canPlace = this.mgr.canPlace(this.selectedType, this.hoveredCell.col, this.hoveredCell.row);
        ctx.fillStyle = canPlace ? "rgba(74,170,106,0.3)" : "rgba(201,64,64,0.3)";
        ctx.fillRect(this.hoveredCell.col * cs, this.hoveredCell.row * cs, type.size[0] * cs, type.size[1] * cs);
      }
    }
  }

  _drawFurniture(ctx, f, selected) {
    const type = FURNITURE_TYPES[f.type];
    if (!type) return;
    const grade = f.grade ? FURNITURE_GRADES[f.grade] : null;
    const cs = this.cellSize;
    const x = f.col * cs;
    const y = f.row * cs;
    const w = type.size[0] * cs;
    const h = type.size[1] * cs;
    const tier = getGradeTier(f.grade);

    // Fill color by category and grade
    const catColors = { table: "#2a2418", counter: "#1a2028", chair: "#1a2418", decor: "#201a28", functional: "#28201a" };
    ctx.fillStyle = catColors[type.category] || "#2a2418";
    ctx.strokeStyle = selected ? "#f0c860" : (tier >= 7 ? "#4a88cc" : tier >= 4 ? "#d4a843" : "#3a3020");
    ctx.lineWidth = selected ? 2 : 1;

    // Rounded rect
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Grade glow for tier 7+
    if (tier >= 9) {
      ctx.shadowColor = "#f0c860"; ctx.shadowBlur = 8;
      ctx.strokeStyle = "#f0c860"; ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (tier >= 7) {
      ctx.shadowColor = "#4a88cc"; ctx.shadowBlur = 5;
      ctx.strokeStyle = "#4a88cc"; ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Label
    const emoji = grade?.emoji || (CATEGORY_INFO[type.category]?.icon || "📦");
    ctx.font = `${Math.min(cs * 0.6, 18)}px serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8e0d0";
    ctx.fillText(emoji, x + w / 2, y + h / 2 + 2);

    // Capacity
    if (type.capacity > 0) {
      ctx.font = "9px 'Space Mono'";
      ctx.fillStyle = "#a09080";
      ctx.fillText(`${type.capacity}席`, x + w / 2, y + h - 3);
    }

    // Grade label
    if (grade) {
      ctx.font = "7px 'Noto Sans JP'";
      ctx.fillStyle = tier >= 7 ? "#4a88cc" : "#a09080";
      ctx.fillText(grade.name, x + w / 2, y + 9);
    }

    // Condition warning
    if (f.condition !== null && f.condition <= 30) {
      ctx.font = "12px serif";
      ctx.fillText("⚠️", x + w - 8, y + 12);
    }
  }
}
