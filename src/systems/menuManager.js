export class MenuManager {
  constructor(state, menus) {
    this.state = state;
    this.menus = menus;
    this.researching = null; // { menuId, daysLeft }
  }

  getActiveMenus() {
    return this.menus.menus.filter(
      m => this.state.restaurant.activeMenuIds.includes(m.id)
    );
  }

  getResearchableMenus(maxCookLevel) {
    return this.menus.menus.filter(m =>
      !m.unlocked &&
      !this.state.restaurant.activeMenuIds.includes(m.id) &&
      (m.requiredCookLevel || 0) <= maxCookLevel &&
      (!this.researching || this.researching.menuId !== m.id)
    );
  }

  startResearch(menuId) {
    if (this.researching) {
      return { success: false, reason: "すでに研究中のメニューがあります" };
    }

    const menu = this.menus.menus.find(m => m.id === menuId);
    if (!menu) return { success: false, reason: "メニューが見つかりません" };

    if (this.state.restaurant.money < menu.researchCost) {
      return { success: false, reason: "研究資金が不足しています" };
    }

    this.state.restaurant.money -= menu.researchCost;
    this.researching = {
      menuId: menu.id,
      menuName: menu.name,
      daysLeft: menu.researchDays,
      totalDays: menu.researchDays
    };

    return { success: true, menu };
  }

  advanceDay() {
    if (!this.researching) return null;

    this.researching.daysLeft -= 1;

    if (this.researching.daysLeft <= 0) {
      const menuId = this.researching.menuId;
      const menuName = this.researching.menuName;
      this.state.restaurant.activeMenuIds.push(menuId);

      const menuData = this.menus.menus.find(m => m.id === menuId);
      if (menuData) menuData.unlocked = true;

      this.researching = null;
      return { completed: true, menuId, menuName };
    }

    return { completed: false, daysLeft: this.researching.daysLeft, menuName: this.researching.menuName };
  }

  toggleMenu(menuId) {
    const ids = this.state.restaurant.activeMenuIds;
    const index = ids.indexOf(menuId);
    if (index >= 0) {
      if (ids.length <= 1) return { success: false, reason: "最低1品はメニューに必要です" };
      ids.splice(index, 1);
      return { success: true, active: false };
    } else {
      const menu = this.menus.menus.find(m => m.id === menuId && m.unlocked);
      if (!menu) return { success: false, reason: "解放されていないメニューです" };
      ids.push(menuId);
      return { success: true, active: true };
    }
  }
}
