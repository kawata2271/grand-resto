export class EndingManager {
  constructor(state, achievementMgr) {
    this.state = state;
    this.achievementMgr = achievementMgr;
  }

  checkEndings() {
    const endings = [];
    const s = this.state;
    const achCount = this.achievementMgr.getUnlockedCount();
    const achTotal = this.achievementMgr.getTotalCount();
    const recipes = s.discoveredRecipes?.length || 0;
    const prestige = s.prestige?.level || 0;

    // True Ending: All achievements
    if (achCount >= achTotal) {
      endings.push({
        id: "ending_true",
        title: "真のグランドレストラン",
        icon: "👑",
        description: "全ての実績を解除した。\nあなたは伝説の経営者として歴史に名を刻んだ。\nこの街の食文化は、あなた無くして語れない。",
        rarity: "legendary"
      });
    }

    // Recipe Master: All recipes discovered
    if (recipes >= 20) {
      endings.push({
        id: "ending_recipe_master",
        title: "レシピの探究者",
        icon: "📜",
        description: "全ての隠しレシピを発見した。\nあなたの料理への飽くなき探究心が、\n無数の食の可能性を切り開いた。",
        rarity: "epic"
      });
    }

    // Prestige Master
    if (prestige >= 5) {
      endings.push({
        id: "ending_prestige",
        title: "のれんの帝国",
        icon: "🏯",
        description: "5回ものれん分けを成し遂げた。\nあなたの店は全国チェーンに成長し、\n誰もが知るブランドとなった。",
        rarity: "epic"
      });
    }

    // Reputation 100 sustained
    if (s.restaurant.reputation >= 100 && s.stats.daysPlayed >= 30) {
      endings.push({
        id: "ending_perfect_rep",
        title: "完璧なおもてなし",
        icon: "✨",
        description: "評判100という完璧な評価を達成。\nあなたの店は「奇跡のレストラン」と呼ばれ、\n全国から食通が訪れるようになった。",
        rarity: "rare"
      });
    }

    // Money milestone
    if (s.restaurant.money >= 10000000) {
      endings.push({
        id: "ending_tycoon",
        title: "レストラン王",
        icon: "💎",
        description: "1000万円の資産を築き上げた。\nもはやレストラン経営は趣味のレベルを超え、\n食の帝国を統べる王となった。",
        rarity: "rare"
      });
    }

    // 365 days
    if (s.stats.daysPlayed >= 365) {
      endings.push({
        id: "ending_anniversary",
        title: "1周年記念",
        icon: "🎂",
        description: "開店から1年が経過した。\n山あり谷ありの365日。\n振り返れば全てが宝物のような日々だった。",
        rarity: "uncommon"
      });
    }

    return endings;
  }

  getUnlockedEndings() {
    if (!this.state.unlockedEndings) this.state.unlockedEndings = [];
    return this.state.unlockedEndings;
  }

  checkAndUnlockNew() {
    if (!this.state.unlockedEndings) this.state.unlockedEndings = [];
    const current = this.checkEndings();
    const newEndings = current.filter(e => !this.state.unlockedEndings.includes(e.id));
    for (const e of newEndings) {
      this.state.unlockedEndings.push(e.id);
    }
    return newEndings;
  }
}
