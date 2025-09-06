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
  private audioBuffer: string[] = [];
  private processingInProgress = false;
  private isDownloadingModel = false;
  private allowLongDownload = false;
  
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
    console.log('🎙️ Starting improved real-time speech recognition...');
    
    // Use shorter chunks (1.5 seconds) for faster response
    // Shorter chunks = faster detection but less context for Whisper
    const audioFile = path.join(
      os.tmpdir(),
      `voice_control_audio_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
    );

    this.recordingProcess = spawn('sox', [
      '-t', 'coreaudio',
      'default',
      '-r', '16000',
      '-c', '1',
      '-b', '16',
      '-e', 'signed-integer',
      '-t', 'wav',
      audioFile,
      'trim', '0', '1.5'  // Reduced from 3 to 1.5 seconds
    ], {
      stdio: ['ignore', 'ignore', 'ignore']
    });

    // Suppress SoX output completely for clean interface
    // (all stdio: 'ignore' in spawn options)

    this.recordingProcess.on('exit', (code) => {
      if (code === 0) {
        this.processAudioChunk(audioFile);
      } else {
        // Clean up failed/partial file if present
        try {
          if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
        } catch {}
      }
      
      // Restart recording for continuous listening - but wait longer if downloading with allowLongDownload
      if (this.isListening) {
        let restartDelay = 100; // Default 100ms
        
        // If downloading and we allow long downloads, wait much longer before restarting
        if (this.isDownloadingModel && this.allowLongDownload) {
          restartDelay = 60000; // Wait 1 minute before restarting
          console.log('🤖 Waiting 1 minute before restarting voice recognition to allow download...');
        }
        
        setTimeout(() => this.startContinuousListening(), restartDelay);
      }
    });

    this.recordingProcess.on('error', (error) => {
      if (this.isListening) {
        setTimeout(() => this.startContinuousListening(), 2000);
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
    
    // Only process if there's meaningful audio (more than just silence)
    if (stats.size < 8000) {
      try { fs.unlinkSync(audioFile); } catch {}
      return;
    }

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
        '--model', 'base',  // Always use base model for better accuracy
        '--output_format', 'txt',
        '--output_dir', path.dirname(audioFile),
        '--verbose', 'False',  // Disable verbose for cleaner logs
        '--language', 'en',    // Force English
        '--task', 'transcribe'  // Explicit transcribe task
      ];
      
      const whisperProcess = spawn(whisperPath, whisperArgs, { 
        stdio: ['pipe', 'pipe', 'pipe'] 
      });

      let output = '';
      let error = '';

      if (whisperProcess.stdout) {
        whisperProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
      }

      if (whisperProcess.stderr) {
        whisperProcess.stderr.on('data', (data) => {
          const msg = data.toString();
          error += msg;
          
          // Check if model is downloading (always using base model now)
          if (msg.includes('downloading') || msg.includes('%|') || msg.includes('MiB/s')) {
            if (!this.isDownloadingModel) {
              this.isDownloadingModel = true;
              if (this.allowLongDownload) {
                console.log('🤖 Base model downloading - allowing time to complete...');
              } else {
                console.log('🤖 Base model downloading - use --allowLongDownload flag to avoid interruption');
              }
            }
            
            // Show download progress if allowing long download
            if (this.allowLongDownload && (msg.includes('%|') || msg.includes('MiB/s'))) {
              console.log('📥 Download progress:', msg.trim());
            }
          }
        });
      }

      whisperProcess.on('exit', (code) => {
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
            resolve(transcription);
          } else {
            resolve('');
          }
        } else {
          reject(new Error(`Whisper failed: ${error}`));
        }
      });

      whisperProcess.on('error', (err) => {
        // Try system whisper as fallback
        const fallbackProcess = spawn('whisper', whisperArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
        
        fallbackProcess.on('exit', (code) => {
          if (code === 0) {
            const textFile = audioFile.replace('.wav', '.txt');
            if (fs.existsSync(textFile)) {
              const transcription = fs.readFileSync(textFile, 'utf8');
              fs.unlinkSync(textFile);
              resolve(transcription);
            } else {
              resolve('');
            }
          } else {
            reject(err);
          }
        });

        fallbackProcess.on('error', () => reject(err));
      });
      
      // Dynamic timeout - much longer if allowing long downloads, or if currently downloading
      let timeoutMs = 5000; // Default 5 seconds
      if (this.allowLongDownload) {
        timeoutMs = 300000; // 5 minutes if flag is set
      }
      
      const timeoutId = setTimeout(() => {
        if (!whisperProcess.killed) {
          // Don't kill if currently downloading and we allow long downloads
          if (this.isDownloadingModel && this.allowLongDownload) {
            console.log('🤖 Download in progress, extending timeout...');
            // Restart timeout for another 5 minutes
            setTimeout(() => {
              if (!whisperProcess.killed) {
                console.log('🤖 Download taking too long, killing process');
                whisperProcess.kill('SIGTERM');
                resolve('');
              }
            }, 300000);
            return;
          }
          
          if (this.allowLongDownload) {
            console.log('🤖 Base model processing taking too long, killing process');
          }
          whisperProcess.kill('SIGTERM');
          resolve(''); // Return empty instead of error for timeout
        }
      }, timeoutMs);
    });
  }

  private async processCommand(command: string): Promise<void> {
    // Look for command keywords with better matching (check for pause first to avoid play conflicts)
    const commands = ['pause', 'play', 'top', 'bottom']; // Reorder to check pause before play
    
    for (const cmd of commands) {
      if (command.includes(cmd)) {        
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
        return;
      }
    }
  }

  registerCommand(command: string, handler: () => Promise<void>): void {
    this.commandHandlers.set(command, handler);
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