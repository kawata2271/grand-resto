export class EffectManager {
  constructor() {
    this.container = null;
    this._init();
  }

  _init() {
    this.container = document.createElement("div");
    this.container.id = "effect-container";
    this.container.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:300;overflow:hidden";
    document.body.appendChild(this.container);
  }

  // Floating text that rises and fades
  floatText(text, x, y, color = "#f0c860", size = 16) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;color:${color};font-size:${size}px;font-weight:900;font-family:'Noto Sans JP',sans-serif;text-shadow:0 2px 8px rgba(0,0,0,0.8);transition:all 1.5s ease-out;opacity:1;z-index:301`;
    this.container.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = `${y - 80}px`;
      el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 1600);
  }

  // Center screen notification with icon
  notify(icon, title, subtitle = "", duration = 2500) {
    const el = document.createElement("div");
    el.innerHTML = `<div style="font-size:40px;margin-bottom:6px">${icon}</div><div style="font-size:18px;font-weight:900;color:#f0c860">${title}</div>${subtitle ? `<div style="font-size:12px;color:#a09080;margin-top:4px">${subtitle}</div>` : ""}`;
    el.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.5);background:rgba(15,13,10,0.92);border:2px solid #d4a843;border-radius:12px;padding:20px 32px;text-align:center;z-index:302;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);opacity:0;pointer-events:none";
    this.container.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = "translate(-50%,-50%) scale(1)";
      el.style.opacity = "1";
    });
    setTimeout(() => {
      el.style.transform = "translate(-50%,-50%) scale(0.8)";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 500);
    }, duration);
  }

  // Particle burst from a point
  particles(x, y, count = 12, color = "#f0c860") {
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      const angle = (Math.PI * 2 * i) / count;
      const dist = 40 + Math.random() * 60;
      const size = 3 + Math.random() * 4;
      p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${color};border-radius:50%;transition:all 0.8s ease-out;opacity:1;z-index:301`;
      this.container.appendChild(p);
      requestAnimationFrame(() => {
        p.style.left = `${x + Math.cos(angle) * dist}px`;
        p.style.top = `${y + Math.sin(angle) * dist}px`;
        p.style.opacity = "0";
        p.style.transform = "scale(0)";
      });
      setTimeout(() => p.remove(), 900);
    }
  }

  // Level up effect
  levelUp(staffName) {
    this.notify("⬆️", `${staffName} レベルアップ！`, "スキルポイント獲得", 2000);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.particles(cx, cy - 40, 16, "#f0c860");
  }

  // Achievement unlock
  achievement(icon, name) {
    this.notify(icon, `実績解除！`, name, 3000);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.particles(cx, cy, 20, "#4aaa6a");
  }

  // Recipe discovery
  recipeDiscovered(menuName) {
    this.notify("🌟", "新レシピ発見！", menuName, 3000);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.particles(cx, cy, 24, "#9060c8");
  }

  // Event notification (brief flash)
  eventFlash(icon, name) {
    const el = document.createElement("div");
    el.innerHTML = `<span style="font-size:18px;margin-right:6px">${icon}</span><span style="font-size:13px;font-weight:700;color:#e8e0d0">${name}</span>`;
    el.style.cssText = "position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-20px);background:rgba(15,13,10,0.9);border:1px solid #d4a843;border-radius:8px;padding:8px 18px;z-index:302;transition:all 0.4s ease;opacity:0;pointer-events:none;white-space:nowrap";
    this.container.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = "translateX(-50%) translateY(0)";
      el.style.opacity = "1";
    });
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(-20px)";
      setTimeout(() => el.remove(), 500);
    }, 2500);
  }

  // Money change float
  moneyFloat(amount) {
    const positive = amount >= 0;
    const text = positive ? `+¥${amount.toLocaleString()}` : `-¥${Math.abs(amount).toLocaleString()}`;
    const color = positive ? "#4aaa6a" : "#c94040";
    const x = window.innerWidth - 150 + Math.random() * 40;
    const y = 30 + Math.random() * 20;
    this.floatText(text, x, y, color, 14);
  }

  // Rival appear
  rivalAppear(name) {
    this.notify("⚔️", "ライバル出現！", name, 3000);
  }

  // Prestige
  prestigeEffect() {
    this.notify("🔄", "のれん分け", "新たな旅が始まる…", 4000);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.particles(cx, cy, 20, ["#f0c860", "#4aaa6a", "#9060c8", "#4a88cc", "#c94040"][i]), i * 200);
    }
  }
}
