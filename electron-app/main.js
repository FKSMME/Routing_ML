const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const http = require('http');

let mainWindow;
let projectPath = null;
let serverProcesses = {};
let statusCheckInterval = null;

// 서비스 설정
const SERVICES = {
  backend: {
    name: 'Backend Main',
    port: 8000,
    url: 'http://localhost:8000/health',
    command: 'run_backend_main.bat'
  },
  backendTraining: {
    name: 'Backend Training',
    port: 8001,
    url: 'http://localhost:8001/health',
    command: 'run_training_service.bat'
  },
  backendPrediction: {
    name: 'Backend Prediction',
    port: 8002,
    url: 'http://localhost:8002/health',
    command: 'run_prediction_service.bat'
  },
  frontendHome: {
    name: 'Frontend Home',
    port: 3000,
    url: 'http://localhost:3000',
    command: 'run_frontend_home.bat'
  },
  frontendPrediction: {
    name: 'Frontend Prediction',
    port: 5173,
    url: 'http://localhost:5173',
    command: 'run_frontend_prediction.bat'
  },
  frontendTraining: {
    name: 'Frontend Training',
    port: 5174,
    url: 'http://localhost:5174',
    command: 'run_frontend_training.bat'
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#1e3c72',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: 'default'
  });

  mainWindow.loadFile('index.html');

  // 개발자 도구 (개발 시에만)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // 상태 체크 시작
  startStatusChecking();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopAllServers();
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 폴더 선택
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '프로젝트 폴더 선택'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    projectPath = result.filePaths[0];
    return {
      success: true,
      path: projectPath
    };
  }

  return { success: false };
});

// 서버 시작
ipcMain.handle('start-servers', async () => {
  if (!projectPath) {
    return {
      success: false,
      message: '프로젝트 폴더를 먼저 선택해주세요'
    };
  }

  try {
    // 모든 서비스 시작
    for (const [key, service] of Object.entries(SERVICES)) {
      if (!serverProcesses[key]) {
        startService(key, service);
      }
    }

    return {
      success: true,
      message: '모든 서버를 시작했습니다'
    };
  } catch (error) {
    return {
      success: false,
      message: `서버 시작 실패: ${error.message}`
    };
  }
});

// 개별 서비스 시작
function startService(key, service) {
  const commandPath = path.join(projectPath, service.command);

  try {
    const process = spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', commandPath], {
      cwd: projectPath,
      detached: true,
      shell: true
    });

    serverProcesses[key] = {
      process: process,
      startTime: Date.now(),
      service: service
    };

    sendLog('SUCCESS', `${service.name} 시작됨 (Port: ${service.port})`);
  } catch (error) {
    sendLog('ERROR', `${service.name} 시작 실패: ${error.message}`);
  }
}

// 서버 중지
ipcMain.handle('stop-servers', async () => {
  stopAllServers();
  return {
    success: true,
    message: '모든 서버를 중지했습니다'
  };
});

function stopAllServers() {
  for (const [key, data] of Object.entries(serverProcesses)) {
    try {
      if (data.process && !data.process.killed) {
        // Windows에서 프로세스 강제 종료
        spawn('taskkill', ['/F', '/T', '/PID', data.process.pid]);
      }
      sendLog('INFO', `${data.service.name} 중지됨`);
    } catch (error) {
      sendLog('ERROR', `${data.service.name} 중지 실패: ${error.message}`);
    }
  }
  serverProcesses = {};
}

// 캐시 삭제
ipcMain.handle('clear-cache', async () => {
  if (!projectPath) {
    return {
      success: false,
      message: '프로젝트 폴더를 먼저 선택해주세요'
    };
  }

  try {
    const { exec } = require('child_process');
    const cacheDirs = [
      '__pycache__',
      'node_modules/.cache',
      '.next',
      '.vite',
      'dist',
      'build'
    ];

    // 캐시 폴더 삭제 (비동기로 실행)
    for (const dir of cacheDirs) {
      const fullPath = path.join(projectPath, dir);
      exec(`if exist "${fullPath}" rmdir /s /q "${fullPath}"`, (error) => {
        if (!error) {
          sendLog('SUCCESS', `캐시 삭제: ${dir}`);
        }
      });
    }

    return {
      success: true,
      message: '캐시를 삭제했습니다'
    };
  } catch (error) {
    return {
      success: false,
      message: `캐시 삭제 실패: ${error.message}`
    };
  }
});

// 상태 확인
ipcMain.handle('check-status', async () => {
  const status = {};

  for (const [key, service] of Object.entries(SERVICES)) {
    status[key] = await checkServiceStatus(key, service);
  }

  // 시스템 성능 정보
  const performance = {
    cpu: os.loadavg()[0] * 10, // 간단한 CPU 사용률 추정
    memory: (os.totalmem() - os.freemem()) / 1024 / 1024, // MB
    timestamp: Date.now()
  };

  return {
    services: status,
    performance: performance
  };
});

async function checkServiceStatus(key, service) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const urlObj = new URL(service.url);

    const req = http.get({
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      timeout: 2000
    }, (res) => {
      const latency = Date.now() - startTime;

      resolve({
        status: res.statusCode === 200 ? 'GOOD' : 'BUSY',
        message: res.statusCode === 200 ? 'Running' : `HTTP ${res.statusCode}`,
        port: service.port,
        latency: latency,
        uptime: serverProcesses[key] ?
                Math.floor((Date.now() - serverProcesses[key].startTime) / 1000) : 0
      });

      res.resume(); // Consume response data
    });

    req.on('error', () => {
      resolve({
        status: 'ERROR',
        message: 'Not running',
        port: service.port,
        latency: -1,
        uptime: 0
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'ERROR',
        message: 'Timeout',
        port: service.port,
        latency: -1,
        uptime: 0
      });
    });
  });
}

// URL 열기
ipcMain.handle('open-url', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

// 주기적 상태 확인 (2초마다)
function startStatusChecking() {
  statusCheckInterval = setInterval(async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const status = await ipcMain.invoke('check-status');
      mainWindow.webContents.send('server-status', status);
    }
  }, 2000);
}

// 로그 전송
function sendLog(level, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-log', {
      level: level,
      message: message,
      timestamp: new Date().toISOString()
    });
  }
}

// 앱 정보
ipcMain.handle('get-app-info', async () => {
  return {
    name: '라우팅 자동생성 시스템 모니터',
    version: '5.2.0',
    author: 'Routing ML Team',
    buildDate: '2025-10-15'
  };
});

console.log('Routing ML Auto-Generation Monitor v5.2.0 - Electron Edition');
console.log('Main process started');
