import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import os from 'os';

export class BrowserDisplayManager {
  private topHtmlPath: string;
  private bottomHtmlPath: string;
  private topProcess: any = null;
  private bottomProcess: any = null;

  constructor() {
    this.topHtmlPath = path.join(os.tmpdir(), 'top-video.html');
    this.bottomHtmlPath = path.join(os.tmpdir(), 'bottom-video.html');
  }

  async initialize(): Promise<void> {
    console.log('🖥️ Initializing browser display manager...');
    
    // Create initial HTML files
    this.createHtmlFile(this.topHtmlPath, '', 'TOP', 'Waiting for video data from extension...');
    this.createHtmlFile(this.bottomHtmlPath, '', 'BOTTOM', 'Waiting for video data from extension...');
    
    console.log('📄 Created initial display files');
  }

  async updateVideos(topVideoUrl: string, bottomVideoUrl: string, prompt: string): Promise<void> {
    console.log('🎬 Updating video displays...');
    
    // Update HTML files
    this.createHtmlFile(this.topHtmlPath, topVideoUrl, 'TOP', prompt);
    this.createHtmlFile(this.bottomHtmlPath, bottomVideoUrl, 'BOTTOM', prompt);
    
    // Open in browser windows if not already open
    if (!this.topProcess) {
      this.topProcess = spawn('open', ['-a', 'Google Chrome', '--args', '--new-window', this.topHtmlPath]);
      console.log('🖥️ Opened TOP video window');
    }
    
    if (!this.bottomProcess) {
      // Add delay to avoid opening both windows at exactly the same time
      setTimeout(() => {
        this.bottomProcess = spawn('open', ['-a', 'Google Chrome', '--args', '--new-window', this.bottomHtmlPath]);
        console.log('🖥️ Opened BOTTOM video window');
      }, 1000);
    }
  }

  private createHtmlFile(filePath: string, videoUrl: string, title: string, prompt: string) {
    const html = this.getHtmlTemplate(videoUrl, title, prompt);
    writeFileSync(filePath, html);
  }

  private getHtmlTemplate(videoUrl: string, title: string, prompt: string): string {
    return `
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
              
              .no-video {
                  font-size: 1.2rem;
                  opacity: 0.7;
                  text-align: center;
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
              ${videoUrl ? 
                `<video controls autoplay muted loop>
                    <source src="${videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                 </video>` : 
                '<div class="no-video">Waiting for video...</div>'
              }
          </div>
          
          <div class="controls">
              <button onclick="togglePlay()">⏯️ Play/Pause</button>
              <button onclick="restartVideo()">🔄 Restart</button>
              <button onclick="toggleMute()">🔊 Mute/Unmute</button>
          </div>
          
          <script>
              const video = document.querySelector('video');
              
              function togglePlay() {
                  if (video) {
                      if (video.paused) {
                          video.play();
                      } else {
                          video.pause();
                      }
                  }
              }
              
              function restartVideo() {
                  if (video) {
                      video.currentTime = 0;
                      video.play();
                  }
              }
              
              function toggleMute() {
                  if (video) {
                      video.muted = !video.muted;
                  }
              }
              
              // Auto-refresh when file changes (for development)
              let lastModified = document.lastModified;
              setInterval(() => {
                  if (document.lastModified !== lastModified) {
                      location.reload();
                  }
              }, 1000);
          </script>
      </body>
      </html>
    `;
  }

  async playVideos(): Promise<void> {
    // Since we're using file-based HTML, we can't directly control playback
    // The videos will have controls for manual control
    console.log('▶️ Play command - videos have manual controls');
  }

  async pauseVideos(): Promise<void> {
    // Since we're using file-based HTML, we can't directly control playback
    console.log('⏸️ Pause command - videos have manual controls');
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up display manager...');
    // Browser windows will remain open for user to close manually
  }
}