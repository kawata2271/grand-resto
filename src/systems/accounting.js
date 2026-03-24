export class AccountingManager {
  constructor(state, config) {
    this.state = state;
    this.config = config;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.accounting) {
      this.state.accounting = {
        monthlyPL: [],
        loans: [],
        subsidies: [],
        cashFlowHistory: [],
        taxPaid: 0,
        bankruptDays: 0
      };
    }
  }

  // Monthly P/L calculation
  generateMonthlyPL() {
    const history = this.state.history || [];
    const month = this.state.time.month === 1 ? 12 : this.state.time.month;
    const monthDays = history.filter(h => h.date.month === month);
    if (monthDays.length === 0) return null;

    const revenue = monthDays.reduce((s, d) => s + d.revenue, 0);
    const foodCost = monthDays.reduce((s, d) => s + d.cost, 0);
    const rent = this.config.economy.rentPerMonth;

    // Estimate labor from staff
    const laborCost = this.state.staff.reduce((s, st) => s + st.salary, 0);

    // Equipment monthly costs
    let equipmentCost = 0;
    if (this.state.equipment?.owned) {
      for (const [, eq] of Object.entries(this.state.equipment.owned)) {
        // Rough estimate from equipment data
        equipmentCost += 3000; // Simplified average
      }
    }

    // Marketing costs
    let marketingCost = 0;
    for (const ac of (this.state.marketing?.activeCampaigns || [])) {
      marketingCost += (ac.monthlyCost || 0);
    }
    marketingCost += (this.state.marketing?.campaignHistory || [])
      .filter(h => {
        const hMonth = Math.ceil(h.day / 30);
        return hMonth === month;
      })
      .reduce((s, h) => s + h.cost, 0);

    const grossProfit = revenue - foodCost;
    const operatingExpenses = laborCost + rent + equipmentCost + marketingCost;
    const operatingProfit = grossProfit - operatingExpenses;

    // Tax (simplified: 10% on profit if positive)
    const tax = operatingProfit > 0 ? Math.round(operatingProfit * 0.1) : 0;
    const netProfit = operatingProfit - tax;

    const pl = {
      month, year: this.state.time.year,
      revenue, foodCost, grossProfit,
      laborCost, rent, equipmentCost, marketingCost,
      operatingExpenses, operatingProfit,
      tax, netProfit,
      foodCostRatio: revenue > 0 ? Math.round((foodCost / revenue) * 100) : 0,
      laborCostRatio: revenue > 0 ? Math.round((laborCost / revenue) * 100) : 0
    };

    this.state.accounting.monthlyPL.push(pl);
    this.state.accounting.taxPaid += tax;
    this.state.restaurant.money -= tax;

    return pl;
  }

  // Loan system
  applyForLoan(amount) {
    if (amount < 100000 || amount > 5000000) return { success: false, reason: "融資額は10万〜500万円" };
    if (this.state.accounting.loans.length >= 3) return { success: false, reason: "融資上限（3件）に達しています" };

    // Approval based on reputation + days played
    const rep = this.state.restaurant.reputation;
    const days = this.state.stats.daysPlayed;
    const approvalChance = Math.min(0.9, (rep / 100) * 0.5 + (days / 365) * 0.3);

    if (Math.random() > approvalChance) {
      return { success: false, reason: "審査の結果、融資が見送られました" };
    }

    const interestRate = 0.05; // 5% annual
    const monthlyPayment = Math.round((amount * (1 + interestRate)) / 12);
    const loan = {
      id: `loan_${Date.now()}`,
      principal: amount,
      remaining: amount,
      monthlyPayment,
      startDay: this.state.stats.daysPlayed,
      monthsLeft: 12
    };

    this.state.accounting.loans.push(loan);
    this.state.restaurant.money += amount;
    return { success: true, loan };
  }

  // Monthly loan repayment
  processLoanPayments() {
    const events = [];
    for (const loan of this.state.accounting.loans) {
      if (loan.monthsLeft <= 0) continue;

      if (this.state.restaurant.money >= loan.monthlyPayment) {
        this.state.restaurant.money -= loan.monthlyPayment;
        loan.remaining -= loan.monthlyPayment;
        loan.monthsLeft--;
        events.push(`🏦 融資返済 ¥${loan.monthlyPayment.toLocaleString()}（残${loan.monthsLeft}ヶ月）`);
      } else {
        events.push(`⚠️ 融資返済不能！信用スコア低下`);
        this.state.restaurant.reputation = Math.max(0, this.state.restaurant.reputation - 5);
      }
    }
    // Remove completed loans
    this.state.accounting.loans = this.state.accounting.loans.filter(l => l.monthsLeft > 0);
    return events;
  }

  // Cash flow tracking
  recordCashFlow() {
    this.state.accounting.cashFlowHistory.push({
      day: this.state.stats.daysPlayed,
      balance: this.state.restaurant.money
    });
    // Keep last 90 days
    if (this.state.accounting.cashFlowHistory.length > 90) {
      this.state.accounting.cashFlowHistory.shift();
    }
  }

  // Bankruptcy check
  checkBankruptcy() {
    if (this.state.restaurant.money < -100000) {
      this.state.accounting.bankruptDays++;
      if (this.state.accounting.bankruptDays >= 7) {
        return { bankrupt: true, message: "7日連続の赤字超過により倒産…ゲームオーバー" };
      }
      return { bankrupt: false, warning: `⚠️ 資金がマイナスです！あと${7 - this.state.accounting.bankruptDays}日で倒産` };
    }
    this.state.accounting.bankruptDays = 0;
    return { bankrupt: false };
  }

  // Get latest P/L
  getLatestPL() {
    return this.state.accounting.monthlyPL[this.state.accounting.monthlyPL.length - 1] || null;
  }

  getActiveLoans() { return this.state.accounting.loans; }
  getTotalDebt() { return this.state.accounting.loans.reduce((s, l) => s + l.remaining, 0); }

  getSummary() {
    return {
      balance: this.state.restaurant.money,
      totalDebt: this.getTotalDebt(),
      activeLoans: this.state.accounting.loans.length,
      taxPaid: this.state.accounting.taxPaid,
      bankruptDays: this.state.accounting.bankruptDays,
      latestPL: this.getLatestPL()
    };
  }
}
