export class MarketingManager {
  constructor(state, marketingData) {
    this.state = state;
    this.data = marketingData;
    this._ensureData();
  }

  _ensureData() {
    if (!this.state.marketing) {
      this.state.marketing = {
        awareness: this.data.initialAwareness,
        brandPower: this.data.initialBrandPower,
        reviewScore: this.data.initialReviewScore,
        reviewCount: 0,
        activeCampaigns: [],
        campaignHistory: [],
        cooldowns: {}
      };
    }
  }

  // ─── Core Getters ───
  getAwareness() { return this.state.marketing.awareness; }
  getBrandPower() { return this.state.marketing.brandPower; }
  getReviewScore() { return this.state.marketing.reviewScore; }
  getReviewCount() { return this.state.marketing.reviewCount; }

  // ─── Awareness → Traffic coefficient ───
  getTrafficCoefficient() {
    const a = Math.floor(this.state.marketing.awareness / 10) * 10;
    const curve = this.data.awarenessToTrafficCurve;
    const lower = curve[String(Math.min(a, 100))] || 0.02;
    const upper = curve[String(Math.min(a + 10, 100))] || 1.0;
    const frac = (this.state.marketing.awareness - a) / 10;
    return lower + (upper - lower) * frac;
  }

  // ─── Available campaigns ───
  getAvailableCampaigns() {
    const days = this.state.stats.daysPlayed;
    return this.data.campaigns.map(c => {
      let locked = false;
      let lockReason = "";
      if (c.unlockCondition) {
        if (c.unlockCondition.maxDays && days > c.unlockCondition.maxDays) {
          locked = true;
          lockReason = "期間限定（終了済み）";
        }
        if (c.unlockCondition.minReputation && this.state.restaurant.reputation < c.unlockCondition.minReputation) {
          locked = true;
          lockReason = `評判${c.unlockCondition.minReputation}以上が必要`;
        }
        if (c.unlockCondition.minAwareness && this.state.marketing.awareness < c.unlockCondition.minAwareness) {
          locked = true;
          lockReason = `認知度${c.unlockCondition.minAwareness}以上が必要`;
        }
      }

      const isActive = this.state.marketing.activeCampaigns.some(ac => ac.id === c.id);
      const cooldownLeft = this.state.marketing.cooldowns[c.id] || 0;
      const canAfford = this.state.restaurant.money >= c.initialCost;

      return { ...c, locked, lockReason, isActive, cooldownLeft, canAfford };
    });
  }

  // ─── Start a campaign ───
  startCampaign(campaignId) {
    const campaign = this.data.campaigns.find(c => c.id === campaignId);
    if (!campaign) return { success: false, reason: "施策が見つかりません" };

    // Check if already active (for persistent)
    if (campaign.type === "persistent" && this.state.marketing.activeCampaigns.some(ac => ac.id === campaignId)) {
      return { success: false, reason: "すでに実行中です" };
    }

    // Cooldown check
    if ((this.state.marketing.cooldowns[campaignId] || 0) > 0) {
      return { success: false, reason: `クールダウン中（残${this.state.marketing.cooldowns[campaignId]}日）` };
    }

    // Unlock check
    const avail = this.getAvailableCampaigns().find(c => c.id === campaignId);
    if (avail?.locked) return { success: false, reason: avail.lockReason };

    // Cost check
    if (this.state.restaurant.money < campaign.initialCost) {
      return { success: false, reason: `資金不足（必要¥${campaign.initialCost.toLocaleString()}）` };
    }

    // Staff check
    if (campaign.requiresStaff) {
      const hasStaff = this.state.staff.some(s => s.role === campaign.requiresStaff && s.shift !== "off");
      if (!hasStaff) return { success: false, reason: `稼働中の${campaign.requiresStaff === "hall" ? "ホール" : "厨房"}スタッフが必要` };
    }

    // Execute
    this.state.restaurant.money -= campaign.initialCost;

    const activeCampaign = {
      id: campaign.id,
      name: campaign.name,
      startDay: this.state.stats.daysPlayed,
      remainingDays: campaign.duration === -1 ? -1 : campaign.duration,
      type: campaign.type,
      awarenessGain: campaign.awarenessGain,
      monthlyCost: campaign.monthlyCost || 0,
      priceDiscountRate: campaign.priceDiscountRate || 0,
      buzzChance: campaign.buzzChance || 0,
      buzzAwareness: campaign.buzzAwareness || 0,
      burnChance: campaign.burnChance || 0,
      burnAwareness: campaign.burnAwareness || 0
    };

    this.state.marketing.activeCampaigns.push(activeCampaign);

    // Immediate awareness for oneshot
    if (campaign.type === "oneshot") {
      let gain = campaign.awarenessGain;
      // Staff skill effect
      if (campaign.staffSkillEffect) {
        const staff = this.state.staff.filter(s => s.role === (campaign.requiresStaff || "hall") && s.shift !== "off");
        if (staff.length > 0) {
          const avgSkill = staff.reduce((sum, s) => sum + (s.stats[campaign.staffSkillEffect] || 30), 0) / staff.length;
          gain *= (0.5 + avgSkill / 100);
        }
      }
      this._addAwareness(gain);
    }

    // Set cooldown
    if (campaign.cooldown > 0) {
      this.state.marketing.cooldowns[campaignId] = campaign.cooldown;
    }

    this.state.marketing.campaignHistory.push({
      id: campaign.id,
      day: this.state.stats.daysPlayed,
      cost: campaign.initialCost
    });

    return { success: true, campaign: activeCampaign, cost: campaign.initialCost };
  }

