// 必要なモジュールの読み込み
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 設定の定義
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const TARGET_URL = process.env.TARGET_URL || 'https://www.sixtones.jp/news/';
const DATA_FILE = path.join(__dirname, 'latestArticle.json');

// 最新NEWSを取得する関数
async function fetchLatestArticle() {
    try {
        const { data: html } = await axios.get(TARGET_URL);
        const $ = cheerio.load(html);

        // ページの構造に合わせたセレクタ
        // h3.p-news-list-item__title の親 <a> タグを取得
        const latestArticleElement = $('h3.p-news-list-item__title').first().parent('a');

        if (!latestArticleElement.length) {
            throw new Error('最新NEWSの要素が見つかりません。セレクタを確認してください。');
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
        console.error(`最新NEWSの取得に失敗しました: ${error.message}`);
        throw error; // 呼び出し元でハンドリングできるように再スロー
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

// ファイルから最新NEWSを読み込む関数
function loadLastArticle() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`最新NEWSデータの読み込みに失敗しました: ${error.message}`);
            return null;
        }
    }
    return null;
}

// ファイルに最新NEWSを保存する関数
function saveLastArticle(article) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(article, null, 2), 'utf-8');
        console.log('最新NEWSを保存しました:', article.title);
    } catch (error) {
        console.error(`最新NEWSの保存に失敗しました: ${error.message}`);
    }
}

// 新しいNEWSをチェックする関数
async function checkForNewArticle() {
    console.log('最新NEWSをチェックしています...');
    try {
        const latestArticle = await fetchLatestArticle();
        const lastArticle = loadLastArticle();

        if (!lastArticle || latestArticle.url !== lastArticle.url) {
            console.log('新しいNEWSが見つかりました:', latestArticle.title);
            const message = `**新しいNEWSが追加されました！\n${latestArticle.title}\n${latestArticle.url}`;
            await sendDiscordNotification(message);
            saveLastArticle(latestArticle);
        } else {
            console.log('新しいNEWSはありません。');
            const message = '**NEWSの更新チェック結果:** 新しいNEWSはありません。';
            await sendDiscordNotification(message);
        }
    } catch (error) {
        console.error('新しいNEWSのチェックに失敗しました:', error.message);
    }
}

// 初期化関数（初回実行時に最新NEWSを保存）
async function initialize() {
    const lastArticle = loadLastArticle();
    if (!lastArticle) {
        try {
            const latestArticle = await fetchLatestArticle();
            if (latestArticle) {
                saveLastArticle(latestArticle);
                console.log('初期化: 最新NEWSを保存しました:', latestArticle.title);
                const message = `**初期化完了:** 最新NEWSを保存しました。\n ${latestArticle.title}\n ${latestArticle.url}`;
                await sendDiscordNotification(message);
            }
        } catch (error) {
            console.error('初期化に失敗しました:', error.message);
        }
    }
}

// メイン関数の実行
(async () => {
    await initialize();
    await checkForNewArticle();
    console.log('処理が完了しました。');
    process.exit(0); // プロセスを終了
})();
