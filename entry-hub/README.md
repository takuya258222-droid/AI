## 2026-10-26 更新
- 職歴は実際の勤務期間を入力。直近5年も保持し、詳細の合計が最低3年（経験3年未満なら全期間）に達した後、残りをまとめます。
- 郵便番号必須（7桁、ハイフン・全角正規化）。法人向け匿名文には含めません。
- 電話希望は1つ。10:00〜19:30の30分単位、または日付＋いつでも可。
- 管理画面から時刻指定は30分、いつでも可は終日の連絡可能日として登録。他の予定をブロックしない空き扱いです。フォーム送信だけで予定を確定せず、担当者が登録します。
- SMSの共通短縮パスは `/e`。有効期限・候補者情報・DB照会を持たず、何人でも同じURLから別々に応募できます。旧 `/s/` も保持。
- 既存DBには `supabase/migrations/20261026_flexible_entry.sql` のみ適用。新規DBはschema.sqlのみ（更新を含む）。
- 以下の旧説明にある「直近ちょうど3年」「1時間」「電話第2希望」はこの更新で置き換わります。

# CARE ENTRY — Webエントリー・社内管理

Next.js App Router + Tailwind CSS + Supabase + Resend。GAS不使用。フォーム・認証・保存・通知はGoogleに依存しません。Googleカレンダーは管理者が確定した電話面談を1時間で登録する独立した連携です。

## 最初に読むこと

これはデプロイ可能なコード一式です。外部サービスのキーを設定しない状態では、実際の応募保存・通知・カレンダー登録は動きません。モックテスト合格は実メール受信や本番接続を意味しません。

- 求職者用URL：公開先ドメインの `/`
- 社内用URL：同じドメインの `/admin`（`?mode=admin` も対応）
- SMS用：同じドメインの `/s/xxxxxxxx`
- 社内画面は最初だけメール＋パスワード認証。ログイン済みの端末は直接開きます。URLだけ知っている外部の人には個人情報を返しません。
- Vercel Hobbyは非商用限定のため、この業務用途ではRender無料Web Service、またはVercel Proなど適合するプランを使用してください。
- Render無料枠は一定時間無通信で休止し、次回の初回アクセスが遅くなります。SMSから即座に開く体験を優先する本番運用では、常時稼働プランが適しています。無料枠で速度を保証することはできません。

## 実装済みの機能

1. スマホ向け4ステップフォーム。文字16px以上・大きなタップ領域・telキーボード・外部ログイン不要。任意項目は折りたたみ。
2. 看護／介護の資格と施設形態の連動。経験は年月単位。直近3年（就業経験ベース）を新しい順に入力し、それ以前は施設形態を複数選択して一括登録。
3. 30年なら「直近3年＋過去27年」。1年6ヶ月ならその全期間。未経験なら職歴入力を省略。直近期間の不足・超過は送信前とサーバーで検証。
4. 氏名・電話・資格・職歴検索、職種フィルター、「未対応／対応済み／対象外」のタブと件数表示。削除ボタンなし。対象外も記録を保持。
5. 架電・SMS起動、短縮URL入りSMS本文の一発コピー、URLのみコピー。
6. 法人用コピーは氏名・電話・管理ID・社内メモ・自由記述を除外。年代・資格・職歴・勤務条件・入職・見学希望を整形。
7. ステータスと社内メモを非同期保存。他担当者との同時更新は409で停止し、黙って上書きしません。
8. 全応募項目を指定宛先へ通知。失敗時は応募を保持し、管理画面から再送可能。通知処理中の重複送信を抑制。
9. 電話面談は希望時間帯内の1時間で登録。Googleの空き状況を確認し、DBでアプリ内の重複を排除。再試行は同一GoogleイベントIDで照合。
10. 法人向けPDF。応募から初期入力、足りない項目を編集、自動保存、担当者プロフィール選択、署名の再利用。日本語フォントをnpmパッケージから同梱するためPDF生成時にGoogle Fontsへの通信はありません。
11. メール／カレンダー接続テスト画面。メールは実受信を別途確認。予定は「接続テスト」として1時間登録しGoogle側から再取得。

