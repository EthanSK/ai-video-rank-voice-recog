import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { Browser, Page, BrowserContext } from 'playwright';
import { VideoDisplayManager } from './VideoDisplayManager';
import * as path from 'path';
import * as os from 'os';

// Add stealth plugin
chromium.use(stealth());

export class StealthPlaywrightSystem {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private originalPage: Page | null = null;
  private topVideoPage: Page | null = null;
  private bottomVideoPage: Page | null = null;
  private displayManager: VideoDisplayManager | null = null;
  
  private currentTopVideoUrl: string = '';
  private currentBottomVideoUrl: string = '';
  private currentPrompt: string = '';
  private sessionDir = path.join(os.tmpdir(), 'playwright-session');

  async initialize(): Promise<void> {
    console.log('🚀 Launching stealth Playwright with Cloudflare bypasses...');
    
    // Launch with persistent context for session persistence
    this.context = await chromium.launchPersistentContext(this.sessionDir, {
      headless: false,
      viewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--start-maximized',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages'
      ],
      userAgent: this.getRandomUserAgent(),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['notifications'],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    });

    this.browser = this.context.browser()!;

    // Create pages with stealth modifications
    this.originalPage = await this.createStealthPage();
    this.topVideoPage = await this.createStealthPage();
    this.bottomVideoPage = await this.createStealthPage();

    // Set page titles
    await this.topVideoPage.addInitScript(() => {
      Object.defineProperty(document, 'title', {
        set: () => {},
        get: () => 'TOP'
      });
    });
    
    await this.bottomVideoPage.addInitScript(() => {
      Object.defineProperty(document, 'title', {
        set: () => {},
        get: () => 'BOTTOM'
      });
    });

    // Initialize display manager
    this.displayManager = new VideoDisplayManager(
      this.createPuppeteerLikePage(this.topVideoPage),
      this.createPuppeteerLikePage(this.bottomVideoPage)
    );

    // Navigate with stealth techniques
    await this.stealthNavigation();
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private async createStealthPage(): Promise<Page> {
    const page = await this.context!.newPage();
    
    // Advanced stealth JavaScript injection
    await page.addInitScript(() => {
      // Remove webdriver traces
      delete (navigator as any).webdriver;
      delete (window as any).__webdriver_script_fn;
      delete (window as any).__driver_evaluate;
      delete (window as any).__webdriver_evaluate;
      delete (window as any).__selenium_evaluate;
      delete (window as any).__fxdriver_evaluate;
      delete (window as any).__driver_unwrapped;
      delete (window as any).__webdriver_unwrapped;
      delete (window as any).__selenium_unwrapped;
      delete (window as any).__fxdriver_unwrapped;

      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return {
            0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            2: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
            length: 3
          };
        }
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Mock hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 4 + Math.floor(Math.random() * 4)
      });

