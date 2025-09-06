// Enhanced popup with real-time status and controls
document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const backendStatusEl = document.getElementById('backendStatus');
  const pageStatusEl = document.getElementById('pageStatus');
  const updateCountEl = document.getElementById('updateCount');
  const videoDataEl = document.getElementById('videoData');
  const debugInfoEl = document.getElementById('debugInfo');
  
  // Control buttons
  const topBtn = document.getElementById('topBtn');
  const bottomBtn = document.getElementById('bottomBtn');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const extractBtn = document.getElementById('extractBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  
  let updateCount = 0;
  let lastVideoData = null;
  
  // Test backend connection
  function testBackendConnection() {
    fetch('http://localhost:7777/status')
      .then(response => {
        if (response.ok) {
          backendStatusEl.textContent = '✅';
          return response.json();
        } else {
          throw new Error('Backend not responding');
        }
      })
      .then(data => {
        statusEl.textContent = '🟢 Connected';
        statusEl.className = 'status connected';
      })
      .catch(() => {
        backendStatusEl.textContent = '❌';
        statusEl.textContent = '🔴 Backend Offline';
        statusEl.className = 'status disconnected';
      });
  }
  
  // Check if we're on the arena page
  function checkArenaPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url && tab.url.includes('artificialanalysis.ai/text-to-video/arena')) {
        pageStatusEl.textContent = '✅';
      } else {
        pageStatusEl.textContent = '❌';
      }
    });
  }
  
  // Get stored video data from extension
  function updateVideoDisplay() {
    chrome.storage.local.get(['lastVideoData', 'extractCount', 'debugData'], (result) => {
      if (result.lastVideoData) {
        lastVideoData = result.lastVideoData;
        displayVideoData(lastVideoData);
      }
      
      if (result.extractCount) {
        updateCount = result.extractCount;
        updateCountEl.textContent = updateCount;
      }
      
      if (result.debugData) {
        displayDebugInfo(result.debugData);
      }
    });
  }
  
  // Request debug info from content script
  function getDebugInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      console.log('🔍 Current tab:', tab?.url);
      
      if (tab && tab.url && tab.url.includes('artificialanalysis.ai')) {
        console.log('📤 Sending get_debug_info message to content script...');
        
        chrome.tabs.sendMessage(tab.id, { action: 'get_debug_info' }, (response) => {
          console.log('📥 Received response from content script:', response);
          console.log('🔧 Chrome runtime error:', chrome.runtime.lastError);
          
          if (chrome.runtime.lastError) {
            debugInfoEl.innerHTML = `<div class="loading">Error: ${chrome.runtime.lastError.message}</div>`;
            return;
          }
          
          if (response && response.debugData) {
            console.log('✅ Valid debug data received, displaying...');
            displayDebugInfo(response.debugData);
            // Also store it for future reference
            chrome.storage.local.set({ debugData: response.debugData });
          } else {
            console.log('❌ No debug data in response');
            debugInfoEl.innerHTML = '<div class="loading">Content script not responding</div>';
          }
        });
      } else {
        debugInfoEl.innerHTML = '<div class="loading">Not on arena page</div>';
      }
    });
  }
  
  // Display debug information
  function displayDebugInfo(debugData) {
    if (!debugData) {
      debugInfoEl.innerHTML = '<div class="loading">No debug data</div>';
      return;
    }
    
    let html = '';
    
    // Scan count
    html += `<div class="debug-row">
      <span class="debug-label">🔍 Scans:</span>
      <span class="debug-value">${debugData.scanCount || 0}</span>
    </div>`;
    
    // Backend connection
    html += `<div class="debug-row">
      <span class="debug-label">📡 Backend:</span>
      <span class="debug-value">${debugData.isConnected ? '🟢 Connected' : '🔴 Offline'}</span>
    </div>`;
    
    // Last model data
    if (debugData.lastModelData) {
      try {
        const models = JSON.parse(debugData.lastModelData);
        const preferredModel = models.find(m => m.preference === 'preferred');
        const nonPreferredModel = models.find(m => m.preference === 'not-preferred');
        
        if (preferredModel) {
          html += `<div class="debug-row">
            <span class="debug-label">✅ Preferred:</span>
            <span class="debug-model">${preferredModel.name}</span>
          </div>`;
        }
        
        if (nonPreferredModel) {
          html += `<div class="debug-row">
            <span class="debug-label">❌ Against:</span>
            <span class="debug-model not-preferred">${nonPreferredModel.name}</span>
          </div>`;
        }
      } catch (e) {
        html += `<div class="debug-row">
          <span class="debug-label">🏷️ Models:</span>
          <span class="debug-value">Parse error</span>
        </div>`;
      }
    } else {
      html += `<div class="debug-row">
        <span class="debug-label">🏷️ Models:</span>
        <span class="debug-value">None detected</span>
      </div>`;
    }
    
    // Current URL for navigation tracking
    if (debugData.currentUrl) {
      const urlPart = debugData.currentUrl.split('?')[0].split('/').pop();
      html += `<div class="debug-row">
        <span class="debug-label">🌐 Page:</span>
        <span class="debug-value">${urlPart}</span>
      </div>`;
    }
    
    // Last update time
    html += `<div class="debug-row">
      <span class="debug-label">⏰ Updated:</span>
      <span class="debug-value">${new Date().toLocaleTimeString()}</span>
    </div>`;
    
    debugInfoEl.innerHTML = html;
  }
  
  // Display video data in popup
  function displayVideoData(data) {
    if (!data || (!data.top && !data.bottom)) {
      videoDataEl.innerHTML = '<div class="loading">No videos detected</div>';
      return;
    }
    
    const topUrl = data.top ? data.top.substring(data.top.lastIndexOf('/') + 1, data.top.indexOf('?') !== -1 ? data.top.indexOf('?') : data.top.length) : 'None';
    const bottomUrl = data.bottom ? data.bottom.substring(data.bottom.lastIndexOf('/') + 1, data.bottom.indexOf('?') !== -1 ? data.bottom.indexOf('?') : data.bottom.length) : 'None';
    
    videoDataEl.innerHTML = `
      <div class="video-info">
        <div class="label">🔼 TOP:</div>
        <div class="url">${data.top ? topUrl : 'No video'}</div>
        
        <div class="label">🔽 BOTTOM:</div>
        <div class="url">${data.bottom ? bottomUrl : 'No video'}</div>
        
        ${data.prompt ? `<div class="prompt-preview"><strong>Prompt:</strong> ${data.prompt.substring(0, 100)}${data.prompt.length > 100 ? '...' : ''}</div>` : ''}
      </div>
    `;
  }
  
  // Send message to content script
  function sendToContentScript(action, data = {}) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.url && tab.url.includes('artificialanalysis.ai')) {
        chrome.tabs.sendMessage(tab.id, { action, ...data }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not ready:', chrome.runtime.lastError.message);
          }
        });
      } else {
        alert('Please navigate to artificialanalysis.ai/text-to-video/arena first');
      }
    });
  }
  
  // Send command to backend
  function sendToBackend(command) {
    fetch('http://localhost:7777/voice-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Command sent:', command, data);
    })
    .catch(error => {
      console.error('Failed to send command:', error);
    });
  }
  
  // Button event listeners
  topBtn.addEventListener('click', () => {
    sendToContentScript('select_preference', { preference: 'top' });
    sendToBackend('top');
    topBtn.style.background = 'rgba(40, 167, 69, 0.6)';
    setTimeout(() => topBtn.style.background = '', 200);
  });
  
  bottomBtn.addEventListener('click', () => {
    sendToContentScript('select_preference', { preference: 'bottom' });
    sendToBackend('bottom');
    bottomBtn.style.background = 'rgba(40, 167, 69, 0.6)';
    setTimeout(() => bottomBtn.style.background = '', 200);
  });
  
  playBtn.addEventListener('click', () => {
    sendToBackend('play');
    playBtn.style.background = 'rgba(0, 123, 255, 0.6)';
    setTimeout(() => playBtn.style.background = '', 200);
  });
  
  pauseBtn.addEventListener('click', () => {
    sendToBackend('pause');
    pauseBtn.style.background = 'rgba(0, 123, 255, 0.6)';
    setTimeout(() => pauseBtn.style.background = '', 200);
  });
  
  extractBtn.addEventListener('click', () => {
    sendToContentScript('extract_videos');
    extractBtn.textContent = '🔄 Extracting...';
    setTimeout(() => extractBtn.textContent = '🔄 Extract Now', 1000);
  });
  
  refreshBtn.addEventListener('click', () => {
    testBackendConnection();
    checkArenaPage();
    updateVideoDisplay();
    getDebugInfo();
    refreshBtn.textContent = '🔃 Refreshing...';
    setTimeout(() => refreshBtn.textContent = '🔃 Refresh', 1000);
  });
  
  // Initial load
  testBackendConnection();
  checkArenaPage();
  updateVideoDisplay();
  getDebugInfo();
  
  // Auto-refresh every 3 seconds
  const interval = setInterval(() => {
    testBackendConnection();
    checkArenaPage();
    updateVideoDisplay();
    getDebugInfo();
  }, 3000);
  
  // Cleanup when popup closes
  window.addEventListener('unload', () => {
    clearInterval(interval);
  });
});