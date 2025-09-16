const { ipcRenderer } = require('electron');

const downloadBtn = document.getElementById('download-btn');
const outputSelectEl = document.getElementById('outputSelect');
const outputContent = document.getElementById('output');


const startDownload = () => {
  const videoUrlEl = document.getElementById('video-url');
  const videoUrl = videoUrlEl.value.trim();

  // 修正：檢查 URL 字串是否為空
  if (!videoUrl) {
    outputContent.value = '請輸入影片網址';
    return;
  }

  const format = outputSelectEl.value;

  const args = [
    // 建議指定一個輸出目錄，這裡會存在應用程式執行目錄下的 Downloads 資料夾
    '--output',
    '--ffmpeg-location', 
    './FFmpeg/bin'
  ];

  if (format === 'mp4') {
    args.push('--merge-output-format', 'mp4');
  } else if (format === 'mp3') {
    args.push(
      '--extract-audio',
      '--audio-format', 'mp3',
      // 使用 '0' 來獲取最佳 VBR 品質
      '--audio-quality', '0'
    );
  }

  // 修正：將影片 URL「字串」作為最後一個參數，而不是整個 input 元素
  args.push(videoUrl);

  // 清除先前的訊息並顯示正在執行的命令
  outputContent.value = `執行命令: yt-dlp ${args.join(' ')}\n\n`;

  // 發送下載請求到主進程
  ipcRenderer.send('download-video', args);
};

// 將下載函式綁定到按鈕的點擊事件
downloadBtn.addEventListener('click', startDownload);

// 監聽來自 main process 的進度更新
ipcRenderer.on('download-progress', (event, data) => {
  outputContent.value += data;
  // 自動捲動到底部
  outputContent.scrollTop = outputContent.scrollHeight;
});

// 監聽來自 main process 的完成訊息
ipcRenderer.on('download-complete', (event, message) => {
  outputContent.value += `\n${message}\n`;
  outputContent.scrollTop = outputContent.scrollHeight;
});
