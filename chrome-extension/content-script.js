// Content script that runs on artificialanalysis.ai
console.log('🎬 AI Video Ranking Extension loaded');

class VideoExtractor {
  constructor() {
    this.backendUrl = 'http://localhost:7777';
    this.isConnected = false;
    this.lastModelData = null; // Track last sent model data to prevent spam
    this.lastSentTimestamp = null; // Track when we last sent data
    this.scanCount = 0; // Track number of model detection scans
    this.currentUrl = window.location.href; // Track current URL for navigation detection
    this.checkBackendConnection();
    this.setupVideoMonitoring();
    this.setupCommandPolling();
    this.setupModelNamePolling();
    this.setupNavigationMonitoring();
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
    console.log('🚀 Starting high frequency polling for model names (300ms for 4 seconds)...');
    
    // Clear any existing high frequency polling
    if (this.voteDetectionInterval) {
      clearInterval(this.voteDetectionInterval);
    }
    
    // DON'T reset lastModelData here - we need it for deduplication!
    // this.lastModelData = null;  // REMOVED - this was causing the spam
    
    // Poll every 300ms for 4 seconds (as requested)
    let pollCount = 0;
    const maxPolls = Math.floor(4000 / 300); // 4 seconds / 300ms = ~13 polls
    let modelFoundAndSent = false;
    
    this.voteDetectionInterval = setInterval(() => {
      this.extractAndSendModelNames();
      pollCount++;
      
      // Check if we found and sent models this cycle
      if (this.lastModelData !== null && !modelFoundAndSent) {
        modelFoundAndSent = true;
        console.log('✅ Models detected and sent - continuing polling for remaining time');
      }
      
      // Stop after 4 seconds (13 polls at 300ms)
      if (pollCount >= maxPolls) {
        clearInterval(this.voteDetectionInterval);
        this.voteDetectionInterval = null;
        console.log('🛑 Stopped high frequency polling after 4 seconds');
      }
    }, 300); // 300ms polling as requested
  }

  setupNavigationMonitoring() {
    // Monitor URL changes (for SPA navigation)
    const checkForNavigation = () => {
      const newUrl = window.location.href;
      if (newUrl !== this.currentUrl) {
        console.log('🌐 Navigation detected:', this.currentUrl, '→', newUrl);
        this.currentUrl = newUrl;
        
        // Reset tracking for new page
        this.lastModelData = null;
        this.lastSentTimestamp = null;
        this.scanCount = 0;
        
        // Clear any active polling
        if (this.voteDetectionInterval) {
          clearInterval(this.voteDetectionInterval);
          this.voteDetectionInterval = null;
        }
        
        // Re-initialize video extraction for new page
        setTimeout(() => {
          console.log('🔄 Re-initializing for new comparison...');
          this.extractAndSendVideos();
        }, 1000);
      }
    };
    
    // Check for navigation every 1 second
    setInterval(checkForNavigation, 1000);
    
    // Also listen for popstate events (back/forward buttons)
    window.addEventListener('popstate', () => {
      setTimeout(checkForNavigation, 100);
    });
  }

  extractAndSendModelNames() {
    // Increment scan counter
    this.scanCount++;
    
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
    
    // Update debug UI with scan count
    this.updateDebugUI(modelElements, debugInfo);
    
    // Handle model detection logic
    if (modelElements.length > 0) {
      const currentModelData = JSON.stringify(modelElements);
      const now = Date.now();
      
      // More lenient deduplication - only block if sent within last 2 seconds
      const shouldSend = (this.lastModelData !== currentModelData) || 
                        (!this.lastSentTimestamp || (now - this.lastSentTimestamp) > 2000);
      
      if (shouldSend) {
        console.log('🏷️ NEW MODEL DATA - Sending to backend:', modelElements);
        this.lastModelData = currentModelData;
        this.lastSentTimestamp = now;
        
        // Send model names to backend
        this.sendToBackend('/model-names', {
          models: modelElements,
          timestamp: now
        });
      } else {
        // Same data as before - don't send to prevent spam
        console.log('🔄 Duplicate model data (within 2s), not sending again');
      }
    } else {
      // No models found - but don't reset immediately, might just be a brief gap
      if (this.lastModelData !== null) {
        console.log('🔍 No models detected in this scan');
      }
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
    // Remove any existing debug panel first
    const existingPanel = document.getElementById('arena-extension-debug');
    if (existingPanel) {
      existingPanel.remove();
    }
    
    // Create a debug panel in the top-right corner with more prominent styling
    const debugPanel = document.createElement('div');
    debugPanel.id = 'arena-extension-debug';
    debugPanel.style.cssText = `
      position: fixed !important;
      top: 10px !important;
      right: 10px !important;
      width: 350px !important;
      max-height: 500px !important;
      background: rgba(0, 0, 0, 0.95) !important;
      color: white !important;
      padding: 15px !important;
      border-radius: 10px !important;
      font-family: 'Courier New', monospace !important;
      font-size: 13px !important;
      z-index: 999999 !important;
      overflow-y: auto !important;
      border: 3px solid #ff4444 !important;
      box-shadow: 0 0 20px rgba(255, 68, 68, 0.5) !important;
    `;
    
    debugPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 15px; color: #ff4444; font-size: 14px;">🎬 Arena Extension Debug</div>
      <div id="debug-content">Starting model detection...</div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Make sure it stays visible
    setTimeout(() => {
      if (document.getElementById('arena-extension-debug')) {
        console.log('✅ Debug UI created and visible');
      } else {
        console.log('❌ Debug UI not found, recreating...');
        this.createDebugUI();
      }
    }, 1000);
  }

  updateDebugUI(modelElements, debugInfo) {
    const debugContent = document.getElementById('debug-content');
    if (!debugContent) return;
    
    let content = '';
    
    // Show scan counter
    content += `<div style="color: #2196F3; font-weight: bold;">🔍 Scans: ${this.scanCount}</div><br>`;
    
    // Show last known model if any
    if (this.lastModelData) {
      try {
        const lastModels = JSON.parse(this.lastModelData);
        const preferredModel = lastModels.find(m => m.preference === 'preferred');
        if (preferredModel) {
          content += `<div style="color: #4CAF50; font-weight: bold;">🏷️ Last Known Model:</div>`;
          content += `<div style="color: #4CAF50;">• ${preferredModel.name}</div><br>`;
        }
      } catch (e) {}
    }
    
    if (modelElements.length > 0) {
      content += '<div style="color: #4CAF50; font-weight: bold;">✅ Current Models:</div>';
      modelElements.forEach(model => {
        const color = model.preference === 'preferred' ? '#4CAF50' : '#f44336';
        content += `<div style="color: ${color};">• ${model.name} (${model.preference})</div>`;
      });
    } else {
      content += '<div style="color: #ff9800;">⚠️ No current models detected</div>';
    }
    
    content += '<br><div style="color: #ccc; font-size: 10px;">Debug Info:</div>';
    debugInfo.slice(0, 5).forEach(info => {
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