  // ─── Stop a persistent campaign ───
  stopCampaign(campaignId) {
    const idx = this.state.marketing.activeCampaigns.findIndex(ac => ac.id === campaignId);
    if (idx === -1) return { success: false, reason: "実行中ではありません" };
    this.state.marketing.activeCampaigns.splice(idx, 1);
    return { success: true };
  }

  // ─── Daily update ───
  dailyUpdate() {
    const events = [];

    // Natural decay
    this._addAwareness(-this.data.awarenessDecayRate);

    // Process active campaigns
    const toRemove = [];
    for (const ac of this.state.marketing.activeCampaigns) {
      // Persistent campaigns: daily awareness gain
      if (ac.type === "persistent") {
        this._addAwareness(ac.awarenessGain);
        // Monthly cost (daily portion)
        if (ac.monthlyCost > 0) {
          this.state.restaurant.money -= Math.round(ac.monthlyCost / 30);
        }
      }

      // SNS buzz/burn
      if (ac.buzzChance && Math.random() < ac.buzzChance) {
        this._addAwareness(ac.buzzAwareness);
        events.push(`📱 SNS投稿がバズった！認知度+${ac.buzzAwareness}`);
      }
      if (ac.burnChance && Math.random() < ac.burnChance) {
        this._addAwareness(ac.burnAwareness);
        events.push(`🔥 SNSで炎上…認知度${ac.burnAwareness}`);
      }

      // Duration countdown
      if (ac.remainingDays > 0) {
        ac.remainingDays--;
        if (ac.remainingDays <= 0) {
          toRemove.push(ac.id);
          events.push(`📢 「${ac.name}」の効果が終了しました`);
        }
      }
    }

    // Remove expired campaigns
    this.state.marketing.activeCampaigns = this.state.marketing.activeCampaigns.filter(
      ac => !toRemove.includes(ac.id)
    );

    // Cooldown decrement
    for (const key of Object.keys(this.state.marketing.cooldowns)) {
      if (this.state.marketing.cooldowns[key] > 0) {
        this.state.marketing.cooldowns[key]--;
      }
    }

    // Brand power grows with consistent high reputation
    if (this.state.restaurant.reputation >= 50) {
      this.state.marketing.brandPower = Math.min(100,
        this.state.marketing.brandPower + 0.2);
    } else if (this.state.restaurant.reputation < 30) {
      this.state.marketing.brandPower = Math.max(0,
        this.state.marketing.brandPower - 0.1);
    }

    return events;
  }

  // ─── Customer review after visit ───
  processReview(satisfaction) {
    if (Math.random() > this.data.reviewChanceBase) return null;

    // Convert satisfaction (0-100) to stars (1-5)
    let stars;
    if (satisfaction >= 90) stars = 5;
    else if (satisfaction >= 70) stars = 4;
    else if (satisfaction >= 50) stars = 3;
    else if (satisfaction >= 30) stars = 2;
    else stars = 1;

    // Add random variance
    stars = Math.max(1, Math.min(5, stars + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)));

    const m = this.state.marketing;
    const oldCount = m.reviewCount;
    const oldScore = m.reviewScore;
    m.reviewCount++;
    m.reviewScore = (oldScore * oldCount + stars) / m.reviewCount;

    // Reviews affect awareness
    if (stars >= 4) this._addAwareness(0.5);
    if (stars <= 2) this._addAwareness(-0.3);

    return { stars, newAvg: m.reviewScore, totalReviews: m.reviewCount };
  }

  // ─── Get current price discount ───
  getPriceDiscount() {
    let maxDiscount = 0;
    for (const ac of this.state.marketing.activeCampaigns) {
      if (ac.priceDiscountRate > maxDiscount) maxDiscount = ac.priceDiscountRate;
    }
    return maxDiscount;
  }

  // ─── Internal ───
  _addAwareness(amount) {
    this.state.marketing.awareness = Math.max(0,
      Math.min(this.data.maxAwareness, this.state.marketing.awareness + amount));
  }

  // ─── Summary for UI ───
  getSummary() {
    return {
      awareness: Math.round(this.state.marketing.awareness * 10) / 10,
      brandPower: Math.round(this.state.marketing.brandPower * 10) / 10,
      reviewScore: Math.round(this.state.marketing.reviewScore * 100) / 100,
      reviewCount: this.state.marketing.reviewCount,
      activeCampaigns: this.state.marketing.activeCampaigns.length,
      trafficCoeff: Math.round(this.getTrafficCoefficient() * 100)
    };
  }
}
