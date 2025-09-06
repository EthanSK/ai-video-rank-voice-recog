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
      const process = spawn(whisperPath, ['--help'], { stdio: 'pipe' });
      
      process.on('error', () => {
        // Fallback to system whisper
        const fallbackProcess = spawn('whisper', ['--help'], { stdio: 'pipe' });
        fallbackProcess.on('error', () => reject(new Error('Whisper not found')));
        fallbackProcess.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error('Whisper not working'));
        });
      });
      process.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Whisper not working'));
      });
    });
  }

  private startContinuousListening(): void {
    console.log('🔊 Starting continuous voice listening...');
    console.log('🎙️ Say "top", "bottom", "play", or "pause" to control the system');
    
    // Use SoX to record audio in chunks
    this.recordingProcess = spawn('sox', [
      '-t', 'coreaudio', 
      'default',  // Use default microphone on macOS
      '-r', '16000',  // 16kHz sample rate (good for speech)
      '-c', '1',      // Mono
      '-b', '16',     // 16-bit
      '-t', 'wav',    // WAV format
      this.tempAudioFile,
      'trim', '0', '3'  // Record 3-second chunks
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (this.recordingProcess.stderr) {
      this.recordingProcess.stderr.on('data', (data) => {
        // Suppress sox output unless it's an error
        const message = data.toString();
        if (message.includes('FAIL') || message.includes('ERROR')) {
          console.error('🎤 Recording error:', message);
        }
      });
    }

    this.recordingProcess.on('exit', (code) => {
      if (code === 0) {
        this.processAudioChunk();
      }
      
      // Restart recording for continuous listening
      if (this.isListening) {
        setTimeout(() => this.startContinuousListening(), 100);
      }
    });

    this.recordingProcess.on('error', (error) => {
      console.error('🎤 Recording process error:', error);
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

    try {
      // Use whisper to transcribe the audio chunk
      const transcription = await this.transcribeAudio(this.tempAudioFile);
      
      if (transcription.trim()) {
        console.log(`🗣️ Heard: "${transcription}"`);
        await this.processCommand(transcription.toLowerCase().trim());
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
        '--model', 'base',
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
          error += data.toString();
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
    });
  }

  private async processCommand(command: string): Promise<void> {
    // Look for command keywords
    const commands = ['top', 'bottom', 'play', 'pause'];
    
    for (const cmd of commands) {
      if (command.includes(cmd)) {
        const handler = this.commandHandlers.get(cmd);
        if (handler) {
          console.log(`🎯 Executing command: ${cmd}`);
          await handler();
          return;
        }
      }
    }
  }

  onCommand(command: string, handler: () => Promise<void>): void {
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