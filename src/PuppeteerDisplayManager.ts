import puppeteer, { Browser, Page } from 'puppeteer';

export class PuppeteerDisplayManager {
  private browser: Browser | null = null;
  private topPage: Page | null = null;
  private bottomPage: Page | null = null;
  
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
    
    // Create TOP video page
    this.topPage = await this.browser.newPage();
    await this.topPage.evaluate(() => {
      document.title = 'TOP';
    });
    
    // Create BOTTOM video page  
    this.bottomPage = await this.browser.newPage();
    await this.bottomPage.evaluate(() => {
      document.title = 'BOTTOM';
    });
    
    // Load initial waiting pages
    await this.showWaitingState();
    
    console.log('✅ Puppeteer video display ready');
  }
  
  async updateVideos(topVideoUrl: string, bottomVideoUrl: string, prompt: string): Promise<void> {
    // Recreate pages if they were closed
    if (!this.browser) return;
    if (!this.topPage || this.topPage.isClosed()) {
      this.topPage = await this.browser.newPage();
      await this.topPage.evaluate(() => { document.title = 'TOP'; });
    }
    if (!this.bottomPage || this.bottomPage.isClosed()) {
      this.bottomPage = await this.browser.newPage();
      await this.bottomPage.evaluate(() => { document.title = 'BOTTOM'; });
    }
    
    // Update TOP page
    if (topVideoUrl && topVideoUrl.trim()) {
      await this.loadVideoPage(this.topPage, topVideoUrl, 'TOP', prompt);
    }
    
    // Update BOTTOM page
    if (bottomVideoUrl && bottomVideoUrl.trim()) {
      await this.loadVideoPage(this.bottomPage, bottomVideoUrl, 'BOTTOM', prompt);
    }
  }
  
  private async loadVideoPage(page: Page, videoUrl: string, title: string, prompt: string) {
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
                  padding: 20px;
                  text-align: center;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              }
              
              .title {
                  font-size: 2.5rem;
                  font-weight: bold;
                  margin-bottom: 10px;
                  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
              }
              
              .prompt {
                  font-size: 1rem;
                  opacity: 0.9;
                  max-width: 800px;
                  margin: 0 auto;
                  line-height: 1.4;
              }
              
              .video-container {
                  flex: 1;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  padding: 20px;
                  background: radial-gradient(circle at center, #1a1a1a 0%, #000 100%);
              }
              
              video {
                  max-width: 90%;
                  max-height: 90%;
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
              <div class="prompt">${prompt}</div>
          </div>
          
          <div class="video-container">
              ${videoUrl && videoUrl.trim() ? `
              <video controls autoplay muted loop playsinline crossorigin="anonymous" id="mainVideo">
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
              
              if (video) {
                  // Auto-play when loaded
                  video.addEventListener('loadeddata', () => {
                      video.play().catch(() => {
                          // Autoplay might be blocked
                          console.log('Autoplay blocked, user interaction required');
                      });
                  });
              }
          </script>
      </body>
      </html>
    `;
    
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
  }
  
  private async showWaitingState() {
    if (!this.topPage || !this.bottomPage) return;
    
    await this.loadVideoPage(this.topPage, '', 'TOP', 'Waiting for video data from extension...');
    await this.loadVideoPage(this.bottomPage, '', 'BOTTOM', 'Waiting for video data from extension...');
  }
  
  async playVideos(): Promise<void> {
    if (!this.topPage || !this.bottomPage) return;
    
    console.log('▶️ Playing videos');
    
    await Promise.all([
      this.topPage.evaluate(() => {
        const video = document.querySelector('video');
        if (video) video.play();
      }),
      this.bottomPage.evaluate(() => {
        const video = document.querySelector('video');
        if (video) video.play();
      })
    ]);
  }
  
  async pauseVideos(): Promise<void> {
    if (!this.topPage || !this.bottomPage) return;
    
    console.log('⏸️ Pausing videos');
    
    await Promise.all([
      this.topPage.evaluate(() => {
        const video = document.querySelector('video');
        if (video) video.pause();
      }),
      this.bottomPage.evaluate(() => {
        const video = document.querySelector('video');
        if (video) video.pause();
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