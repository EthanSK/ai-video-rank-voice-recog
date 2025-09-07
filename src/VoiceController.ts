import {
  RealtimeSTTServer,
  TranscriptionMessage,
} from "./services/RealtimeSTTServer";

export class VoiceController {
  private sttServer: RealtimeSTTServer;
  private commandHandlers: Map<string, () => Promise<void>> = new Map();
  private isListening = false;
  private isMutedForTTS = false;
  private lastCommandTime = 0;
  private commandDebounceMs = 300; // Prevent duplicate commands within 300ms (fast voting)
  private liveCommandProcessed = false; // Track if we've processed a live command
  private liveCommandCount = 0; // Count consecutive live commands with same trigger
  private lastDetectedCommand = ""; // Track which command we're seeing

  public onCommand: ((command: string) => void) | null = null;

  constructor() {
    this.sttServer = new RealtimeSTTServer(8889);
  }

  async initialize(): Promise<void> {
    console.log("🎤 Initializing voice controller with RealtimeSTT...");

    // Set up transcription event handler
    this.sttServer.on("transcription", (message: TranscriptionMessage) => {
      this.handleTranscription(message);
    });

    // Start the TCP server
    await this.sttServer.start();

    this.isListening = true;
    console.log(
      "✅ Voice controller ready! Start the Python script: python3 realtime_stt_streamer.py"
    );
  }

  private handleTranscription(message: TranscriptionMessage): void {
    // Skip processing if muted for TTS
    if (this.isMutedForTTS) {
      console.log(
        "🔇 Voice recognition muted (TTS speaking), ignoring transcription"
      );
      return;
    }

    // Skip if empty text
    if (!message.text.trim()) {
      return;
    }

    const now = Date.now();
    const command = message.text.toLowerCase().trim();

    console.log(
      `🗣️ Received: "${message.text}" (${message.isFinal ? "final" : "live"})`
    );

    // Handle final transcription - guaranteed source of truth
    if (message.isFinal) {
      console.log(`🎯 Final transcription received - checking for commands`);
      
      const hasCommand = this.hasStrongCommandSignal(command);
      const commandType = this.extractCommandType(command);
      
      if (hasCommand && !this.liveCommandProcessed) {
        // Debounce rapid commands
        if (now - this.lastCommandTime < this.commandDebounceMs) {
          console.log(`🚫 Ignoring FINAL command (debounced): "${command}"`);
        } else {
          console.log(`✅ Processing FINAL command: "${command}"`);
          this.processCommand(command);
          this.lastCommandTime = now;
          this.liveCommandProcessed = true;
        }
      }
      
      // Reset tracking for next speech
      this.liveCommandCount = 0;
      this.lastDetectedCommand = "";
      this.liveCommandProcessed = false;
      console.log(`🔄 Reset command tracking for next speech`);
      return;
    }

    // Handle live transcription - wait for 3 consecutive matches
    const hasCommand = this.hasStrongCommandSignal(command);
    
    if (hasCommand) {
      const commandType = this.extractCommandType(command);
      
      if (commandType === this.lastDetectedCommand) {
        // Same command detected again
        this.liveCommandCount++;
        console.log(`🔄 Live command "${commandType}" count: ${this.liveCommandCount}/3`);
      } else {
        // New/different command detected
        this.lastDetectedCommand = commandType;
        this.liveCommandCount = 1;
        console.log(`🆕 New live command detected: "${commandType}" (1/3)`);
      }
      
      // Process after 3 consecutive detections (if not already processed)
      if (this.liveCommandCount >= 3 && !this.liveCommandProcessed) {
        // Debounce rapid commands
        if (now - this.lastCommandTime < this.commandDebounceMs) {
          console.log(`🚫 Ignoring LIVE command (debounced): "${command}"`);
          return;
        }
        
        console.log(`🎯 Processing LIVE command after 3 detections: "${command}"`);
        this.processCommand(command);
        this.lastCommandTime = now;
        this.liveCommandProcessed = true;
      }
    } else {
      // No command detected, reset counters
      if (this.liveCommandCount > 0) {
        console.log(`🔄 No command in transcription, resetting counters`);
        this.liveCommandCount = 0;
        this.lastDetectedCommand = "";
      }
    }
  }

