// Enhanced popup with real-time status and controls
document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const backendStatusEl = document.getElementById('backendStatus');
  const pageStatusEl = document.getElementById('pageStatus');
  const updateCountEl = document.getElementById('updateCount');
  const videoDataEl = document.getElementById('videoData');
  
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
    chrome.storage.local.get(['lastVideoData', 'extractCount'], (result) => {
      if (result.lastVideoData) {
        lastVideoData = result.lastVideoData;
        displayVideoData(lastVideoData);
      }
      
      if (result.extractCount) {
        updateCount = result.extractCount;
        updateCountEl.textContent = updateCount;
      }
    });
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
    refreshBtn.textContent = '🔃 Refreshing...';
    setTimeout(() => refreshBtn.textContent = '🔃 Refresh', 1000);
  });
  
  // Initial load
  testBackendConnection();
  checkArenaPage();
  updateVideoDisplay();
  
  // Auto-refresh every 3 seconds
  const interval = setInterval(() => {
    testBackendConnection();
    checkArenaPage();
    updateVideoDisplay();
  }, 3000);
  
  // Cleanup when popup closes
  window.addEventListener('unload', () => {
    clearInterval(interval);
  });
});