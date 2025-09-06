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
      
      // Check if videos are new BEFORE updating currentVideoData
      const hasNewVideos = !this.currentVideoData || 
                          this.currentVideoData.top !== videoData.top || 
                          this.currentVideoData.bottom !== videoData.bottom;
      
      // Store the video data
      this.currentVideoData = videoData;
      
      // Update display if we have valid video URLs
      if (videoData.top && videoData.bottom && this.displayManager) {
        this.displayManager.updateVideos(
          videoData.top,
          videoData.bottom,
          videoData.prompt
        );
        
        if (hasNewVideos) {
          console.log('🎬 New videos loaded:', videoData.prompt.substring(0, 80) + '...');
        }
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
      
      // Silently send commands to reduce spam
    });

    // Route to receive model names from extension for TTS
    this.app.post('/model-names', (req, res) => {
      const { models, timestamp } = req.body;
      console.log('🏷️ Received model names from extension:', models);
      
      if (models && models.length > 0) {
        this.handleModelNames(models);
      }
      
      res.json({ success: true });
    });

    // Debug endpoint to request current page state
    this.app.post('/request-page-state', (req, res) => {
      console.log('🔍 Requesting current page state from extension...');
      
      // Add command to queue for extension to poll
      this.commandQueue.push({
        type: 'extract_videos',
        data: { timestamp: Date.now() }
      });
      
      res.json({ success: true });
    });
  }

  async initialize(allowLongDownload: boolean = false): Promise<void> {
    console.log('🚀 Starting Extension-based Video Ranking System...');
    
    // Start HTTP server
    this.server = this.app.listen(7777, () => {
      console.log('🌐 Backend server listening on http://localhost:7777');
      console.log('✅ Extension can now send video data');
    });

    // Initialize Puppeteer display manager (optional - may fail in headless environments)
    try {
      this.displayManager = new PuppeteerDisplayManager();
      await this.displayManager.initialize();
      console.log('✅ Puppeteer display manager initialized');
    } catch (error) {
      console.log('⚠️ Puppeteer display manager failed to start:', (error as Error).message);
      console.log('💡 This is OK - the system will work without video display');
      this.displayManager = null;
    }
    
    // Initialize voice controller (this is the main focus of this fix)
    try {
      this.voiceController = new VoiceController();
      this.voiceController.onCommand = (command: string) => {
        this.handleVoiceCommand(command);
      };
      
      await this.voiceController.initialize(allowLongDownload);
      console.log('🎤 Voice recognition system initialized successfully');
    } catch (error) {
      console.log('⚠️ Voice recognition failed to start:', (error as Error).message);
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
    console.log('');
    console.log('🎤 Voice recognition is now running with improved real-time processing!');
    console.log('📝 All speech will be logged in real-time for debugging');
    
    // Start periodic debug logging
    this.startDebugLogging();
  }
  
  private startDebugLogging() {
    // Remove debug logging - it's working and too verbose
  }

  private async handleVoiceCommand(command: string) {
    const cmd = command.toLowerCase().trim();
    
    switch (cmd) {
      case 'top':
      case 'left':
      case 'first':
      case '1':
      case 'one':
        await this.selectPreference('top');
        break;
        
      case 'bottom':
      case 'right':
      case 'second':
      case '2':
      case 'two':
        await this.selectPreference('bottom');
        break;
        
      case 'play':
        this.displayManager?.playVideos();
        // Also queue command for extension to play videos on the site
        this.commandQueue.push({
          type: 'play_videos',
          data: { timestamp: Date.now() }
        });
        break;
        
      case 'pause':
      case 'stop':
        this.displayManager?.pauseVideos();
        // Also queue command for extension to pause videos on the site
        this.commandQueue.push({
          type: 'pause_videos', 
          data: { timestamp: Date.now() }
        });
        break;
        
      default:
        console.log('❓ Unknown command');
    }
  }

  private commandQueue: Array<{type: string, data: any}> = [];

  private async selectPreference(preference: 'top' | 'bottom') {
    const displayNumber = preference === 'top' ? '1' : '2';
    console.log(`🎯 ${displayNumber}`);
    
    // Add command to queue for extension to poll
    this.commandQueue.push({
      type: 'select_preference',
      data: { preference, timestamp: Date.now() }
    });

    // Test Daniel TTS immediately
    const { spawn } = await import('child_process');
    const testMessage = `Selected ${displayNumber}`;
    console.log(`🗣️ Test TTS: ${testMessage}`);
    
    try {
      const sayProcess = spawn('say', ['-v', 'Daniel', testMessage], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      sayProcess.on('error', (error) => {
        console.log('⚠️ Daniel TTS test failed:', error.message);
      });
      
      sayProcess.on('close', (code) => {
        console.log(`🔊 Daniel TTS finished with code: ${code}`);
      });
      
      sayProcess.stderr.on('data', (data) => {
        console.log('🔊 Daniel TTS stderr:', data.toString());
      });
    } catch (error) {
      console.log('⚠️ Failed to spawn Daniel TTS:', (error as Error).message);
    }

    // Model name announcement will happen automatically when the extension detects them
  }


  private async handleModelNames(models: Array<{ name: string, preference: string, type: string }>): Promise<void> {
    console.log('🔍 RECEIVED MODEL DATA FROM EXTENSION:', JSON.stringify(models, null, 2));
    
    // Find the preferred model (the one that was voted for)
    const preferredModel = models.find(model => model.preference === 'preferred');
    const allModels = models.map(m => `"${m.name}" (${m.preference})`).join(', ');
    
    console.log('📋 ALL MODELS DETECTED:', allModels);
    console.log('🎯 PREFERRED MODEL FOUND:', preferredModel ? `"${preferredModel.name}"` : 'NONE');
    
    // Import spawn for running the 'say' command
    const { spawn } = await import('child_process');
    
    if (preferredModel) {
      const modelName = preferredModel.name;
      console.log(`🗣️  DANIEL SHOULD SAY: "Selected ${modelName}"`);
      
      // Use macOS built-in 'say' command with Daniel voice to announce the selected model
      const announcement = `Selected ${modelName}`;
      const sayProcess = spawn('say', ['-v', 'Daniel', announcement]);
      
      sayProcess.on('error', (error) => {
        console.log('⚠️ Text-to-speech error:', error.message);
      });
      
      sayProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Successfully announced: ${announcement}`);
        }
      });
    } else {
      console.log('⚠️ NO PREFERRED MODEL FOUND - DANIEL SHOULD SAY FALLBACK MESSAGE');
      console.log('🔍 DEBUG: Extension might not be detecting model names correctly');
      
      // Fallback message when no model name could be retrieved
      const fallbackMessage = "I'm retarded";
      const sayProcess = spawn('say', ['-v', 'Daniel', fallbackMessage]);
      
      sayProcess.on('error', (error) => {
        console.log('⚠️ Text-to-speech error:', error.message);
      });
      
      sayProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Successfully announced fallback: ${fallbackMessage}`);
        }
      });
    }
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