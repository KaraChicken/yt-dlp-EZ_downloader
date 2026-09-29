# yt-dlp EZ Downloader

一個以 Electron 製作的 **yt-dlp 圖形化下載器（GUI）**。

## 功能

- 多網址下載佇列
- 下載前解析影片標題、頻道、時長與格式數
- 最佳畫質、指定最高解析度、MP4 / MKV / WebM
- MP3 / M4A / Opus / FLAC / WAV 音訊抽取
- 自訂 yt-dlp format selector
- 字幕與自動字幕
- 嵌入縮圖與 metadata
- 下載封存（避免重複下載）
- 自訂下載資料夾
- Proxy、速度上限、並行 fragments、重試次數
- Chrome / Edge / Firefox / Brave cookies
- 額外 yt-dlp 參數
- 即時進度、速度、ETA 與完整執行日誌
- 取消目前下載
- Windows / macOS / Linux Electron 打包

## 使用前

本程式是 yt-dlp 的 GUI 前端，因此系統必須能執行 \`yt-dlp\`。

另外，FFmpeg / FFprobe 強烈建議安裝；yt-dlp 在合併獨立影音串流及音訊轉檔時會使用它。完整 YouTube 支援目前也需要 yt-dlp-ejs 與 JavaScript runtime。詳見 yt-dlp 官方文件。

官方專案：<https://github.com/yt-dlp/yt-dlp>

## 開發

\`\`\`bash
npm install
npm start
\`\`\`

## 打包

\`\`\`bash
npm run dist
\`\`\`

> 請確認你有權下載目標內容，並遵守來源網站的服務條款與著作權規範。
