// Renderer Process - Client-side JavaScript

let selectedPath = null;
let logCount = 0;
const MAX_LOGS = 100;
let services = {};

// 서비스 설정
const SERVICE_CONFIG = {
  backend: { name: 'Backend Main', icon: '🔹', port: 8000 },
  backendTraining: { name: 'Backend Training', icon: '🧠', port: 8001 },
  backendPrediction: { name: 'Backend Prediction', icon: '🔮', port: 8002 },
  frontendHome: { name: 'Frontend Home', icon: '🏠', port: 3000 },
  frontendPrediction: { name: 'Frontend Prediction', icon: '📊', port: 5173 },
  frontendTraining: { name: 'Frontend Training', icon: '🎯', port: 5174 }
};

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  addLog('INFO', '시스템 초기화 중...');

  // 앱 정보 로드
  try {
    const appInfo = await window.electronAPI.getAppInfo();
    document.getElementById('appInfo').textContent =
      `${appInfo.name} v${appInfo.version} - Electron Edition`;
    addLog('SUCCESS', `${appInfo.name} v${appInfo.version} 로드 완료`);
  } catch (error) {
    addLog('ERROR', `앱 정보 로드 실패: ${error.message}`);
  }

  // 상태 그리드 초기화
  initStatusGrid();

  // 이벤트 리스너 등록
  window.electronAPI.onServerStatus(updateAllStatus);
  window.electronAPI.onServerLog(handleServerLog);

  // 초기 상태 확인
  await refreshStatus();
  addLog('SUCCESS', '시스템 준비 완료');
});

// 상태 그리드 초기화
function initStatusGrid() {
  const grid = document.getElementById('statusGrid');
  grid.innerHTML = '';

  for (const [key, config] of Object.entries(SERVICE_CONFIG)) {
    const item = document.createElement('div');
    item.className = 'status-item';
    item.id = `status-${key}`;
    item.innerHTML = `
      <div class="status-label">
        <span>${config.icon} ${config.name}</span>
        <span class="status-port">Port: ${config.port}</span>
      </div>
      <div class="status-badge status-error">
        <span class="status-indicator indicator-error"></span>
        <span>ERROR - 대기중</span>
      </div>
    `;
    grid.appendChild(item);
  }
}

// 폴더 선택
async function selectFolder() {
  try {
    const result = await window.electronAPI.selectFolder();
    if (result.success) {
      selectedPath = result.path;
      document.getElementById('folderDisplay').textContent = result.path;
      document.getElementById('folderDisplay').classList.add('selected');

      // 버튼 활성화
      document.getElementById('btnStart').disabled = false;
      document.getElementById('btnStop').disabled = false;
      document.getElementById('btnCache').disabled = false;

      addLog('SUCCESS', `프로젝트 폴더 선택: ${result.path}`);
      showMessage('프로젝트 폴더가 선택되었습니다', 'success');
    }
  } catch (error) {
    addLog('ERROR', `폴더 선택 실패: ${error.message}`);
    showMessage('폴더 선택에 실패했습니다', 'error');
  }
}

