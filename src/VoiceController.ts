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
    
    // Process commands on both live and final transcriptions for better responsiveness
    // But prioritize final transcriptions for accuracy
    const shouldProcess = message.isFinal || 
                         (message.text.length > 3 && this.hasStrongCommandSignal(message.text));
    
    if (shouldProcess) {
      this.processCommand(message.text.toLowerCase().trim());
      this.lastCommandTime = now;
    }
  }

  private hasStrongCommandSignal(text: string): boolean {
    // Check if text contains clear command words that we should act on immediately
    const strongCommands = [
      'top', 'bottom', 'first', 'second', 
      'one', 'two', 'too', 'to', '1', '2',
      'play', 'pause', 'stop'
    ];
    
    const lowerText = text.toLowerCase();
    return strongCommands.some(cmd => this.containsWord(lowerText, cmd));
  }

  private async processCommand(command: string): Promise<void> {
    console.log(`🎯 Processing command: "${command}"`);
    
    // More resilient command detection - check for multiple patterns
    
    // TOP commands - detect "top" anywhere in the phrase
    if (this.containsAnyWord(command, ['top', 'first', 'one', '1'])) {
      console.log('🎯 Detected command: TOP');
      this.executeCommand('top');
      return;
    }
    
    // BOTTOM commands - detect "bottom" anywhere in the phrase
    if (this.containsAnyWord(command, ['bottom', 'second', 'two', 'too', 'to', '2'])) {
      console.log('🎯 Detected command: BOTTOM'); 
      this.executeCommand('bottom');
      return;
    }
    
    // Media controls
    if (this.containsAnyWord(command, ['pause', 'stop'])) {
      console.log('🎯 Detected command: PAUSE');
      this.executeCommand('pause');
      return;
    }
    
    if (this.containsAnyWord(command, ['play', 'resume', 'start'])) {
      console.log('🎯 Detected command: PLAY');
      this.executeCommand('play');
      return;
    }
    
    console.log(`❓ No matching command found in: "${command}"`);
  }

  private containsWord(text: string, word: string): boolean {
    // Match the word at word boundaries
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(text);
  }

  private containsAnyWord(text: string, words: string[]): boolean {
    // Check if text contains any of the given words
    return words.some(word => this.containsWord(text, word));
  }

  private containsPhrase(text: string, phrases: string[]): boolean {
    // Check if text contains any of the given phrases
    const lowerText = text.toLowerCase();
    return phrases.some(phrase => lowerText.includes(phrase.toLowerCase()));
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