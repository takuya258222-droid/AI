const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 スクリーンショット保存: ${filepath}`);
  return filepath;
}

async function loginLINE(page, email, password) {
  console.log("🔐 LINE公式アカウント管理画面にログイン中...");
  await page.goto("https://manager.line.biz/");
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  if (currentUrl.includes("account.line.biz") || currentUrl.includes("access.line.me")) {
    console.log("ログイン画面を検出。メールアドレスでログインします...");

    const emailLogin = page.locator('a:has-text("メールアドレスでログイン"), a:has-text("Log in with email")');
    if (await emailLogin.count() > 0) {
      await emailLogin.first().click();
      await page.waitForTimeout(2000);
    }

    await page.fill('input[type="email"], input[name="email"], #email', email);
    await page.fill('input[type="password"], input[name="password"], #password', password);
    await page.click('button[type="submit"], .MdBtn');
    await page.waitForTimeout(5000);
  }

  await screenshot(page, "01_after_login");
  console.log("✅ ログイン完了");
}

async function selectAccount(page) {
  console.log("📋 アカウント一覧を確認中...");
  await page.waitForTimeout(3000);
  await screenshot(page, "02_account_list");

  const accounts = await page.locator('.account-list-item, [class*="account"], a[href*="/account/"]').all();
  if (accounts.length > 0) {
    console.log(`${accounts.length}個のアカウントを検出。最初のアカウントを選択します...`);
    await accounts[0].click();
    await page.waitForTimeout(3000);
  }

  await screenshot(page, "03_account_home");
  console.log("✅ アカウント選択完了");
}

async function setupGreetingMessage(page, message) {
  console.log("👋 あいさつメッセージを設定中...");

  await page.goto(page.url().replace(/\/home.*/, "/home"));
  await page.waitForTimeout(2000);

  const greetingLinks = page.locator('a:has-text("あいさつメッセージ"), a:has-text("Greeting message"), a[href*="greeting"]');
  if (await greetingLinks.count() > 0) {
    await greetingLinks.first().click();
  } else {
    const settingsLinks = page.locator('a:has-text("設定"), a:has-text("Settings")');
    if (await settingsLinks.count() > 0) {
      await settingsLinks.first().click();
      await page.waitForTimeout(2000);
    }
    const greetingInSettings = page.locator('a:has-text("あいさつメッセージ"), a:has-text("Greeting")');
    if (await greetingInSettings.count() > 0) {
      await greetingInSettings.first().click();
    }
  }

  await page.waitForTimeout(3000);
  await screenshot(page, "04_greeting_page");

  const textArea = page.locator('textarea, [contenteditable="true"], .text-editor');
  if (await textArea.count() > 0) {
    await textArea.first().click();
    await textArea.first().fill("");
    await textArea.first().fill(message);
    console.log("✅ あいさつメッセージを入力しました");
  }

  const saveBtn = page.locator('button:has-text("保存"), button:has-text("Save"), button:has-text("変更を保存")');
  if (await saveBtn.count() > 0) {
    await saveBtn.first().click();
    await page.waitForTimeout(2000);
  }

  await screenshot(page, "05_greeting_saved");
  console.log("✅ あいさつメッセージ設定完了");
}

async function setupRichMenu(page) {
  console.log("📱 リッチメニューを設定中...");

  const richMenuLinks = page.locator('a:has-text("リッチメニュー"), a:has-text("Rich menu"), a[href*="richmenu"]');
  if (await richMenuLinks.count() > 0) {
    await richMenuLinks.first().click();
  } else {
    const homeLink = page.locator('a:has-text("ホーム"), a:has-text("Home")');
    if (await homeLink.count() > 0) {
      await homeLink.first().click();
      await page.waitForTimeout(2000);
    }
    const rmLink = page.locator('a:has-text("リッチメニュー")');
    if (await rmLink.count() > 0) {
      await rmLink.first().click();
    }
  }

  await page.waitForTimeout(3000);
  await screenshot(page, "06_richmenu_page");

  const createBtn = page.locator('button:has-text("作成"), button:has-text("Create"), a:has-text("作成")');
  if (await createBtn.count() > 0) {
    await createBtn.first().click();
    await page.waitForTimeout(3000);
  }

  await screenshot(page, "07_richmenu_create");
  console.log("✅ リッチメニュー設定ページを開きました");
  console.log("⚠️  リッチメニューの画像アップロードとボタン設定は手動で行ってください");
  console.log("   （画像テンプレートは templates/ フォルダに用意します）");
}

async function main() {
  console.log("=== LINE公式アカウント自動セットアップ ===\n");

  const email = process.env.LINE_EMAIL || await ask("LINE ログインメールアドレス: ");
  const password = process.env.LINE_PASSWORD || await ask("LINE ログインパスワード: ");

  const greetingMessage = `友だち追加ありがとうございます！🎉

転職をお考えのあなたに、ぴったりのエージェントをご紹介します。

✅ 完全無料
✅ 非公開求人あり
✅ プロのアドバイザーが面談サポート

下のメニューから「おすすめエージェント」をタップして、あなたに合ったエージェントを見つけてください👇`;

  const browser = await chromium.launch({
    headless: true,
    executablePath: "/opt/pw-browsers/chromium/chrome" || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    locale: "ja-JP",
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    await loginLINE(page, email, password);
    await selectAccount(page);
    await setupGreetingMessage(page, greetingMessage);
    await setupRichMenu(page);

    console.log("\n=== セットアップ完了 ===");
    console.log("スクリーンショットは screenshots/ フォルダで確認できます");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
    await screenshot(page, "error");
  } finally {
    await browser.close();
  }
}

main();
