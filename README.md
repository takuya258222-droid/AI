# 転職LINE公式アカウント Bot

「自分に合う転職サービスを30秒で診断できるLINE」。職種・年代・年収帯・重視項目に合わせて、対象条件に合うサービスを2社（保育は1社）に厳選して案内し、登録完了スクショで毎月抽選（3名様）のキャンペーンに応募できます。

**特徴**：全問タップ回答／年収ポジション診断（国税庁の公的統計）／選ばれた理由の明示／転職体験記（note）連動／
タブ付きリッチメニュー／診断後の自動フォロー／運営者情報・選定基準・広告表記の公開／運営はほぼ完全自動

## ドキュメント
| | |
|---|---|
| [docs/設計書.md](docs/設計書.md) | STEP 1〜15の設計書（文面・ボタン・分岐・管理画面の設定手順） |
| [docs/公開手順.md](docs/公開手順.md) | Cloudflareへの公開、Webhook登録、応答設定 |
| [docs/運営チェックリスト.md](docs/運営チェックリスト.md) | 公開前に必ず確認すること（ASP規約・景品・情報の確度） |
| [docs/サービス振り分け表.md](docs/サービス振り分け表.md) | 各サービスの調査結果と表示条件 |
| [docs/集客テンプレート.md](docs/集客テンプレート.md) | note・Threads・Xに貼る誘導文、流入経路リンクの使い方 |

## コマンド
```
npm test              振り分けの総当たりテスト + Webhook疑似送信テスト（約12,000パターン）
npm run e2e           Cloudflare Workers実行環境(wrangler dev)での動作テスト
npm run validate      全メッセージをLINEの検証APIでチェック（要トークン）
npm run assets        画像を再生成（リッチメニュー・バナー・アイコン）
npm run pages         規約ページ・トップページを再生成
npm run docs          設計書・振り分け表を再生成
npm run richmenu      リッチメニューをLINEに作成（--activate で全員に表示）
npm run deploy        Cloudflare Workersへデプロイ
```

## 構成
```
worker/            Cloudflare Workers の入り口       src/adapters/  Node版の入り口
src/core/          診断・振り分け・メッセージ・Webhook処理の本体（Web標準APIのみ）
config/            services.json(サービスDB) brand.json campaign.json notes.json
public/            画像(img/)・規約ページ（Workerが配信）   assets/  リッチメニュー画像・アイコン
scripts/           テスト・画像/ページ/設計書の生成・リッチメニュー登録
docs/              設計書・手順書
```
