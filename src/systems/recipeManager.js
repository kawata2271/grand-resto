export class RecipeManager {
  constructor(state, recipesData, menus) {
    this.state = state;
    this.recipesData = recipesData;
    this.menus = menus;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.discoveredRecipes) this.state.discoveredRecipes = [];
    if (!this.state.unlockedIngredients) {
      // Start with basic ingredients
      this.state.unlockedIngredients = [
        "ing_rice", "ing_flour", "ing_egg", "ing_vegetable", "ing_dashi"
      ];
    }
  }

  getAvailableIngredients() {
    return this.recipesData.ingredients.filter(
      i => this.state.unlockedIngredients.includes(i.id)
    );
  }

  getLockedIngredients() {
    return this.recipesData.ingredients.filter(
      i => !this.state.unlockedIngredients.includes(i.id)
    );
  }

  unlockIngredient(ingredientId) {
    const ing = this.recipesData.ingredients.find(i => i.id === ingredientId);
    if (!ing) return { success: false, reason: "食材が見つかりません" };

    const cost = ing.cost * 50; // Unlock cost = 50x unit price
    if (this.state.restaurant.money < cost) {
      return { success: false, reason: `資金不足（必要: ¥${cost.toLocaleString()}）` };
    }

    this.state.restaurant.money -= cost;
    this.state.unlockedIngredients.push(ingredientId);
    return { success: true, ingredient: ing, cost };
  }

  getCookingMethods() {
    return this.recipesData.cookingMethods;
  }

  tryResearch(ingredientIds, methodId) {
    if (ingredientIds.length !== 3) {
      return { success: false, reason: "食材を3つ選んでください" };
    }

    const method = this.recipesData.cookingMethods.find(m => m.id === methodId);
    if (!method) return { success: false, reason: "調理法を選んでください" };

    // Check all ingredients are unlocked
    for (const id of ingredientIds) {
      if (!this.state.unlockedIngredients.includes(id)) {
        return { success: false, reason: "未解放の食材が含まれています" };
      }
    }

    // Cost to attempt
    const ingredients = ingredientIds.map(id => this.recipesData.ingredients.find(i => i.id === id));
    const attemptCost = ingredients.reduce((s, i) => s + i.cost, 0) * 5;

    if (this.state.restaurant.money < attemptCost) {
      return { success: false, reason: `研究費用不足（必要: ¥${attemptCost.toLocaleString()}）` };
    }

    this.state.restaurant.money -= attemptCost;

    // Check against hidden recipes
    const sortedIngIds = [...ingredientIds].sort();
    for (const recipe of this.recipesData.hiddenRecipes) {
      if (this.state.discoveredRecipes.includes(recipe.id)) continue;

      const recipeIngs = [...recipe.ingredients].sort();
      if (recipe.method !== methodId) continue;
      if (sortedIngIds.length !== recipeIngs.length) continue;

      let match = true;
      for (let i = 0; i < sortedIngIds.length; i++) {
        if (sortedIngIds[i] !== recipeIngs[i]) { match = false; break; }
      }
      if (!match) continue;

      // Check cook's sense
      const cooks = this.state.staff.filter(s => s.role === "cook");
      const maxSense = cooks.length > 0 ? Math.max(...cooks.map(s => s.stats.sense)) : 0;

      if (maxSense < recipe.requiredSense) {
        return {
          success: false,
          nearMiss: true,
          reason: `組み合わせは正しいが、感覚が足りない（要${recipe.requiredSense}、現在${maxSense}）`,
          cost: attemptCost
        };
      }

      // Discovery!
      this.state.discoveredRecipes.push(recipe.id);
      const menuData = recipe.resultMenu;
      menuData.unlocked = true;
      this.menus.menus.push(menuData);
      this.state.restaurant.activeMenuIds.push(menuData.id);

      return {
        success: true,
        discovered: true,
        recipe,
        menuName: menuData.name,
        message: recipe.discoveryMessage,
        cost: attemptCost
      };
    }

    // No recipe found
    return {
      success: true,
      discovered: false,
      reason: "有望な組み合わせは見つかりませんでした…",
      cost: attemptCost
    };
  }

  getDiscoveredRecipes() {
    return this.recipesData.hiddenRecipes
      .filter(r => this.state.discoveredRecipes.includes(r.id))
      .map(r => r.resultMenu);
  }

  getHintForUndiscovered() {
    const undiscovered = this.recipesData.hiddenRecipes
      .filter(r => !this.state.discoveredRecipes.includes(r.id));

    if (undiscovered.length === 0) return null;

    const recipe = undiscovered[Math.floor(Math.random() * undiscovered.length)];
    const randomIng = recipe.ingredients[Math.floor(Math.random() * recipe.ingredients.length)];
    const ing = this.recipesData.ingredients.find(i => i.id === randomIng);

    return {
      hint: `「${ing?.name || "？？？"}」を使ったまだ見ぬレシピがあるらしい…`,
      totalUndiscovered: undiscovered.length
    };
  }
}
