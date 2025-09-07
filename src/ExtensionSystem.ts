import express from "express";
import cors from "cors";
import { PuppeteerDisplayManager } from "./PuppeteerDisplayManager";
import { VoiceController } from "./VoiceController";

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
  // Track last announced preferred model to prevent duplicate TTS
  private lastAnnouncedPreferredModelName: string | null = null;

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
    this.app.get("/status", (req, res) => {
      res.json({ status: "ok", timestamp: Date.now() });
    });

    // Receive video data from extension
    this.app.post("/update", (req, res) => {
      const videoData: VideoData = req.body;

      // Check if videos are new BEFORE updating currentVideoData
      const hasNewVideos =
        !this.currentVideoData ||
        this.currentVideoData.top !== videoData.top ||
        this.currentVideoData.bottom !== videoData.bottom;

      // Store the video data
      this.currentVideoData = videoData;

      // Reset model announcement tracking when new videos are loaded
      if (hasNewVideos) {
        console.log(
          "🎬 New videos detected - resetting model announcement tracking"
        );
        this.lastAnnouncedPreferredModelName = null;
      }

      // Update display if we have valid video URLs
      if (videoData.top && videoData.bottom && this.displayManager) {
        this.displayManager.updateVideos(
          videoData.top,
          videoData.bottom,
          videoData.prompt
        );

        if (hasNewVideos) {
          console.log(
            "🎬 New videos loaded:",
            videoData.prompt.substring(0, 80) + "..."
          );
        }
      }

      res.sendStatus(204);
    });

    // Voice command endpoint (for testing)
    this.app.post("/voice-command", (req, res) => {
      const { command } = req.body;
      console.log("🎙️ Voice command:", command);

      this.handleVoiceCommand(command);
      res.json({ success: true });
    });

    // Command polling endpoint for extension
    this.app.get("/get-commands", (req, res) => {
      const commands = [...this.commandQueue];
      this.commandQueue = []; // Clear queue after sending

      res.json({ commands });

      // Silently send commands to reduce spam
    });

    // Route to receive model names from extension for TTS
    this.app.post("/model-names", (req, res) => {
      const { models, timestamp } = req.body;
      const now = Date.now();
      console.log(`🏷️ Received model names POST request at ${now} (${models?.length || 0} models)`);

      if (models && models.length > 0) {
        this.handleModelNames(models);
      } else {
        console.log("⚠️ No models provided in request");
      }

      res.json({ success: true });
    });

    // Debug endpoint to request current page state
    this.app.post("/request-page-state", (req, res) => {
      // Silently request page state (no logging to reduce spam)

      // Add command to queue for extension to poll
      this.commandQueue.push({
        type: "extract_videos",
        data: { timestamp: Date.now() },
      });

      res.json({ success: true });
    });
  }

  async initialize(allowLongDownload: boolean = false): Promise<void> {
    console.log("🚀 Starting Extension-based Video Ranking System...");

    // Start HTTP server
    this.server = this.app.listen(7777, () => {
      console.log("🌐 Backend server listening on http://localhost:7777");
      console.log("✅ Extension can now send video data");
    });

    // Initialize Puppeteer display manager (optional - may fail in headless environments)
    try {
      this.displayManager = new PuppeteerDisplayManager();
      await this.displayManager.initialize();
      console.log("✅ Puppeteer display manager initialized");
    } catch (error) {
      console.log(
        "⚠️ Puppeteer display manager failed to start:",
        (error as Error).message
      );
      console.log("💡 This is OK - the system will work without video display");
      this.displayManager = null;
    }

    // Initialize voice controller (this is the main focus of this fix)
    try {
      this.voiceController = new VoiceController();
      this.voiceController.onCommand = (command: string) => {
        this.handleVoiceCommand(command);
      };

      await this.voiceController.initialize(allowLongDownload);
      console.log("🎤 Voice recognition system initialized successfully");
    } catch (error) {
      console.log(
        "⚠️ Voice recognition failed to start:",
        (error as Error).message
      );
      console.log("💡 Install dependencies:");
      console.log("   brew install sox");
      console.log("   pip install openai-whisper");
    }

    console.log("📋 Instructions:");
    console.log(
      "   1. Load chrome-extension folder in Chrome (chrome://extensions)"
    );
    console.log("   2. Navigate to artificialanalysis.ai/text-to-video/arena");
    console.log("   3. Solve Cloudflare manually in your browser");
    console.log("   4. Extension will automatically stream video data");
    console.log('   5. Use voice commands: "left", "right", "play", "pause"');
    console.log("");
    console.log(
      "🎤 Voice recognition is now running with improved real-time processing!"
    );
    console.log("📝 All speech will be logged in real-time for debugging");

    // Start periodic debug logging
    this.startDebugLogging();
  }

  private startDebugLogging() {
    // Remove debug logging - it's working and too verbose
  }

  private async handleVoiceCommand(command: string) {
    const cmd = command.toLowerCase().trim();

    switch (cmd) {
      case "left":
      case "top":
      case "first":
        await this.selectPreference("top");
        break;

      case "right":
      case "bottom":
      case "second":
        await this.selectPreference("bottom");
        break;

      case "play":
        this.displayManager?.playVideos();
        // Also queue command for extension to play videos on the site
        this.commandQueue.push({
          type: "play_videos",
          data: { timestamp: Date.now() },
        });
        break;

      case "pause":
      case "stop":
        this.displayManager?.pauseVideos();
        // Also queue command for extension to pause videos on the site
        this.commandQueue.push({
          type: "pause_videos",
          data: { timestamp: Date.now() },
        });
        break;

      default:
        console.log("❓ Unknown command");
    }
  }

  private commandQueue: Array<{ type: string; data: any }> = [];

  private async selectPreference(preference: "top" | "bottom") {
    const displaySide = preference === "top" ? "left" : "right";
    console.log(`🎯 Voting for ${displaySide} option`);

    // Add command to queue for extension to poll
    this.commandQueue.push({
      type: "select_preference",
      data: { preference, timestamp: Date.now() },
    });

    // NO immediate TTS announcement - wait for model detection
    console.log(`🤐 Daniel will stay silent until model names are detected`);
    console.log(
      `📝 Model name announcement will happen automatically when extension detects them`
    );

    // Model name announcement will happen automatically when the extension detects them
  }

  private modelCallCounter: number = 0;
  private lastTTSTime: number = 0; // Track when Daniel last spoke

  private async handleModelNames(
    models: Array<{ name: string; preference: string; type: string }>
  ): Promise<void> {
    console.log(
      "🔍 RECEIVED MODEL DATA FROM EXTENSION (call #" +
        ++this.modelCallCounter +
        "):",
      JSON.stringify(models, null, 2)
    );

    // Find the preferred model (the one that was voted for)
    const preferredModel = models.find(
      (model) => model.preference === "preferred"
    );
    const allModels = models
      .map((m) => `"${m.name}" (${m.preference})`)
      .join(", ");

    console.log("📋 ALL MODELS DETECTED:", allModels);
    console.log(
      "🎯 PREFERRED MODEL FOUND:",
      preferredModel ? `"${preferredModel.name}"` : "NONE"
    );

    // Normalize preferred model name for comparison (trim + collapse whitespace)
    const normalize = (s: string) =>
      s.replace(/\s+/g, " ").trim().toLowerCase();
    const preferredNameNorm = preferredModel
      ? normalize(preferredModel.name)
      : null;

    // If we've already announced this preferred model for current videos, skip
    if (
      preferredNameNorm &&
      this.lastAnnouncedPreferredModelName === preferredNameNorm
    ) {
      console.log(
        "🔄 DUPLICATE ANNOUNCEMENT BLOCKED - preferred model unchanged"
      );
      return;
    }

    // Import spawn for running the 'say' command
    const { spawn } = await import("child_process");

    if (preferredModel) {
      const modelName = preferredModel.name;
      const currentTime = Date.now();

      // Check if Daniel spoke within the last 3 seconds (stronger debounce)
      if (currentTime - this.lastTTSTime < 3000) {
        console.log(
          `🔇 DANIEL DEBOUNCED - spoke ${(currentTime - this.lastTTSTime)/1000}s ago, skipping announcement`
        );
        return;
      }

      console.log(`🗣️  DANIEL WILL ANNOUNCE (ONCE): "Selected ${modelName}"`);
      this.lastTTSTime = currentTime; // Update last speech time
      this.lastAnnouncedPreferredModelName = preferredNameNorm; // Mark as announced for current videos

      // Mute voice recognition before speaking
      if (this.voiceController) {
        this.voiceController.muteForTTS();
      }

      // Use macOS built-in 'say' command with Daniel voice to announce the selected model
      const announcement = `Selected ${modelName}`;
      const sayProcess = spawn("say", ["-v", "Daniel", announcement]);

      sayProcess.on("error", (error) => {
        console.log("⚠️ Text-to-speech error:", error.message);
        // Unmute on error
        if (this.voiceController) {
          this.voiceController.unmuteAfterTTS();
        }
      });

      sayProcess.on("close", (code) => {
        if (code === 0) {
          console.log(`✅ Daniel announced (ONCE): ${announcement}`);
        }

        // Wait 5 seconds after TTS finishes before unmuting voice recognition
        console.log(
          "🔇 Keeping voice recognition muted for 5 seconds after TTS..."
        );
        setTimeout(() => {
          if (this.voiceController) {
            this.voiceController.unmuteAfterTTS();
            console.log("🔊 Voice recognition unmuted after 5-second delay");
          }
        }, 5000);
      });
    } else {
      console.log(
        "⚠️ NO PREFERRED MODEL FOUND - only non-preferred models detected"
      );
      console.log("🔍 This means you voted AGAINST these models");
      console.log(
        "🤐 Daniel stays silent for non-preferred models (correct behavior)"
      );

      // Show which model was voted against for debugging
      const nonPreferredModel = models.find(
        (m) => m.preference === "not-preferred"
      );
      if (nonPreferredModel) {
        console.log(`👎 You voted AGAINST: "${nonPreferredModel.name}"`);
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
    if (this.displayManager) {
      await this.displayManager.cleanup();
    }
    console.log("🧹 Extension system cleanup completed");
  }
}
