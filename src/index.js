require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const app = express();

const agentsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "config", "agents.json"), "utf8")
);

const GREETING_MESSAGE = `友だち追加ありがとうございます！🎉

転職をお考えのあなたに、ぴったりのエージェントをご紹介します。

✅ 完全無料で利用OK
✅ 非公開求人を多数ご紹介
✅ プロのアドバイザーが面談サポート

下のメニューから「おすすめエージェント」をタップしてください👇`;

function buildAgentCarousel() {
  const agents = agentsConfig.agents.filter((a) => a.recommended);
  return {
    type: "template",
    altText: "おすすめ転職エージェント一覧",
    template: {
      type: "carousel",
      columns: agents.map((agent) => ({
        thumbnailImageUrl: agent.imageUrl,
        title: agent.name,
        text: agent.description.substring(0, 60),
        actions: [
          {
            type: "uri",
            label: "無料で面談予約 →",
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

function buildAgentDetail(agent) {
  return {
    type: "flex",
    altText: `${agent.name}の詳細`,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: agent.imageUrl,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: agent.name, weight: "bold", size: "xl" },
          { type: "text", text: agent.description, wrap: true, size: "sm", margin: "md", color: "#666666" },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            contents: agent.tags.map((tag) => ({
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "✅", size: "sm", flex: 0 },
                { type: "text", text: tag, size: "sm", color: "#444444", margin: "sm" },
              ],
            })),
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#06C755",
            action: { type: "uri", label: "無料で面談予約する →", uri: agent.affiliateUrl },
          },
        ],
      },
    },
  };
}

function buildFlowMessage() {
  return {
    type: "flex",
    altText: "転職の流れ",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "転職の流れ", weight: "bold", size: "lg" },
          { type: "separator", margin: "md" },
          ...[
            ["1️⃣", "エージェントに無料登録（1分）"],
            ["2️⃣", "アドバイザーと面談（電話 or オンライン）"],
            ["3️⃣", "あなたに合った求人を紹介"],
            ["4️⃣", "書類添削・面接対策"],
            ["5️⃣", "内定・年収交渉もサポート"],
          ].map(([num, text]) => ({
            type: "box",
            layout: "horizontal",
            margin: "lg",
            contents: [
              { type: "text", text: num, size: "sm", flex: 0 },
              { type: "text", text, size: "sm", wrap: true, margin: "md" },
            ],
          })),
        ],
      },
    },
  };
}

const FAQ_ANSWERS = {
  "よくある質問": {
    type: "text",
    text: `よくある質問にお答えします💡

Q. 本当に無料？
→ はい！エージェントは企業から報酬をもらうため、あなたは完全無料です。

Q. 今すぐ転職しなくても大丈夫？
→ もちろん！情報収集だけでもOKです。

Q. 面談って何するの？
→ 希望条件のヒアリングと求人紹介です。服装自由・オンラインOK！

他に気になることがあればお気軽にメッセージください😊`,
  },
};

async function handleEvent(event) {
  if (event.type === "follow") {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: GREETING_MESSAGE },
        buildAgentCarousel(),
      ],
    });
  }

  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }

  const text = event.message.text;

  if (text === "おすすめエージェント") {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: "text", text: "あなたにおすすめの転職エージェントをご紹介します✨" },
        buildAgentCarousel(),
      ],
    });
  }

  const agentMatch = agentsConfig.agents.find((a) => text.includes(a.name));
  if (agentMatch) {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [buildAgentDetail(agentMatch)],
    });
  }

  if (text === "転職相談") {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `転職のお悩み、なんでも聞いてください😊

まずはプロに相談してみませんか？
おすすめのエージェントに無料登録すれば、アドバイザーが親身に相談に乗ってくれます。

「おすすめエージェント」とメッセージしてください👇`,
        },
      ],
    });
  }

  if (text === "年収診断") {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: `あなたの市場価値、気になりませんか？💰

転職エージェントに登録すると、あなたのスキル・経験から適正年収を無料で診断してもらえます。

今の年収が適正か確かめてみましょう👇`,
        },
        buildAgentCarousel(),
      ],
    });
  }

  if (text === "転職の流れ") {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [buildFlowMessage()],
    });
  }

  if (FAQ_ANSWERS[text]) {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [FAQ_ANSWERS[text]],
    });
  }

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: `メッセージありがとうございます😊

下のメニューからお選びください👇
・おすすめエージェント
・転職相談
・年収診断
・転職の流れ
・よくある質問`,
      },
    ],
  });
}

app.post("/webhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.json({ success: true }))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LINE Bot サーバー起動: port ${PORT}`);
});
