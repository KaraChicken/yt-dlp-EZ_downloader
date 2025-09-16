const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');

ipcMain.on('download-video', (event, args) => {
  const ytProcess = spawn('yt-dlp', args);

  ytProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`stdout: ${output}`);
    event.sender.send('download-progress', output);
  });

  ytProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(`stderr: ${output}`);
    // yt-dlp 經常將進度訊息輸出到 stderr，所以我們也將它轉發
    event.sender.send('download-progress', output);
  });

  ytProcess.on('close', (code) => {
    console.log(`子進程結束，代碼 ${code}`);
    const message = code === 0 ? '下載完成！' : `下載失敗，錯誤代碼: ${code}`;
    event.sender.send('download-complete', message);
  });

  ytProcess.on('error', (err) => {
    console.error('無法啟動子進程:', err);
    event.sender.send('download-complete', `啟動下載失敗: ${err.message}. 請確認 yt-dlp 已安裝並在系統 PATH 中。`);
  });
});

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // 為了讓 renderer process 可以使用 require()
      nodeIntegration: true,
      contextIsolation: false,
    }
  })

  win.loadFile('index.html')
};

app.whenReady().then(() => {
  createWindow()
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});