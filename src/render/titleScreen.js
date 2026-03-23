import { hasSave, deleteSave } from "../save/saveManager.js";

export class TitleScreen {
  constructor(onStart) {
    this.onStart = onStart;
    this.overlay = null;
  }

  show() {
    this.overlay = document.createElement("div");
    this.overlay.id = "title-screen";
    this.overlay.innerHTML = `
      <div class="ts-bg">
        <div class="ts-content">
          <div class="ts-logo">🍽</div>
          <h1 class="ts-title">GRAND RESTO</h1>
          <div class="ts-subtitle">やり込み型ファミレス経営シミュレーション</div>
          <div class="ts-buttons">
            ${hasSave() ? `<button class="ts-btn ts-btn-primary" id="ts-continue">▶ つづきから</button>` : ""}
            <button class="ts-btn ${hasSave() ? "" : "ts-btn-primary"}" id="ts-newgame">🆕 はじめから</button>
          </div>
          ${hasSave() ? `<button class="ts-btn-small" id="ts-delete">セーブデータを削除</button>` : ""}
          <div class="ts-footer">v1.0 — Powered by Claude Code</div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    // Bindings
    document.getElementById("ts-continue")?.addEventListener("click", () => {
      this._fadeOut(() => this.onStart(false));
    });
    document.getElementById("ts-newgame")?.addEventListener("click", () => {
      if (hasSave()) {
        if (!confirm("既存のセーブデータを上書きしますか？")) return;
      }
      deleteSave();
      this._fadeOut(() => this.onStart(true));
    });
    document.getElementById("ts-delete")?.addEventListener("click", () => {
      if (confirm("セーブデータを削除しますか？この操作は取り消せません。")) {
        deleteSave();
        location.reload();
      }
    });

    // Animate in
    requestAnimationFrame(() => {
      this.overlay.querySelector(".ts-content").style.opacity = "1";
      this.overlay.querySelector(".ts-content").style.transform = "translateY(0)";
    });
  }

  _fadeOut(cb) {
    this.overlay.style.opacity = "0";
    setTimeout(() => {
      this.overlay.remove();
      cb();
    }, 500);
  }
}
