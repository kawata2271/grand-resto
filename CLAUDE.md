# GRAND RESTO — やり込み型ファミレス経営シミュレーション

## プロジェクト概要
「ザ・ファミレス」インスパイアのブラウザ経営シミュレーションゲーム。
ローグライク的周回要素・スタッフ育成深度・ライバル経済戦を組み合わせた、何周しても飽きないやり込みシム。

## 技術スタック
- **言語**: Vanilla JS (ES Modules) — フレームワーク不使用
- **描画**: Canvas 2D API（店内シミュレーション描画）
- **保存**: LocalStorage / IndexedDB
- **音声**: Web Audio API
- **データ**: JSON外出し（メニュー・イベント・シナリオ・スキル等）
- **エントリポイント**: `index.html`

## ディレクトリ構成
```
grand-resto/
  index.html              — エントリポイント
  src/
    engine/               — シミュレーションコア
      sim.js              — 1日シミュレーション（tick制）
      economy.js          — 経済計算・収支管理
      ai.js               — ライバルAI
    systems/ (28ファイル)  — ゲームシステム
      staffManager.js     — スタッフ採用・解雇
      shiftManager.js     — シフト管理・休憩・労基法対応
      skillManager.js     — スキルツリー（6路線）
      compatibilityManager.js — スタッフ相性
      mentorManager.js    — 師弟関係
      turnoverManager.js  — 離職リスク
      abilityManager.js   — 特殊能力（100種）
      menuManager.js      — メニュー管理・研究
      recipeManager.js    — 料理錬成（隠しレシピ20種）
      eventManager.js     — ランダムイベント（524種）
      rivalManager.js     — ライバル店AI（5種）
      seasonManager.js    — 季節システム
      formatManager.js    — 業態変更（6業態）
      townManager.js      — プロシージャル街マップ（8タイプ）
      relocationManager.js — 店舗移転（30箇所）
      prestigeManager.js  — プレステージ（のれん分け）
      achievementManager.js — 実績（130種）
      endingManager.js    — エンディング（6種）
      tutorialManager.js  — チュートリアル
      furniture-data.js   — 家具データ（38種×10グレード）
      furniture.js        — 家具配置・スコアリング
      marketing.js        — 集客・マーケティング（34施策）
      cleaning.js         — 清掃・衛生管理
      preparation.js      — 仕込み・食材在庫
      equipment.js        — 設備管理（10設備）
      reservation.js      — 予約管理
      customerDB.js       — 顧客データベース
      accounting.js       — 会計・融資・P/L
    render/ (6ファイル)    — 描画・UI
      ui.js               — HTML UIコンポーネント（20タブ）
      floorView.js        — Canvas店内ビュー
      floor-editor.js     — 家具配置エディタ
      chart.js            — グラフ描画
      effects.js          — アニメーション演出
      titleScreen.js      — タイトル画面
    data/ (20ファイル)     — ゲームデータ（JSON）
      config.json         — ゲーム定数
      menus.json          — メニュー（30品）
      events.json         — ランダムイベント（524種）
      skills.json         — スキルツリー
      staff-templates.json — スタッフテンプレート
      customers.json      — 客タイプ（8種）
      abilities.json      — 特殊能力（100種）
      achievements.json   — 実績（130種）
      recipes.json        — 隠しレシピ（20種）
      rivals.json         — ライバル店
      seasons.json        — 季節データ
      formats.json        — 業態データ
      towns.json          — 街タイプ
      locations.json      — 移転先（30箇所）
      upgrades.json       — テーブル・シナリオ
      marketing.json      — 集客施策（34種）
      cleaning.json       — 清掃タスク
      ingredients.json    — 食材マスタ（14種）
      equipment.json      — 設備マスタ（10種）
      help.json           — ヘルプデータ
    save/
      saveManager.js      — セーブ/ロード抽象化
  assets/
    audio/                — BGM・SE
    sprites/              — スプライト画像
```

## コーディング規約
- ES Modules (`import`/`export`) を使用、`<script type="module">`
- クラスベース設計。各システムは独立したクラスとして実装
- ゲームステートは単一のGameStateオブジェクトで管理（JSON直列化可能に保つ）
- データ駆動設計：ゲームバランスに関わる数値はすべてJSONデータファイルに外出し
- 関数名・変数名は英語camelCase、クラス名はPascalCase
- UIテキスト（プレイヤーに見える文字列）は日本語
- コメントは必要最小限（コード自体で意図が伝わるように書く）

## ゲームステート設計方針
- GameStateはプレーンオブジェクト（JSON.stringify可能）
- セーブ/ロードはGameStateの直列化/復元で完結
- 循環参照禁止（IDで参照）
- 日時は `{ year, month, day, hour, minute }` オブジェクト

## 開発フェーズ（現在: Phase 1 — プロトタイプ）
Phase 1の目標：「1日の売上が計算できる最小プロトタイプ」
- メニュー3品・スタッフ2人・テーブル5卓
- 客が来て、注文して、お金が増える基本ループ
- テキストベースUI（Canvas描画は後回し）

## 重要な設計原則
1. **遊べる状態を維持** — 各Phase完了時点で必ずプレイ可能であること
2. **データ駆動** — バランス調整はコード変更不要、JSONを編集するだけ
3. **モジュール独立** — 各systemsは疎結合。engine経由でのみ連携
4. **プレーンJS** — npm/bundler不使用。ブラウザで直接動作
