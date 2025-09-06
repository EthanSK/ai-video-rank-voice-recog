// Content script that runs on artificialanalysis.ai
console.log('🎬 AI Video Ranking Extension loaded');

class VideoExtractor {
  constructor() {
    this.backendUrl = 'http://localhost:7777';
    this.isConnected = false;
    this.checkBackendConnection();
    this.setupVideoMonitoring();
    this.setupCommandPolling();
    this.setupModelNamePolling();
    this.createDebugUI();
  }

  async checkBackendConnection() {
    try {
      const response = await fetch(`${this.backendUrl}/status`);
      if (response.ok) {
        console.log('✅ Connected to Node.js backend on port 7777');
        this.isConnected = true;
      } else {
        throw new Error('Backend not responding');
      }
    } catch (error) {
      console.log('❌ Backend not available, retrying in 5s...', error.message);
      this.isConnected = false;
      setTimeout(() => this.checkBackendConnection(), 5000);
    }
  }

  async sendToBackend(endpoint, data) {
    if (!this.isConnected) {
      console.log('⚠️ Backend not connected, skipping send');
      return;
    }
    
    try {
      const response = await fetch(`${this.backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        console.error('Failed to send data to backend:', response.status);
      }
    } catch (error) {
      console.error('Error sending data to backend:', error);
      this.isConnected = false;
      setTimeout(() => this.checkBackendConnection(), 5000);
    }
  }

  setupCommandPolling() {
    // Poll for commands from backend every 2 seconds
    setInterval(async () => {
      if (!this.isConnected) return;
      
      try {
        const response = await fetch(`${this.backendUrl}/get-commands`);
        if (response.ok) {
          const result = await response.json();
          if (result.commands && result.commands.length > 0) {
            result.commands.forEach(command => {
              this.handleBackendCommand(command);
            });
          }
        }
      } catch (error) {
        console.error('Error polling commands:', error);
      }
    }, 2000);
  }

  handleBackendCommand(command) {
    console.log('📨 Command from backend:', command);
    
    switch (command.type) {
      case 'select_preference':
        this.selectPreference(command.data.preference);
        break;
      case 'play_videos':
        this.playVideos();
        break;
      case 'pause_videos':
        this.pauseVideos();
        break;
      case 'extract_videos':
        this.extractAndSendVideos();
        break;
    }
  }

  setupVideoMonitoring() {
    // Monitor for page changes and new videos
    const observer = new MutationObserver((mutations) => {
      let shouldExtract = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              if (node.tagName === 'VIDEO' || node.querySelector('video')) {
                shouldExtract = true;
              }
            }
          });
        }
      });
      
      if (shouldExtract) {
        console.log('🎥 New videos detected, extracting...');
        setTimeout(() => this.extractAndSendVideos(), 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial extraction
    setTimeout(() => this.extractAndSendVideos(), 2000);
  }

  extractAndSendVideos() {
    console.log('🔍 Extracting videos from page...');
    
    const videos = document.querySelectorAll('video');
    console.log(`Found ${videos.length} video elements`);
    
    // Log video count
    if (videos.length > 0) {
      console.log(`📺 Found ${videos.length} videos`);
    }
    
    if (videos.length >= 2) {
      // Extract video URLs using the ExtensionSystem expected format
      const videoData = {
        top: videos[0].currentSrc || videos[0].src,
        bottom: videos[1].currentSrc || videos[1].src,
        prompt: this.extractPrompt()
      };
      
      console.log('🎬 Sending videos to backend');
      
      // Send to backend using HTTP
      this.sendToBackend('/update', videoData);
      
      // Store in extension storage
      chrome.storage.local.set({ lastVideoData: videoData });
    } else {
      console.log('⚠️ Not enough videos found - need at least 2 videos');
      console.log('🔍 Looking for video elements in the entire page...');
      
      // More comprehensive search
      const allVideos = document.querySelectorAll('video, [src*=".mp4"], [src*=".webm"], source');
      console.log(`Found ${allVideos.length} potential video elements`);
      
      allVideos.forEach((element, index) => {
        console.log(`Potential video ${index + 1}:`, {
          tagName: element.tagName,
          src: element.src,
          type: element.type,
          className: element.className
        });
      });
    }
  }

  extractPrompt() {
    // Look for prompt text in various locations
    const selectors = [
      'p[class*="prompt"]',
      'div[class*="prompt"]',
      '.text-lg',
      '.text-xl', 
      'p:not(:empty)',
      'div:not(:empty)'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text && text.length > 20 && text.length < 500) {
          // Likely a prompt
          console.log('📝 Found prompt:', text.substring(0, 100) + '...');
          return text;
        }
      }
    }
    
    return 'Video comparison loaded';
  }

  selectPreference(preference) {
    console.log(`🎯 Selecting ${preference} preference...`);
    
    // Look for preference buttons
    const buttons = document.querySelectorAll('button');
    
    for (const button of buttons) {
      const text = button.textContent?.toLowerCase() || '';
      const hasLeftArrow = text.includes('←') || button.innerHTML.includes('←');
      const hasRightArrow = text.includes('→') || button.innerHTML.includes('→');
      
      if (preference === 'top' && (hasLeftArrow || text.includes('left') || text.includes('first'))) {
        console.log('✅ Clicking top/left preference button');
        button.click();
        
        // Start high frequency polling for model names after voting
        this.startHighFrequencyPolling();
        return;
      } else if (preference === 'bottom' && (hasRightArrow || text.includes('right') || text.includes('second'))) {
        console.log('✅ Clicking bottom/right preference button');
        button.click();
        
        // Start high frequency polling for model names after voting
        this.startHighFrequencyPolling();
        return;
      }
    }
    
    console.log('⚠️ Preference buttons not found');
  }

  setupModelNamePolling() {
    // Normal polling every 2 seconds
    setInterval(() => {
      this.extractAndSendModelNames();
    }, 2000);
    
    // High frequency polling right after voting
    this.voteDetectionInterval = null;
  }

  startHighFrequencyPolling() {
    console.log('🚀 Starting high frequency polling for model names...');
    
    // Clear any existing high frequency polling
    if (this.voteDetectionInterval) {
      clearInterval(this.voteDetectionInterval);
    }
    
    // Poll every 300ms for 10 seconds after a vote
    let pollCount = 0;
    this.voteDetectionInterval = setInterval(() => {
      this.extractAndSendModelNames();
      pollCount++;
      
      // Stop after 10 seconds (33 polls)
      if (pollCount >= 33) {
        clearInterval(this.voteDetectionInterval);
        this.voteDetectionInterval = null;
        console.log('🛑 Stopped high frequency polling');
      }
    }, 300);
  }

  extractAndSendModelNames() {
    // Look for model names that appear after voting
    // Based on the DOM investigation, they appear in divs with green/red colors and arrows
    const modelElements = [];
    const debugInfo = [];
    
    // More comprehensive search - look for the specific patterns from our Playwright investigation
    const selectors = [
      '.text-green-500',  // Green upvote text
      '.text-red-500',    // Red downvote text
      '[class*="upvote"]',
      '[class*="downvote"]',
      '[class*="green-500"]',
      '[class*="red-500"]',
      '.animate-arena-upvote',
      '.animate-arena-downvote'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      debugInfo.push(`${selector}: ${elements.length} elements`);
      
      elements.forEach(element => {
        const text = element.textContent?.trim();
        const classList = element.className;
        
        debugInfo.push(`  Element: "${text}" (classes: ${classList})`);
        
        if (text && this.looksLikeModelName(text)) {
          const isGreen = classList.includes('green') || classList.includes('upvote');
          const isRed = classList.includes('red') || classList.includes('downvote');
          
          if (isGreen) {
            modelElements.push({
              name: text,
              preference: 'preferred',
              type: 'upvote'
            });
          } else if (isRed) {
            modelElements.push({
              name: text,
              preference: 'not-preferred',
              type: 'downvote'
            });
          }
        }
      });
    });
    
    // Also do a broader search for any model-like text
    const allElements = document.querySelectorAll('div, span, p');
    let modelLikeTexts = [];
    allElements.forEach(element => {
      const text = element.textContent?.trim();
      if (text && this.looksLikeModelName(text)) {
        modelLikeTexts.push(`"${text}" in ${element.tagName}.${element.className}`);
      }
    });
    
    if (modelLikeTexts.length > 0) {
      debugInfo.push(`Model-like texts found: ${modelLikeTexts.join(', ')}`);
    }
    
    // Update debug UI
    this.updateDebugUI(modelElements, debugInfo);
    
    // Only send if we found model names and they're different from what we last sent
    if (modelElements.length > 0) {
      const currentModelData = JSON.stringify(modelElements);
      if (this.lastModelData !== currentModelData) {
        console.log('🏷️ Found model names:', modelElements);
        this.lastModelData = currentModelData;
        
        // Send model names to backend
        this.sendToBackend('/model-names', {
          models: modelElements,
          timestamp: Date.now()
        });
      }
    } else {
      console.log('🔍 No model names detected. Debug info:', debugInfo);
    }
  }
  
  looksLikeModelName(text) {
    if (!text || text.length < 3 || text.length > 100) return false;
    
    // Common model name patterns
    const modelPatterns = [
      /\b(GPT|Claude|Gemini|Llama|Mistral|Qwen|DeepSeek|Runway|Pika|Suno|Udio|Hailuo|PixVerse|Wan|Luma|Dream|Stable|Midjourney)\b/i,
      /\b\w+\s*\d+(\.\d+)?\s*(Pro|Standard|Turbo|Base|Large|Small|B|M)?\b/i, // Pattern for "Model 2.2 Pro" etc
      /\b\d+(\.\d+)?\s*[BM]\b/i // Pattern for "5B", "7B", "3M" etc
    ];
    
    return modelPatterns.some(pattern => pattern.test(text));
  }

  playVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach((video, index) => {
      video.play().then(() => {
        console.log(`▶️ Playing video ${index + 1}`);
      }).catch(console.error);
    });
  }

  pauseVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach((video, index) => {
      video.pause();
      console.log(`⏸️ Paused video ${index + 1}`);
    });
  }

  createDebugUI() {
    // Create a debug panel in the top-right corner
    const debugPanel = document.createElement('div');
    debugPanel.id = 'arena-extension-debug';
    debugPanel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      max-height: 400px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 10px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      overflow-y: auto;
      border: 2px solid #333;
    `;
    
    debugPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px;">🎬 Arena Extension Debug</div>
      <div id="debug-content">Waiting for model detection...</div>
    `;
    
    document.body.appendChild(debugPanel);
  }

  updateDebugUI(modelElements, debugInfo) {
    const debugContent = document.getElementById('debug-content');
    if (!debugContent) return;
    
    let content = '';
    
    if (modelElements.length > 0) {
      content += '<div style="color: #4CAF50; font-weight: bold;">✅ Models Found:</div>';
      modelElements.forEach(model => {
        const color = model.preference === 'preferred' ? '#4CAF50' : '#f44336';
        content += `<div style="color: ${color};">• ${model.name} (${model.preference})</div>`;
      });
    } else {
      content += '<div style="color: #ff9800;">⚠️ No models detected</div>';
    }
    
    content += '<br><div style="color: #ccc; font-size: 10px;">Debug Info:</div>';
    debugInfo.slice(0, 10).forEach(info => {
      content += `<div style="color: #888; font-size: 10px;">${info}</div>`;
    });
    
    content += `<br><div style="color: #666; font-size: 10px;">Last updated: ${new Date().toLocaleTimeString()}</div>`;
    
    debugContent.innerHTML = content;
  }
}

// Initialize the extractor
const videoExtractor = new VideoExtractor();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract_videos') {
    videoExtractor.extractAndSendVideos();
    sendResponse({ success: true });
  }
});