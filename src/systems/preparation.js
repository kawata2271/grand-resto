export class PreparationManager {
  constructor(state, ingredientsData) {
    this.state = state;
    this.data = ingredientsData;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.inventory) {
      this.state.inventory = {
        stock: {},
        prepStock: {},
        orders: [],
        supplier: "standard",
        totalWaste: 0,
        totalWasteCost: 0
      };
      // Initialize with basic stock
      for (const ing of this.data.ingredients) {
        this.state.inventory.stock[ing.id] = {
          quantity: 10,
          purchaseDay: this.state.stats.daysPlayed,
          quality: 1.0
        };
      }
    }
    if (!this.state.prep) {
      this.state.prep = {
        preparedToday: {},
        totalPrepTime: 0
      };
    }
  }

  // ─── Inventory ───
  getStock(ingredientId) {
    return this.state.inventory.stock[ingredientId] || { quantity: 0, purchaseDay: 0, quality: 1.0 };
  }

  getStockSummary() {
    return this.data.ingredients.map(ing => {
      const stock = this.getStock(ing.id);
      const daysOld = this.state.stats.daysPlayed - stock.purchaseDay;
      const fresh = daysOld <= ing.shelfLife;
      const expiringSoon = daysOld >= ing.shelfLife - 1;
      return { ...ing, ...stock, daysOld, fresh, expiringSoon };
    });
  }

  // ─── Ordering ───
  placeOrder(ingredientId, quantity, supplierId) {
    const ing = this.data.ingredients.find(i => i.id === ingredientId);
    if (!ing) return { success: false, reason: "食材が見つかりません" };
    const supplier = this.data.suppliers.find(s => s.id === (supplierId || this.state.inventory.supplier));
    if (!supplier) return { success: false, reason: "業者が見つかりません" };

    const cost = Math.round(ing.basePrice * quantity * supplier.priceMultiplier);
    if (cost < supplier.minOrder && supplier.minOrder > 0) {
      return { success: false, reason: `最低注文額¥${supplier.minOrder.toLocaleString()}以上` };
    }
    if (this.state.restaurant.money < cost) {
      return { success: false, reason: `資金不足（¥${cost.toLocaleString()}）` };
    }

    this.state.restaurant.money -= cost;

    if (supplier.deliveryDays === 0) {
      // Immediate delivery
      const stock = this.state.inventory.stock[ingredientId] || { quantity: 0, purchaseDay: 0, quality: 1.0 };
      stock.quantity += quantity;
      stock.purchaseDay = this.state.stats.daysPlayed;
      stock.quality = supplier.qualityMultiplier;
      this.state.inventory.stock[ingredientId] = stock;
    } else {
      this.state.inventory.orders.push({
        ingredientId, quantity, quality: supplier.qualityMultiplier,
        deliveryDay: this.state.stats.daysPlayed + supplier.deliveryDays
      });
    }

    return { success: true, cost, deliveryDays: supplier.deliveryDays };
  }

  // ─── Quick order: auto-restock all low items ───
  autoRestock() {
    const results = [];
    for (const ing of this.data.ingredients) {
      const stock = this.getStock(ing.id);
      if (stock.quantity < 5) {
        const qty = 10 - stock.quantity;
        const r = this.placeOrder(ing.id, qty, this.state.inventory.supplier);
        if (r.success) results.push({ name: ing.name, qty, cost: r.cost });
      }
    }
    return results;
  }

  // ─── Preparation (pre-cooking) ───
  doPrepTask(taskId, staffId) {
    const task = this.data.prepTasks.find(t => t.id === taskId);
    if (!task) return { success: false, reason: "仕込みタスクが見つかりません" };

    const stock = this.getStock(task.ingredient);
    if (stock.quantity < 1) return { success: false, reason: `${task.ingredient}の在庫がありません` };

    // Consume ingredient
    stock.quantity -= 1;

    // Staff skill bonus
    let prepAmount = task.prepPerUnit;
    if (staffId) {
      const staff = this.state.staff.find(s => s.id === staffId);
      if (staff) {
        const skill = staff.stats[task.skillBonus] || 30;
        prepAmount = Math.round(prepAmount * (0.7 + skill / 100));
        staff.fatigue = Math.min(100, staff.fatigue + Math.round(task.time / 10));
        staff.experience += 1;
      }
    }

    // Add to prep stock
    this.state.prep.preparedToday[task.id] = (this.state.prep.preparedToday[task.id] || 0) + prepAmount;
    this.state.prep.totalPrepTime += task.time;

    return { success: true, prepAmount, totalPrep: this.state.prep.preparedToday[task.id] };
  }

  // ─── Quick prep: auto-prepare estimated needs ───
  quickPrepAll(estimatedCustomers) {
    const results = [];
    const availableCooks = this.state.staff.filter(s => s.role === "cook" && s.shift !== "off");
    let staffIdx = 0;

    for (const task of this.data.prepTasks) {
      const needed = Math.ceil(estimatedCustomers / task.prepPerUnit);
      const current = this.state.prep.preparedToday[task.id] || 0;
      if (current >= needed) continue;

      const rounds = Math.min(3, needed - Math.floor(current / task.prepPerUnit));
      for (let i = 0; i < rounds; i++) {
        const cook = availableCooks[staffIdx % availableCooks.length];
        staffIdx++;
        if (cook) {
          const r = this.doPrepTask(task.id, cook.id);
          if (r.success) results.push({ task: task.name, amount: r.prepAmount });
        }
      }
    }
    return results;
  }

  // ─── Get prep readiness (affects cooking speed) ───
  getPrepReadiness() {
    const totalPrep = Object.values(this.state.prep.preparedToday).reduce((a, b) => a + b, 0);
    // Normalize: 0 prep = 0.5x speed, 30+ prep = 1.2x speed
    if (totalPrep <= 0) return 0.5;
    if (totalPrep >= 30) return 1.2;
    return 0.5 + (totalPrep / 30) * 0.7;
  }

  // ─── Daily update: deliveries, expiry, waste ───
  dailyUpdate() {
    const events = [];
    const day = this.state.stats.daysPlayed;

    // Process deliveries
    const delivered = this.state.inventory.orders.filter(o => o.deliveryDay <= day);
    for (const order of delivered) {
      const stock = this.state.inventory.stock[order.ingredientId] || { quantity: 0, purchaseDay: 0, quality: 1.0 };
      stock.quantity += order.quantity;
      stock.purchaseDay = day;
      stock.quality = order.quality;
      this.state.inventory.stock[order.ingredientId] = stock;
      const ing = this.data.ingredients.find(i => i.id === order.ingredientId);
      events.push(`📦 ${ing?.name || order.ingredientId} ${order.quantity}${ing?.unit || "個"} 入荷`);
    }
    this.state.inventory.orders = this.state.inventory.orders.filter(o => o.deliveryDay > day);

    // Check expiry
    for (const ing of this.data.ingredients) {
      const stock = this.state.inventory.stock[ing.id];
      if (!stock || stock.quantity <= 0) continue;
      const age = day - stock.purchaseDay;
      if (age > ing.shelfLife) {
        const wasteQty = Math.ceil(stock.quantity * 0.3); // 30% waste per day past expiry
        stock.quantity = Math.max(0, stock.quantity - wasteQty);
        const wasteCost = wasteQty * this.data.wasteDisposalCostPerKg;
        this.state.restaurant.money -= wasteCost;
        this.state.inventory.totalWaste += wasteQty;
        this.state.inventory.totalWasteCost += wasteCost;
        events.push(`🗑 ${ing.name}が期限切れ。${wasteQty}${ing.unit}廃棄（¥${wasteCost.toLocaleString()}）`);
      }
    }

    // Reset daily prep
    this.state.prep.preparedToday = {};
    this.state.prep.totalPrepTime = 0;

    // Consume ingredients based on customer count (simplified)
    const customers = this.state.todayLog?.customers || 0;
    if (customers > 0) {
      for (const ing of this.data.ingredients) {
        const stock = this.state.inventory.stock[ing.id];
        if (!stock) continue;
        const consume = Math.ceil(customers * 0.1); // rough consumption
        stock.quantity = Math.max(0, stock.quantity - consume);
      }
    }

    return events;
  }

  // ─── Check if a menu can be served (has ingredients) ───
  canServeMenu() {
    // Simplified: check if key ingredients are in stock
    const criticalLow = this.data.ingredients.filter(ing => {
      const stock = this.getStock(ing.id);
      return stock.quantity <= 0;
    });
    return criticalLow.length < 3; // At least some ingredients available
  }

  // ─── Makanai (staff meal from leftovers) ───
  doMakanai() {
    // Use near-expiry ingredients for staff meal
    const used = [];
    for (const ing of this.data.ingredients) {
      const stock = this.state.inventory.stock[ing.id];
      if (!stock || stock.quantity <= 0) continue;
      const age = this.state.stats.daysPlayed - stock.purchaseDay;
      if (age >= ing.shelfLife - 1 && stock.quantity > 0) {
        stock.quantity -= 1;
        used.push(ing.name);
      }
    }

    if (used.length > 0) {
      for (const s of this.state.staff) {
        s.morale = Math.min(100, s.morale + this.data.makanaiMoraleBonus);
      }
      return { success: true, used, moraleBonus: this.data.makanaiMoraleBonus };
    }
    return { success: false, reason: "賄いに使える食材がありません" };
  }
}
