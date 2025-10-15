const { contextBridge, ipcRenderer } = require('electron');

// Renderer 프로세스에 안전하게 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 폴더 선택
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // 서버 제어
  startServers: () => ipcRenderer.invoke('start-servers'),
  stopServers: () => ipcRenderer.invoke('stop-servers'),
  clearCache: () => ipcRenderer.invoke('clear-cache'),

  // 상태 확인
  checkStatus: () => ipcRenderer.invoke('check-status'),

  // URL 열기
  openURL: (url) => ipcRenderer.invoke('open-url', url),

  // 앱 정보
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // 이벤트 리스너
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (event, status) => callback(status));
  },

  onServerLog: (callback) => {
    ipcRenderer.on('server-log', (event, log) => callback(log));
  }
});

console.log('Preload script loaded');
