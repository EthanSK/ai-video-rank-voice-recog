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
  private sessionDir = path.join(os.tmpdir(), 'playwright-session');

  async initialize(): Promise<void> {
    console.log('🚀 Launching ULTRA stealth mode with persistent profile...');
    
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

    // Launch browser with stealth settings
    this.browser = await chromium.launch({
      headless: false,
      executablePath,
      args: [
        // Core anti-detection
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-dev-shm-usage',
        
        // Browser fingerprint normalization  
        '--disable-extensions-except=',
        '--disable-extensions',
        '--disable-plugins-discovery',
        '--disable-default-apps',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        
        // Network behavior
        '--disable-web-security',
        '--allow-running-insecure-content', 
        '--disable-sync',
        '--metrics-recording-only',
        '--no-report-upload',
        '--disable-background-mode',
        
        // Startup behavior
        '--no-default-browser-check',
        '--no-first-run',
        '--start-maximized',
        '--window-size=1920,1080',
        
        // Memory and performance
        '--max_old_space_size=4096',
        '--disable-ipc-flooding-protection',
        
        // DNS and network randomization
        '--host-resolver-rules=MAP dns.google 8.8.8.8',
        '--enable-features=AsyncDns',
        '--disable-features=VizDisplayCompositor'
      ],
      ignoreDefaultArgs: [
        '--enable-automation',
        '--enable-blink-features=IdleDetection'
      ]
    });

    // Create context with stealth settings
    this.context = await this.browser.newContext({
      viewport: null,
      userAgent: this.getRandomUserAgent(),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['notifications', 'geolocation', 'camera', 'microphone'],
      isMobile: false,
      hasTouch: false,
      colorScheme: 'light',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,en-GB;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'sec-ch-ua': '"Chromium";v="121", "Not(A:Brand";v="24", "Google Chrome";v="121"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Cache-Control': 'max-age=0'
      }
    });

    // Create main page
    console.log('📄 Creating main navigation page...');
    this.originalPage = await this.context.newPage();
    
    // Apply stealth to the page
    await this.applyStealthToPage(this.originalPage);

    // Check if this is first run and seed if needed  
    await this.checkAndSeedProfile();

    // Warm up browser session first
    await this.warmBrowserSession();
    
    // Navigate to target site FIRST using the main tab
    console.log('🎯 Navigating main tab to target site...');
    await this.multiStrategyNavigation();

    // Only create additional tabs AFTER successful navigation
    console.log('✅ Site loaded! Creating video display tabs...');
    
    console.log('📄 Creating TOP video page...');
    this.topVideoPage = await this.createMaxStealthPage();
    await this.topVideoPage.addInitScript(() => {
      document.title = 'TOP';
    });
    
    console.log('⏳ Quick pause...');  
    await this.randomDelay(500, 1500);
    
    console.log('📄 Creating BOTTOM video page...');
    this.bottomVideoPage = await this.createMaxStealthPage();
    await this.bottomVideoPage.addInitScript(() => {
      document.title = 'BOTTOM';
    });

    // Initialize display manager
    console.log('🎬 Setting up video display system...');
    this.displayManager = new VideoDisplayManager(
      this.createPuppeteerLikePage(this.topVideoPage),
      this.createPuppeteerLikePage(this.bottomVideoPage)
    );

    // Now extract and display the videos we found
    await this.setupVideoDisplay();
  }

  private getRandomFingerprint(): any {
    const fingerprints = [
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezone: 'America/New_York',
        platform: 'MacIntel'
      },
      {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1536, height: 864 },
        locale: 'en-US',
        timezone: 'America/Chicago',
        platform: 'Win32'
      },
      {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 2560, height: 1440 },
        locale: 'en-US',
        timezone: 'America/Los_Angeles',
        platform: 'MacIntel'
      }
    ];
    
    return fingerprints[Math.floor(Math.random() * fingerprints.length)];
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

  private async setupVideoDisplay(): Promise<void> {
    console.log('🎬 Extracting videos from loaded page...');
    await this.startVideoMonitoring();
  }

  private async applyStealthToPage(page: Page): Promise<void> {
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
  }

  private async createDistributedNavigation(): Promise<void> {
    console.log('🎭 Creating distributed navigation pattern...');
    
    // Create multiple tabs to distribute the load and confuse detection
    const decoyTabs: Page[] = [];
    
    for (let i = 0; i < 3; i++) {
      const decoyPage = await this.context!.newPage();
      await this.applyStealthToPage(decoyPage);
      decoyTabs.push(decoyPage);
      
      // Each decoy navigates to different AI-related sites
      const decoyTargets = [
        'https://openai.com',
        'https://huggingface.co',
        'https://anthropic.com'
      ];
      
      setTimeout(async () => {
        try {
          await decoyPage.goto(decoyTargets[i], { waitUntil: 'domcontentloaded' });
          await this.simulateHumanBehavior(decoyPage);
        } catch (e) {
          console.log(`⚠️ Decoy tab ${i} failed, continuing...`);
        }
      }, Math.random() * 5000);
    }
    
    // Wait for decoys to start loading
    await this.randomDelay(2000, 4000);
    
    // Now navigate main tab while decoys are active
    console.log('🎯 Main tab navigating while decoys are active...');
  }

  private async createMaxStealthPage(): Promise<Page> {
    const page = await this.context!.newPage();
    await this.applyStealthToPage(page);
    return page;
  }

  private async warmBrowserSession(): Promise<void> {
    console.log('🔥 Warming browser session with realistic user journey...');
    
    // Start with common sites that build trust
    const warmupSites = [
      'https://www.google.com',
      'https://news.ycombinator.com',
      'https://github.com',
      'https://stackoverflow.com'
    ];
    
    for (let i = 0; i < warmupSites.length; i++) {
      const site = warmupSites[i];
      console.log(`🌐 Warming up with ${site}...`);
      
      try {
        await this.originalPage!.goto(site, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Simulate real user behavior
        await this.randomDelay(2000, 5000);
        await this.simulateHumanBehavior();
        
        // Build up browsing history and cookies
        if (i < warmupSites.length - 1) {
          await this.randomDelay(3000, 7000);
        }
      } catch (error) {
        console.log(`⚠️ Warmup site ${site} failed, continuing...`);
      }
    }
    
    console.log('✅ Browser session warmed up');
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
    await this.randomDelay(1000, 2000);
    await this.humanMouseMove();
    
    // Now navigate to the actual target
    console.log('🎯 Navigating to target site...');
    await this.randomDelay(1000, 2000);
    
    await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.handlePossibleChallenge();
    // Don't start video monitoring yet - wait for tabs to be created
  }

  private async refererNavigation(): Promise<void> {
    if (!this.originalPage) return;

    // Navigate via Google first
    await this.originalPage.goto('https://google.com', {
      waitUntil: 'domcontentloaded'
    });
    
    await this.randomDelay(1000, 2000);
    await this.humanMouseMove();
    
    // Then navigate to target with referer
    console.log('🎯 Navigating from Google to target site...');
    await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.handlePossibleChallenge();
    
    // Check if we got redirected and handle it
    const currentUrl = this.originalPage.url();
    console.log('📍 Current URL:', currentUrl);
    
    if (currentUrl.includes('/orgs') || currentUrl.includes('signin')) {
      console.log('🔄 Got redirected, trying to navigate back to arena...');
      await this.randomDelay(2000, 4000);
      await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
    }
    
    // Don't start video monitoring yet - wait for tabs to be created
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
    // Don't start video monitoring yet - wait for tabs to be created
  }

  private async handlePossibleChallenge(): Promise<void> {
    if (!this.originalPage) return;

    await this.randomDelay(3000, 6000);
    
    const isChallenge = await this.originalPage.evaluate(() => {
      const title = document.title.toLowerCase();
      const body = document.body?.textContent?.toLowerCase() || '';
      const url = window.location.href.toLowerCase();
      
      return title.includes('just a moment') || 
             title.includes('checking') ||
             title.includes('please wait') ||
             title.includes('security check') ||
             body.includes('cloudflare') ||
             body.includes('checking your browser') ||
             body.includes('ddos protection') ||
             body.includes('security service') ||
             url.includes('challenges.cloudflare.com') ||
             document.querySelector('[data-ray]') !== null ||
             document.querySelector('.cf-browser-verification') !== null ||
             document.querySelector('#cf-challenge-running') !== null;
    });

    if (isChallenge) {
      console.log('🔍 Cloudflare challenge detected, acting like patient human...');
      
      // Extended wait time - be very patient
      const maxWait = 120000; // 2 minutes
      const startTime = Date.now();
      let mouseMovements = 0;
      
      while (Date.now() - startTime < maxWait) {
        // More realistic human behavior during wait
        if (mouseMovements < 15) { // Don't overdo mouse movements
          await this.humanMouseMove();
          mouseMovements++;
        }
        
        // Longer pauses between actions
        await this.randomDelay(5000, 12000);
        
        // Occasionally scroll slightly
        if (Math.random() > 0.7) {
          await this.originalPage.evaluate(() => {
            window.scrollBy(0, Math.random() * 100 - 50);
          });
        }
        
        // Check if challenge completed
        const stillChallenge = await this.originalPage.evaluate(() => {
          const title = document.title.toLowerCase();
          const body = document.body?.textContent?.toLowerCase() || '';
          const url = window.location.href.toLowerCase();
          
          return title.includes('just a moment') || 
                 title.includes('checking') ||
                 title.includes('please wait') ||
                 title.includes('security check') ||
                 body.includes('cloudflare') ||
                 body.includes('checking your browser') ||
                 body.includes('ddos protection') ||
                 body.includes('security service') ||
                 url.includes('challenges.cloudflare.com') ||
                 document.querySelector('[data-ray]') !== null ||
                 document.querySelector('.cf-browser-verification') !== null ||
                 document.querySelector('#cf-challenge-running') !== null;
        });

        if (!stillChallenge) {
          console.log('✅ Challenge completed successfully!');
          // Wait a bit more after completion
          await this.randomDelay(3000, 7000);
          return;
        }
        
        // Progress indicator
        const elapsed = Date.now() - startTime;
        const remaining = Math.ceil((maxWait - elapsed) / 1000);
        if (remaining % 15 === 0) {
          console.log(`⏳ Still waiting... ${remaining}s remaining`);
        }
      }
      
      throw new Error('Challenge timeout - waited 2 minutes');
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
        return playwrightPage.setContent(html, { 
          waitUntil: 'domcontentloaded', 
          timeout: 10000,
          ...options 
        });
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
      console.log('📍 Current page:', this.originalPage.url());
      
      // Check if we're on the right page
      const currentUrl = this.originalPage.url();
      if (!currentUrl.includes('/text-to-video/arena')) {
        console.log('⚠️ Not on arena page, trying to navigate there...');
        await this.originalPage.goto('https://artificialanalysis.ai/text-to-video/arena', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        await this.randomDelay(2000, 4000);
      }
      
      await this.originalPage.waitForSelector('video', { timeout: 10000 });
      
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

  private async checkAndSeedProfile(): Promise<void> {
    // Check if profile already exists
    const pages = this.context!.pages();
    const existingPage = pages[0];
    
    // Navigate to a data URL first to establish an origin for localStorage
    await existingPage.goto('data:text/html,<html><body>Checking profile...</body></html>');
    
    const isFirstRun = await existingPage.evaluate(() => {
      try {
        return !localStorage.getItem('profile_seeded');
      } catch (e) {
        return true; // If localStorage fails, assume first run
      }
    });

    if (isFirstRun) {
      console.log('🌱 First run detected - seeding browser with realistic user data...');
      await this.seedBrowserProfile();
    } else {
      console.log('🔄 Returning user - using existing profile data...');
      // Update some data to show continued activity
      await this.updateProfileActivity();
    }
  }

  private async updateProfileActivity(): Promise<void> {
    const pages = this.context!.pages();
    const existingPage = pages[0];
    
    await existingPage.evaluate(() => {
      try {
        // Update timestamps to show recent activity
        const now = Date.now();
        const lastVisited = JSON.parse(localStorage.getItem('last_visited') || '{}');
        lastVisited['google.com'] = now - Math.floor(Math.random() * 3600000);
        localStorage.setItem('last_visited', JSON.stringify(lastVisited));
        
        // Update session
        sessionStorage.setItem('login_time', now.toString());
        sessionStorage.setItem('session_token', `tok_${Math.random().toString(36).substring(2, 15)}`);
      } catch (e) {
        console.log('Could not update profile activity:', e.message);
      }
    });
    
    console.log('✅ Profile activity updated');
  }

  private async seedBrowserProfile(): Promise<void> {
    // Create a temporary page to seed data
    const seedPage = await this.context!.newPage();
    
    try {
      // Add realistic cookies for popular sites
      await this.context!.addCookies([
        {
          name: '_ga',
          value: `GA1.1.${Math.floor(Math.random() * 1000000000)}.${Date.now() - Math.floor(Math.random() * 31536000000)}`,
          domain: '.google.com',
          path: '/',
          expires: Date.now() + 31536000000 // 1 year
        },
        {
          name: '_gid',
          value: `GA1.1.${Math.floor(Math.random() * 1000000000)}.${Date.now()}`,
          domain: '.google.com',
          path: '/',
          expires: Date.now() + 86400000 // 1 day
        },
        {
          name: '_fbp',
          value: `fb.1.${Date.now()}.${Math.floor(Math.random() * 1000000000)}`,
          domain: '.facebook.com',
          path: '/',
          expires: Date.now() + 7776000000 // 90 days
        },
        {
          name: 'session_id',
          value: `sess_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
          domain: '.youtube.com',
          path: '/',
          expires: Date.now() + 86400000
        },
        {
          name: 'preferences',
          value: `{"theme":"light","language":"en-US","notifications":true}`,
          domain: '.github.com',
          path: '/',
          expires: Date.now() + 31536000000
        }
      ]);

      // Seed localStorage with realistic data
      await seedPage.goto('data:text/html,<html><body>Seeding...</body></html>');
      
      await seedPage.evaluate(() => {
        // Google Analytics
        localStorage.setItem('_ga', `GA1.1.${Math.floor(Math.random() * 1000000000)}.${Date.now() - Math.floor(Math.random() * 31536000000)}`);
        localStorage.setItem('_gid', `GA1.1.${Math.floor(Math.random() * 1000000000)}.${Date.now()}`);
        
        // Common site preferences
        localStorage.setItem('theme', 'light');
        localStorage.setItem('language', 'en-US');
        localStorage.setItem('timezone', 'America/New_York');
        localStorage.setItem('visited_sites', JSON.stringify([
          'google.com', 'youtube.com', 'github.com', 'stackoverflow.com', 'reddit.com'
        ]));
        
        // Fake browsing history timestamps
        const now = Date.now();
        localStorage.setItem('last_visited', JSON.stringify({
          'google.com': now - Math.floor(Math.random() * 3600000), // Within last hour
          'youtube.com': now - Math.floor(Math.random() * 86400000), // Within last day  
          'github.com': now - Math.floor(Math.random() * 604800000), // Within last week
          'stackoverflow.com': now - Math.floor(Math.random() * 2592000000) // Within last month
        }));
        
        // User preferences that look realistic
        localStorage.setItem('user_preferences', JSON.stringify({
          cookieConsent: true,
          analyticsOptIn: true,
          notificationsEnabled: false,
          autoplay: true,
          defaultVolume: 0.7,
          preferredQuality: '1080p'
        }));
        
        // Search history (fake but realistic)
        localStorage.setItem('search_history', JSON.stringify([
          'typescript tutorial',
          'playwright automation',
          'best practices web development',
          'ai video generation',
          'cloudflare bypass methods'
        ]));

        // Fake login sessions
        sessionStorage.setItem('session_token', `tok_${Math.random().toString(36).substring(2, 15)}`);
        sessionStorage.setItem('user_id', Math.floor(Math.random() * 1000000).toString());
        sessionStorage.setItem('login_time', Date.now().toString());

        // Mark profile as seeded
        localStorage.setItem('profile_seeded', 'true');
        localStorage.setItem('profile_created', Date.now().toString());
      });

      // Visit some popular sites to establish browsing patterns
      const popularSites = [
        'https://www.google.com',
        'https://www.youtube.com', 
        'https://www.github.com'
      ];

      for (const site of popularSites) {
        try {
          console.log(`🌐 Quick visit to ${site} to establish browsing pattern...`);
          await seedPage.goto(site, { 
            waitUntil: 'domcontentloaded', 
            timeout: 10000 
          });
          await this.randomDelay(500, 1500);
          
          // Add some realistic interaction
          await seedPage.mouse.move(
            Math.random() * 1920, 
            Math.random() * 1080
          );
          await this.randomDelay(300, 800);
        } catch (e) {
          // Don't fail if a site doesn't load - just continue
          console.log(`⚠️ Couldn't visit ${site}, continuing...`);
        }
      }

      console.log('✅ Browser profile seeded with realistic user data');

    } catch (error) {
      console.log('⚠️ Failed to seed browser profile:', error.message);
    } finally {
      await seedPage.close();
    }
  }

  private async simulateHumanBehavior(page?: Page): Promise<void> {
    const targetPage = page || this.originalPage!;
    
    console.log('🤖 Simulating advanced human behavior patterns...');
    
    // Simulate human reading patterns with eye tracking simulation
    const patterns = [
      async () => {
        // F-pattern reading (common web reading pattern)
        await targetPage.mouse.move(100, 200, { steps: 20 });
        await this.randomDelay(300, 800);
        await targetPage.mouse.move(800, 200, { steps: 30 });
        await this.randomDelay(500, 1200);
        await targetPage.mouse.move(150, 400, { steps: 25 });
        await this.randomDelay(400, 900);
        await targetPage.mouse.move(600, 400, { steps: 20 });
      },
      async () => {
        // Z-pattern reading
        await targetPage.mouse.move(50, 150, { steps: 15 });
        await this.randomDelay(200, 600);
        await targetPage.mouse.move(950, 150, { steps: 40 });
        await this.randomDelay(300, 700);
        await targetPage.mouse.move(50, 500, { steps: 35 });
        await this.randomDelay(400, 800);
        await targetPage.mouse.move(950, 500, { steps: 30 });
      },
      async () => {
        // Natural scrolling with pauses
        for (let i = 0; i < 3; i++) {
          await targetPage.mouse.wheel(0, Math.random() * 300 + 100);
          await this.randomDelay(800, 2000);
          // Occasional back-scroll (humans do this)
          if (Math.random() > 0.7) {
            await targetPage.mouse.wheel(0, -(Math.random() * 100 + 50));
            await this.randomDelay(300, 700);
          }
        }
      }
    ];
    
    // Execute random pattern
    const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)];
    await selectedPattern();
    
    // Add micro-movements that humans can't avoid
    for (let i = 0; i < 5; i++) {
      const currentPos = await targetPage.evaluate(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));
      await targetPage.mouse.move(
        currentPos.x + (Math.random() - 0.5) * 10,
        currentPos.y + (Math.random() - 0.5) * 10,
        { steps: 1 }
      );
      await this.randomDelay(100, 300);
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🧹 Cleanup completed');
  }
}