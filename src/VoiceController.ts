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
  
  // Memory leak prevention
  private activeTimeouts: Set<NodeJS.Timeout> = new Set();
  private audioFileQueue: string[] = [];
  private maxAudioFiles = 3; // Limit concurrent audio files
  private restartCount = 0;
  private maxRestarts = 10; // Circuit breaker
  private lastRestartTime = 0;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private processStartTime = Date.now();
  
  public onCommand: ((command: string) => void) | null = null;

  async initialize(allowLongDownload: boolean = false): Promise<void> {
    console.log('🎤 Initializing voice controller...');
    
    // Set model preference based on flag
    this.allowLongDownload = allowLongDownload;
    
    // Start memory monitoring
    this.startMemoryMonitoring();
    
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

  private startMemoryMonitoring(): void {
    // Log memory usage every 5 minutes to detect leaks
    this.memoryCheckInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const uptimeMinutes = Math.floor((Date.now() - this.processStartTime) / 60000);
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const rssMemMB = Math.round(memUsage.rss / 1024 / 1024);
      
      console.log(`🧠 Memory Status [${uptimeMinutes}m]: Heap ${heapUsedMB}MB, RSS ${rssMemMB}MB, Active timeouts: ${this.activeTimeouts.size}, Audio files: ${this.audioFileQueue.length}, Restarts: ${this.restartCount}`);
      
      // Warning thresholds
      if (heapUsedMB > 200) {
        console.log('⚠️ High heap memory usage detected - potential memory leak');
      }
      if (this.activeTimeouts.size > 10) {
        console.log('⚠️ High timeout count detected - potential timer leak');
      }
      if (this.audioFileQueue.length > 5) {
        console.log('⚠️ High audio file count detected - cleaning up old files');
        this.cleanupOldAudioFiles();
      }
    }, 300000); // Every 5 minutes
    
    this.activeTimeouts.add(this.memoryCheckInterval);
  }

  private cleanupOldAudioFiles(): void {
    // Remove oldest audio files if we have too many
    while (this.audioFileQueue.length > this.maxAudioFiles) {
      const oldFile = this.audioFileQueue.shift();
      if (oldFile) {
        try {
          if (fs.existsSync(oldFile)) {
            fs.unlinkSync(oldFile);
            console.log(`🗑️ Cleaned up old audio file: ${path.basename(oldFile)}`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to cleanup old audio file: ${error}`);
        }
      }
    }
  }

  private safeSetTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeout = setTimeout(() => {
      this.activeTimeouts.delete(timeout);
      callback();
    }, delay);
    this.activeTimeouts.add(timeout);
    return timeout;
  }

  private clearAllTimeouts(): void {
    for (const timeout of this.activeTimeouts) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();
  }
  private startContinuousListening(): void {
    // Circuit breaker: stop if too many restarts in short time
    const now = Date.now();
    if (this.restartCount > this.maxRestarts && (now - this.lastRestartTime) < 300000) { // 5 minutes
      console.log('🛑 Circuit breaker activated - too many restarts, stopping voice recognition');
      this.isListening = false;
      return;
    }
    
    // Reset restart counter if enough time has passed
    if ((now - this.lastRestartTime) > 600000) { // 10 minutes
      this.restartCount = 0;
    }
    
    // Ensure we cleanup any existing recording process first
    this.cleanupRecordingProcess();
    
    console.log('🎙️ Starting continuous speech recognition...');
    
    // Use limited pool of audio files instead of infinite unique names
    const audioIndex = this.audioFileQueue.length % this.maxAudioFiles;
    const audioFile = path.join(
      os.tmpdir(),
      `voice_control_audio_${audioIndex}.wav`
    );

    // Track this audio file
    if (!this.audioFileQueue.includes(audioFile)) {
      this.audioFileQueue.push(audioFile);
    }

    this.recordingProcess = spawn('sox', [
      '-t', 'coreaudio',
      'default',
      '-r', '16000',
      '-c', '1',
      '-b', '16',
      '-e', 'signed-integer',
      '-t', 'wav',
      audioFile,
      'trim', '0', '3'  // 3 seconds - better for voice command detection
    ], {
      stdio: ['ignore', 'ignore', 'ignore']
    });

    // Ensure we can clean up this process
    if (this.recordingProcess) {
      this.recordingProcess.on('exit', (code) => {
        // Clear the process reference immediately
        this.recordingProcess = null;
        
        if (code === 0) {
          // Process this audio chunk
          this.processAudioChunk(audioFile);
        } else {
          // Clean up failed/partial file if present
          this.safeCleanupFile(audioFile);
        }
        
        // Restart recording with backoff for continuous operation
        if (this.isListening) {
          const delay = this.calculateBackoffDelay();
          this.safeSetTimeout(() => {
            if (this.isListening) { // Double check we're still listening
              this.startContinuousListening();
            }
          }, delay);
        }
      });

      this.recordingProcess.on('error', (error) => {
        console.error('🎤 Recording process error:', error.message);
        this.recordingProcess = null;
        this.restartCount++;
        this.lastRestartTime = Date.now();
        
        if (this.isListening && this.restartCount <= this.maxRestarts) {
          console.log(`🎙️ Restarting voice recognition after error (attempt ${this.restartCount}/${this.maxRestarts})...`);
          this.safeSetTimeout(() => {
            if (this.isListening) {
              this.startContinuousListening();
            }
          }, 2000);
        }
      });
    }

    this.isListening = true;
  }

  private calculateBackoffDelay(): number {
    if (this.isDownloadingModel && this.allowLongDownload) {
      return 60000; // 1 minute during download
    }
    // Exponential backoff for errors
    if (this.restartCount > 0) {
      return Math.min(1000 * Math.pow(2, this.restartCount), 30000); // Max 30 seconds
    }
    return 100; // Normal restart delay
  }

  private cleanupRecordingProcess(): void {
    if (this.recordingProcess && !this.recordingProcess.killed) {
      try {
        this.recordingProcess.removeAllListeners();
        this.recordingProcess.kill('SIGTERM');
        // Give it a moment to terminate gracefully
        setTimeout(() => {
          if (this.recordingProcess && !this.recordingProcess.killed) {
            this.recordingProcess.kill('SIGKILL');
          }
        }, 1000);
      } catch (error) {
        console.log('⚠️ Error cleaning up recording process:', error);
      }
      this.recordingProcess = null;
    }
  }

  private safeCleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      // Silently ignore cleanup errors
    }
  }

  private async processAudioChunk(audioFile: string): Promise<void> {
    if (this.processingInProgress) {
      // Drop this chunk to avoid overlapping processing and file contention
      this.safeCleanupFile(audioFile);
      return;
    }

    // If model is downloading and we don't allow long downloads, skip processing
    if (this.isDownloadingModel && !this.allowLongDownload) {
      this.safeCleanupFile(audioFile);
      return;
    }

    if (!fs.existsSync(audioFile)) {
      return;
    }
    
    let stats;
    try {
      stats = fs.statSync(audioFile);
    } catch (error) {
      // File doesn't exist or can't be accessed
      return;
    }
    
    // Only process if there's meaningful audio (more than just silence)
    if (stats.size < 8000) {
      this.safeCleanupFile(audioFile);
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
      this.safeCleanupFile(audioFile);
      
    } catch (error) {
      console.error('🎤 Error processing audio chunk:', error);
      // Clean up the temporary file even on error
      this.safeCleanupFile(audioFile);
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
          this.activeTimeouts.delete(timeoutId);
          timeoutId = null;
        }
        if (whisperProcess && !whisperProcess.killed) {
          try {
            whisperProcess.removeAllListeners();
            whisperProcess.kill('SIGTERM');
            // Force kill after 2 seconds
            setTimeout(() => {
              if (whisperProcess && !whisperProcess.killed) {
                whisperProcess.kill('SIGKILL');
              }
            }, 2000);
          } catch (error) {
            // Ignore cleanup errors
          }
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
          try {
            if (fs.existsSync(textFile)) {
              const transcription = fs.readFileSync(textFile, 'utf8');
              this.safeCleanupFile(textFile); // Clean up immediately
              resolveOnce(transcription);
            } else {
              resolveOnce('');
            }
          } catch (error) {
            resolveOnce(''); // Don't fail on cleanup errors
          }
        } else {
          rejectOnce(new Error(`Whisper failed: ${error}`));
        }
      });

      whisperProcess.on('error', (err) => {
        if (isResolved) return;
        
        // Try system whisper as fallback
        console.log('⚠️ Primary whisper failed, trying system fallback...');
        try {
          const fallbackProcess = spawn('whisper', whisperArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
          whisperProcess = fallbackProcess; // Update reference
          this.whisperProcess = fallbackProcess;
          
          fallbackProcess.on('exit', (code) => {
            if (isResolved) return;
            
            if (code === 0) {
              const textFile = audioFile.replace('.wav', '.txt');
              try {
                if (fs.existsSync(textFile)) {
                  const transcription = fs.readFileSync(textFile, 'utf8');
                  this.safeCleanupFile(textFile);
                  resolveOnce(transcription);
                } else {
                  resolveOnce('');
                }
              } catch (error) {
                resolveOnce('');
              }
            } else {
              rejectOnce(err);
            }
          });

          fallbackProcess.on('error', () => rejectOnce(err));
        } catch (fallbackError) {
          rejectOnce(err);
        }
      });
      
      // Dynamic timeout - much longer if allowing long downloads, or if currently downloading
      let timeoutMs = 5000; // Default 5 seconds
      if (this.allowLongDownload) {
        timeoutMs = 300000; // 5 minutes if flag is set
      }
      
      timeoutId = this.safeSetTimeout(() => {
        if (isResolved) return;
        
        if (!whisperProcess.killed) {
          // Don't kill if currently downloading and we allow long downloads
          if (this.isDownloadingModel && this.allowLongDownload) {
            console.log('🤖 Download in progress, extending timeout...');
            // Extend timeout for another 5 minutes
            timeoutId = this.safeSetTimeout(() => {
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
        this.containsWord(command, 'second') || this.containsWord(command, 'bottom') || 
        this.containsWord(command, 'right')) {
      console.log('🎯 Detected command for option 2'); 
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

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up voice controller...');
    this.isListening = false;

    // Clear all timeouts first
    this.clearAllTimeouts();
    
    // Stop memory monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    // Clean up recording process
    this.cleanupRecordingProcess();

    // Clean up whisper process
    if (this.whisperProcess) {
      console.log('🛑 Stopping whisper process...');
      try {
        this.whisperProcess.removeAllListeners();
        this.whisperProcess.kill('SIGTERM');
        // Force kill after 2 seconds
        setTimeout(() => {
          if (this.whisperProcess && !this.whisperProcess.killed) {
            this.whisperProcess.kill('SIGKILL');
          }
          this.whisperProcess = null;
        }, 2000);
      } catch (error) {
        console.log('⚠️ Error cleaning up whisper process:', error);
      }
    }

    // Clean up temp files (legacy single file and new per-chunk files)
    console.log('🗑️ Cleaning up temporary audio files...');
    this.safeCleanupFile(this.tempAudioFile);

    // Clean up all tracked audio files
    for (const audioFile of this.audioFileQueue) {
      this.safeCleanupFile(audioFile);
      // Also clean up any corresponding .txt files
      this.safeCleanupFile(audioFile.replace('.wav', '.txt'));
    }
    this.audioFileQueue = [];

    // Remove all voice_control_audio_* files from temp directory
    try {
      const tempDir = os.tmpdir();
      const entries = fs.readdirSync(tempDir);
      let cleanedCount = 0;
      for (const entry of entries) {
        if (entry.startsWith('voice_control_audio_') && (entry.endsWith('.wav') || entry.endsWith('.txt'))) {
          try { 
            fs.unlinkSync(path.join(tempDir, entry)); 
            cleanedCount++;
          } catch {}
        }
      }
      if (cleanedCount > 0) {
        console.log(`🗑️ Cleaned up ${cleanedCount} orphaned audio files`);
      }
    } catch (error) {
      console.log('⚠️ Error during temp file cleanup:', error);
    }
    
    // Log final memory status
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const rssMemMB = Math.round(memUsage.rss / 1024 / 1024);
    console.log(`📊 Final memory usage: Heap ${heapUsedMB}MB, RSS ${rssMemMB}MB`);
    
    console.log('✅ Voice controller cleanup completed');
  }
}