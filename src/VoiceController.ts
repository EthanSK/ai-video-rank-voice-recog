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
  
  public onCommand: ((command: string) => void) | null = null;

  async initialize(): Promise<void> {
    console.log('🎤 Initializing voice controller...');
    
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
    console.log('🎙️ 🗣️ Real-time speech recognition active...');
    
    // Use SoX to record audio in shorter chunks for near real-time processing
    this.recordingProcess = spawn('sox', [
      '-t', 'coreaudio', 
      'default',  // Use default microphone on macOS
      '-r', '16000',  // 16kHz sample rate (good for speech)
      '-c', '1',      // Mono
      '-b', '16',     // 16-bit
      '-t', 'wav',    // WAV format
      this.tempAudioFile,
      'trim', '0', '1.5'  // Record 1.5-second chunks for faster processing
    ], {
      stdio: ['pipe', 'ignore', 'ignore']  // Suppress all SoX output
    });

    // No SoX output logging - completely silent

    this.recordingProcess.on('exit', (code) => {
      if (code === 0) {
        this.processAudioChunk();
      }
      
      // Restart recording immediately for continuous listening
      if (this.isListening) {
        setTimeout(() => this.startContinuousListening(), 100);
      }
    });

    this.recordingProcess.on('error', (error) => {
      if (this.isListening) {
        setTimeout(() => this.startContinuousListening(), 1000);
      }
    });

    this.isListening = true;
  }

  private async processAudioChunk(): Promise<void> {
    if (!fs.existsSync(this.tempAudioFile)) {
      return;
    }
    
    const stats = fs.statSync(this.tempAudioFile);
    // Only process if there's meaningful audio (more than just silence)
    if (stats.size < 10000) { // Skip very small files (likely silence)
      return;
    }

    try {
      // Use whisper to transcribe the audio chunk
      const transcription = await this.transcribeAudio(this.tempAudioFile);
      
      if (transcription.trim()) {
        console.log(`🗣️ "${transcription.trim()}"`);
        await this.processCommand(transcription.toLowerCase().trim());
      } else {
        console.log('🔇 No speech detected in audio chunk');
      }

      // Clean up the temporary file
      fs.unlinkSync(this.tempAudioFile);
      
    } catch (error) {
      console.error('🎤 Error processing audio chunk:', error);
    }
  }

  private async transcribeAudio(audioFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use virtual environment whisper path
      const whisperPath = path.join(process.cwd(), 'venv', 'bin', 'whisper');
      const whisperProcess = spawn(whisperPath, [
        audioFile,
        '--model', 'tiny',  // Much smaller and faster model
        '--output_format', 'txt',
        '--output_dir', path.dirname(audioFile),
        '--verbose', 'False'
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      let output = '';
      let error = '';

      if (whisperProcess.stdout) {
        whisperProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
      }

      if (whisperProcess.stderr) {
        whisperProcess.stderr.on('data', (data) => {
          const message = data.toString();
          error += message;
          // Only log actual errors, not progress bars
          if (message.includes('Error') || message.includes('Failed')) {
            console.log('🎤 Whisper error:', message.trim());
          }
        });
      }

      whisperProcess.on('exit', (code) => {
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
        reject(err);
      });
      
      // Add timeout to prevent hanging (shorter for real-time feel)
      setTimeout(() => {
        if (!whisperProcess.killed) {
          whisperProcess.kill('SIGTERM');
          resolve(''); // Return empty instead of error for timeout
        }
      }, 5000); // 5 second timeout for faster response
    });
  }

  private async processCommand(command: string): Promise<void> {
    // Look for command keywords
    const commands = ['top', 'bottom', 'play', 'pause'];
    
    for (const cmd of commands) {
      if (command.includes(cmd)) {
        const handler = this.commandHandlers.get(cmd);
        if (handler) {
          console.log(`✨ KEYWORD DETECTED: "${cmd}" - Executing action`);
          await handler();
          return;
        }
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
      this.recordingProcess.kill('SIGTERM');
    }

    if (this.whisperProcess) {
      this.whisperProcess.kill('SIGTERM');
    }

    // Clean up temp files
    if (fs.existsSync(this.tempAudioFile)) {
      fs.unlinkSync(this.tempAudioFile);
    }
  }
}