// Content script that runs on artificialanalysis.ai
console.log('🎬 AI Video Ranking Extension loaded on:', window.location.href);

class VideoExtractor {
  constructor() {
    this.backendUrl = 'http://localhost:7777';
    this.isConnected = false;
    this.lastModelData = null; // Track last sent model data to prevent spam
    this.lastSentTimestamp = null; // Track when we last sent data
    this.scanCount = 0; // Track number of model detection scans
    this.currentUrl = window.location.href; // Track current URL for navigation detection
    this.currentVotePreference = null; // Track which preference we voted for
    this.checkBackendConnection();
    this.setupVideoMonitoring();
    this.setupCommandPolling();
    this.setupModelNamePolling();
    this.setupNavigationMonitoring();
    // Disabled floating UI - using extension popup instead
    // this.createDebugUI();
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
    console.log(`🎯 Selecting ${preference} preference using keyboard arrows...`);
    
    // Store which preference we're voting for so we can interpret results correctly
    this.currentVotePreference = preference;
    
    // Use keyboard arrow keys to vote (the correct method)
    if (preference === 'top') {
      console.log('✅ Pressing LEFT arrow key for top preference');
      this.simulateKeyPress('ArrowLeft');
    } else if (preference === 'bottom') {
      console.log('✅ Pressing RIGHT arrow key for bottom preference');
      this.simulateKeyPress('ArrowRight');
    }
    
    // Start high frequency polling for model names after voting
    this.startHighFrequencyPolling();
  }