// 서버 시작
async function startServers() {
  addLog('INFO', '모든 서버 시작 요청...');
  showMessage('서버를 시작하는 중...', 'success');

  const btn = document.getElementById('btnStart');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="loading">⏳</span><span>시작 중...</span>';
  btn.disabled = true;

  try {
    const result = await window.electronAPI.startServers();

    if (result.success) {
      addLog('SUCCESS', result.message);
      showMessage(result.message, 'success');
    } else {
      addLog('ERROR', result.message);
      showMessage(result.message, 'error');
    }
  } catch (error) {
    addLog('ERROR', `서버 시작 실패: ${error.message}`);
    showMessage('서버 시작에 실패했습니다', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// 서버 중지
async function stopServers() {
  if (!confirm('모든 서버를 중지하시겠습니까?')) {
    return;
  }

  addLog('WARNING', '모든 서버 중지 요청...');

  const btn = document.getElementById('btnStop');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="loading">⏳</span><span>중지 중...</span>';
  btn.disabled = true;

  try {
    const result = await window.electronAPI.stopServers();
    addLog('INFO', result.message);
    showMessage(result.message, 'success');
  } catch (error) {
    addLog('ERROR', `서버 중지 실패: ${error.message}`);
    showMessage('서버 중지에 실패했습니다', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// 캐시 삭제
async function clearCache() {
  if (!confirm('캐시를 삭제하시겠습니까? (빌드 파일, __pycache__, node_modules/.cache 등)')) {
    return;
  }

  addLog('INFO', '캐시 삭제 요청...');

  const btn = document.getElementById('btnCache');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="loading">⏳</span><span>삭제 중...</span>';
  btn.disabled = true;

  try {
    const result = await window.electronAPI.clearCache();

    if (result.success) {
      addLog('SUCCESS', result.message);
      showMessage(result.message, 'success');
    } else {
      addLog('ERROR', result.message);
      showMessage(result.message, 'error');
    }
  } catch (error) {
    addLog('ERROR', `캐시 삭제 실패: ${error.message}`);
    showMessage('캐시 삭제에 실패했습니다', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// 상태 새로고침
async function refreshStatus() {
  const btn = document.getElementById('btnRefresh');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="loading">🔄</span><span>새로고침</span>';

  try {
    const status = await window.electronAPI.checkStatus();
    updateAllStatus(status);
    addLog('INFO', '상태 업데이트 완료');
  } catch (error) {
    addLog('ERROR', `상태 확인 실패: ${error.message}`);
  } finally {
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 500);
  }
}

// 전체 상태 업데이트
function updateAllStatus(data) {
  if (!data || !data.services) return;

  // 서비스 상태 업데이트
  let activeCount = 0;
  let totalLatency = 0;
  let latencyCount = 0;

  for (const [key, status] of Object.entries(data.services)) {
    updateServiceStatus(key, status);

    if (status.status === 'GOOD') {
      activeCount++;
    }

    if (status.latency && status.latency > 0) {
      totalLatency += status.latency;
      latencyCount++;
    }
  }

  // 성능 정보 업데이트
  if (data.performance) {
    updatePerformance(data.performance, activeCount, totalLatency, latencyCount);
  }
}

// 개별 서비스 상태 업데이트
function updateServiceStatus(key, status) {
  const element = document.getElementById(`status-${key}`);
  if (!element) return;

  const badge = element.querySelector('.status-badge');
  const indicator = element.querySelector('.status-indicator');

  // 상태 클래스 제거
  badge.classList.remove('status-good', 'status-busy', 'status-error');
  indicator.classList.remove('indicator-good', 'indicator-busy', 'indicator-error');

  // 새 상태 클래스 추가
  const statusClass = status.status.toLowerCase();
  badge.classList.add(`status-${statusClass}`);
  indicator.classList.add(`indicator-${statusClass}`);

  // 텍스트 업데이트
  let text = `${status.status} - ${status.message}`;
  if (status.latency && status.latency > 0) {
    text += ` (${status.latency}ms)`;
  }

  badge.querySelector('span:last-child').textContent = text;
}

// 성능 정보 업데이트
function updatePerformance(perf, activeCount, totalLatency, latencyCount) {
  // CPU
  if (perf.cpu !== undefined) {
    const cpuValue = Math.min(perf.cpu, 100).toFixed(1);
    document.getElementById('cpuUsage').innerHTML =
      `${cpuValue}<span class="perf-unit">%</span>`;
  }

  // 메모리
  if (perf.memory !== undefined) {
    const memValue = Math.floor(perf.memory);
    document.getElementById('memUsage').innerHTML =
      `${memValue}<span class="perf-unit">MB</span>`;
  }

  // 활성 서비스
  document.getElementById('activeServices').innerHTML =
    `${activeCount}<span class="perf-unit">/ 6</span>`;

  // 평균 응답시간
  if (latencyCount > 0) {
    const avgLatency = Math.floor(totalLatency / latencyCount);
    document.getElementById('avgLatency').innerHTML =
      `${avgLatency}<span class="perf-unit">ms</span>`;
  } else {
    document.getElementById('avgLatency').innerHTML =
      `-<span class="perf-unit">ms</span>`;
  }
}

// 서버 로그 핸들러
function handleServerLog(log) {
  addLog(log.level, log.message);
}

// 로그 추가
function addLog(level, message) {
  const logPanel = document.getElementById('logPanel');
  const timestamp = new Date().toLocaleTimeString('ko-KR');

  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  logEntry.innerHTML = `
    <span class="log-timestamp">[${timestamp}]</span>
    <span class="log-level log-level-${level}">${level}</span>
    <span>${message}</span>
  `;

  logPanel.appendChild(logEntry);
  logCount++;

  // 로그 개수 제한
  if (logCount > MAX_LOGS) {
    logPanel.removeChild(logPanel.firstChild);
    logCount--;
  }

  // 자동 스크롤
  logPanel.scrollTop = logPanel.scrollHeight;
}

// 메시지 표시
function showMessage(text, type) {
  const messageArea = document.getElementById('messageArea');
  messageArea.innerHTML = `<div class="message message-${type}">${text}</div>`;

  setTimeout(() => {
    messageArea.innerHTML = '';
  }, 5000);
}

// URL 열기
async function openURL(url) {
  addLog('INFO', `페이지 열기: ${url}`);
  try {
    await window.electronAPI.openURL(url);
  } catch (error) {
    addLog('ERROR', `페이지 열기 실패: ${error.message}`);
    showMessage('페이지를 열 수 없습니다', 'error');
  }
}

// 주기적 상태 확인은 main.js에서 자동으로 처리됨
console.log('Renderer process ready');
