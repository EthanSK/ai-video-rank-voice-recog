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
  private isDownloadingModel = false;
  private allowLongDownload = false;
  private isMutedForTTS = false; // New: mute voice recognition during TTS
  
  public onCommand: ((command: string) => void) | null = null;

  async initialize(allowLongDownload: boolean = false): Promise<void> {
    console.log('🎤 Initializing voice controller...');
    
    // Set model preference based on flag
    this.allowLongDownload = allowLongDownload;
    
    // Show current audio device
    await this.showAudioDevice();
    
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
    
    console.log('🎙️ Starting parallel continuous speech recognition...');
    
    // Use 2-second chunks recorded every 2 seconds for perfect continuous coverage
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
      'trim', '0', '2',  // 2 seconds - perfect for continuous processing
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
          // Restart immediately for continuous 2-second chunks
          setTimeout(() => {
            if (this.isListening) {
              this.startContinuousListening();
            }
          }, 2000); // 2 second intervals for perfect coverage
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
    // Allow multiple whisper processes to run in parallel for continuous processing
    // No need to drop chunks - process them all

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
    
    // Only process if there's meaningful audio (adjusted for 2-second chunks)
    if (stats.size < 6000) {
      console.log(`🔇 Audio chunk too small (${stats.size} bytes, likely silence), skipping`);
      try { fs.unlinkSync(audioFile); } catch {}
      return;
    }
    
    console.log(`🎵 Processing ${(stats.size / 1024).toFixed(1)}KB audio chunk (2-second recording) [PARALLEL]`);

    try {
      // Play audio chunk for debugging (non-blocking - don't await)
      this.playAudioChunk(audioFile); // No await - let it play while we process
      
      // Use whisper to transcribe the audio chunk
      const transcription = await this.transcribeAudio(audioFile);
      
      if (transcription.trim()) {
        console.log(`🗣️ Whisper transcribed: "${transcription.trim()}"`);
        await this.processCommand(transcription.toLowerCase().trim());
      } else {
        console.log(`🔇 Whisper returned empty transcription (silence or unclear audio)`);
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
      
      // Dynamic timeout - optimized for 2-second chunks
      let timeoutMs = 6000; // Default 6 seconds for 2-second audio chunks
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
    
    // Check for left/right commands 
    if (this.containsWord(command, 'left') || this.containsWord(command, 'first') || 
        this.containsWord(command, 'top')) {
      console.log('🎯 Detected command: left');
      this.executeCommand('top'); // Still maps to 'top' internally for compatibility
      return;
    }
    
    if (this.containsWord(command, 'right') || this.containsWord(command, 'second') || 
        this.containsWord(command, 'bottom')) {
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

  // Show current audio input device
  private async showAudioDevice(): Promise<void> {
    return new Promise((resolve) => {
      const process = spawn('system_profiler', ['SPAudioDataType'], { stdio: 'pipe' });
      let output = '';
      
      if (process.stdout) {
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
      }
      
      process.on('exit', () => {
        const lines = output.split('\n');
        const inputDevices = lines.filter(line => 
          line.includes('Input') || line.includes('Microphone') || line.includes('Built-in')
        );
        
        if (inputDevices.length > 0) {
          console.log('🎙️ Audio input devices:');
          inputDevices.forEach(device => {
            console.log(`   ${device.trim()}`);
          });
        } else {
          console.log('🎙️ Using default CoreAudio input device');
        }
        resolve();
      });
      
      process.on('error', () => {
        console.log('🎙️ Using default CoreAudio input device');
        resolve();
      });
    });
  }

  // Play audio chunk for debugging (non-blocking)
  private playAudioChunk(audioFile: string): void {
    console.log('🔊 Playing audio chunk for debugging (parallel)...');
    const playProcess = spawn('afplay', [audioFile], { stdio: 'ignore' });
    
    playProcess.on('exit', () => {
      console.log('🔊 Audio chunk playback finished');
    });
    
    playProcess.on('error', () => {
      console.log('⚠️ Could not play audio chunk (afplay not available)');
    });
    
    // Auto-kill after 3 seconds to prevent hanging
    setTimeout(() => {
      if (!playProcess.killed) {
        playProcess.kill();
      }
    }, 3000);
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