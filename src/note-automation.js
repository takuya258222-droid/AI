const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CHROME_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ARTICLES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "note-articles.json"), "utf8")
);
const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
const IMAGES_DIR = path.join(__dirname, "..", "images");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const NOTE_EMAIL = process.env.NOTE_EMAIL || "takuya258222@gmail.com";
const NOTE_PASSWORD = process.env.NOTE_PASSWORD;
if (!NOTE_PASSWORD) {
  console.error("環境変数 NOTE_PASSWORD を設定してください（パスワードはコードに書かない）");
  process.exit(1);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `note_${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  📸 ${name}`);
}

async function generateCoverImage(page, article) {
  const imgPath = path.join(IMAGES_DIR, `cover_no${article.number}.png`);
  const { line1, line2, line3, subtitle } = article.imageText;

  const colorSchemes = {
    7: { bg: "#1a5632", accent: "#4ade80" },
    8: { bg: "#1e3a5f", accent: "#60a5fa" },
    9: { bg: "#5b21b6", accent: "#c084fc" },
    10: { bg: "#7c2d12", accent: "#fb923c" },
    11: { bg: "#164e63", accent: "#22d3ee" },
    12: { bg: "#831843", accent: "#f472b6" },
  };
  const colors = colorSchemes[article.number] || { bg: "#1a1a2e", accent: "#e94560" };

  const dataUrl = await page.evaluate(
    ({ line1, line2, line3, subtitle, colors }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 670;
      const ctx = canvas.getContext("2d");

      const grad = ctx.createLinearGradient(0, 0, 1280, 670);
      grad.addColorStop(0, colors.bg);
      grad.addColorStop(1, "#0a0a0a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 670);

      ctx.fillStyle = colors.accent + "15";
      ctx.beginPath();
      ctx.arc(1100, 100, 300, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(200, 600, 200, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = colors.accent + "30";
      ctx.lineWidth = 1;
      for (let i = 0; i < 1280; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 670);
        ctx.stroke();
      }
      for (let j = 0; j < 670; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(1280, j);
        ctx.stroke();
      }

      ctx.fillStyle = colors.accent;
      ctx.fillRect(60, 50, 6, 80);

      ctx.font = "bold 22px 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif";
      ctx.fillStyle = colors.accent;
      ctx.fillText(subtitle, 80, 85);

      ctx.font = "bold 52px 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line1, 60, 220);

      ctx.font = "bold 60px 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif";
      ctx.fillStyle = colors.accent;
      ctx.fillText(line2, 60, 330);

      ctx.font = "bold 48px 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line3, 60, 430);

      ctx.fillStyle = colors.accent + "40";
      ctx.fillRect(60, 550, 400, 4);

      ctx.font = "18px 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif";
      ctx.fillStyle = "#ffffff99";
      ctx.fillText("転職エージェントが語る、リアルな転職ストーリー", 60, 600);

      return canvas.toDataURL("image/png");
    },
    { line1, line2, line3, subtitle, colors }
  );

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  fs.writeFileSync(imgPath, Buffer.from(base64, "base64"));
  console.log(`  🎨 カバー画像生成: cover_no${article.number}.png`);
  return imgPath;
}

function buildArticleBody(article) {
  const empathyList = article.empathy.map((e) => `✔ ${e}`).join("\n");
  const hashtagStr = article.hashtags.map((t) => `#${t}`).join(" ");

  let salarySection;
  if (article.salary.hourlyRate) {
    salarySection = `■ 給与の変化

${article.salary.breakdown}`;
  } else {
    salarySection = `■ 給与の内訳（税込）

${article.salary.breakdown}`;
  }

  const body = `本記事にはアフィリエイト広告（PR）を含みます。

${article.hook}

---

## こんな悩み、ありませんか？

${empathyList}

一つでも当てはまるなら、最後まで読んでみてください。

---

## 相談に来たときの状況

${article.background.age}歳、${article.background.qualification}。

${article.background.before}で働いていた${article.background.job}さん。

${article.background.reason}

---

## 転職活動のリアル

${article.selectionReality}

---

▼ 同じような悩みを持つ方へ。まずは無料で相談できます。

👉 ${article.cta}
${article.ctaUrl}

---

## 結果：給与はどう変わった？

${salarySection}

---

## 入職後・1年後のリアル

${article.oneYearLater}

---

## エージェントとしての一言

${article.agentComment}

---

## 最後に

${article.closing}

👉 ${article.cta}
${article.ctaUrl}

---

${hashtagStr}`;

  return body;
}

async function loginNote(page) {
  console.log("🔐 note.comにログイン中...");
  await page.goto("https://note.com/login", { waitUntil: "networkidle", timeout: 30000 });
  await sleep(3000);
  await screenshot(page, "01_login_page");

  const emailInput = page.locator('input[name="login"], input[type="email"], input[placeholder*="メール"], input[placeholder*="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(NOTE_EMAIL);

  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  await passwordInput.fill(NOTE_PASSWORD);

  await sleep(1000);

  const loginBtn = page.locator('button[type="submit"], button:has-text("ログイン"), button:has-text("Login")').first();
  await loginBtn.click();

  await sleep(5000);
  await screenshot(page, "02_after_login");

  const currentUrl = page.url();
  if (currentUrl.includes("/login")) {
    console.log("⚠️  ログインページにまだいます。別の方法を試します...");
    await page.goto("https://note.com/login?redirectPath=%2F", { waitUntil: "networkidle", timeout: 30000 });
    await sleep(3000);
  }

  console.log(`  現在のURL: ${page.url()}`);
  console.log("✅ ログイン処理完了");
}

async function createArticle(page, article, coverImagePath) {
  console.log(`\n📝 記事No.${article.number}を作成中...`);
  console.log(`  タイトル: ${article.title.substring(0, 50)}...`);

  await page.goto("https://note.com/new", { waitUntil: "networkidle", timeout: 30000 });
  await sleep(3000);
  await screenshot(page, `article${article.number}_01_editor`);

  // note.com uses different editor versions - try to detect and handle
  const editorUrl = page.url();
  console.log(`  エディタURL: ${editorUrl}`);

  // Try the title field
  const titleSelectors = [
    'textarea[placeholder*="タイトル"]',
    'textarea[placeholder*="title"]',
    'div[data-placeholder*="タイトル"]',
    'input[placeholder*="タイトル"]',
    '[class*="title"] textarea',
    '[class*="title"] input',
    'textarea:first-of-type',
    '[contenteditable="true"]:first-of-type',
  ];

  let titleEl = null;
  for (const sel of titleSelectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      titleEl = el;
      console.log(`  タイトル入力欄を検出: ${sel}`);
      break;
    }
  }

  if (titleEl) {
    await titleEl.click();
    await titleEl.fill(article.title);
    await sleep(500);
  } else {
    console.log("  ⚠️ タイトル入力欄が見つかりません。キーボード入力を試します...");
    await page.keyboard.type(article.title, { delay: 10 });
  }

  await sleep(1000);

  // Move to body - try Tab or click body area
  const bodySelectors = [
    'div[data-placeholder*="本文"]',
    'div[data-placeholder*="ここに"]',
    'div[class*="body"] [contenteditable="true"]',
    '[class*="editor-body"]',
    '[class*="note-body"]',
    'div[contenteditable="true"]',
    '.ProseMirror',
  ];

  let bodyEl = null;
  for (const sel of bodySelectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      bodyEl = el;
      console.log(`  本文入力欄を検出: ${sel}`);
      break;
    }
  }

  const articleBody = buildArticleBody(article);

  if (bodyEl) {
    await bodyEl.click();
    await sleep(500);

    // Type the body content in chunks to avoid issues
    const lines = articleBody.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "") {
        await page.keyboard.press("Enter");
      } else {
        await page.keyboard.type(lines[i], { delay: 2 });
        if (i < lines.length - 1) {
          await page.keyboard.press("Enter");
        }
      }
      // Brief pause every 20 lines
      if (i % 20 === 0 && i > 0) {
        await sleep(200);
      }
    }
  } else {
    console.log("  ⚠️ 本文入力欄が見つかりません。Tab→入力を試します...");
    await page.keyboard.press("Tab");
    await sleep(500);
    const lines = articleBody.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "") {
        await page.keyboard.press("Enter");
      } else {
        await page.keyboard.type(lines[i], { delay: 2 });
        if (i < lines.length - 1) {
          await page.keyboard.press("Enter");
        }
      }
      if (i % 20 === 0 && i > 0) await sleep(200);
    }
  }

  await sleep(2000);
  await screenshot(page, `article${article.number}_02_body_filled`);

  // Try to upload cover image
  if (coverImagePath && fs.existsSync(coverImagePath)) {
    console.log("  🖼️ カバー画像をアップロード中...");
    try {
      const coverBtnSelectors = [
        'button:has-text("見出し画像")',
        'button:has-text("カバー画像")',
        'button:has-text("画像を追加")',
        '[class*="cover"] button',
        '[class*="header-image"] button',
        '[aria-label*="画像"]',
        'label[for*="cover"]',
        'input[type="file"][accept*="image"]',
      ];

      let fileInput = page.locator('input[type="file"][accept*="image"]').first();
      if ((await fileInput.count()) > 0) {
        await fileInput.setInputFiles(coverImagePath);
        console.log("  ✅ カバー画像アップロード完了（file input）");
      } else {
        for (const sel of coverBtnSelectors) {
          const btn = page.locator(sel).first();
          if ((await btn.count()) > 0) {
            await btn.click();
            await sleep(1000);
            fileInput = page.locator('input[type="file"]').first();
            if ((await fileInput.count()) > 0) {
              await fileInput.setInputFiles(coverImagePath);
              console.log("  ✅ カバー画像アップロード完了");
            }
            break;
          }
        }
      }
      await sleep(2000);
    } catch (err) {
      console.log(`  ⚠️ カバー画像のアップロードに失敗: ${err.message}`);
    }
  }

  // Add hashtags
  console.log("  🏷️ ハッシュタグを設定中...");
  try {
    const hashtagSelectors = [
      'input[placeholder*="タグ"]',
      'input[placeholder*="ハッシュタグ"]',
      'input[placeholder*="tag"]',
      '[class*="tag"] input',
      '[class*="hashtag"] input',
    ];

    let hashtagInput = null;
    for (const sel of hashtagSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0) {
        hashtagInput = el;
        break;
      }
    }

    if (hashtagInput) {
      for (const tag of article.hashtags.slice(0, 5)) {
        await hashtagInput.fill(tag);
        await sleep(300);
        await page.keyboard.press("Enter");
        await sleep(300);
      }
      console.log("  ✅ ハッシュタグ設定完了");
    } else {
      console.log("  ⚠️ ハッシュタグ入力欄が見つかりません（公開設定時に設定可能）");
    }
  } catch (err) {
    console.log(`  ⚠️ ハッシュタグ設定失敗: ${err.message}`);
  }

  await sleep(1000);
  await screenshot(page, `article${article.number}_03_complete`);

  // Save as draft
  console.log("  💾 下書き保存中...");
  try {
    // note.com auto-saves, but let's also try explicit save
    const saveBtnSelectors = [
      'button:has-text("下書き保存")',
      'button:has-text("保存")',
      'button:has-text("Save")',
      '[class*="save"] button',
      'button[class*="draft"]',
    ];

    for (const sel of saveBtnSelectors) {
      const btn = page.locator(sel).first();
      if ((await btn.count()) > 0) {
        await btn.click();
        await sleep(2000);
        console.log("  ✅ 下書き保存完了");
        break;
      }
    }

    // Also try Ctrl+S
    await page.keyboard.press("Control+s");
    await sleep(2000);
  } catch (err) {
    console.log(`  ⚠️ 明示的な保存に失敗（自動保存されている可能性あり）: ${err.message}`);
  }

  await screenshot(page, `article${article.number}_04_saved`);
  console.log(`✅ 記事No.${article.number} 作成完了`);
}

async function main() {
  console.log("=== NOTE記事自動作成 ===");
  console.log(`対象: No.7〜No.12（${ARTICLES.length}記事）\n`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const context = await browser.newContext({
    locale: "ja-JP",
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    // Generate all cover images first
    console.log("🎨 カバー画像を生成中...");
    await page.goto("about:blank");
    const coverPaths = {};
    for (const article of ARTICLES) {
      coverPaths[article.number] = await generateCoverImage(page, article);
    }
    console.log("✅ 全カバー画像生成完了\n");

    // Login
    await loginNote(page);

    // Create each article
    for (const article of ARTICLES) {
      await createArticle(page, article, coverPaths[article.number]);
      await sleep(3000);
    }

    console.log("\n=== 全記事作成完了 ===");
    console.log("📁 スクリーンショット: screenshots/");
    console.log("📁 カバー画像: images/");
    console.log("\n⚠️  アフィリエイトリンクはプレースホルダーです。");
    console.log("   実際のリンクに差し替えてください。");
  } catch (error) {
    console.error("❌ エラー:", error.message);
    await screenshot(page, "error");
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
