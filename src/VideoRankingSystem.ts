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
    // Launch browser with custom debugging port
    const debuggingPort = 9222 + Math.floor(Math.random() * 1000);
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--start-maximized',
        `--remote-debugging-port=${debuggingPort}`
      ],
      ignoreHTTPSErrors: true,
      timeout: 60000,
      protocolTimeout: 60000
    });

    // Create pages
    this.originalPage = await this.browser.newPage();
    this.topVideoPage = await this.browser.newPage();
    this.bottomVideoPage = await this.browser.newPage();

    // Set page titles
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

    // Navigate to the original website with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        console.log('🌐 Navigated to Artificial Analysis Arena');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`⚠️ Navigation failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Initialize voice controller (skip for testing)
    console.log('⚠️ Skipping voice controller initialization for testing...');
    // this.voiceController = new VoiceController();
    // await this.voiceController.initialize();

    // Set up voice command handlers
    // this.setupVoiceCommandHandlers();

    // Monitor for new videos on the original page
    this.startVideoMonitoring();
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
      // Find the preference buttons using more reliable selectors
      const buttons = await this.originalPage.$$('button[class*="prefer"], button:has-text("Prefer this video")');
      
      if (buttons.length >= 2) {
        const targetButton = preference === 'top' ? buttons[0] : buttons[1];
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