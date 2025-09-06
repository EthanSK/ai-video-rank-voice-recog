// Content script that runs on artificialanalysis.ai
console.log('🎬 AI Video Ranking Extension loaded');

class VideoExtractor {
  constructor() {
    this.backendUrl = 'http://localhost:7777';
    this.isConnected = false;
    this.checkBackendConnection();
    this.setupVideoMonitoring();
    this.setupCommandPolling();
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
        return;
      } else if (preference === 'bottom' && (hasRightArrow || text.includes('right') || text.includes('second'))) {
        console.log('✅ Clicking bottom/right preference button');
        button.click();
        return;
      }
    }
    
    console.log('⚠️ Preference buttons not found');
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