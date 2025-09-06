import puppeteer, { Browser, Page } from 'puppeteer';
import { VideoDisplayManager } from './VideoDisplayManager';

export class PuppeteerRemoteSystem {
  private browser: Browser | null = null;
  private originalPage: Page | null = null;
  private topVideoPage: Page | null = null;
  private bottomVideoPage: Page | null = null;
  private displayManager: VideoDisplayManager | null = null;
  
  private currentTopVideoUrl: string = '';
  private currentBottomVideoUrl: string = '';
  private currentPrompt: string = '';

  async initialize(): Promise<void> {
    console.log('🔗 Connecting to your existing Chrome browser...');
    
    try {
      // Connect to the existing Chrome instance running on port 9222
      this.browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222',
        defaultViewport: null // Use the browser's actual viewport
      });

      console.log('✅ Successfully connected to your Chrome browser!');
      
      // Get existing pages or create new ones
      const pages = await this.browser.pages();
      
      if (pages.length > 0) {
        // Use the first existing page as our main page
        this.originalPage = pages[0];
        console.log('📄 Using existing tab as main navigation page');
      } else {
        // Create a new page if none exist
        this.originalPage = await this.browser.newPage();
        console.log('📄 Created new main navigation page');
      }

      // Create pages for video display
      console.log('📄 Creating TOP video page...');
      this.topVideoPage = await this.browser.newPage();
      await this.topVideoPage.evaluate(() => {
        document.title = 'TOP';
      });
      
      console.log('📄 Creating BOTTOM video page...');
      this.bottomVideoPage = await this.browser.newPage();
      await this.bottomVideoPage.evaluate(() => {
        document.title = 'BOTTOM';
      });

      // Initialize display manager
      this.displayManager = new VideoDisplayManager(this.topVideoPage, this.bottomVideoPage);

      // Navigate to the target site using your real browser session
      console.log('🌐 Navigating to Artificial Analysis with your real browser session...');
      
      try {
        await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        console.log('✅ Successfully navigated to Artificial Analysis Arena');
        
        // Wait for content to load
        await this.originalPage.waitForTimeout(3000);
        
        // Start monitoring for videos
        await this.startVideoMonitoring();
        
      } catch (error) {
        console.error('❌ Failed to navigate to website:', error);
        console.log('🔧 Setting up demo content instead...');
        await this.createDemoContent();
      }
      
    } catch (error) {
      console.error('❌ Failed to connect to Chrome browser:', error);
      console.log('💡 Make sure Chrome is running with: open -a "Google Chrome" --args --remote-debugging-port=9222 --profile-directory="Default"');
      throw error;
    }
  }

  private async startVideoMonitoring(): Promise<void> {
    if (!this.originalPage) return;

    try {
      console.log('🔍 Looking for videos...');
      
      // Wait for videos to load
      await this.originalPage.waitForSelector('video', { timeout: 10000 });
      
      const videoData = await this.originalPage.evaluate(() => {
        const videos = document.querySelectorAll('video');
        
        // Look for prompt text
        let prompt = '';
        const paragraphs = Array.from(document.querySelectorAll('p'));
        for (const p of paragraphs) {
          if (p.textContent && p.textContent.length > 50) {
            prompt = p.textContent;
            break;
          }
        }
        
        return {
          videos: Array.from(videos).map(video => ({
            src: video.currentSrc || video.src,
            className: video.className
          })),
          prompt: prompt || 'Video comparison loaded'
        };
      });

      if (videoData.videos.length >= 2) {
        this.currentTopVideoUrl = videoData.videos[0].src;
        this.currentBottomVideoUrl = videoData.videos[1].src;
        this.currentPrompt = videoData.prompt;

        console.log(`🎥 Found videos:`);
        console.log(`   TOP: ${this.currentTopVideoUrl}`);
        console.log(`   BOTTOM: ${this.currentBottomVideoUrl}`);
        console.log(`   PROMPT: ${this.currentPrompt.substring(0, 100)}...`);

        // Update display
        await this.displayManager?.updateVideos(
          this.currentTopVideoUrl,
          this.currentBottomVideoUrl,
          this.currentPrompt
        );
      } else {
        console.log('⚠️ Not enough videos found, creating demo content');
        await this.createDemoContent();
      }
      
    } catch (error) {
      console.error('❌ Failed to monitor videos:', error);
      console.log('🔧 Setting up demo content instead...');
      await this.createDemoContent();
    }
  }

  private async createDemoContent(): Promise<void> {
    // Use demo video URLs for testing the UI
    const demoTopVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const demoBottomVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
    const demoPrompt = 'Demo: Testing the dual video display system with your real Chrome browser';

    console.log('🎬 Setting up demo videos...');
    
    await this.displayManager?.updateVideos(
      demoTopVideo,
      demoBottomVideo,
      demoPrompt
    );

    console.log('✅ Demo videos loaded in TOP and BOTTOM windows');
    console.log('📱 You can now manually test the UI layout');
  }

  async selectPreference(preference: 'top' | 'bottom'): Promise<void> {
    if (!this.originalPage) return;

    try {
      console.log(`🎯 Selecting ${preference} preference...`);
      
      // Look for preference buttons
      const buttons = await this.originalPage.$$('button');
      
      // Find buttons that might be preference selectors
      let targetButton = null;
      for (const button of buttons) {
        const text = await button.evaluate(el => el.textContent?.toLowerCase() || '');
        if (text.includes('prefer') || text.includes('←') || text.includes('→')) {
          if (preference === 'top' && (text.includes('←') || text.includes('left') || text.includes('first'))) {
            targetButton = button;
            break;
          } else if (preference === 'bottom' && (text.includes('→') || text.includes('right') || text.includes('second'))) {
            targetButton = button;
            break;
          }
        }
      }
      
      if (targetButton) {
        await targetButton.click();
        console.log(`✅ Selected ${preference} preference using your real browser`);
        
        // Wait for next comparison to load
        setTimeout(() => {
          this.startVideoMonitoring();
        }, 3000);
      } else {
        console.log('⚠️ Preference buttons not found');
      }
      
    } catch (error) {
      console.error(`❌ Failed to select ${preference} preference:`, error);
    }
  }

  async playVideos(): Promise<void> {
    await this.displayManager?.playVideos();
  }

  async pauseVideos(): Promise<void> {
    await this.displayManager?.pauseVideos();
  }

  async cleanup(): Promise<void> {
    // Don't close the browser since it's the user's real browser
    // Just disconnect from it
    if (this.browser) {
      this.browser.disconnect();
    }
    console.log('🧹 Disconnected from your Chrome browser');
  }
}