## 構成

| 場所 | 内容 |
| --- | --- |
| app/page.tsx | 公開フォーム |
| app/admin/page.tsx | 管理画面 |
| components/EntryForm.tsx | スマホ向けフォーム |
| components/Dashboard.tsx | 一覧、検索、コピー、メモ、ステータス |
| components/SheetEditor.tsx | PDF項目の編集・自動保存、担当者プロフィール |
| components/IntegrationPanel.tsx | 実接続テストUI |
| app/api/entries | 公開応募受付 |
| app/api/admin/* | 管理者認証付きAPI |
| app/s/[code] | 個人情報を含まない短縮URL |
| lib/model.ts | 共通入力検証・匿名紹介文・日時検証 |
| lib/server.ts | 管理者認証・DBクライアント |
| lib/notify.ts | メール通知・再送 |
| lib/calendar.ts | Google Calendar通信 |
| lib/sheet.ts / lib/pdf.ts | 帳票データ・PDF生成 |
| supabase/schema.sql | テーブル・インデックス・RLS・RPC |
| render.yaml | Render公開設定 |
| .env.example | 必要な環境変数 |
| tests | 入力・DB・連携・帳票の自動テスト |
| output/entry-sheet-sample.pdf | 架空データでのPDF見本 |

## 必要パッケージ

実行：next、react、react-dom、@supabase/supabase-js、zod、lucide-react、pdfkit、@fontsource/noto-sans-jp。
開発：typescript、各種@types、tailwindcss、@tailwindcss/postcss、tsx、@electric-sql/pglite。
正確なバージョンと依存関係はpackage.jsonとpackage-lock.jsonに記録。`npm ci` で再現します。Node.js 22以上を使用してください。

## ローカル起動

```bash
npm ci
cp .env.example .env.local
# .env.localをエディターで設定
npm run dev
```

`http://localhost:3000/` と `/admin` を開きます。設定前も公開フォームの見た目は確認できますが、保存や管理操作は接続完了後です。未設定をデモ保存成功のようには扱いません。

## 1. Supabaseの設定

1. Supabaseでプロジェクトを用意します。既存DBを使う場合は、テーブル名が既存データと衝突しないことを確認してください。
2. SQL Editorで `supabase/schema.sql` を一度実行します。このSQLは新規セットアップ用です。繰り返し実行せず、既存DBの更新時は差分マイグレーションにしてください。
3. Project URLとPublishable keyを取得し、`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` に設定します。変数名は互換性のためANONですがPublishable keyも使えます。
4. Secret keyまたはservice_role keyは `SUPABASE_SERVICE_ROLE_KEY` に設定。ブラウザ用変数には絶対に設定しないでください。
5. Authenticationで外部からの新規サインアップを無効にします。管理者ユーザーだけを管理画面から作成し、メールとパスワードを設定します。Googleログインは不要です。
6. SQL Editorで管理者権限を付与します。

```sql
insert into public.staff(user_id)
select id from auth.users where email='t-sugimoto@kikari.co.jp'
on conflict do nothing;
```

7. ユーザーが1件作成されていること、staffに1件登録されていることを確認します。

全テーブルでRLSを有効化し、anon/authenticatedの直接読書権限を取り除いています。サーバーが `getUser()` とstaffテーブルを検証してからservice_roleで操作します。PDFプロフィールは所有者だけが編集できます。

## 2. Resend通知メール

1. Resendアカウントを用意し、利用権限のある送信ドメインを登録します。
2. 指示されたDNSレコードを設定し、ドメイン認証を完了します。kikari.co.jpを使う権限がなければ勝手に設定せず、承認された送信用ドメインを使ってください。
3. APIキーを作成し、`RESEND_API_KEY` に設定します。
4. `EMAIL_FROM` を `CARE ENTRY <entry@認証済みドメイン>` の形式に設定します。
5. `NOTIFY_EMAIL=t-sugimoto@kikari.co.jp` を設定します。
6. 公開後、管理画面の「メール・カレンダーの接続確認」からテストメールを送信します。
7. API受付成功だけでなく、実際の受信箱または迷惑メールフォルダで到着を確認してください。

Resendの開発用送信元は宛先制限があるため、指定メールへの本番送信には認証済みドメインを用意してください。

## 3. スパム対策（Cloudflare Turnstile）

1. Cloudflare Turnstileでウィジェットを作成します。
2. 公開先のホスト名（例：発行されたonrender.comホスト）を登録します。
3. Site keyを `NEXT_PUBLIC_TURNSTILE_SITE_KEY`、Secret keyを `TURNSTILE_SECRET_KEY` に設定します。
4. `APP_URL` を実際のHTTPS公開URLに設定します。末尾の `/` は付けません。
5. 本番はトークン成功とhostname一致を必須にしています。未設定のままでは応募を受け付けません。

`RATE_LIMIT_SALT` はランダム32バイト以上の値を設定してください。電話番号をHMAC化したキー単位で1時間5件まで制限します。生の電話番号をレート制限キーとして保存しません。

## 4. Renderで公開してURLを発行

1. このフォルダの内容を、ユーザーが所有するGitHub/GitLab/Bitbucketのリポジトリに保存します。秘密の.env.local、node_modules、.nextは追加しません。
2. Renderで対象ワークスペースを選択し、「New」→「Web Service」からそのリポジトリを選びます。
3. Runtime：Node。Build Command：`npm ci && npm run build`。
4. Start Command：`npm run start -- -p $PORT`。
5. 無料の検証ならFreeを選択。本番でSMSから素早く開く必要があれば、休止しないプランを選びます。
6. `.env.example` の必須値をEnvironmentへ登録します。Googleの値は後から追加できます。
7. デプロイ後、Renderが発行した実際のURLを `APP_URL` とTurnstileの許可ホストに反映して再デプロイします。
8. 公開URLの `/` がフォーム、`/admin` が管理画面です。
9. 管理者ログイン、架空の応募を1件登録、メール受信、メモ保存後の再読込、PDF出力を確認します。

`render.yaml` を使う場合はBlueprintからリポジトリを指定し、sync:false項目を入力して適用できます。Google連携変数はその後Environmentへ追加します。無料枠の利用条件・上限は申込時の表示を確認してください。

## 5. Vercelを使う場合

1. GitHubへコードを保存してVercelのNew ProjectからImport。
2. Framework：Next.js。Root Directoryはpackage.jsonのあるフォルダ。
3. 業務用途に適合するプランを選択し、同じ環境変数を登録。
4. Deploy後、発行URLをAPP_URLとTurnstileに設定し、再デプロイ。
5. NEXT_PUBLIC_で始まる変数を変更した場合は必ず再ビルドします。

## 6. Googleカレンダーへの1時間登録

Google認証はこの管理者向け連携の設定だけで使用します。Google側の組織ポリシー・OAuth制限を回避することはできません。設定できなくても応募・DB・メールは動きます。

1. 利用するGoogle CloudプロジェクトでCalendar APIを有効にします。
2. OAuth同意画面を設定し、Web application用OAuth clientを作成します。
3. 初期設定には公式OAuth Playgroundを利用できます。リダイレクトURIに `https://developers.google.com/oauthplayground` を登録します。
4. Playgroundの設定で自分のOAuth client ID/secretを使用し、Calendarの `https://www.googleapis.com/auth/calendar.events` と `https://www.googleapis.com/auth/calendar.freebusy` を認可します。
5. 対象カレンダーへアクセスできるGoogleアカウントで同意し、offline用refresh tokenを取得します。トークンはチャットやGitへ貼らず、Render/Vercelの秘密の環境変数へ設定します。
6. `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`GOOGLE_REFRESH_TOKEN` を設定します。
7. Googleカレンダーの「設定と共有」→「カレンダーの統合」でカレンダーIDを確認し、`GOOGLE_CALENDAR_ID` に設定します。メールアドレスからIDを推測しないでください。
8. 再デプロイ後、管理画面の接続テストで空いている未来の日時を指定します。1時間の「接続テスト」が登録され、再取得に成功することと、実際のカレンダー上で表示されることを確認します。
9. 本番では候補者カードから、本人と調整した1時間の開始日時を選んで登録します。希望日時の受信だけでは勝手に面談確定しません。

OAuth同意画面が外部・Testingの設定だとrefresh tokenが通常7日で失効するため、継続運用の公開設定と権限を整えてください。

登録はアプリ→Googleの一方向です。Google側の手動変更を常時DBへ逆同期する機能、招待メール送信、候補者本人への確定SMS自動送信はありません。Google側で日時変更した場合は管理メモにも反映してください。Googleへの直接編集とアプリ登録を完全に原子的にロックすることはできないため、外部で同時に予定を作る場合は最終確認してください。

自動連携が使えない場合は「Googleカレンダーで作成」またはICSで1時間予定を作れます。これらは手動保存で、DBへの確定反映はしません。

## 7. PDFと担当者設定

1. 候補者カードの「エントリーシート編集・PDF」を開きます。
2. 初回のみ会社名・担当者名・メール・電話・FAXを担当者プロフィールに登録します。
3. 選択した担当者はアカウント別に次回も優先選択されます。シートごとの担当者IDも保存します。
4. 年齢・性別・通勤・希望エリア・雇用形態・勤務曜日・経歴の雇用形態・推薦コメントを必要に応じて補足します。元フォームの申告データは残し、法人用補足として別保存します。
5. 変更後1.2秒で自動保存します。「PDFを出力」は最新内容を保存してからダウンロードします。
6. 氏名・電話番号の自動転記はせず、元の氏名・電話番号を誤って自由記述に入れた場合は保存時に検出します。あらゆる識別情報を完全検出する機能ではないため、自由記述には個人を特定する情報を入力しないでください。
7. 長文の場合はページを追加します。日本語フォントを同梱し、画像ではなく文字を持つPDFを生成します。

## 8. 障害・再送

- 応募と通知キューは同一DBトランザクションで保存。
- 通信失敗後の再送でもrequest_idが同じなら応募は増えません。ページを再読み込みすると新しいrequest_idになります。
- 管理画面でメール失敗を表示し、再送できます。`/api/cron` にAuthorization: Bearer CRON_SECRET付きGETを送ると未送信最大10件を順番に再試行します。定期実行を使う場合は、別途スケジューラーを設定してください。標準では定期ジョブは作成しません。
- Resendの冪等キー有効期間を超えた再送では重複配送の可能性があります。サービス側受付後にDB更新が失敗したケースは配信ログも確認してください。
- カレンダーの通信失敗時は同じ日時で再試行します。DB上の仮押さえは、Google側に登録されたか不明なとき勝手に解除しません。
- カレンダーに予定がなく仮押さえだけ残った場合は、管理者がGoogle側の有無を確認してからDBで該当appointments行を整理します。
- 管理IDはENT-YYYYMMDDHHMMSS形式。秒単位の同時応募は重複防止のため論理的に1秒繰り上げます。正確な登録日時はcreated_atです。

## 検証コマンド

```bash
npm run typecheck
npm test
npm run build
node --import tsx scripts/sample-pdf.ts
```

モック連携テストは外部へ送信しません。DBテストはPGliteの実PostgresエンジンでSQL・権限・制約を実行します。本番Supabaseとの接続確認は別に必要です。検証結果はTEST-REPORT.mdを参照してください。

## 公式資料

- Supabase SSR / Auth：https://supabase.com/docs/guides/auth/server-side
- Supabase RLS：https://supabase.com/docs/guides/database/postgres/row-level-security
- Render Free：https://render.com/docs/free
- Render Next.js：https://render.com/docs/deploy-nextjs-app
- Vercel Hobby：https://vercel.com/docs/plans/hobby
- Resend送信ドメイン：https://resend.com/docs/dashboard/domains/introduction
- Google Calendar共有：https://developers.google.com/workspace/calendar/api/concepts/sharing
- OAuth設定：https://developers.google.com/identity/protocols/oauth2/web-server
- OAuthトークンの有効性：https://developers.google.com/identity/protocols/oauth2

## Gmail通知（送信元ドメインのDNS設定ができない場合）

`MAIL_PROVIDER=gmail`、`GMAIL_FROM=takuya258222@gmail.com` を設定すると、応募通知と管理画面のテスト通知を同じGmail API経由で送ります。通知先は `NOTIFY_EMAIL=t-sugimoto@kikari.co.jp`。求職者のGoogleログインは不要です。

Google CloudでGmail APIとGoogle Calendar APIを有効化し、OAuthクライアントを作成します。送信専用の `https://www.googleapis.com/auth/gmail.send` と必要なカレンダー権限を本人が認可したrefresh tokenを、サーバー専用の `GOOGLE_REFRESH_TOKEN` に設定してください。送信用に別認可した場合は `GMAIL_REFRESH_TOKEN` に保存できます。`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` も必要です。秘密値はリポジトリやチャットに貼らないでください。Testing状態のOAuthアプリは通常7日でrefresh tokenが失効するため、本運用前に公開状態・適用されるGoogleの要件を確認してください。

Gmail APIはResendのIdempotency-Keyと同じ保証を提供しません。DBの送信済み判定・排他処理は維持しますが、送信成功直後の通信断やDB更新失敗後の再送では重複通知が発生し得ます。自動再送と実受信を照合してください。

2026-10-26: Gmail用追加2テスト・既存39テスト成功。外部通信はモック。Google Cloudの認証設定画面が操作環境でSite Unavailableのため、実送信・実到着の確認は未完了です。

参考: https://developers.google.com/workspace/gmail/api/guides/sending
参考: https://developers.google.com/identity/protocols/oauth2

## 管理画面からGoogleに接続（手動トークンコピー不要）

1. `supabase/migrations/20261026120523_google_oauth_connect.sql` を適用します。
2. Renderに `GOOGLE_TOKEN_ENCRYPTION_KEY`（32バイト乱数のbase64）、同じOAuthクライアントの `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET`、`GMAIL_FROM`、`APP_URL` を設定。`MAIL_PROVIDER=gmail`、`GOOGLE_CALENDAR_ID=primary` を設定します。既存のRefresh token設定は移行用に残せますが、接続後は暗号化DBの値が優先されます。
3. Google Cloud > Google Auth Platform > Clients > 対象のWebクライアントの「承認済みのリダイレクトURI」に `https://kikari-entry-hub.onrender.com/api/admin/google/callback` を追加します（APP_URLと一致させる）。PlaygroundのURLと併存できます。
4. `/admin` にログインし「Google連携・メール通知の設定」→「Googleと連携」。GMAIL_FROMのGoogleアカウントで許可します。戻ると自動保存されます。
5. 「テストメールを送信」で実到着を確認し、空き日時に30分のテスト予定を登録します。接続保存だけでは実到着の確認にはなりません。

個人の社内運用でも、Googleの公開ステータスがTestingの場合は通常7日でRefresh tokenが失効します。継続運用時にはGoogle側の公開設定と、使用用途に応じた検証要件を確認してください。認証失効時は管理画面から再接続できます。キーをチャット等に公開した場合はGoogle Cloudで安全にローテーションしてRenderも更新してください。

安全設計：スタッフ認証が必要なPOSTで開始し、Origin検証、10分有効のランダムstate、Secure/HttpOnly/SameSite=Laxのホスト限定Cookie、DBで一度だけ消費するstate、PKCE S256、コールバック時のスタッフ権限再確認、確認済みGoogleメールアドレスと許可スコープの検証を使用。Refresh token・PKCE verifierはAES-256-GCMで暗号化し、DBテーブルはRLS有効・anon/authenticated権限なし・service_roleのみ。Google認証コード・トークンをUIやログへ返しません。暗号化キーを失うと再接続が必要です。状態エラーや接続キャンセルで既存の接続を上書きしません。