  simulateKeyPress(keyCode) {
    // Create and dispatch a keydown event
    const keyEvent = new KeyboardEvent('keydown', {
      key: keyCode,
      code: keyCode,
      bubbles: true,
      cancelable: true
    });
    
    // Dispatch the event on the document
    document.dispatchEvent(keyEvent);
    
    // Also try dispatching on the body element
    document.body.dispatchEvent(keyEvent);
    
    console.log(`🎹 Simulated ${keyCode} key press`);
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
    }, 100); // 100ms FAST polling to catch brief model name appearances
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
      // PRIMARY: Look for the exact pattern you found
      '.text-green-500.animate-arena-upvote',  // Preferred model (green + upvote)
      '.text-red-500.animate-arena-downvote',  // Non-preferred model (red + downvote)
      
      // SECONDARY: Individual classes
      '.text-green-500',  // Green upvote text
      '.text-red-500',    // Red downvote text  
      '.animate-arena-upvote',
      '.animate-arena-downvote',
      
      // FALLBACK: Broader patterns
      '[class*="upvote"]',
      '[class*="downvote"]',
      '[class*="green-500"]',
      '[class*="red-500"]',
      '[class*="text-green"]',
      '[class*="text-red"]'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      debugInfo.push(`${selector}: ${elements.length} elements`);
      
      elements.forEach(element => {
        const text = element.textContent?.trim();
        const classList = element.className;
        
        debugInfo.push(`  Element: "${text}" (classes: ${classList})`);
        
        if (text && this.looksLikeModelName(text)) {
          // Enhanced detection for the exact pattern you found
          const hasTextGreen500 = classList.includes('text-green-500');
          const hasTextRed500 = classList.includes('text-red-500');
          const hasArenaUpvote = classList.includes('animate-arena-upvote');
          const hasArenaDownvote = classList.includes('animate-arena-downvote');
          
          // Enhanced detection logic
          let preference = 'unknown';
          let type = 'unknown';
          
          // Priority 1: Exact pattern match (text-green-500 + animate-arena-upvote)
          if (hasTextGreen500 && hasArenaUpvote) {
            preference = 'preferred';
            type = 'upvote';
            console.log(`🎯 FOUND PREFERRED MODEL (green+upvote): "${text}"`);
          } else if (hasTextRed500 && hasArenaDownvote) {
            preference = 'not-preferred';
            type = 'downvote';
            console.log(`🎯 FOUND NON-PREFERRED MODEL (red+downvote): "${text}"`);
          }
          // Priority 2: Individual class matches
          else if (hasTextGreen500 || hasArenaUpvote) {
            preference = 'preferred';
            type = 'upvote';
            console.log(`🟢 FOUND GREEN MODEL: "${text}"`);
          } else if (hasTextRed500 || hasArenaDownvote) {
            preference = 'not-preferred';
            type = 'downvote';
            console.log(`🔴 FOUND RED MODEL: "${text}"`);
          }
          // Priority 3: Fallback detection
          else {
            const isGreen = classList.includes('green') || classList.includes('upvote');
            const isRed = classList.includes('red') || classList.includes('downvote');
            
            if (isGreen) {
              preference = 'preferred';
              type = 'upvote';
            } else if (isRed) {
              preference = 'not-preferred';
              type = 'downvote';
            }
          }
          
          if (preference !== 'unknown') {
            modelElements.push({
              name: text,
              preference: preference,
              type: type,
              selector: selector,
              element: isGreen ? 'GREEN UPVOTE' : isRed ? 'RED DOWNVOTE' : 'PARENT DETECTED'
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
    
    // Debug UI removed - using extension popup instead
    // this.updateDebugUI(modelElements, debugInfo);
    
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
        
        // Send model names to backend (with extra logging to debug double calls)
        console.log('📤 SENDING MODEL DATA TO BACKEND:', modelElements);
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
    console.log('🎨 Creating debug UI...');
    
    // Remove any existing debug panel first
    const existingPanel = document.getElementById('arena-extension-debug');
    if (existingPanel) {
      existingPanel.remove();
      console.log('🗑️ Removed existing debug panel');
    }
    
    // Wait for body to be ready
    const createPanel = () => {
      if (!document.body) {
        setTimeout(createPanel, 100);
        return;
      }
      
      // Create a debug panel in the top-right corner with MAXIMUM visibility
      const debugPanel = document.createElement('div');
      debugPanel.id = 'arena-extension-debug';
      
      // Use setAttribute to force styles
      debugPanel.setAttribute('style', `
        position: fixed !important;
        top: 10px !important;
        right: 10px !important;
        width: 400px !important;
        min-height: 200px !important;
        max-height: 600px !important;
        background: rgba(0, 0, 0, 0.98) !important;
        color: #ffffff !important;
        padding: 20px !important;
        border-radius: 12px !important;
        font-family: 'Courier New', monospace !important;
        font-size: 14px !important;
        font-weight: normal !important;
        line-height: 1.4 !important;
        z-index: 2147483647 !important;
        overflow-y: auto !important;
        border: 4px solid #ff0000 !important;
        box-shadow: 0 0 30px rgba(255, 0, 0, 0.8), inset 0 0 10px rgba(255, 0, 0, 0.2) !important;
        pointer-events: auto !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
        margin: 0 !important;
        text-align: left !important;
      `);
      
      debugPanel.innerHTML = `
        <div style="font-weight: bold !important; margin-bottom: 15px !important; color: #ff4444 !important; font-size: 16px !important; text-align: center !important;">
          🎬 ARENA EXTENSION DEBUG 🎬
        </div>
        <div id="debug-content" style="color: #ffffff !important; font-size: 13px !important;">
          🚀 Extension loaded and ready...<br>
          📡 Waiting for backend connection...<br>
          🔍 Model detection will appear here...
        </div>
      `;
      
      // Force append to body
      document.body.appendChild(debugPanel);
      console.log('✅ Debug panel created and added to DOM');
      
      // Verify it's visible
      setTimeout(() => {
        const panel = document.getElementById('arena-extension-debug');
        if (panel && panel.offsetParent !== null) {
          console.log('✅ Debug UI is visible on page');
        } else {
          console.log('❌ Debug UI still not visible, trying again...');
          // Force re-creation
          setTimeout(() => this.createDebugUI(), 2000);
        }
      }, 500);
    };
    
    createPanel();
    
    // Also create it periodically to ensure it stays visible
    setInterval(() => {
      const panel = document.getElementById('arena-extension-debug');
      if (!panel || panel.offsetParent === null) {
        console.log('🔄 Debug UI disappeared, recreating...');
        this.createDebugUI();
      }
    }, 5000);
  }

  updateDebugUI(modelElements, debugInfo) {
    let debugContent = document.getElementById('debug-content');
    
    // If debug content doesn't exist, recreate the whole UI
    if (!debugContent) {
      console.log('🔧 Debug content missing, recreating UI...');
      this.createDebugUI();
      debugContent = document.getElementById('debug-content');
    }
    
    if (!debugContent) {
      console.log('❌ Still no debug content after recreation');
      return;
    }
    
    let content = '';
    
    // Show connection status
    const connectionStatus = this.isConnected ? 
      '<div style="color: #4CAF50; font-weight: bold;">🟢 Backend Connected</div>' :
      '<div style="color: #f44336; font-weight: bold;">🔴 Backend Disconnected</div>';
    
    content += connectionStatus + '<br>';
    
    // Show scan counter with big numbers
    content += `<div style="color: #2196F3; font-weight: bold; font-size: 16px;">🔍 Scans: ${this.scanCount}</div><br>`;
    
    // Show last known model if any
    if (this.lastModelData) {
      try {
        const lastModels = JSON.parse(this.lastModelData);
        const preferredModel = lastModels.find(m => m.preference === 'preferred');
        if (preferredModel) {
          content += `<div style="color: #4CAF50; font-weight: bold; font-size: 15px;">🏷️ LAST KNOWN MODEL:</div>`;
          content += `<div style="color: #4CAF50; font-size: 14px; padding: 5px; background: rgba(76,175,80,0.2); border-radius: 5px; margin: 5px 0;">• ${preferredModel.name}</div><br>`;
        }
      } catch (e) {}
    }
    
    if (modelElements.length > 0) {
      content += '<div style="color: #4CAF50; font-weight: bold; font-size: 15px;">✅ CURRENT MODELS:</div>';
      modelElements.forEach(model => {
        const color = model.preference === 'preferred' ? '#4CAF50' : '#f44336';
        const bgColor = model.preference === 'preferred' ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)';
        content += `<div style="color: ${color}; padding: 5px; background: ${bgColor}; border-radius: 5px; margin: 2px 0;">• ${model.name} (${model.preference})</div>`;
      });
    } else {
      content += '<div style="color: #ff9800; font-size: 14px;">⚠️ No current models detected</div>';
    }
    
    content += '<br><div style="color: #ccc; font-size: 12px; font-weight: bold;">DEBUG INFO:</div>';
    debugInfo.slice(0, 3).forEach(info => {
      content += `<div style="color: #888; font-size: 11px; margin: 2px 0;">${info}</div>`;
    });
    
    content += `<br><div style="color: #666; font-size: 11px; text-align: center;">Last updated: ${new Date().toLocaleTimeString()}</div>`;
    
    debugContent.innerHTML = content;
  }
}

// Initialize the extractor
const videoExtractor = new VideoExtractor();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received message:', request);
  
  if (request.action === 'extract_videos') {
    videoExtractor.extractAndSendVideos();
    sendResponse({ success: true });
  } else if (request.action === 'get_debug_info') {
    // Send back debug information
    const debugData = {
      scanCount: videoExtractor.scanCount,
      isConnected: videoExtractor.isConnected,
      lastModelData: videoExtractor.lastModelData,
      lastSentTimestamp: videoExtractor.lastSentTimestamp,
      currentUrl: videoExtractor.currentUrl,
      timestamp: Date.now()
    };
    
    console.log('📊 Sending debug data to popup:', debugData);
    
    sendResponse({
      success: true,
      debugData: debugData
    });
  }
  
  // Return true to indicate we want to send a response asynchronously
  return true;
});