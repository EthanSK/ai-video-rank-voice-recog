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
        this.setLastVoiceCommand(command.data.preference);
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
        
        // Start IMMEDIATE high frequency polling BEFORE clicking
        this.startUltraHighFrequencyPolling();
        button.click();
        return;
      } else if (preference === 'bottom' && (hasRightArrow || text.includes('right') || text.includes('second'))) {
        console.log('✅ Clicking bottom/right preference button');
        
        // Start IMMEDIATE high frequency polling BEFORE clicking
        this.startUltraHighFrequencyPolling();
        button.click();
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

  startUltraHighFrequencyPolling() {
    console.log('🚀🚀 Starting ULTRA high frequency polling for model names...');
    
    // Clear any existing polling
    if (this.voteDetectionInterval) {
      clearInterval(this.voteDetectionInterval);
    }
    if (this.ultraVoteDetectionInterval) {
      clearInterval(this.ultraVoteDetectionInterval);
    }
    
    // Poll every 50ms for 5 seconds immediately after clicking
    let pollCount = 0;
    this.ultraVoteDetectionInterval = setInterval(() => {
      this.extractAndSendModelNames();
      pollCount++;
      
      // Stop after 5 seconds (100 polls)
      if (pollCount >= 100) {
        clearInterval(this.ultraVoteDetectionInterval);
        this.ultraVoteDetectionInterval = null;
        console.log('🛑 Stopped ultra high frequency polling');
        
        // Fall back to regular high frequency polling
        this.startHighFrequencyPolling();
      }
    }, 50);
  }

  extractAndSendModelNames() {
    // Look for model names that appear after voting
    // Based on Playwright investigation, model names appear in simple text elements briefly after voting
    const modelElements = [];
    const debugInfo = [];
    
    // SUPER AGGRESSIVE: Search ALL text elements for model names
    const allElements = document.querySelectorAll('*');
    let foundAnyModelText = false;
    
    allElements.forEach(element => {
      const text = element.textContent?.trim();
      
      // Skip if element has child elements (we want leaf text nodes)
      if (!text || element.children.length > 0) return;
      
      if (this.looksLikeModelName(text)) {
        foundAnyModelText = true;
        
        // Try to determine preference based on position/context
        const rect = element.getBoundingClientRect();
        const isLeftSide = rect.left < window.innerWidth / 2;
        
        // Look at parent elements for clues about preference
        let preference = 'unknown';
        let currentEl = element;
        while (currentEl && currentEl.parentElement) {
          const parentText = currentEl.parentElement.textContent?.toLowerCase() || '';
          const classList = currentEl.parentElement.className?.toLowerCase() || '';
          
          // Check if this element appears after voting (common indicators)
          if (classList.includes('green') || classList.includes('success') || classList.includes('preferred')) {
            preference = 'preferred';
            break;
          } else if (classList.includes('red') || classList.includes('error') || classList.includes('not-preferred')) {
            preference = 'not-preferred';
            break;
          }
          
          currentEl = currentEl.parentElement;
        }
        
        // If we can't determine preference from classes, use position heuristic
        // The user clicks left (top) or right (bottom), so we can infer from most recent click
        if (preference === 'unknown') {
          // Since we detect immediately after clicking, assume left=preferred for left click, right=preferred for right click
          // This is imperfect but better than nothing
          preference = isLeftSide ? 'left-side' : 'right-side';
        }
        
        modelElements.push({
          name: text,
          preference: preference,
          type: 'detected',
          position: `${rect.left.toFixed(0)}, ${rect.top.toFixed(0)}`,
          element: element.tagName + (element.className ? '.' + element.className : '')
        });
        
        debugInfo.push(`FOUND MODEL: "${text}" at ${rect.left.toFixed(0)}, ${rect.top.toFixed(0)} (${element.tagName})`);
      }
    });
    
    // If we found model names, try to be smarter about which is preferred
    if (modelElements.length === 2) {
      // When there are exactly 2 models, we can make better inferences
      // The most recent voice command determines which should be "preferred"
      if (this.lastVoiceCommand === 'top' || this.lastVoiceCommand === 'left') {
        // Top/left click - left model is preferred
        modelElements.forEach(model => {
          const isLeft = parseFloat(model.position.split(',')[0]) < window.innerWidth / 2;
          model.preference = isLeft ? 'preferred' : 'not-preferred';
        });
      } else if (this.lastVoiceCommand === 'bottom' || this.lastVoiceCommand === 'right') {
        // Bottom/right click - right model is preferred  
        modelElements.forEach(model => {
          const isLeft = parseFloat(model.position.split(',')[0]) < window.innerWidth / 2;
          model.preference = isLeft ? 'not-preferred' : 'preferred';
        });
      }
    }
    
    debugInfo.push(`Total elements scanned: ${allElements.length}`);
    debugInfo.push(`Found any model text: ${foundAnyModelText}`);
    
    // Update debug UI
    this.updateDebugUI(modelElements, debugInfo);
    
    // Always send if we found model names - don't check for duplicates during rapid polling
    if (modelElements.length > 0) {
      console.log('🏷️ FOUND MODEL NAMES:', modelElements);
      
      // Send model names to backend
      this.sendToBackend('/model-names', {
        models: modelElements,
        timestamp: Date.now()
      });
    }
  }
  
  // Store the last voice command so we can infer preference
  setLastVoiceCommand(command) {
    this.lastVoiceCommand = command;
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