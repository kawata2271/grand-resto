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
    systems/              — ゲームシステム
      staff.js            — スタッフ管理（採用・育成・スキルツリー・相性）
      menu.js             — メニュー管理（研究・開発・レシピ）
      layout.js           — 店舗レイアウト（グリッドベース配置）
      events.js           — ランダムイベント処理
      prestige.js         — プレステージ（のれん分け）
      town.js             — 街の成長・競合管理
    render/               — 描画・UI
      canvas.js           — Canvas描画エンジン
      ui.js               — HTML UIコンポーネント
      hud.js              — HUD（日時・資金・ステータス表示）
    data/                 — ゲームデータ（JSON）
      scenarios.json      — シナリオ定義
      menus.json          — メニュー・レシピ定義
      events.json         — ランダムイベント定義（200種目標）
      skills.json         — スキルツリー定義
      staff-templates.json — スタッフテンプレート
      towns.json          — 街タイプ定義
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
