export class FormatManager {
  constructor(state, formatsData) {
    this.state = state;
    this.formatsData = formatsData;
    if (!this.state.restaurant.formatId) {
      this.state.restaurant.formatId = "format_general";
    }
    if (!this.state.restaurant.formatCooldown) {
      this.state.restaurant.formatCooldown = 0;
    }
  }

  getCurrentFormat() {
    return this.formatsData.formats.find(f => f.id === this.state.restaurant.formatId)
      || this.formatsData.formats[0];
  }

  getAvailableFormats() {
    const prestige = this.state.prestige?.level || 0;
    return this.formatsData.formats.filter(f =>
      f.unlocked || (f.requirePrestige && prestige >= f.requirePrestige)
    );
  }

  canChangeFormat() {
    return this.state.restaurant.formatCooldown <= 0;
  }

  changeFormat(formatId) {
    const format = this.formatsData.formats.find(f => f.id === formatId);
    if (!format) return { success: false, reason: "業態が見つかりません" };

    const prestige = this.state.prestige?.level || 0;
    if (!format.unlocked && (!format.requirePrestige || prestige < format.requirePrestige)) {
      return { success: false, reason: "この業態はまだ解放されていません" };
    }

    if (!this.canChangeFormat()) {
      return { success: false, reason: `業態変更クールダウン中（残${this.state.restaurant.formatCooldown}日）` };
    }

    const cost = this.formatsData.changeCost;
    if (this.state.restaurant.money < cost) {
      return { success: false, reason: `資金不足（必要: ¥${cost.toLocaleString()}）` };
    }

    // Remove restricted genre menus
    if (format.genreRestriction.length > 0) {
      this.state.restaurant.activeMenuIds = this.state.restaurant.activeMenuIds.filter(id => {
        // Need menus data to check genre - handled by caller
        return true;
      });
    }

    this.state.restaurant.money -= cost;
    this.state.restaurant.formatId = formatId;
    this.state.restaurant.formatCooldown = this.formatsData.changeCooldownDays;

    return { success: true, format };
  }

  removeRestrictedMenus(menus) {
    const format = this.getCurrentFormat();
    if (format.genreRestriction.length === 0) return [];

    const removed = [];
    this.state.restaurant.activeMenuIds = this.state.restaurant.activeMenuIds.filter(id => {
      const menu = menus.menus.find(m => m.id === id);
      if (menu && format.genreRestriction.includes(menu.genre)) {
        removed.push(menu.name);
        return false;
      }
      return true;
    });
    return removed;
  }

  isGenreAllowed(genre) {
    const format = this.getCurrentFormat();
    return !format.genreRestriction.includes(genre);
  }

  getGenrePopularityMult(genre) {
    const format = this.getCurrentFormat();
    return format.genreBonus[genre] || 1.0;
  }

  getCustomerTypeMult(customerTypeId) {
    const format = this.getCurrentFormat();
    return format.customerBonus[customerTypeId] || 1.0;
  }

  getCustomerRateMult() {
    const format = this.getCurrentFormat();
    return format.customerRateMult || 1.0;
  }

  getReputationMult() {
    return this.getCurrentFormat().reputationMult;
  }

  advanceDay() {
    if (this.state.restaurant.formatCooldown > 0) {
      this.state.restaurant.formatCooldown--;
    }
  }
}
