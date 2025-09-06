import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class VoiceController {
  private recordingProcess: ChildProcess | null = null;
  private whisperProcess: ChildProcess | null = null;
  private commandHandlers: Map<string, () => Promise<void>> = new Map();
  private isListening = false;
  private tempAudioFile = path.join(os.tmpdir(), 'voice_control_audio.wav');
  private processingInProgress = false;
  private isDownloadingModel = false;
  private allowLongDownload = false;
  private isMutedForTTS = false; // New: mute voice recognition during TTS
  
  public onCommand: ((command: string) => void) | null = null;

  async initialize(allowLongDownload: boolean = false): Promise<void> {
    console.log('🎤 Initializing voice controller...');
    
    // Set model preference based on flag
    this.allowLongDownload = allowLongDownload;
    
    // Check if whisper is available (you'll need to install it separately)
    try {
      await this.checkWhisperInstallation();
      console.log('✅ Whisper installation found');
    } catch (error) {
      console.log('⚠️ Whisper not found. Please install whisper for voice recognition.');
      console.log('📋 Install with: pip install openai-whisper');
      throw error;
    }
    
    this.startContinuousListening();
  }

  private async checkWhisperInstallation(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try virtual environment path first, then system path
      const whisperPath = path.join(process.cwd(), 'venv', 'bin', 'whisper');
      const whisperProcess = spawn(whisperPath, ['--help'], { stdio: 'pipe' });
      
      whisperProcess.on('error', () => {
        // Fallback to system whisper
        const fallbackProcess = spawn('whisper', ['--help'], { stdio: 'pipe' });
        fallbackProcess.on('error', () => reject(new Error('Whisper not found')));
        fallbackProcess.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error('Whisper not working'));
        });
      });
      whisperProcess.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Whisper not working'));
      });
    });
  }

  private startContinuousListening(): void {
    // Ensure we cleanup any existing recording process first
    if (this.recordingProcess && !this.recordingProcess.killed) {
      this.recordingProcess.kill('SIGTERM');
      this.recordingProcess = null;
    }
    
    console.log('🎙️ Starting continuous speech recognition with improved reliability...');
    
    // Use 4-second chunks for better speech context and reliability
    const audioFile = path.join(
      os.tmpdir(),
      `voice_control_audio_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
    );

    this.recordingProcess = spawn('sox', [
      '-t', 'coreaudio',
      'default',
      '-r', '16000',      // 16kHz sample rate (good for speech)
      '-c', '1',          // Mono
      '-b', '16',         // 16-bit depth
      '-e', 'signed-integer',
      '-t', 'wav',
      audioFile,
      'trim', '0', '4',   // 4 seconds - longer chunks for better reliability
      'gain', '-n'        // Normalize audio levels
    ], {
      stdio: ['ignore', 'ignore', 'ignore']
    });

    this.recordingProcess.on('exit', (code) => {
      // Clear the process reference immediately
      this.recordingProcess = null;
      
      if (code === 0) {
        // Process this audio chunk
        this.processAudioChunk(audioFile);
      } else {
        // Clean up failed/partial file if present
        try {
          if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
        } catch {}
      }
      
      // Restart recording immediately for continuous operation
      if (this.isListening) {
        if (this.isDownloadingModel && this.allowLongDownload) {
          setTimeout(() => {
            if (this.isListening) { // Double check we're still listening
              this.startContinuousListening();
            }
          }, 60000);
          console.log('🤖 Waiting 1 minute before restarting voice recognition to allow download...');
        } else {
          // Slightly longer delay to prevent overlap issues and improve reliability
          setTimeout(() => {
            if (this.isListening) { // Double check we're still listening
              this.startContinuousListening();
            }
          }, 500); // 500ms delay instead of 100ms for better reliability
        }
      }
    });

    this.recordingProcess.on('error', (error) => {
      console.error('🎤 Recording process error:', error.message);
      this.recordingProcess = null;
      
      if (this.isListening) {
        console.log('🎙️ Restarting voice recognition after error...');
        setTimeout(() => {
          if (this.isListening) { // Double check we're still listening
            this.startContinuousListening();
          }
        }, 2000);
      }
    });

    this.isListening = true;
  }

  private async processAudioChunk(audioFile: string): Promise<void> {
    if (this.processingInProgress) {
      // Drop this chunk to avoid overlapping processing and file contention
      try {
        if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
      } catch {}
      return;
    }

    // Skip processing if muted for TTS
    if (this.isMutedForTTS) {
      console.log('🔇 Voice recognition muted (TTS speaking), dropping audio chunk');
      try {
        if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
      } catch {}
      return;
    }

    // If model is downloading and we don't allow long downloads, skip processing
    if (this.isDownloadingModel && !this.allowLongDownload) {
      try {
        if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
      } catch {}
      return;
    }

    if (!fs.existsSync(audioFile)) {
      return;
    }
    
    const stats = fs.statSync(audioFile);
    
    // Only process if there's meaningful audio (adjust threshold for 4-second chunks)
    if (stats.size < 12000) {  // Increased threshold for longer audio chunks
      console.log('🔇 Audio chunk too small (likely silence), skipping');
      try { fs.unlinkSync(audioFile); } catch {}
      return;
    }
    
    console.log(`🎵 Processing audio chunk: ${(stats.size / 1024).toFixed(1)}KB`);

    this.processingInProgress = true;

    try {
      // Use whisper to transcribe the audio chunk
      const transcription = await this.transcribeAudio(audioFile);
      
      if (transcription.trim()) {
        console.log(`🗣️ "${transcription.trim()}"`);
        await this.processCommand(transcription.toLowerCase().trim());
      }

      // Clean up the temporary file
      if (fs.existsSync(audioFile)) {
        fs.unlinkSync(audioFile);
      }
      
    } catch (error) {
      console.error('🎤 Error processing audio chunk:', error);
      // Clean up the temporary file even on error
      try {
        if (fs.existsSync(audioFile)) {
          fs.unlinkSync(audioFile);
        }
      } catch {}
    } finally {
      this.processingInProgress = false;
    }
  }

  private async transcribeAudio(audioFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Try virtual environment whisper path first, then system path
      const whisperPath = path.join(process.cwd(), 'venv', 'bin', 'whisper');
      const whisperArgs = [
        audioFile,
        '--model', 'base',        // Base model for good accuracy/speed balance
        '--output_format', 'txt',
        '--output_dir', path.dirname(audioFile),
        '--verbose', 'False',     // Disable verbose for cleaner logs
        '--language', 'en',       // Force English
        '--task', 'transcribe',   // Explicit transcribe task
        '--temperature', '0',     // More deterministic output
        '--best_of', '1',         // Faster processing
        '--beam_size', '1'        // Faster processing
      ];
      
      let whisperProcess = spawn(whisperPath, whisperArgs, { 
        stdio: ['pipe', 'pipe', 'pipe'] 
      });
      
      // Store reference for cleanup
      this.whisperProcess = whisperProcess;

      let output = '';
      let error = '';
      let timeoutId: NodeJS.Timeout | null = null;
      let isResolved = false;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (whisperProcess && !whisperProcess.killed) {
          whisperProcess.kill('SIGTERM');
        }
        this.whisperProcess = null;
      };

      const resolveOnce = (result: string) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(result);
        }
      };

      const rejectOnce = (err: Error) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(err);
        }
      };

      if (whisperProcess.stdout) {
        whisperProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
      }

      if (whisperProcess.stderr) {
        whisperProcess.stderr.on('data', (data) => {
          const msg = data.toString();
          error += msg;
          
          // Check if model is actually downloading (not just validating)
          if (msg.includes('re-downloading the file') || (msg.includes('%|') && msg.includes('MiB/s') && !msg.includes('100%|'))) {
            if (!this.isDownloadingModel) {
              this.isDownloadingModel = true;
              if (this.allowLongDownload) {
                console.log('🤖 Base model downloading - allowing time to complete...');
              } else {
                console.log('🤖 Base model downloading - use --allowLongDownload flag to avoid interruption');
              }
            }
            
            // Show download progress less frequently if allowing long download
            if (this.allowLongDownload && (msg.includes('%|') || msg.includes('MiB/s'))) {
              // Only show every 10% or so to reduce spam
              if (msg.includes('10%|') || msg.includes('20%|') || msg.includes('30%|') || 
                  msg.includes('40%|') || msg.includes('50%|') || msg.includes('60%|') || 
                  msg.includes('70%|') || msg.includes('80%|') || msg.includes('90%|') || 
                  msg.includes('100%|')) {
                console.log('📥 Download progress:', msg.trim());
              }
            }
          }
        });
      }

      whisperProcess.on('exit', (code) => {
        if (isResolved) return;
        
        // Reset download flag if it was downloading
        if (this.isDownloadingModel) {
          this.isDownloadingModel = false;
          if (code === 0) {
            console.log('🤖 Base model download completed - voice recognition ready!');
          }
        }
        
        if (code === 0) {
          // Read the generated text file
          const textFile = audioFile.replace('.wav', '.txt');
          if (fs.existsSync(textFile)) {
            const transcription = fs.readFileSync(textFile, 'utf8');
            fs.unlinkSync(textFile); // Clean up
            resolveOnce(transcription);
          } else {
            resolveOnce('');
          }
        } else {
          rejectOnce(new Error(`Whisper failed: ${error}`));
        }
      });

      whisperProcess.on('error', (err) => {
        if (isResolved) return;
        
        // Try system whisper as fallback
        console.log('⚠️ Primary whisper failed, trying system fallback...');
        const fallbackProcess = spawn('whisper', whisperArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
        whisperProcess = fallbackProcess; // Update reference
        this.whisperProcess = fallbackProcess;
        
        fallbackProcess.on('exit', (code) => {
          if (isResolved) return;
          
          if (code === 0) {
            const textFile = audioFile.replace('.wav', '.txt');
            if (fs.existsSync(textFile)) {
              const transcription = fs.readFileSync(textFile, 'utf8');
              fs.unlinkSync(textFile);
              resolveOnce(transcription);
            } else {
              resolveOnce('');
            }
          } else {
            rejectOnce(err);
          }
        });

        fallbackProcess.on('error', () => rejectOnce(err));
      });
      
      // Dynamic timeout - longer for 4-second chunks and better reliability
      let timeoutMs = 8000; // Default 8 seconds for 4-second audio chunks
      if (this.allowLongDownload) {
        timeoutMs = 300000; // 5 minutes if flag is set
      }
      
      timeoutId = setTimeout(() => {
        if (isResolved) return;
        
        if (!whisperProcess.killed) {
          // Don't kill if currently downloading and we allow long downloads
          if (this.isDownloadingModel && this.allowLongDownload) {
            console.log('🤖 Download in progress, extending timeout...');
            // Extend timeout for another 5 minutes
            timeoutId = setTimeout(() => {
              if (!isResolved && !whisperProcess.killed) {
                console.log('🤖 Download taking too long, killing process');
                resolveOnce('');
              }
            }, 300000);
            return;
          }
          
          if (this.allowLongDownload) {
            console.log('🤖 Base model processing taking too long, killing process');
          }
          resolveOnce(''); // Return empty instead of error for timeout
        }
      }, timeoutMs);
    });
  }

  private async processCommand(command: string): Promise<void> {
    console.log(`🎯 Processing command: "${command}"`);
    
    // Check for number commands first (more specific patterns)
    if (this.containsNumber(command, '1') || this.containsWord(command, 'one') || 
        this.containsWord(command, 'first') || this.containsWord(command, 'top') || 
        this.containsWord(command, 'left')) {
      console.log('🎯 Detected command for option 1');
      this.executeCommand('top');
      return;
    }
    
    if (this.containsNumber(command, '2') || this.containsWord(command, 'two') || 
        this.containsWord(command, 'too') || this.containsWord(command, 'to') ||
        this.containsWord(command, 'second') || this.containsWord(command, 'bottom') || 
        this.containsWord(command, 'right')) {
      console.log('🎯 Detected command for option 2 (including too/to)'); 
      this.executeCommand('bottom');
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

  private containsNumber(text: string, number: string): boolean {
    // Match the number as a standalone word or at word boundaries
    const regex = new RegExp(`\\b${number}\\b`, 'i');
    return regex.test(text);
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

    if (this.recordingProcess) {
      console.log('🛑 Stopping recording process...');
      this.recordingProcess.kill('SIGTERM');
    }

    if (this.whisperProcess) {
      console.log('🛑 Stopping whisper process...');
      this.whisperProcess.kill('SIGTERM');
    }

    // Clean up temp files (legacy single file and new per-chunk files)
    try {
      if (fs.existsSync(this.tempAudioFile)) {
        console.log('🗑️ Cleaning up temp audio file...');
        fs.unlinkSync(this.tempAudioFile);
      }
    } catch {}

    // Remove all voice_control_audio_* chunk files and their txt outputs
    try {
      const tempDir = os.tmpdir();
      const entries = fs.readdirSync(tempDir);
      for (const entry of entries) {
        if (entry.startsWith('voice_control_audio_') && (entry.endsWith('.wav') || entry.endsWith('.txt'))) {
          try { fs.unlinkSync(path.join(tempDir, entry)); } catch {}
        }
      }
    } catch {}
    
    console.log('✅ Voice controller cleanup completed');
  }
}