      // Mock device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8
      });

      // Mock connection
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50 + Math.floor(Math.random() * 50),
          downlink: 10,
          saveData: false
        })
      });

      // Mock chrome object
      if (!(window as any).chrome) {
        (window as any).chrome = {
          runtime: {
            onConnect: undefined,
            onMessage: undefined
          },
          app: {
            isInstalled: false
          },
          webstore: {
            onInstallStageChanged: undefined,
            onDownloadProgress: undefined
          },
          loadTimes: function() {
            return {
              requestTime: Date.now() * 0.001,
              startLoadTime: Date.now() * 0.001,
              commitLoadTime: Date.now() * 0.001,
              finishDocumentLoadTime: Date.now() * 0.001,
              finishLoadTime: Date.now() * 0.001,
              firstPaintTime: Date.now() * 0.001,
              firstPaintAfterLoadTime: 0,
              navigationType: 'Other',
              wasFetchedViaSpdy: false,
              wasNpnNegotiated: false,
              npnNegotiatedProtocol: 'unknown',
              wasAlternateProtocolAvailable: false,
              connectionInfo: 'unknown'
            };
          },
          csi: function() {
            return {
              startE: Date.now(),
              onloadT: Date.now(),
              pageT: Date.now(),
              tran: 15
            };
          }
        };
      }

      // Mock permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as PermissionStatus) :
          originalQuery(parameters)
      );

      // Override WebGL renderer
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris Pro OpenGL Engine';
        }
        return getParameter.call(this, parameter);
      };

      // Mock screen properties
      Object.defineProperty(screen, 'colorDepth', {
        get: () => 24
      });

      Object.defineProperty(screen, 'pixelDepth', {
        get: () => 24
      });

      // Mock timezone
      try {
        Intl.DateTimeFormat().resolvedOptions = () => ({
          locale: 'en-US',
          calendar: 'gregory',
          numberingSystem: 'latn',
          timeZone: 'America/New_York'
        });
      } catch (e) {}

      // Override toString methods to hide automation
      const originalToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        if (this === navigator.webdriver) {
          return 'function webdriver() { [native code] }';
        }
        return originalToString.call(this);
      };
    });

    return page;
  }

  private async stealthNavigation(): Promise<void> {
    console.log('🌐 Starting stealth navigation...');
    
    if (!this.originalPage) return;

    let retries = 3;
    while (retries > 0) {
      try {
        // Random delay before navigation
        await this.randomDelay(2000, 5000);
        
        // Navigate with realistic timing
        await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        // Check for Cloudflare challenge
        await this.randomDelay(1000, 3000);
        const isChallengePresent = await this.detectCloudflareChallenge();
        
        if (isChallengePresent) {
          console.log('🔍 Cloudflare challenge detected, waiting for completion...');
          await this.handleCloudflareChallenge();
        }

        console.log('✅ Successfully navigated to Artificial Analysis Arena');
        
        // Simulate human behavior
        await this.simulateHumanBehavior();
        
        // Wait before starting video monitoring
        await this.randomDelay(2000, 4000);
        await this.startVideoMonitoring();
        break;
        
      } catch (error) {
        retries--;
        console.error(`❌ Navigation attempt failed:`, error);
        if (retries === 0) {
          console.log('🔧 All navigation attempts failed, using demo content...');
          await this.createDemoContent();
        } else {
          console.log(`⚠️ Retrying navigation... (${retries} attempts left)`);
          await this.randomDelay(10000, 15000);
        }
      }
    }
  }

  private async detectCloudflareChallenge(): Promise<boolean> {
    if (!this.originalPage) return false;

    try {
      const indicators = await this.originalPage.evaluate(() => {
        const title = document.title.toLowerCase();
        const bodyText = document.body?.textContent?.toLowerCase() || '';
        
        return {
          challengeTitle: title.includes('just a moment') || 
                         title.includes('checking your browser') || 
                         title.includes('please wait'),
          challengeText: bodyText.includes('checking your browser') || 
                        bodyText.includes('cloudflare') ||
                        bodyText.includes('ddos protection') ||
                        bodyText.includes('security check'),
          challengeElement: !!document.querySelector('[data-translate="checking_browser"]') ||
                           !!document.querySelector('.cf-browser-verification') ||
                           !!document.querySelector('#cf-challenge-running'),
          captchaFrame: !!document.querySelector('iframe[src*="captcha"]') ||
                       !!document.querySelector('iframe[src*="turnstile"]') ||
                       !!document.querySelector('iframe[src*="hcaptcha"]'),
          cloudflareRay: !!document.querySelector('[data-ray]') ||
                        !!document.querySelector('.ray-id')
        };
      });

      return Object.values(indicators).some(Boolean);
    } catch {
      return false;
    }
  }

  private async handleCloudflareChallenge(): Promise<void> {
    if (!this.originalPage) return;

    const maxWait = 45000; // Wait up to 45 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const isStillChallenge = await this.detectCloudflareChallenge();
      
      if (!isStillChallenge) {
        console.log('✅ Cloudflare challenge completed successfully');
        return;
      }
      
      // Simulate human-like mouse movements during wait
      await this.randomMouseMovement();
      await this.randomDelay(2000, 4000);
    }
    
    throw new Error('Cloudflare challenge timeout - could not complete within 45 seconds');
  }

  private async simulateHumanBehavior(): Promise<void> {
    if (!this.originalPage) return;

    // Random mouse movements
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      await this.randomMouseMovement();
      await this.randomDelay(800, 2000);
    }

    // Random scroll
    await this.originalPage.evaluate(() => {
      const scrollAmount = Math.random() * 300;
      window.scrollBy(0, scrollAmount);
    });
    
    await this.randomDelay(1500, 3000);
    
    // Sometimes scroll back up
    if (Math.random() > 0.5) {
      await this.originalPage.evaluate(() => {
        window.scrollBy(0, -Math.random() * 200);
      });
    }
  }

  private async randomMouseMovement(): Promise<void> {
    if (!this.originalPage) return;

    const viewport = this.originalPage.viewportSize();
    if (!viewport) return;

    const x = 100 + Math.random() * (viewport.width - 200);
    const y = 100 + Math.random() * (viewport.height - 200);
    
    await this.originalPage.mouse.move(x, y);
    await this.randomDelay(100, 500);
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private createPuppeteerLikePage(playwrightPage: Page): any {
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
      console.log('🔍 Looking for videos on the page...');
      
      // Wait for videos with longer timeout
      await this.originalPage.waitForSelector('video', { timeout: 15000 });
      
      const videoData = await this.originalPage.evaluate(() => {
        const videos = document.querySelectorAll('video');
        
        // Look for prompt text in various ways
        let prompt = '';
        const promptSelectors = [
          'p[class*="prompt"]',
          'div[class*="prompt"]',
          '[data-testid*="prompt"]',
          'p'
        ];
        
        for (const selector of promptSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (element.textContent && 
                (element.textContent.includes('Prompt:') || element.textContent.length > 50)) {
              prompt = element.textContent;
              break;
            }
          }
          if (prompt) break;
        }
        
        return {
          videos: Array.from(videos).map(video => ({
            src: video.currentSrc || video.src,
            className: video.className
          })),
          prompt: prompt || 'Video comparison loaded from Artificial Analysis'
        };
      });

      if (videoData.videos.length >= 2) {
        this.currentTopVideoUrl = videoData.videos[0].src;
        this.currentBottomVideoUrl = videoData.videos[1].src;
        this.currentPrompt = videoData.prompt;

        console.log(`🎥 Successfully extracted videos:`);
        console.log(`   TOP: ${this.currentTopVideoUrl}`);
        console.log(`   BOTTOM: ${this.currentBottomVideoUrl}`);
        console.log(`   PROMPT: ${this.currentPrompt.substring(0, 100)}...`);

        // Update display with real videos
        await this.displayManager?.updateVideos(
          this.currentTopVideoUrl,
          this.currentBottomVideoUrl,
          this.currentPrompt
        );
      } else {
        console.log('⚠️ Not enough videos found, using demo content');
        await this.createDemoContent();
      }
      
    } catch (error) {
      console.error('❌ Failed to monitor videos:', error);
      console.log('🔧 Falling back to demo content...');
      await this.createDemoContent();
    }
  }

  private async createDemoContent(): Promise<void> {
    const demoTopVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const demoBottomVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
    const demoPrompt = 'Demo: Stealth Playwright Video Display System';

    console.log('🎬 Setting up demo videos...');
    
    await this.displayManager?.updateVideos(
      demoTopVideo,
      demoBottomVideo,
      demoPrompt
    );

    console.log('✅ Demo videos loaded in TOP and BOTTOM windows');
  }

  async selectPreference(preference: 'top' | 'bottom'): Promise<void> {
    if (!this.originalPage) return;

    try {
      console.log(`🎯 Selecting ${preference} preference...`);
      
      // Human-like delay before action
      await this.randomDelay(1000, 2500);
      
      const buttons = await this.originalPage.locator('button').filter({ 
        hasText: /prefer.*video|←|→/i 
      }).all();
      
      if (buttons.length >= 2) {
        const targetButton = preference === 'top' ? buttons[0] : buttons[1];
        
        // Human-like interaction
        await targetButton.hover();
        await this.randomDelay(300, 700);
        await targetButton.click();
        
        console.log(`✅ Selected ${preference} preference on original site`);
        
        // Wait for next comparison
        setTimeout(() => {
          this.startVideoMonitoring();
        }, 4000);
      } else {
        console.log('⚠️ Preference buttons not found');
      }
      
    } catch (error) {
      console.error(`❌ Failed to select ${preference} preference:`, error);
    }
  }

  async playVideos(): Promise<void> {
    console.log('▶️ Playing videos...');
    await this.displayManager?.playVideos();
  }

  async pauseVideos(): Promise<void> {
    console.log('⏸️ Pausing videos...');
    await this.displayManager?.pauseVideos();
  }

  async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    console.log('🧹 Cleanup completed');
  }
}