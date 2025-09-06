import puppeteer, { Browser, Page } from 'puppeteer';
import { VoiceController } from './VoiceController';
import { VideoDisplayManager } from './VideoDisplayManager';

export class VideoRankingSystem {
  private browser: Browser | null = null;
  private originalPage: Page | null = null;
  private topVideoPage: Page | null = null;
  private bottomVideoPage: Page | null = null;
  private voiceController: VoiceController | null = null;
  private displayManager: VideoDisplayManager | null = null;
  
  private currentTopVideoUrl: string = '';
  private currentBottomVideoUrl: string = '';
  private currentPrompt: string = '';

  async initialize(): Promise<void> {
    // Launch browser with simple configuration
    console.log('🚀 Launching simple browser...');
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create simple pages
    this.originalPage = await this.browser.newPage();
    this.topVideoPage = await this.browser.newPage();
    this.bottomVideoPage = await this.browser.newPage();

    // Set simple page titles
    await this.topVideoPage.evaluateOnNewDocument(() => {
      document.title = 'TOP';
    });
    
    await this.bottomVideoPage.evaluateOnNewDocument(() => {
      document.title = 'BOTTOM';
    });

    // Initialize display manager
    this.displayManager = new VideoDisplayManager(
      this.topVideoPage,
      this.bottomVideoPage
    );

    console.log('⚠️ Skipping navigation to Cloudflare-protected site for now...');
    console.log('🔧 Set up demo videos in custom UI instead...');
    
    // For now, create demo content to test the UI
    await this.createDemoContent();

    // Initialize voice controller (skip for testing)
    console.log('⚠️ Skipping voice controller initialization for testing...');
  }

  private async createDemoContent(): Promise<void> {
    // Use demo video URLs for testing the UI
    const demoTopVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const demoBottomVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
    const demoPrompt = 'Demo: Testing the dual video display system';

    console.log('🎬 Setting up demo videos...');
    
    await this.displayManager?.updateVideos(
      demoTopVideo,
      demoBottomVideo,
      demoPrompt
    );

    console.log('✅ Demo videos loaded in TOP and BOTTOM windows');
    console.log('📱 You can now manually test the UI layout');
  }

  private setupVoiceCommandHandlers(): void {
    if (!this.voiceController) return;

    this.voiceController.onCommand('top', async () => {
      console.log('🔝 Voice command: TOP');
      await this.selectPreference('top');
    });

    this.voiceController.onCommand('bottom', async () => {
      console.log('🔽 Voice command: BOTTOM');
      await this.selectPreference('bottom');
    });

    this.voiceController.onCommand('play', async () => {
      console.log('▶️ Voice command: PLAY');
      await this.displayManager?.playVideos();
    });

    this.voiceController.onCommand('pause', async () => {
      console.log('⏸️ Voice command: PAUSE');
      await this.displayManager?.pauseVideos();
    });
  }

  private async selectPreference(preference: 'top' | 'bottom'): Promise<void> {
    if (!this.originalPage) return;

    try {
      // Human-like delay before action
      await this.randomDelay(500, 1500);
      
      // Find the preference buttons using more reliable selectors
      const buttons = await this.originalPage.$$('button[class*="prefer"], button:has-text("Prefer this video")');
      
      if (buttons.length >= 2) {
        const targetButton = preference === 'top' ? buttons[0] : buttons[1];
        
        // Simulate human-like clicking
        await targetButton.hover();
        await this.randomDelay(200, 500);
        await targetButton.click();
        
        console.log(`✅ Selected ${preference} preference on original site`);
        
        // Wait a bit for the next comparison to load
        setTimeout(() => {
          this.startVideoMonitoring();
        }, 3000);
      } else {
        console.log('⚠️ Preference buttons not found, trying alternative selectors...');
        
        // Try alternative approach by looking for the arrow symbols
        const arrowButtons = await this.originalPage.$$eval('button', (buttons) => {
          return buttons.filter(btn => 
            btn.textContent?.includes('←') || btn.textContent?.includes('→')
          );
        });
        
        if (arrowButtons.length >= 2) {
          const selector = preference === 'top' 
            ? 'button:has-text("←")' 
            : 'button:has-text("→")';
          await this.originalPage.click(selector);
          console.log(`✅ Selected ${preference} preference using arrow selector`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to select ${preference} preference:`, error);
    }
  }

  private async startVideoMonitoring(): Promise<void> {
    if (!this.originalPage) return;

    try {
      // Wait for videos to load and extract their URLs
      await this.originalPage.waitForSelector('video', { timeout: 10000 });
      
      const videoData = await this.originalPage.evaluate(() => {
        const videos = document.querySelectorAll('video');
        
        // Look for prompt text in various ways
        let prompt = '';
        const promptSelectors = [
          'p[class*="prompt"]',
          'div[class*="prompt"]',
          '*:contains("Prompt:")',
          'p'
        ];
        
        for (const selector of promptSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent?.includes('Prompt:')) {
            prompt = element.textContent;
            break;
          }
        }
        
        // If no prompt found with "Prompt:", look for paragraph with substantial text
        if (!prompt) {
          const paragraphs = Array.from(document.querySelectorAll('p'));
          for (const p of paragraphs) {
            if (p.textContent && p.textContent.length > 50) {
              prompt = p.textContent;
              break;
            }
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
      }
    } catch (error) {
      console.error('❌ Failed to monitor videos:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (this.voiceController) {
      await this.voiceController.cleanup();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    console.log('🧹 Cleanup completed');
  }
}