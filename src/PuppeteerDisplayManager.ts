import puppeteer, { Browser, Page } from 'puppeteer';

export class PuppeteerDisplayManager {
  private browser: Browser | null = null;
  private topPage: Page | null = null;
  private bottomPage: Page | null = null;
  private currentTopUrl: string = '';
  private currentBottomUrl: string = '';
  private isPaused: boolean = false;
  
  async initialize(): Promise<void> {
    console.log('🚀 Launching Puppeteer for video display...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    // Create video page 1
    this.topPage = await this.browser.newPage();
    await this.topPage.evaluate(() => {
      document.title = '1';
    });
    
    // Create video page 2
    this.bottomPage = await this.browser.newPage();
    await this.bottomPage.evaluate(() => {
      document.title = '2';
    });
    
    // Load initial waiting pages
    await this.showWaitingState();
    
    console.log('✅ Puppeteer video display ready');
  }
  
  async updateVideos(topVideoUrl: string, bottomVideoUrl: string, prompt: string): Promise<void> {
    // Only update if URLs have actually changed to prevent unnecessary reloads
    if (topVideoUrl === this.currentTopUrl && bottomVideoUrl === this.currentBottomUrl) {
      return;
    }
    
    console.log('🎬 Updating videos with new URLs');
    this.currentTopUrl = topVideoUrl;
    this.currentBottomUrl = bottomVideoUrl;
    
    // Recreate pages if they were closed
    if (!this.browser) return;
    if (!this.topPage || this.topPage.isClosed()) {
      this.topPage = await this.browser.newPage();
      await this.topPage.evaluate(() => { document.title = '1'; });
    }
    if (!this.bottomPage || this.bottomPage.isClosed()) {
      this.bottomPage = await this.browser.newPage();
      await this.bottomPage.evaluate(() => { document.title = '2'; });
    }
    
    // Update page 1
    if (topVideoUrl && topVideoUrl.trim()) {
      await this.loadVideoPage(this.topPage, topVideoUrl, '1', prompt);
    } else {
      // Load waiting page that will poll for data
      await this.loadVideoPage(this.topPage, '', '1', 'Trying to connect to extension...');
    }
    
    // Update page 2
    if (bottomVideoUrl && bottomVideoUrl.trim()) {
      await this.loadVideoPage(this.bottomPage, bottomVideoUrl, '2', prompt);
    } else {
      // Load waiting page that will poll for data
      await this.loadVideoPage(this.bottomPage, '', '2', 'Trying to connect to extension...');
    }
    
    // Auto-play videos after loading if not paused
    if (!this.isPaused) {
      console.log('▶️ Auto-playing new videos');
      setTimeout(async () => {
        await this.playVideos();
      }, 1000);
    }
  }
  
  private async loadVideoPage(page: Page, videoUrl: string, title: string, prompt: string) {
    // Show prompt in both windows now
    const showPrompt = true;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>${title}</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              
              body {
                  background: #000;
                  color: #fff;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  display: flex;
                  flex-direction: column;
                  height: 100vh;
                  overflow: hidden;
              }
              
              .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  padding: 10px;
                  text-align: center;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                  min-height: fit-content;
              }
              
              .title {
                  font-size: 2rem;
                  font-weight: bold;
                  margin-bottom: ${showPrompt ? '8px' : '0'};
                  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
              }
              
              .prompt {
                  font-size: 0.9rem;
                  opacity: 0.9;
                  max-width: 800px;
                  margin: 0 auto;
                  line-height: 1.2;
                  background: rgba(0,0,0,0.2);
                  padding: 8px;
                  border-radius: 8px;
                  border: 1px solid rgba(255,255,255,0.1);
              }
              
              .video-container {
                  flex: 1;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  padding: 5px;
                  background: radial-gradient(circle at center, #1a1a1a 0%, #000 100%);
              }
              
              video {
                  max-width: 95%;
                  max-height: 95%;
                  width: auto;
                  height: auto;
                  border-radius: 15px;
                  box-shadow: 0 8px 40px rgba(0,0,0,0.6);
                  object-fit: contain;
              }
              
              .controls {
                  position: fixed;
                  bottom: 20px;
                  left: 50%;
                  transform: translateX(-50%);
                  background: rgba(0,0,0,0.8);
                  padding: 10px 20px;
                  border-radius: 25px;
                  display: flex;
                  gap: 10px;
              }
              
              button {
                  background: #667eea;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 20px;
                  cursor: pointer;
                  font-size: 14px;
                  transition: all 0.3s ease;
              }
              
              button:hover {
                  background: #5a67d8;
                  transform: translateY(-2px);
              }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="title">${title}</div>
              ${showPrompt ? `<div class="prompt">${prompt}</div>` : ''}
          </div>
          
          <div class="video-container">
              ${videoUrl && videoUrl.trim() ? `
              <video controls muted loop playsinline crossorigin="anonymous" id="mainVideo">
                  <source src="${videoUrl}" type="video/webm">
                  <source src="${videoUrl}" type="video/mp4">
                  Your browser does not support the video tag.
              </video>
              ` : `
              <div style="opacity:0.8; font-size: 1.1rem;">Waiting for video...</div>
              `}
          </div>
          
          <div class="controls">
              <button onclick="togglePlay()">⏯️ Play/Pause</button>
              <button onclick="restartVideo()">🔄 Restart</button>
              <button onclick="toggleMute()">🔊 Mute/Unmute</button>
          </div>
          
          <script>
              const video = document.getElementById('mainVideo');
              const windowNumber = '${title}';
              let pollCount = 0;
              let hasVideoData = ${videoUrl ? 'true' : 'false'};
              
              function togglePlay() {
                  if (!video) return;
                  if (video.paused) {
                      video.play();
                  } else {
                      video.pause();
                  }
              }
              
              function restartVideo() {
                  if (!video) return;
                  video.currentTime = 0;
                  video.play();
              }
              
              function toggleMute() {
                  if (!video) return;
                  video.muted = !video.muted;
              }
              
              // Poll backend for video data if we don't have any
              async function pollForVideoData() {
                  if (hasVideoData) return; // Stop polling if we already have video data
                  
                  pollCount++;
                  
                  // Determine polling frequency: fast for first minute, then slower
                  let nextPollDelay;
                  if (pollCount <= 60) {
                      // First minute: poll every second
                      nextPollDelay = 1000;
                      console.log(\`[Window \${windowNumber}] Fast polling attempt \${pollCount} for video data...\`);
                  } else {
                      // After first minute: poll every 5 seconds to avoid memory leaks
                      nextPollDelay = 5000;
                      if (pollCount % 12 === 1) { // Only log every minute (12 attempts * 5s = 60s)
                          console.log(\`[Window \${windowNumber}] Slow polling (attempt \${pollCount})...\`);
                      }
                  }
                  
                  try {
                      const response = await fetch('http://localhost:7777/status');
                      if (response.ok) {
                          // Request page state to trigger extension to send video data
                          await fetch('http://localhost:7777/request-page-state', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ source: 'puppeteer-window-' + windowNumber })
                          });
                      }
                  } catch (error) {
                      if (pollCount <= 60 || pollCount % 12 === 1) {
                          console.log(\`[Window \${windowNumber}] Backend not available: \${error.message}\`);
                      }
                  }
                  
                  // Switch to slow polling after 1 minute but NEVER stop completely
                  if (pollCount === 60) {
                      console.log(\`[Window \${windowNumber}] Switching to slow polling (every 5s) - will continue forever\`);
                      
                      // Update UI to show we're still trying but less aggressively
                      const headerDiv = document.querySelector('.header .prompt');
                      if (headerDiv) {
                          headerDiv.textContent = 'Still waiting for video data (slow polling)...';
                      }
                  }
                  
                  // Continue polling forever (but slower after 1 minute)
                  setTimeout(pollForVideoData, nextPollDelay);
              }
              
              // Auto-play videos when they load (unless explicitly paused)
              if (video) {
                  video.addEventListener('loadeddata', () => {
                      // Only auto-play if not in paused state
                      if (!video.dataset.isPaused) {
                          video.play().catch(() => {
                              console.log('Auto-play blocked, user interaction may be required');
                          });
                      }
                  });
              }
              
              // Start polling if we don't have video data
              if (!hasVideoData) {
                  console.log(\`[Window \${windowNumber}] No video data, starting to poll backend...\`);
                  setTimeout(pollForVideoData, 2000); // Start after 2 seconds
              } else {
                  console.log(\`[Window \${windowNumber}] Already has video data, no polling needed\`);
              }
          </script>
      </body>
      </html>
    `;
    
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    
    // Set the pause state for the video
    if (this.isPaused) {
      await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          video.dataset.isPaused = 'true';
          video.pause();
        }
      });
    } else {
      await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          delete video.dataset.isPaused;
        }
      });
    }
  }
  
  private async showWaitingState() {
    if (!this.topPage || !this.bottomPage) return;
    
    await this.loadVideoPage(this.topPage, '', '1', 'Waiting for video data from extension...');
    await this.loadVideoPage(this.bottomPage, '', '2', 'Waiting for video data from extension...');
  }
  
  async playVideos(): Promise<void> {
    if (!this.topPage || !this.bottomPage) return;
    
    console.log('▶️ Playing videos');
    this.isPaused = false;
    
    await Promise.all([
      this.topPage.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          delete video.dataset.isPaused;
          video.play();
        }
      }),
      this.bottomPage.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          delete video.dataset.isPaused;
          video.play();
        }
      })
    ]);
  }
  
  async pauseVideos(): Promise<void> {
    if (!this.topPage || !this.bottomPage) return;
    
    console.log('⏸️ Pausing videos');
    this.isPaused = true;
    
    await Promise.all([
      this.topPage.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          video.dataset.isPaused = 'true';
          video.pause();
        }
      }),
      this.bottomPage.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          video.dataset.isPaused = 'true';
          video.pause();
        }
      })
    ]);
  }
  
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🧹 Puppeteer browser closed');
    }
  }
}