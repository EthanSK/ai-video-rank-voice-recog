import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { VideoDisplayManager } from './VideoDisplayManager';
import * as path from 'path';
import * as os from 'os';

export class UltraStealthSystem {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private originalPage: Page | null = null;
  private topVideoPage: Page | null = null;
  private bottomVideoPage: Page | null = null;
  private displayManager: VideoDisplayManager | null = null;
  
  private currentTopVideoUrl: string = '';
  private currentBottomVideoUrl: string = '';
  private currentPrompt: string = '';

  async initialize(): Promise<void> {
    console.log('🚀 Launching ULTRA stealth mode - maximum evasion...');
    
    // Use a real Chrome installation if available
    const chromeExecutables = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser'
    ];

    let executablePath = undefined;
    for (const path of chromeExecutables) {
      try {
        const fs = require('fs');
        if (fs.existsSync(path)) {
          executablePath = path;
          break;
        }
      } catch (e) {}
    }

    this.browser = await chromium.launch({
      headless: false,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-plugins-discovery',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--no-default-browser-check',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-component-extensions-with-background-pages',
        '--start-maximized',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      ],
      ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection']
    });

    // Create context with maximum stealth
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['notifications', 'geolocation'],
      javaScriptEnabled: true,
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    });

    // Create pages with realistic human timing
    console.log('📄 Creating first page...');
    this.originalPage = await this.createMaxStealthPage();
    
    // Wait like a human would before opening more tabs
    console.log('⏳ Waiting before opening second tab...');
    await this.randomDelay(3000, 8000);
    
    console.log('📄 Creating TOP video page...');
    this.topVideoPage = await this.createMaxStealthPage();
    
    console.log('⏳ Waiting before opening third tab...');  
    await this.randomDelay(2000, 5000);
    
    console.log('📄 Creating BOTTOM video page...');
    this.bottomVideoPage = await this.createMaxStealthPage();

    // Set titles
    await this.topVideoPage.addInitScript(() => {
      document.title = 'TOP';
    });
    
    await this.bottomVideoPage.addInitScript(() => {
      document.title = 'BOTTOM';
    });

    // Initialize display manager
    console.log('🎬 Initializing video display system...');
    this.displayManager = new VideoDisplayManager(
      this.createPuppeteerLikePage(this.topVideoPage),
      this.createPuppeteerLikePage(this.bottomVideoPage)
    );

    // Wait a bit more before starting navigation (let tabs settle)
    console.log('⏳ Letting browser settle before navigation...');
    await this.randomDelay(5000, 10000);

    // Try multiple navigation strategies
    await this.multiStrategyNavigation();
  }

  private async createMaxStealthPage(): Promise<Page> {
    const page = await this.context!.newPage();

    // ULTRA stealth injection - executed before any page loads
    await page.addInitScript(() => {
      // Completely remove automation traces
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      delete (window as any).__webdriver_script_fn;
      delete (window as any).__webdriver_script_func;
      delete (window as any).__webdriver_script_function;
      delete (window as any).__fxdriver_id;
      delete (window as any).__fxdriver_evaluate;
      delete (window as any).__driver_unwrapped;
      delete (window as any).__webdriver_unwrapped;
      delete (window as any).__driver_evaluate;
      delete (window as any).__selenium_evaluate;
      delete (window as any).__webdriver_evaluate;
      delete (navigator as any).webdriver;

      // Redefine webdriver property to be completely invisible
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        set: () => {},
        configurable: false,
        enumerable: false
      });

      // Mock realistic Chrome properties
      Object.defineProperty(navigator, 'plugins', {
        get: () => ({
          0: {
            0: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: null },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          },
          1: {
            0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "", enabledPlugin: null },
            description: "",
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer"
          },
          2: {
            0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable", enabledPlugin: null },
            1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable", enabledPlugin: null },
            description: "",
            filename: "internal-nacl-plugin",
            length: 2,
            name: "Native Client"
          },
          length: 3,
          refresh: () => {}
        })
      });

      // Mock perfect Chrome runtime
      (window as any).chrome = {
        app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
        runtime: { 
          OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
          OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
          PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
          RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }
        },
        webstore: { onInstallStageChanged: {}, onDownloadProgress: {} },
        loadTimes: () => ({
          requestTime: performance.now(),
          startLoadTime: performance.now(),
          commitLoadTime: performance.now(),
          finishDocumentLoadTime: performance.now(),
          finishLoadTime: performance.now(),
          firstPaintTime: performance.now(),
          firstPaintAfterLoadTime: performance.now(),
          navigationType: 'Other',
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false,
          npnNegotiatedProtocol: 'unknown',
          wasAlternateProtocolAvailable: false,
          connectionInfo: 'unknown'
        }),
        csi: () => ({
          startE: Math.floor(performance.now()),
          onloadT: Math.floor(performance.now()),
          pageT: Math.floor(performance.now()),
          tran: 15
        })
      };

      // Perfect navigator properties
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: false
      });

      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
        configurable: false
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
        configurable: false
      });

      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel',
        configurable: false
      });

      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
        configurable: false
      });

      // Mock perfect permissions
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = (params) => {
        return Promise.resolve({
          state: 'granted',
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          name: params.name,
          onchange: null
        } as PermissionStatus);
      };

      // Perfect WebGL spoofing
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
        if (contextType === 'webgl' || contextType === 'webgl2') {
          const context = getContext.call(this, contextType, ...args);
          if (context) {
            const getParameter = context.getParameter;
            context.getParameter = function(parameter) {
              if (parameter === 37445) return 'Intel Inc.';
              if (parameter === 37446) return 'Intel Iris Pro OpenGL Engine';
              if (parameter === 7936) return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
              if (parameter === 7937) return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
              return getParameter.call(this, parameter);
            };
          }
          return context;
        }
        return getContext.call(this, contextType, ...args);
      };

      // Mock perfect screen properties
      Object.defineProperty(screen, 'availTop', { get: () => 0 });
      Object.defineProperty(screen, 'availLeft', { get: () => 0 });
      Object.defineProperty(screen, 'availHeight', { get: () => 1055 });
      Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

      // Remove iframe detection
      const originalCreateElement = document.createElement;
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        if (tagName.toLowerCase() === 'iframe') {
          element.contentWindow = null;
        }
        return element;
      };

      // Perfect timing functions
      const originalDate = Date;
      const startTime = originalDate.now();
      Date.now = () => startTime + performance.now();

      // Hide automation in Error stacks
      const originalStackTrace = Error.prepareStackTrace;
      Error.prepareStackTrace = (error, stack) => {
        if (originalStackTrace) return originalStackTrace(error, stack);
        return error.stack;
      };

      console.log('🔒 Ultra stealth mode activated');
    });

    return page;
  }

  private async multiStrategyNavigation(): Promise<void> {
    console.log('🌐 Trying multiple navigation strategies...');
    
    const strategies = [
      () => this.directNavigation(),
      () => this.refererNavigation(),
      () => this.searchEngineNavigation()
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🎯 Strategy ${i + 1}: Attempting navigation...`);
        await strategies[i]();
        return; // Success!
      } catch (error) {
        console.log(`❌ Strategy ${i + 1} failed:`, error.message);
        if (i < strategies.length - 1) {
          console.log('⏳ Waiting before next strategy...');
          await this.randomDelay(10000, 20000);
        }
      }
    }

    console.log('🔧 All strategies failed, using demo content');
    await this.createDemoContent();
  }

  private async directNavigation(): Promise<void> {
    if (!this.originalPage) return;

    // First, just browse to a normal site like a human would
    console.log('🌐 Starting with innocent browsing...');
    await this.originalPage.goto('https://google.com', {
      waitUntil: 'domcontentloaded'
    });
    
    // Wait and do some human-like activity
    await this.randomDelay(2000, 4000);
    await this.humanMouseMove();
    
    // Now navigate to the actual target
    console.log('🎯 Navigating to target site...');
    await this.randomDelay(3000, 7000);
    
    await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.handlePossibleChallenge();
    await this.startVideoMonitoring();
  }

  private async refererNavigation(): Promise<void> {
    if (!this.originalPage) return;

    // Navigate via Google first
    await this.originalPage.goto('https://google.com', {
      waitUntil: 'domcontentloaded'
    });
    
    await this.randomDelay(2000, 4000);
    
    // Then navigate to target with referer
    await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
      referer: 'https://google.com'
    });

    await this.handlePossibleChallenge();
    await this.startVideoMonitoring();
  }

  private async searchEngineNavigation(): Promise<void> {
    if (!this.originalPage) return;

    // Search on Google first
    await this.originalPage.goto('https://www.google.com/search?q=artificial+analysis+video+arena');
    await this.randomDelay(2000, 5000);
    
    // Human-like mouse movement
    await this.humanMouseMove();
    
    // Navigate to the actual site
    await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.handlePossibleChallenge();
    await this.startVideoMonitoring();
  }

  private async handlePossibleChallenge(): Promise<void> {
    if (!this.originalPage) return;

    await this.randomDelay(2000, 4000);
    
    const isChallenge = await this.originalPage.evaluate(() => {
      const title = document.title.toLowerCase();
      const body = document.body?.textContent?.toLowerCase() || '';
      return title.includes('just a moment') || 
             title.includes('checking') ||
             body.includes('cloudflare') ||
             body.includes('checking your browser');
    });

    if (isChallenge) {
      console.log('🔍 Challenge detected, waiting patiently...');
      
      // Keep the page active with realistic human behavior
      const maxWait = 60000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWait) {
        await this.humanMouseMove();
        await this.randomDelay(3000, 6000);
        
        const stillChallenge = await this.originalPage.evaluate(() => {
          const title = document.title.toLowerCase();
          const body = document.body?.textContent?.toLowerCase() || '';
          return title.includes('just a moment') || 
                 title.includes('checking') ||
                 body.includes('cloudflare') ||
                 body.includes('checking your browser');
        });

        if (!stillChallenge) {
          console.log('✅ Challenge completed!');
          return;
        }
      }
      
      throw new Error('Challenge timeout');
    }
  }

  private async humanMouseMove(): Promise<void> {
    if (!this.originalPage) return;

    const moves = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < moves; i++) {
      const x = 200 + Math.random() * 1520;
      const y = 200 + Math.random() * 680;
      await this.originalPage.mouse.move(x, y);
      await this.randomDelay(500, 1500);
    }
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
      console.log('🔍 Searching for videos...');
      
      await this.originalPage.waitForSelector('video', { timeout: 20000 });
      
      const videoData = await this.originalPage.evaluate(() => {
        const videos = document.querySelectorAll('video');
        
        let prompt = '';
        const paragraphs = Array.from(document.querySelectorAll('p'));
        for (const p of paragraphs) {
          if (p.textContent && p.textContent.length > 30) {
            prompt = p.textContent;
            break;
          }
        }
        
        return {
          videos: Array.from(videos).map(video => ({
            src: video.currentSrc || video.src,
            className: video.className
          })),
          prompt: prompt || 'Real videos from Artificial Analysis'
        };
      });

      if (videoData.videos.length >= 2) {
        this.currentTopVideoUrl = videoData.videos[0].src;
        this.currentBottomVideoUrl = videoData.videos[1].src;
        this.currentPrompt = videoData.prompt;

        console.log(`🎉 SUCCESS! Real videos extracted:`);
        console.log(`   TOP: ${this.currentTopVideoUrl.substring(0, 80)}...`);
        console.log(`   BOTTOM: ${this.currentBottomVideoUrl.substring(0, 80)}...`);

        await this.displayManager?.updateVideos(
          this.currentTopVideoUrl,
          this.currentBottomVideoUrl,
          this.currentPrompt
        );
      } else {
        throw new Error('Not enough videos found');
      }
      
    } catch (error) {
      console.error('❌ Video monitoring failed:', error);
      await this.createDemoContent();
    }
  }

  private async createDemoContent(): Promise<void> {
    const demoTopVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const demoBottomVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
    const demoPrompt = 'Demo: Ultra Stealth Mode - Testing Video UI';

    console.log('🎬 Loading demo videos...');
    
    await this.displayManager?.updateVideos(
      demoTopVideo,
      demoBottomVideo,
      demoPrompt
    );

    console.log('✅ Demo content ready');
  }

  async selectPreference(preference: 'top' | 'bottom'): Promise<void> {
    if (!this.originalPage) return;

    try {
      await this.randomDelay(1500, 3000);
      
      const buttons = await this.originalPage.locator('button').filter({ 
        hasText: /prefer.*video|←|→/i 
      }).all();
      
      if (buttons.length >= 2) {
        const targetButton = preference === 'top' ? buttons[0] : buttons[1];
        await targetButton.hover();
        await this.randomDelay(400, 800);
        await targetButton.click();
        
        console.log(`✅ Selected ${preference} preference`);
        
        setTimeout(() => {
          this.startVideoMonitoring();
        }, 5000);
      }
    } catch (error) {
      console.error(`❌ Failed to select preference:`, error);
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