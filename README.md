# sixtones-monitor

[sixtones.jp/news](https://www.sixtones.jp/news/) を監視し、新しい記事が追加された際にDiscordに通知を送信するNode.jsアプリケーションです。このアプリケーションはAWS Lambda上にデプロイされ、Amazon EventBridgeを使用して1時間ごとに自動的に実行されます。

## Getting Started

### 必要条件

- **Node.js**: バージョン14.x以上
- **npm**: Node Package Manager
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
