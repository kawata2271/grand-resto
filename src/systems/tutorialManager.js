export class TutorialManager {
  constructor(state) {
    this.state = state;
    if (this.state.tutorialCompleted === undefined) {
      this.state.tutorialCompleted = false;
    }
    if (!this.state.tutorialStep) {
      this.state.tutorialStep = 0;
    }
    this.steps = [
      {
        title: "ようこそ GRAND RESTO へ！",
        message: "あなたはレストランのオーナーです。\n客が来て、注文して、お金が入る。\nまずは基本を覚えましょう。",
        highlight: null,
        action: null
      },
      {
        title: "時間を進めよう",
        message: "「⏩ 10分」ボタンで時間が進みます。\n「▶ 自動」で自動進行もできます。\nまずは数回押してみましょう。",
        highlight: "btn-tick",
        action: "tick"
      },
      {
        title: "お客さんが来た！",
        message: "テーブルにお客さんが座ると🍽マークが表示されます。\n時間帯によって来る客層が変わります。\nランチタイムはサラリーマンが多いですよ。",
        highlight: "table-status",
        action: null
      },
      {
        title: "閉店処理",
        message: "「🌙 閉店」ボタンで1日を終了します。\n日報で売上・利益・来客数を確認できます。\n押してみましょう。",
        highlight: "btn-end-day",
        action: "endday"
      },
      {
        title: "スタッフ管理",
        message: "右の「採用」タブでスタッフを雇えます。\n「シフト」タブでシフトを調整。\n「スキル」タブでスキルツリーを育成。\n人材が経営の要です！",
        highlight: null,
        action: null
      },
      {
        title: "メニュー開発",
        message: "「メニュー」タブで新メニューを研究できます。\n「錬成」タブでは食材の組み合わせで隠しレシピも！\nメニューの幅を広げましょう。",
        highlight: null,
        action: null
      },
      {
        title: "目標を達成しよう",
        message: "左パネルの「🎯 目標」にシナリオ目標が表示されます。\n月商100万円＆評判80を目指しましょう。\n達成すると「のれん分け」で新しいステージへ！",
        highlight: "scenario-goals",
        action: null
      },
      {
        title: "準備完了！",
        message: "基本は以上です。あとは実践あるのみ！\n\n💡 ヒント:\n・疲れたスタッフは休ませよう\n・ライバル店が出店してきたら差別化を\n・季節に合ったメニュー構成を意識しよう\n\nグッドラック！ 🍽",
        highlight: null,
        action: null
      }
    ];
  }

  isActive() {
    return !this.state.tutorialCompleted && this.state.tutorialStep < this.steps.length;
  }

  getCurrentStep() {
    if (!this.isActive()) return null;
    return { ...this.steps[this.state.tutorialStep], index: this.state.tutorialStep, total: this.steps.length };
  }

  advance() {
    this.state.tutorialStep++;
    if (this.state.tutorialStep >= this.steps.length) {
      this.state.tutorialCompleted = true;
    }
  }

  skip() {
    this.state.tutorialCompleted = true;
  }
}
