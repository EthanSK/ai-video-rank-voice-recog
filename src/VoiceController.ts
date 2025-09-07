import { RealtimeSTTServer, TranscriptionMessage } from './services/RealtimeSTTServer';

export class VoiceController {
  private sttServer: RealtimeSTTServer;
  private commandHandlers: Map<string, () => Promise<void>> = new Map();
  private isListening = false;
  private isMutedForTTS = false;
  private lastCommandTime = 0;
  private commandDebounceMs = 1000; // Prevent duplicate commands within 1 second
  
  public onCommand: ((command: string) => void) | null = null;

  constructor() {
    this.sttServer = new RealtimeSTTServer(8889);
  }

  async initialize(): Promise<void> {
    console.log('🎤 Initializing voice controller with RealtimeSTT...');
    
    // Set up transcription event handler
    this.sttServer.on('transcription', (message: TranscriptionMessage) => {
      this.handleTranscription(message);
    });
    
    // Start the TCP server
    await this.sttServer.start();
    
    this.isListening = true;
    console.log('✅ Voice controller ready! Start the Python script: python3 realtime_stt_streamer.py');
  }

  private handleTranscription(message: TranscriptionMessage): void {
    // Skip processing if muted for TTS
    if (this.isMutedForTTS) {
      console.log('🔇 Voice recognition muted (TTS speaking), ignoring transcription');
      return;
    }

    // Skip if empty text
    if (!message.text.trim()) {
      return;
    }

    // Debounce rapid commands
    const now = Date.now();
    if (now - this.lastCommandTime < this.commandDebounceMs) {
      console.log(`🚫 Ignoring command (debounced): "${message.text}"`);
      return;
    }

    console.log(`🗣️ Received: "${message.text}" (${message.isFinal ? 'final' : 'live'})`);
    
    // Process commands on final transcriptions for better accuracy
    if (message.isFinal) {
      this.processCommand(message.text.toLowerCase().trim());
      this.lastCommandTime = now;
    }
  }

  private async processCommand(command: string): Promise<void> {
    console.log(`🎯 Processing command: "${command}"`);
    
    // Check for left/right commands 
    if (this.containsWord(command, 'left') || this.containsWord(command, 'first') || 
        this.containsWord(command, 'top')) {
      console.log('🎯 Detected command: left');
      this.executeCommand('top'); // Still maps to 'top' internally for compatibility
      return;
    }
    
    // Enhanced number 2 detection - include 'too', 'to', 'two'
    if (this.containsWord(command, 'right') || this.containsWord(command, 'second') || 
        this.containsWord(command, 'bottom') || this.containsWord(command, 'two') ||
        this.containsWord(command, 'too') || this.containsWord(command, 'to')) {
      console.log('🎯 Detected command: right'); 
      this.executeCommand('bottom'); // Still maps to 'bottom' internally for compatibility
      return;
    }
    
    // Check for other commands (pause first to avoid play conflicts)
    const otherCommands = ['pause', 'play'];
    for (const cmd of otherCommands) {
      if (this.containsWord(command, cmd)) {        
        console.log(`🎯 Detected command: ${cmd}`);
        this.executeCommand(cmd);
        return;
      }
    }
    
    console.log(`❓ No matching command found in: "${command}"`);
  }

  private containsWord(text: string, word: string): boolean {
    // Match the word at word boundaries
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(text);
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
    console.log('🔇 Muting voice recognition for TTS');
    this.isMutedForTTS = true;
  }

  // Unmute voice recognition after TTS completes
  unmuteAfterTTS(): void {
    console.log('🔊 Unmuting voice recognition after TTS');
    this.isMutedForTTS = false;
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up voice controller...');
    this.isListening = false;

    // Stop the RealtimeSTT server
    this.sttServer.stop();
    
    console.log('✅ Voice controller cleanup completed');
  }

  // Check if RealtimeSTT client is connected
  isConnected(): boolean {
    return this.sttServer.isConnected();
  }
}