import { Page } from 'puppeteer';

export class VideoDisplayManager {
  constructor(
    private topVideoPage: Page,
    private bottomVideoPage: Page
  ) {}

  async updateVideos(topVideoUrl: string, bottomVideoUrl: string, prompt: string): Promise<void> {
    const htmlTemplate = (videoUrl: string, title: string, prompt: string) => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  background: #000;
                  color: #fff;
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  overflow: hidden;
                  display: flex;
                  flex-direction: column;
                  height: 100vh;
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
                  max-width: 80%;
                  margin: 0 auto;
                  line-height: 1.4;
              }
              
              .video-container {
                  flex: 1;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 20px;
                  background: radial-gradient(ellipse at center, #1a1a1a 0%, #000 70%);
              }
              
              video {
                  max-width: 100%;
                  max-height: 100%;
                  border-radius: 15px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                  object-fit: contain;
              }
              
              .controls {
                  position: absolute;
                  bottom: 30px;
                  right: 30px;
                  display: flex;
                  gap: 15px;
                  z-index: 100;
              }
              
              .control-btn {
                  background: rgba(255,255,255,0.2);
                  border: 2px solid rgba(255,255,255,0.3);
                  color: #fff;
                  padding: 12px 20px;
                  border-radius: 25px;
                  cursor: pointer;
                  font-size: 1rem;
                  transition: all 0.3s ease;
                  backdrop-filter: blur(10px);
              }
              
              .control-btn:hover {
                  background: rgba(255,255,255,0.3);
                  transform: translateY(-2px);
                  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
              }
              
              .status {
                  position: absolute;
                  top: 20px;
                  left: 20px;
                  background: rgba(0,0,0,0.7);
                  padding: 10px 15px;
                  border-radius: 20px;
                  font-size: 0.9rem;
                  backdrop-filter: blur(5px);
              }
          </style>
      </head>
      <body>
          <div class="status" id="status">Ready</div>
          
          <div class="header">
              <div class="title">${title} VIDEO</div>
              <div class="prompt">${prompt.replace('Prompt: ', '')}</div>
          </div>
          
          <div class="video-container">
              <video id="video" controls autoplay loop muted>
                  <source src="${videoUrl}" type="video/webm">
                  <source src="${videoUrl}" type="video/mp4">
                  Your browser does not support the video tag.
              </video>
          </div>
          
          <div class="controls">
              <button class="control-btn" onclick="togglePlay()">⏯️ Play/Pause</button>
              <button class="control-btn" onclick="restart()">🔄 Restart</button>
          </div>
          
          <script>
              const video = document.getElementById('video');
              const status = document.getElementById('status');
              
              function updateStatus(message) {
                  status.textContent = message;
                  setTimeout(() => {
                      status.textContent = 'Ready';
                  }, 2000);
              }
              
              function togglePlay() {
                  if (video.paused) {
                      video.play();
                      updateStatus('Playing');
                  } else {
                      video.pause();
                      updateStatus('Paused');
                  }
              }
              
              function restart() {
                  video.currentTime = 0;
                  video.play();
                  updateStatus('Restarted');
              }
              
              // Global functions for external control
              window.playVideo = function() {
                  video.play();
                  updateStatus('Playing (Voice Command)');
              };
              
              window.pauseVideo = function() {
                  video.pause();
                  updateStatus('Paused (Voice Command)');
              };
              
              video.addEventListener('loadstart', () => updateStatus('Loading...'));
              video.addEventListener('canplay', () => updateStatus('Ready to play'));
              video.addEventListener('ended', () => updateStatus('Ended'));
              video.addEventListener('error', (e) => updateStatus('Error loading video'));
              
              console.log('${title} video player initialized');
          </script>
      </body>
      </html>
    `;

    try {
      // Update top video page
      await this.topVideoPage.setContent(htmlTemplate(topVideoUrl, 'TOP', prompt), {
        waitUntil: 'networkidle0'
      });

      // Update bottom video page
      await this.bottomVideoPage.setContent(htmlTemplate(bottomVideoUrl, 'BOTTOM', prompt), {
        waitUntil: 'networkidle0'
      });

      console.log('🖥️ Video displays updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to update video displays:', error);
    }
  }

  async playVideos(): Promise<void> {
    try {
      await Promise.all([
        this.topVideoPage.evaluate(() => (window as any).playVideo()),
        this.bottomVideoPage.evaluate(() => (window as any).playVideo())
      ]);
    } catch (error) {
      console.error('❌ Failed to play videos:', error);
    }
  }

  async pauseVideos(): Promise<void> {
    try {
      await Promise.all([
        this.topVideoPage.evaluate(() => (window as any).pauseVideo()),
        this.bottomVideoPage.evaluate(() => (window as any).pauseVideo())
      ]);
    } catch (error) {
      console.error('❌ Failed to pause videos:', error);
    }
  }
}