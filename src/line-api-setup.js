const https = require("https");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

function lineApi(method, endpoint, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.line.me",
      path: endpoint,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function lineApiUpload(endpoint, token, imageBuffer, contentType) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api-data.line.me",
      path: endpoint,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
        "Content-Length": imageBuffer.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", reject);
    req.write(imageBuffer);
    req.end();
  });
}

const agentsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "config", "agents.json"), "utf8")
);

async function createRichMenu(token) {
  console.log("📱 リッチメニューを作成中...");

  const richMenu = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: "転職サポートメニュー",
    chatBarText: "メニューを開く",
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: { type: "message", text: "おすすめエージェント" },
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: { type: "message", text: "転職相談" },
      },
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: { type: "message", text: "年収診断" },
      },
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: { type: "message", text: "転職の流れ" },
      },
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: "message", text: "よくある質問" },
      },
    ],
  };

  const result = await lineApi("POST", "/v2/bot/richmenu", token, richMenu);

  if (result.status === 200 && result.data.richMenuId) {
    console.log(`✅ リッチメニュー作成成功: ${result.data.richMenuId}`);
    return result.data.richMenuId;
  } else {
    console.error("❌ リッチメニュー作成失敗:", result.data);
    return null;
  }
}

async function setDefaultRichMenu(token, richMenuId) {
  console.log("🔗 デフォルトリッチメニューに設定中...");
  const result = await lineApi("POST", `/v2/bot/user/all/richmenu/${richMenuId}`, token);

  if (result.status === 200) {
    console.log("✅ デフォルトリッチメニュー設定完了");
  } else {
    console.error("❌ デフォルト設定失敗:", result.data);
  }
}

async function setupWebhook(token, webhookUrl) {
  console.log("🌐 Webhook URLを設定中...");
  const result = await lineApi("PUT", "/v2/bot/channel/webhook/endpoint", token, {
    endpoint: webhookUrl,
  });

  if (result.status === 200) {
    console.log("✅ Webhook URL設定完了");
  } else {
    console.error("❌ Webhook設定失敗:", result.data);
  }
}

function buildAgentCarousel() {
  const agents = agentsConfig.agents.filter((a) => a.recommended);
  return {
    type: "template",
    altText: "おすすめ転職エージェント",
    template: {
      type: "carousel",
      columns: agents.map((agent) => ({
        thumbnailImageUrl: agent.imageUrl,
        title: agent.name,
        text: agent.description.substring(0, 60),
        actions: [
          {
            type: "uri",
            label: "無料で面談予約する",
            uri: agent.affiliateUrl,
          },
          {
            type: "message",
            label: "詳しく見る",
            text: `${agent.name}について教えて`,
          },
        ],
      })),
    },
  };
}

async function main() {
  console.log("=== LINE Messaging API セットアップ ===\n");

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || await ask("チャネルアクセストークン: ");

  console.log("\n--- リッチメニュー作成 ---");
  const richMenuId = await createRichMenu(token);

  if (richMenuId) {
    await setDefaultRichMenu(token, richMenuId);
  }

  console.log("\n--- カルーセルテンプレート確認 ---");
  const carousel = buildAgentCarousel();
  console.log("✅ エージェント紹介カルーセル準備完了");
  console.log(`   ${carousel.template.columns.length}社のエージェントを表示`);

  console.log("\n=== セットアップ完了 ===");
  console.log("\n次のステップ:");
  console.log("1. リッチメニューの画像をアップロード (npm run setup:richmenu:image)");
  console.log("2. Webhookサーバーをデプロイ (npm start)");
  console.log("3. Webhook URLを設定");
}

main();
