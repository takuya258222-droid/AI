const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TENANT_CSV = path.join(__dirname, 'fixtures', 'tenant-sample.csv');

test.describe('案件アプリ 基本UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('#regionOverlay');
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.locator('.region-btn[data-region="kansai"]').click();
    }
    await page.waitForSelector('#list', { timeout: 5000 });
  });

  test('ページが読み込まれヘッダーが表示される', async ({ page }) => {
    await expect(page).toHaveTitle('案件検索');
    await expect(page.locator('h1')).toContainText('案件検索');
  });

  test('カテゴリタブが表示される', async ({ page }) => {
    const tabs = page.locator('.tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(3);
    await expect(tabs.first()).toContainText('すべて');
  });

  test('府県タブが表示される', async ({ page }) => {
    const ptabs = page.locator('.ptab');
    const count = await ptabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('検索ボックスでフィルターできる', async ({ page }) => {
    await page.locator('#q').fill('京都');
    await page.locator('#q').dispatchEvent('input');
    await page.waitForTimeout(400);
    const infoText = await page.locator('#info').textContent();
    expect(infoText).toContain('京都');
  });

  test('カード要素が表示される', async ({ page }) => {
    const cards = page.locator('.card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('地域切り替えが動作する', async ({ page }) => {
    await page.locator('#regionSwitch').click();
    const overlay = page.locator('#regionOverlay');
    await expect(overlay).not.toHaveClass(/hidden/);
  });
});

test.describe('CSVエクスポート', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('#regionOverlay');
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.locator('.region-btn[data-region="kansai"]').click();
    }
    await page.waitForSelector('#list', { timeout: 5000 });
  });

  test('エクスポートボタンが表示される', async ({ page }) => {
    const btn = page.locator('#exportBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('CSVエクスポート');
  });

  test('CSVダウンロードが発火する', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.locator('#exportBtn').click(),
    ]);
    const fname = download.suggestedFilename();
    expect(fname === 'download' || /^案件_\d{8}\.csv$/.test(fname)).toBe(true);
  });

  test('CSVにBOMとヘッダーが含まれる', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.locator('#exportBtn').click(),
    ]);
    const filePath = await download.path();
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content.charCodeAt(0)).toBe(0xFEFF);
    expect(content).toContain('事業所名,住所,府県,職種,施設種別,シフト,担当者,オーダー内容,勤務時間,取得日');
  });

  test('フィルター結果がエクスポートされる', async ({ page }) => {
    await page.locator('.tab >> text=看護').click();
    await page.waitForTimeout(300);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.locator('#exportBtn').click(),
    ]);
    const filePath = await download.path();
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).toContain('看護');
    }
  });

  test('選択バーにCSVボタンがある', async ({ page }) => {
    const firstCheck = page.locator('.card-check').first();
    if (await firstCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstCheck.click();
      await expect(page.locator('#selectBar')).toBeVisible();
      await expect(page.locator('#selCsvExport')).toBeVisible();
    }
  });
});

test.describe('CSV取り込み（バックオーダーCSV）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('#regionOverlay');
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.locator('.region-btn[data-region="kansai"]').click();
    }
    await page.waitForSelector('#list', { timeout: 5000 });
  });

  test('取り込みボタンが表示される', async ({ page }) => {
    const btn = page.locator('#importBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('CSV取り込み');
  });

  test('取り込みモーダルが開閉する', async ({ page }) => {
    const modal = page.locator('#importModal');
    await expect(modal).toHaveClass(/hidden/);
    await page.locator('#importBtn').click();
    await expect(modal).not.toHaveClass(/hidden/);
    await page.locator('#importClose').click();
    await expect(modal).toHaveClass(/hidden/);
  });

  test('ドロップゾーンが表示される', async ({ page }) => {
    await page.locator('#importBtn').click();
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('.drop-text')).toContainText('CSVをドロップ');
  });
});

test.describe('CSV取り込み（テナント管理CSV）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('#regionOverlay');
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.locator('.region-btn[data-region="kansai"]').click();
    }
    await page.waitForSelector('#list', { timeout: 5000 });
  });

  test('テナント管理CSVを読み込める', async ({ page }) => {
    await page.locator('#importBtn').click();
    const fileInput = page.locator('#csvFileInput');
    await fileInput.setInputFiles(TENANT_CSV);
    await page.waitForTimeout(2000);
    const status = await page.locator('#importStatus').textContent();
    expect(status).toContain('関西');
    expect(status).toMatch(/\d+件/);
  });

  test('テナント管理CSVを取り込める', async ({ page }) => {
    const totalBefore = await page.evaluate(() => D.length);
    await page.locator('#importBtn').click();
    const fileInput = page.locator('#csvFileInput');
    await fileInput.setInputFiles(TENANT_CSV);
    await page.waitForTimeout(2000);
    const applyBtn = page.locator('#importApply');
    if (await applyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await applyBtn.click();
      await page.waitForTimeout(1500);
      const totalAfter = await page.evaluate(() => D.length);
      expect(totalAfter).toBeGreaterThanOrEqual(totalBefore);
    }
  });

  test('取り込み後にlocalStorageに保存される', async ({ page }) => {
    await page.locator('#importBtn').click();
    const fileInput = page.locator('#csvFileInput');
    await fileInput.setInputFiles(TENANT_CSV);
    await page.waitForTimeout(2000);
    const applyBtn = page.locator('#importApply');
    if (await applyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await applyBtn.click();
      await page.waitForTimeout(1500);
      const stored = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('csv_imports')); } catch(e) { return null; }
      });
      expect(stored).not.toBeNull();
      expect(stored.ka.length).toBeGreaterThan(0);
    }
  });
});

test.describe('フィルター・ソート', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('#regionOverlay');
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.locator('.region-btn[data-region="kansai"]').click();
    }
    await page.waitForSelector('#list', { timeout: 5000 });
  });

  test('カテゴリタブで介護のみ表示', async ({ page }) => {
    await page.locator('.tab >> text=介護').click();
    await page.waitForTimeout(300);
    const badges = await page.locator('.card .badge').allTextContents();
    for (const b of badges) {
      expect(b.trim()).toBe('介護');
    }
  });

  test('カテゴリタブで看護のみ表示', async ({ page }) => {
    await page.locator('.tab >> text=看護').click();
    await page.waitForTimeout(300);
    const badges = await page.locator('.card .badge').allTextContents();
    for (const b of badges) {
      expect(b.trim()).toBe('看護');
    }
  });

  test('検索クリアボタンが動作する', async ({ page }) => {
    await page.locator('#q').fill('テスト');
    await page.locator('#q').dispatchEvent('input');
    await page.waitForTimeout(300);
    const clearBtn = page.locator('.q-clear');
    if (await clearBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('#q')).toHaveValue('');
    }
  });
});