  private hasStrongCommandSignal(text: string): boolean {
    // Check if text contains clear command words that we should act on immediately
    const lowerText = text.toLowerCase();

    // Check for "i like up" and "i like down" commands (more specific to avoid false triggers)
    if (this.containsPhrase(lowerText, ["i like up", "i like down"])) {
      return true;
    }

    // Check for media controls
    const mediaCommands = ["play", "pause", "stop"];
    return mediaCommands.some((cmd) => this.containsWord(lowerText, cmd));
  }

  private extractCommandType(text: string): string {
    // Extract which specific command type was detected
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('i like up')) return 'up';
    if (lowerText.includes('i like down')) return 'down';
    if (this.containsWord(lowerText, 'play')) return 'play';
    if (this.containsWord(lowerText, 'pause')) return 'pause';
    if (this.containsWord(lowerText, 'stop')) return 'stop';
    
    return '';
  }

  private async processCommand(command: string): Promise<void> {
    console.log(`🎯 Processing command: "${command}"`);

    // Only respond to "i like up" or "i like down" commands

    // Check for "i like up" command
    if (command.toLowerCase().includes('i like up')) {
      console.log("🎯 Detected command: I LIKE UP → TOP");
      console.log(`🚀 RUNNING VOTE DUE TO DETECTED COMMAND: "${command}"`);
      this.executeCommand("top");
      return;
    }

    // Check for "i like down" command
    if (command.toLowerCase().includes('i like down')) {
      console.log("🎯 Detected command: I LIKE DOWN → BOTTOM");
      console.log(`🚀 RUNNING VOTE DUE TO DETECTED COMMAND: "${command}"`);
      this.executeCommand("bottom");
      return;
    }

    // Media controls
    if (this.containsAnyWord(command, ["pause", "stop"])) {
      console.log("🎯 Detected command: PAUSE");
      this.executeCommand("pause");
      return;
    }

    if (this.containsAnyWord(command, ["play", "resume", "start"])) {
      console.log("🎯 Detected command: PLAY");
      this.executeCommand("play");
      return;
    }

    console.log(
      `❓ No matching command found in: "${command}" (only 'i like up', 'i like down', 'pause', 'play' are recognized)`
    );
  }

  private containsWord(text: string, word: string): boolean {
    // Match the word at word boundaries
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(text);
  }

  private containsAnyWord(text: string, words: string[]): boolean {
    // Check if text contains any of the given words
    return words.some((word) => this.containsWord(text, word));
  }

  private containsPhrase(text: string, phrases: string[]): boolean {
    // Check if text contains any of the given phrases
    const lowerText = text.toLowerCase();
    return phrases.some((phrase) => lowerText.includes(phrase.toLowerCase()));
  }


  private async executeCommand(cmd: string): Promise<void> {
    const handler = this.commandHandlers.get(cmd);
    if (handler) {
      try {
        await handler();
      } catch (error) {
        console.error(`❌ Error executing handler for "${cmd}":`, error);
      }
    }

    // Also call the onCommand callback if set
    if (this.onCommand) {
      this.onCommand(cmd);
    }
  }

  registerCommand(command: string, handler: () => Promise<void>): void {
    this.commandHandlers.set(command, handler);
  }

  // Mute voice recognition during TTS to prevent interference
  muteForTTS(): void {
    console.log("🔇 Muting voice recognition for TTS");
    this.isMutedForTTS = true;
  }

  // Unmute voice recognition after TTS completes
  unmuteAfterTTS(): void {
    console.log("🔊 Unmuting voice recognition after TTS");
    this.isMutedForTTS = false;
  }

  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up voice controller...");
    this.isListening = false;

    // Stop the RealtimeSTT server
    this.sttServer.stop();

    console.log("✅ Voice controller cleanup completed");
  }

  // Check if RealtimeSTT client is connected
  isConnected(): boolean {
    return this.sttServer.isConnected();
  }
}
