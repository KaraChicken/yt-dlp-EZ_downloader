# yt-dlp EZ Downloader

以 Electron 製作的 yt-dlp 圖形化下載器。

## 安全性變更（2.1.0）

- 移除額外 yt-dlp 參數及自由格式 selector；下載命令只由 GUI 白名單設定產生。
- 僅允許 HTTP / HTTPS 來源網址。
- yt-dlp 執行時強制使用 \`--ignore-config\`，避免使用者層級設定檔注入隱藏參數。
- 最低要求 yt-dlp **2026.07.04**，低於此版本或無法辨識版本時拒絕下載。
- Electron 升級至 45.2.1，啟用 sandbox、context isolation、停用 Node integration。
- 限制 IPC 來源、導覽及新視窗；補強 CSP。
- 輸出目錄必須由原生資料夾選擇器核准。
- 全域下載工作鎖在任何非同步前置檢查前同步取得，避免重複啟動競態。
- 取消旗標在前置檢查階段即生效；啟動後會嘗試終止下載程序樹。
- 整個佇列使用同一份 GUI 設定快照，下載期間鎖定設定控制項。
- 佇列支援單筆移除與清空；清除輸入框不會誤刪佇列。
- 環境檢查顯示 yt-dlp 版本、FFmpeg、FFprobe 與可偵測的 JavaScript runtime；EJS 套件仍需依安裝方式確認。
- GUI 顯示實際預設下載資料夾，窄視窗斷點與視窗最小寬度一致。
- 影片資訊解析加入 45 秒逾時；Preload 事件訂閱支援解除註冊。

## 功能

- 多網址下載佇列
- 下載前解析影片標題、頻道、時長與格式數
- 最佳畫質、指定最高解析度、MP4 / MKV / WebM
- MP3 / M4A / Opus / FLAC / WAV 音訊抽取
- 字幕與自動字幕
- 嵌入縮圖與 metadata
- 下載封存（避免重複下載）
- 自訂下載資料夾
- Proxy、速度上限、並行 fragments、重試次數
- Chrome / Edge / Firefox / Brave cookies
- 即時進度、速度、ETA 與執行日誌
- 取消目前下載
- Windows / macOS / Linux Electron 打包

## 使用前

系統必須能執行 yt-dlp 2026.07.04 或更新版本。FFmpeg / FFprobe 強烈建議安裝；完整 YouTube 支援也可能需要 yt-dlp-ejs 與 JavaScript runtime。

官方專案：<https://github.com/yt-dlp/yt-dlp>

## 開發

先執行 \`npm install\` 產生與目前 package.json 一致的 lockfile，再執行：

\`\`\`bash
npm test
npm start
\`\`\`

## 打包

\`\`\`bash
npm run dist
\`\`\`

> 請確認你有權下載目標內容，並遵守來源網站的服務條款與著作權規範。
