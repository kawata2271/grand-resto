export class FloorView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.animFrame = null;
    this.entities = [];
    this.tables = [];
    this.time = 0;
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = Math.max(180, rect.height);
  }

  update(state, sim) {
    this.tables = this._layoutTables(state.restaurant.tables);

    this.entities = [];

    // Seated/eating customers
    const customers = sim?.customers || [];
    for (const c of customers) {
      if (c.status === "seated" || c.status === "eating") {
        const table = this.tables.find(t => t.id === c.tableId);
        if (table) {
          this.entities.push({
            type: "customer",
            x: table.x + table.w / 2,
            y: table.y - 10,
            icon: c.typeIcon || "👤",
            eating: c.status === "eating",
            groupSize: c.groupSize
          });
        }
      } else if (c.status === "waiting") {
        // Use customer ID to generate stable position (no random per frame)
        const hash = c.id * 7 + 13;
        this.entities.push({
          type: "waiting",
          x: 12 + (hash % 5) * 10,
          y: this.canvas.height - 40 - (hash % 3) * 10,
          icon: c.typeIcon || "👤"
        });
      }
    }

    // Staff
    const hour = state.time.hour;
    for (let i = 0; i < state.staff.length; i++) {
      const s = state.staff[i];
      if (s.shift === "off") continue;
      const working = true; // simplified
      if (working) {
        if (s.role === "cook") {
          this.entities.push({
            type: "cook",
            x: this.canvas.width - 50 - (i % 3) * 25,
            y: 30 + (i % 2) * 30,
            name: s.name.split(" ")[0],
            fatigue: s.fatigue
          });
        } else {
          this.entities.push({
            type: "hall",
            x: 80 + (i % 4) * 60,
            y: this.canvas.height / 2 + (i % 2 === 0 ? -20 : 20),
            name: s.name.split(" ")[0],
            fatigue: s.fatigue
          });
        }
      }
    }
  }

  _layoutTables(tables) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cols = Math.ceil(Math.sqrt(tables.length * 1.5));
    const tw = 40, th = 30;
    const startX = 70, startY = 40;
    const gapX = Math.min(65, (w - 120) / cols);
    const gapY = 50;

    return tables.map((t, i) => ({
      id: t.id,
      seats: t.seats,
      x: startX + (i % cols) * gapX,
      y: startY + Math.floor(i / cols) * gapY,
      w: tw,
      h: th
    }));
  }

  render(state) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.time++;

    // Background
    ctx.fillStyle = "#1a1710";
    ctx.fillRect(0, 0, w, h);

    // Floor
    ctx.fillStyle = "#201c14";
    ctx.fillRect(60, 20, w - 80, h - 40);

    // Kitchen area
    ctx.fillStyle = "#252018";
    ctx.fillRect(w - 70, 10, 65, h - 20);
    ctx.strokeStyle = "#3a3020";
    ctx.lineWidth = 1;
    ctx.strokeRect(w - 70, 10, 65, h - 20);
    ctx.fillStyle = "#a09080";
    ctx.font = "9px 'Noto Sans JP'";
    ctx.textAlign = "center";
    ctx.fillText("厨房", w - 38, h - 16);

    // Entrance
    ctx.fillStyle = "#252018";
    ctx.fillRect(0, h - 50, 55, 45);
    ctx.strokeStyle = "#3a3020";
    ctx.strokeRect(0, h - 50, 55, 45);
    ctx.fillStyle = "#a09080";
    ctx.font = "9px 'Noto Sans JP'";
    ctx.fillText("入口", 28, h - 10);

    // Tables
    for (const t of this.tables) {
      const occupied = this.entities.some(e => e.type === "customer" && Math.abs(e.x - (t.x + t.w / 2)) < 5);
      ctx.fillStyle = occupied ? "#2a3a1a" : "#2a2418";
      ctx.strokeStyle = occupied ? "#4aaa6a" : "#3a3020";
      ctx.lineWidth = 1;

      // Rounded rect
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(t.x + r, t.y);
      ctx.lineTo(t.x + t.w - r, t.y);
      ctx.quadraticCurveTo(t.x + t.w, t.y, t.x + t.w, t.y + r);
      ctx.lineTo(t.x + t.w, t.y + t.h - r);
      ctx.quadraticCurveTo(t.x + t.w, t.y + t.h, t.x + t.w - r, t.y + t.h);
      ctx.lineTo(t.x + r, t.y + t.h);
      ctx.quadraticCurveTo(t.x, t.y + t.h, t.x, t.y + t.h - r);
      ctx.lineTo(t.x, t.y + r);
      ctx.quadraticCurveTo(t.x, t.y, t.x + r, t.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Seat count
      ctx.fillStyle = occupied ? "#4aaa6a" : "#605040";
      ctx.font = "8px 'Space Mono'";
      ctx.textAlign = "center";
      ctx.fillText(`${t.seats}席`, t.x + t.w / 2, t.y + t.h / 2 + 3);
    }

    // Entities
    for (const e of this.entities) {
      if (e.type === "customer") {
        const bob = Math.sin(this.time * 0.05 + e.x) * 2;
        ctx.font = "14px serif";
        ctx.textAlign = "center";
        ctx.fillText(e.icon, e.x, e.y + bob);
        if (e.eating) {
          ctx.font = "8px serif";
          ctx.fillText("🍽", e.x + 10, e.y - 5 + bob);
        }
      } else if (e.type === "waiting") {
        const bob = Math.sin(this.time * 0.02 + e.x * 0.5) * 1.5;
        ctx.font = "12px serif";
        ctx.textAlign = "center";
        ctx.fillText(e.icon, e.x, e.y + bob);
      } else if (e.type === "cook") {
        ctx.font = "12px serif";
        ctx.textAlign = "center";
        const bob = Math.sin(this.time * 0.1 + e.x) * 1;
        ctx.fillText("👨‍🍳", e.x, e.y + bob);
        ctx.fillStyle = "#a09080";
        ctx.font = "7px 'Noto Sans JP'";
        ctx.fillText(e.name, e.x, e.y + 14);
      } else if (e.type === "hall") {
        const moveX = Math.sin(this.time * 0.03 + e.y) * 15;
        ctx.font = "12px serif";
        ctx.textAlign = "center";
        ctx.fillText("🧑‍🍳", e.x + moveX, e.y);
        ctx.fillStyle = "#a09080";
        ctx.font = "7px 'Noto Sans JP'";
        ctx.fillText(e.name, e.x + moveX, e.y + 14);
      }
    }

    // Time & period overlay
    if (state) {
      ctx.fillStyle = "rgba(15,13,10,0.6)";
      ctx.fillRect(60, 20, 100, 18);
      ctx.fillStyle = "#d4a843";
      ctx.font = "10px 'Space Mono'";
      ctx.textAlign = "left";
      const t = state.time;
      ctx.fillText(`${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`, 65, 33);
    }
  }

  startAnimation(state, sim) {
    const loop = () => {
      this.resize();
      this.update(state, sim);
      this.render(state);
      this.animFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  stopAnimation() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }
}
