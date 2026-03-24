export class ReservationManager {
  constructor(state) {
    this.state = state;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.reservations) {
      this.state.reservations = {
        list: [],
        cancelPolicy: "none", // none, deposit, strict
        noShowCount: 0,
        totalReservations: 0
      };
    }
  }

  // Generate daily reservations based on reputation & awareness
  generateDailyReservations() {
    const rep = this.state.restaurant.reputation;
    const awareness = this.state.marketing?.awareness || 5;
    const events = [];

    // Base reservation chance
    const baseChance = (rep / 100) * (awareness / 100) * 0.4;
    const count = Math.floor(baseChance * 5 + (Math.random() < (baseChance * 5 % 1) ? 1 : 0));

    for (let i = 0; i < count; i++) {
      const groupSize = 2 + Math.floor(Math.random() * 5); // 2-6
      const hour = Math.random() > 0.6 ? 18 + Math.floor(Math.random() * 3) : 11 + Math.floor(Math.random() * 2);
      const isVIP = rep >= 70 && Math.random() < 0.15;

      const reservation = {
        id: `rsv_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
        groupSize,
        hour,
        isVIP,
        noShowRisk: this.state.reservations.cancelPolicy === "strict" ? 0.05 : this.state.reservations.cancelPolicy === "deposit" ? 0.10 : 0.15,
        confirmed: true
      };

      this.state.reservations.list.push(reservation);
      this.state.reservations.totalReservations++;
      events.push(`📋 予約: ${hour}時 ${groupSize}名${isVIP ? " (VIP)" : ""}`);
    }

    return events;
  }

  // Check for no-shows
  processNoShows() {
    const events = [];
    const toRemove = [];

    for (const rsv of this.state.reservations.list) {
      if (Math.random() < rsv.noShowRisk) {
        toRemove.push(rsv.id);
        this.state.reservations.noShowCount++;
        events.push(`😤 予約ノーショー（${rsv.hour}時 ${rsv.groupSize}名）`);
      }
    }

    this.state.reservations.list = this.state.reservations.list.filter(r => !toRemove.includes(r.id));
    return events;
  }

  // Get reservations for current hour
  getReservationsForHour(hour) {
    return this.state.reservations.list.filter(r => r.hour === hour);
  }

  // Get today's reservation count
  getTodayCount() {
    return this.state.reservations.list.length;
  }

  // Set cancel policy
  setCancelPolicy(policy) {
    this.state.reservations.cancelPolicy = policy;
  }

  // Clear daily reservations
  clearDaily() {
    this.state.reservations.list = [];
  }

  getSummary() {
    return {
      today: this.state.reservations.list.length,
      total: this.state.reservations.totalReservations,
      noShows: this.state.reservations.noShowCount,
      policy: this.state.reservations.cancelPolicy
    };
  }
}
