import express from 'express';
import cors from 'cors';
import { PuppeteerDisplayManager } from './PuppeteerDisplayManager';
import { VoiceController } from './VoiceController';

interface VideoData {
  top: string;
  bottom: string;
  prompt: string;
}

export class ExtensionSystem {
  private app: express.Application;
  private server: any;
  private displayManager: PuppeteerDisplayManager | null = null;
  private voiceController: VoiceController | null = null;
  private currentVideoData: VideoData | null = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Status endpoint for extension popup
    this.app.get('/status', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Receive video data from extension
    this.app.post('/update', (req, res) => {
      const videoData: VideoData = req.body;
      console.log('📥 Received from extension:', videoData);
      
      // Store the video data
      this.currentVideoData = videoData;
      
      // Update display if we have valid video URLs
      if (videoData.top && videoData.bottom && this.displayManager) {
        this.displayManager.updateVideos(
          videoData.top,
          videoData.bottom,
          videoData.prompt
        );
        console.log('🖥️ Updated video display');
      }
      
      res.sendStatus(204);
    });

    // Voice command endpoint (for testing)
    this.app.post('/voice-command', (req, res) => {
      const { command } = req.body;
      console.log('🎙️ Voice command:', command);
      
      this.handleVoiceCommand(command);
      res.json({ success: true });
    });

    // Command polling endpoint for extension
    this.app.get('/get-commands', (req, res) => {
      const commands = [...this.commandQueue];
      this.commandQueue = []; // Clear queue after sending
      
      res.json({ commands });
      
      if (commands.length > 0) {
        console.log(`📤 Sent ${commands.length} commands to extension:`, commands);
      }
    });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Starting Extension-based Video Ranking System...');
    
    // Start HTTP server
    this.server = this.app.listen(7777, () => {
      console.log('🌐 Backend server listening on http://localhost:7777');
      console.log('✅ Extension can now send video data');
    });

    // Initialize Puppeteer display manager
    this.displayManager = new PuppeteerDisplayManager();
    await this.displayManager.initialize();
    
    // Initialize voice controller
    try {
      this.voiceController = new VoiceController();
      this.voiceController.onCommand = (command: string) => {
        this.handleVoiceCommand(command);
      };
      
      await this.voiceController.initialize();
      console.log('🎤 Voice recognition ready');
    } catch (error) {
      console.log('⚠️ Voice recognition failed to start:', error.message);
      console.log('💡 Install dependencies:');
      console.log('   brew install sox');
      console.log('   pip install openai-whisper');
    }
    console.log('📋 Instructions:');
    console.log('   1. Load chrome-extension folder in Chrome (chrome://extensions)');
    console.log('   2. Navigate to artificialanalysis.ai/text-to-video/arena');
    console.log('   3. Solve Cloudflare manually in your browser');
    console.log('   4. Extension will automatically stream video data');
    console.log('   5. Use voice commands: "top", "bottom", "play", "pause"');
  }

  private handleVoiceCommand(command: string) {
    const cmd = command.toLowerCase().trim();
    console.log(`🎯 Processing command: "${cmd}"`);
    
    switch (cmd) {
      case 'top':
      case 'left':
      case 'first':
        this.selectPreference('top');
        break;
        
      case 'bottom':
      case 'right':
      case 'second':
        this.selectPreference('bottom');
        break;
        
      case 'play':
        this.displayManager?.playVideos();
        // Also queue command for extension to play videos on the site
        this.commandQueue.push({
          type: 'play_videos',
          data: { timestamp: Date.now() }
        });
        console.log('📤 Queued play command for extension');
        break;
        
      case 'pause':
      case 'stop':
        this.displayManager?.pauseVideos();
        // Also queue command for extension to pause videos on the site
        this.commandQueue.push({
          type: 'pause_videos', 
          data: { timestamp: Date.now() }
        });
        console.log('📤 Queued pause command for extension');
        break;
        
      default:
        console.log('❓ Unknown command');
    }
  }

  private commandQueue: Array<{type: string, data: any}> = [];

  private selectPreference(preference: 'top' | 'bottom') {
    console.log(`🎯 Selecting ${preference} preference via extension...`);
    
    // Add command to queue for extension to poll
    this.commandQueue.push({
      type: 'select_preference',
      data: { preference, timestamp: Date.now() }
    });
    
    console.log(`📤 Queued ${preference} preference command for extension`);
  }

  async cleanup(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
    if (this.displayManager) {
      await this.displayManager.cleanup();
    }
    console.log('🧹 Extension system cleanup completed');
  }
}