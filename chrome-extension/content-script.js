// Content script that runs on artificialanalysis.ai
console.log('🎬 AI Video Ranking Extension loaded');

class VideoExtractor {
  constructor() {
    this.websocket = null;
    this.isConnected = false;
    this.connectToBackend();
    this.setupVideoMonitoring();
  }

  connectToBackend() {
    try {
      this.websocket = new WebSocket('ws://localhost:8080');
      
      this.websocket.onopen = () => {
        console.log('✅ Connected to Node.js backend');
        this.isConnected = true;
        this.sendMessage({ type: 'extension_connected' });
      };

      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleBackendMessage(data);
      };

      this.websocket.onclose = () => {
        console.log('❌ Disconnected from backend, retrying in 5s...');
        this.isConnected = false;
        setTimeout(() => this.connectToBackend(), 5000);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to backend:', error);
      setTimeout(() => this.connectToBackend(), 5000);
    }
  }

  sendMessage(data) {
    if (this.isConnected && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(data));
    }
  }

  handleBackendMessage(data) {
    console.log('📨 Message from backend:', data);
    
    switch (data.type) {
      case 'select_preference':
        this.selectPreference(data.preference);
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
    
    if (videos.length >= 2) {
      // Extract video URLs
      const videoData = {
        topVideo: videos[0].currentSrc || videos[0].src,
        bottomVideo: videos[1].currentSrc || videos[1].src,
        prompt: this.extractPrompt(),
        timestamp: Date.now()
      };
      
      console.log('🎬 Extracted video data:', videoData);
      
      this.sendMessage({
        type: 'videos_extracted',
        data: videoData
      });
      
      // Store in extension storage
      chrome.storage.local.set({ lastVideoData: videoData });
    } else {
      console.log('⚠️ Not enough videos found');
      
      // Send empty state
      this.sendMessage({
        type: 'no_videos_found',
        message: 'Waiting for videos to load...'
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