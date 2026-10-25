# 公開環境の初回設定

2026-10-25 JST。ソース配置・Renderサービス作成・Supabase SQL適用済み。メール到着・実カレンダー登録・応募の本番保存は未確認です。

- フォーム: https://kikari-entry-hub.onrender.com/
- 管理: https://kikari-entry-hub.onrender.com/admin
- Render: https://dashboard.render.com/web/srv-dbevhog473hc73bbacig
- Supabaseプロジェクト: sdmxaaklontldhmqlnbw

## RenderのEnvironmentへ設定する残りの値

秘密値はチャット・GitHubへ貼らず、RenderのEnvironment画面で入力してください。

| 用途 | 変数 |
| --- | --- |
| SupabaseのSecret key / service_role | SUPABASE_SERVICE_ROLE_KEY |
| Resend送信APIキー | RESEND_API_KEY |
| 認証済み送信ドメインのメールアドレス | EMAIL_FROM |
| Turnstile公開Site key | NEXT_PUBLIC_TURNSTILE_SITE_KEY |
| Turnstile Secret key | TURNSTILE_SECRET_KEY |
| Google OAuth Client ID | GOOGLE_CLIENT_ID |
| Google OAuth Client secret | GOOGLE_CLIENT_SECRET |
| 対象Googleアカウントのoffline refresh token | GOOGLE_REFRESH_TOKEN |
| 利用するカレンダーの実際のID | GOOGLE_CALENDAR_ID |

Turnstileの許可ホストは kikari-entry-hub.onrender.com 。各サービスの取得手順はREADMEの1〜3、6章に記載。

## 管理者作成

Supabase Authenticationで t-sugimoto@kikari.co.jp のユーザーを作成し、パスワードを設定してください。SQL Editorで次を実行します。

```sql
insert into public.staff(user_id)
select id from auth.users where email='t-sugimoto@kikari.co.jp'
on conflict do nothing;
```

完了後RenderでSave, rebuild, and deploy。NEXT_PUBLIC変数は再ビルドが必要です。

## 完了判定

1. 管理ログイン成功。
2. 管理画面の連携テストから指定宛先へテストメール送信。受信箱で実着信を確認。
3. 未来の空き1時間枠で接続テスト予定を登録し、Google Calendarから再取得・画面表示確認。
4. 架空の応募データでフォーム送信→DB保存→メール通知を通しで確認。

ChatGPTのGmail/Calendar接続と、本アプリの実行用OAuth認証は別です。別のメールツールで送っただけでは本アプリのテスト完了にはしません。
