import { chromium, Browser, Page } from 'playwright';
import { VideoDisplayManager } from './VideoDisplayManager';

export class PlaywrightVideoSystem {
  private browser: Browser | null = null;
  private originalPage: Page | null = null;
  private topVideoPage: Page | null = null;
  private bottomVideoPage: Page | null = null;
  private displayManager: VideoDisplayManager | null = null;
  
  private currentTopVideoUrl: string = '';
  private currentBottomVideoUrl: string = '';
  private currentPrompt: string = '';

  async initialize(): Promise<void> {
    console.log('🚀 Launching Playwright browser...');
    
    // Launch browser
    this.browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create browser context
    const context = await this.browser.newContext({
      viewport: null, // Use full viewport
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Create pages
    this.originalPage = await context.newPage();
    this.topVideoPage = await context.newPage();
    this.bottomVideoPage = await context.newPage();

    // Set page titles
    await this.topVideoPage.addInitScript(() => {
      document.title = 'TOP';
    });
    
    await this.bottomVideoPage.addInitScript(() => {
      document.title = 'BOTTOM';
    });

    // Initialize display manager (convert Playwright pages to Puppeteer-like interface)
    this.displayManager = new VideoDisplayManager(
      this.createPuppeteerLikePage(this.topVideoPage),
      this.createPuppeteerLikePage(this.bottomVideoPage)
    );

    // Navigate to the website
    console.log('🌐 Navigating to Artificial Analysis...');
    
    try {
      await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      console.log('✅ Successfully navigated to Artificial Analysis Arena');
      
      // Wait a bit for any dynamic content to load
      await this.originalPage.waitForTimeout(3000);
      
      // Start monitoring for videos
      await this.startVideoMonitoring();
      
    } catch (error) {
      console.error('❌ Failed to navigate to website:', error);
      console.log('🔧 Setting up demo content instead...');
      await this.createDemoContent();
    }
  }

  private createPuppeteerLikePage(playwrightPage: Page): any {
    // Create a minimal adapter to make Playwright pages work with our VideoDisplayManager
    return {
      setContent: async (html: string, options?: any) => {
        return playwrightPage.setContent(html, options);
      },
      evaluate: async (pageFunction: any) => {
        return playwrightPage.evaluate(pageFunction);
      }
    };
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
    const demoPrompt = 'Demo: Testing the dual video display system with Playwright';

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
      const buttons = await this.originalPage.locator('button').filter({ 
        hasText: /prefer.*video|←|→/i 
      }).all();
      
      if (buttons.length >= 2) {
        const targetButton = preference === 'top' ? buttons[0] : buttons[1];
        await targetButton.click();
        console.log(`✅ Selected ${preference} preference on original site`);
        
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
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🧹 Cleanup completed');
  }
}