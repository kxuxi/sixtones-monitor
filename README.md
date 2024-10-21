# sixtones-monitor

[sixtones.jp/news](https://www.sixtones.jp/news/) を監視し、新しい記事が追加された際にDiscordに通知を送信するNode.jsアプリケーションです。このアプリケーションはAWS Lambda上にデプロイされ、Amazon EventBridgeを使用して1時間ごとに自動的に実行されます。

## Getting Started

### 必要条件

- **Node.js**: バージョン14.x以上
- **npm**: Node Package Manager
- **AWSアカウント**: Lambda関数のデプロイおよびEventBridgeルールの設定権限を持つアカウント
- **Discord Webhook URL**: Discordチャンネルに通知を送信するためのWebhook URL

### インストール

1. **リポジトリのクローン**

    ```bash
    git clone https://github.com/yourusername/sixtones-monitor.git
    cd sixtones-monitor
    ```

2. **依存関係のインストール**

    ```bash
    npm install
    ```

3. **環境変数の設定**

    プロジェクトのルートディレクトリに `.env` ファイルを作成し、以下の内容を追加します：

    ```env
    DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_id/your_webhook_token
    TARGET_URL=https://www.sixtones.jp/news/
    ```

    **注意**: `your_webhook_id` と `your_webhook_token` は実際のDiscord Webhook URLに置き換えてください。

4. **Serverless Frameworkのインストール**

    Serverless Frameworkをグローバルにインストールします：

    ```bash
    npm install -g serverless
    ```

5. **AWS CLIの設定**

    AWS CLIがインストールされていない場合は、公式ドキュメントに従ってインストールしてください。インストール後、以下のコマンドで設定します：

    ```bash
    aws configure
    ```

    プロンプトに従い、AWS Access Key ID、Secret Access Key、デフォルトリージョン（例: `ap-northeast-1` 東京リージョン）、および出力形式（`json`）を入力します。

## Usage

### デプロイ

1. **Serverlessプロジェクトの初期化**

    プロジェクトディレクトリで以下のコマンドを実行し、Serverless Frameworkを初期化します：

    ```bash
    serverless create --template aws-nodejs --path sixtones-monitor
    cd sixtones-monitor
    ```

2. **コードの編集**

    `handler.js` ファイルを以下の内容に置き換えます：

    ```javascript
    // handler.js

    const axios = require('axios');
    const cheerio = require('cheerio');
    const fs = require('fs');
    const path = require('path');
    require('dotenv').config();

    // 環境変数からWebhook URLとターゲットURLを取得
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
    const TARGET_URL = process.env.TARGET_URL || 'https://www.sixtones.jp/news/';
    const DATA_FILE = path.join('/tmp', 'latestArticle.json'); // Lambdaでは/tmpにのみ書き込み可能

    // 最新記事を取得する関数
    async function fetchLatestArticle() {
        try {
            const { data: html } = await axios.get(TARGET_URL);
            const $ = cheerio.load(html);

            // セレクタを最新のHTML構造に合わせて調整
            const latestArticleElement = $('h3.p-news-list-item__title').first().parent('a');

            if (!latestArticleElement.length) {
                throw new Error('最新記事の要素が見つかりません。セレクタを確認してください。');
            }

            const title = latestArticleElement.find('h3.p-news-list-item__title').text().trim();
            const relativeUrl = latestArticleElement.attr('href');

            if (!title || !relativeUrl) {
                throw new Error('タイトルまたはURLが取得できませんでした。');
            }

            // URLが相対パスの場合、絶対パスに変換
            const absoluteUrl = new URL(relativeUrl, TARGET_URL).href;

            return { title, url: absoluteUrl };
        } catch (error) {
            console.error(`最新記事の取得に失敗しました: ${error.message}`);
            throw error;
        }
    }

    // Discordに通知を送信する関数
    async function sendDiscordNotification(message) {
        try {
            const payload = { content: message };
            await axios.post(DISCORD_WEBHOOK_URL, payload);
            console.log('Discordに通知を送信しました:', message);
        } catch (error) {
            console.error(`Discordへの通知に失敗しました: ${error.message}`);
        }
    }

    // ファイルから最新記事を読み込む関数
    function loadLastArticle() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const data = fs.readFileSync(DATA_FILE, 'utf-8');
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error(`最新記事データの読み込みに失敗しました: ${error.message}`);
            return null;
        }
    }

    // ファイルに最新記事を保存する関数
    function saveLastArticle(article) {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(article, null, 2), 'utf-8');
            console.log('最新記事を保存しました:', article.title);
        } catch (error) {
            console.error(`最新記事の保存に失敗しました: ${error.message}`);
        }
    }

    // 新しい記事をチェックする関数
    async function checkForNewArticle() {
        console.log('最新記事をチェックしています...');
        try {
            const latestArticle = await fetchLatestArticle();
            const lastArticle = loadLastArticle();

            if (!lastArticle || latestArticle.url !== lastArticle.url) {
                console.log('新しい記事が見つかりました:', latestArticle.title);
                const message = `**新しい記事が追加されました！**\n**タイトル:** ${latestArticle.title}\n**URL:** ${latestArticle.url}`;
                await sendDiscordNotification(message);
                saveLastArticle(latestArticle);
            } else {
                console.log('新しい記事はありません。');
                const message = '**記事の更新チェック結果:** 新しい記事はありません。';
                await sendDiscordNotification(message);
            }
        } catch (error) {
            console.error('新しい記事のチェックに失敗しました:', error.message);
        }
    }

    // 初期化関数（初回実行時に最新記事を保存）
    async function initialize() {
        const lastArticle = loadLastArticle();
        if (!lastArticle) {
            try {
                const latestArticle = await fetchLatestArticle();
                if (latestArticle) {
                    saveLastArticle(latestArticle);
                    console.log('初期化: 最新記事を保存しました:', latestArticle.title);
                    const message = `**初期化完了:** 最新記事を保存しました。\n**タイトル:** ${latestArticle.title}\n**URL:** ${latestArticle.url}`;
                    await sendDiscordNotification(message);
                }
            } catch (error) {
                console.error('初期化に失敗しました:', error.message);
            }
        }
    }

    // Lambdaハンドラー関数
    module.exports.monitor = async (event) => {
        await initialize();
        await checkForNewArticle();
        console.log('処理が完了しました。');
        return {
            statusCode: 200,
            body: JSON.stringify({ message: '実行完了' }),
        };
    };
    ```

3. **`serverless.yml` の編集**

    ```yaml
    service: sixtones-monitor

    provider:
      name: aws
      runtime: nodejs14.x
      region: ap-northeast-1  # 東京リージョン
      environment:
        DISCORD_WEBHOOK_URL: ${env:DISCORD_WEBHOOK_URL}
        TARGET_URL: ${env:TARGET_URL}

    functions:
      monitor:
        handler: handler.monitor
        events:
          - schedule:
              rate: rate(1 hour)  # 毎時実行
              enabled: true
              name: sixtones-monitor-schedule
    ```

4. **デプロイ**

    プロジェクトディレクトリで以下のコマンドを実行して、Lambda 関数をデプロイします：

    ```bash
    serverless deploy
    ```

    デプロイが完了すると、Lambda 関数とスケジュールが設定されます。

## Usage

### 自動実行

デプロイが完了すると、Lambda関数がAmazon EventBridgeにより1時間ごとに自動的に実行されます。実行ごとに以下の処理が行われます：

1. **最新記事の取得**: 指定されたURLから最新の記事をスクレイピングします。
2. **記事の比較**: 取得した記事が前回保存されたものと異なるか確認します。
3. **Discordへの通知**: 新しい記事が見つかった場合、Discordに通知を送信します。
4. **最新記事の保存**: 新しい記事情報を保存し、次回の比較に備えます。

### ローカルでのテスト

デプロイ前にローカル環境でスクリプトをテストすることも可能です。以下のコマンドを実行します：

```bash
node index.js
