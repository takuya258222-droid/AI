/**
 * Google Apps Script — スプレッドシートデータをJSONで配信するWebアプリ
 *
 * セットアップ:
 *   1. https://script.google.com で新しいプロジェクトを作成
 *   2. このコードを貼り付けて保存
 *   3. デプロイ → 新しいデプロイ → ウェブアプリ
 *      - 実行するユーザー: 自分
 *      - アクセスできるユーザー: 全員
 *   4. デプロイURLをコピー
 *   5. GitHub Secretに GAS_DEPLOY_URL として設定
 */

var SPREADSHEET_ID = '1GgRzu3_VrF63QIzIxduF4HgeIeCN7WsZuyetLJ8v1jI';

var SHEETS = {
  'anken':  '案件!A1:S3000',
  'kaigo':  '介護案件!A1:Q3000',
  'kango':  '看護案件!A1:Q3000'
};

function doGet(e) {
  var sheet = (e && e.parameter && e.parameter.sheet) ? e.parameter.sheet : 'all';

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var result = {};

    if (sheet === 'all') {
      for (var key in SHEETS) {
        result[key] = getSheetData(ss, SHEETS[key]);
      }
    } else if (SHEETS[sheet]) {
      result[sheet] = getSheetData(ss, SHEETS[sheet]);
    } else {
      return ContentService.createTextOutput(JSON.stringify({error: 'Unknown sheet: ' + sheet}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetData(ss, range) {
  var data = ss.getRange(range).getValues();
  // Filter out empty rows
  var filtered = [];
  for (var i = 0; i < data.length; i++) {
    var hasData = false;
    for (var j = 0; j < data[i].length; j++) {
      if (data[i][j] !== '') { hasData = true; break; }
    }
    if (hasData) filtered.push(data[i]);
  }
  return { values: filtered };
}

// テスト用
function testDoGet() {
  var result = doGet({parameter: {sheet: 'all'}});
  Logger.log(result.getContent().substring(0, 500));
}
