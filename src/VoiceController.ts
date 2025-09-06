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
    console.log('🎙️ Starting improved real-time speech recognition...');
    
    // Use longer chunks (3 seconds) for better speech recognition
    // This gives Whisper more context while still being reasonably responsive
    this.recordingProcess = spawn('sox', [
      '-t', 'coreaudio', 
      'default',  // Use default microphone on macOS
      '-r', '16000',  // 16kHz sample rate (good for speech)
      '-c', '1',      // Mono
      '-b', '16',     // 16-bit
      '-t', 'wav',    // WAV format
      this.tempAudioFile,
      'trim', '0', '3'  // Record 3-second chunks for better speech context
    ], {
      stdio: ['pipe', 'pipe', 'pipe']  // Capture all outputs for debugging
    });

    // Log SoX status for debugging
    if (this.recordingProcess.stdout) {
      this.recordingProcess.stdout.on('data', (data) => {
        console.log('🎤 SoX output:', data.toString().trim());
      });
    }

    if (this.recordingProcess.stderr) {
      this.recordingProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          console.log('🎤 SoX status:', message);
        }
      });
    }

    this.recordingProcess.on('exit', (code) => {
      console.log(`🎤 SoX recording finished with code: ${code}`);
      if (code === 0) {
        this.processAudioChunk();
      }
      
      // Restart recording for continuous listening, but with a small delay
      if (this.isListening) {
        setTimeout(() => this.startContinuousListening(), 200);
      }
    });

    this.recordingProcess.on('error', (error) => {
      console.error('🎤 SoX recording error:', error);
      if (this.isListening) {
        setTimeout(() => this.startContinuousListening(), 2000);
      }
    });

    this.isListening = true;
  }

  private async processAudioChunk(): Promise<void> {
    if (this.processingInProgress) {
      console.log('🔄 Skipping audio processing - previous chunk still being processed');
      return;
    }

    if (!fs.existsSync(this.tempAudioFile)) {
      console.log('🔇 No audio file found to process');
      return;
    }
    
    const stats = fs.statSync(this.tempAudioFile);
    console.log(`🎤 Processing audio chunk: ${stats.size} bytes`);
    
    // Only process if there's meaningful audio (more than just silence)
    if (stats.size < 8000) { // Lowered threshold for 3-second chunks
      console.log('🔇 Audio chunk too small, likely silence');
      fs.unlinkSync(this.tempAudioFile);
      return;
    }

    this.processingInProgress = true;

    try {
      console.log('🤖 Sending audio to Whisper...');
      // Use whisper to transcribe the audio chunk
      const transcription = await this.transcribeAudio(this.tempAudioFile);
      
      if (transcription.trim()) {
        console.log(`🗣️  SPEECH DETECTED: "${transcription.trim()}"`);
        await this.processCommand(transcription.toLowerCase().trim());
      } else {
        console.log('🔇 Whisper returned no transcription');
      }

      // Clean up the temporary file
      if (fs.existsSync(this.tempAudioFile)) {
        fs.unlinkSync(this.tempAudioFile);
      }
      
    } catch (error) {
      console.error('🎤 Error processing audio chunk:', error);
      // Clean up the temporary file even on error
      if (fs.existsSync(this.tempAudioFile)) {
        fs.unlinkSync(this.tempAudioFile);
      }
    } finally {
      this.processingInProgress = false;
    }
  }

  private async transcribeAudio(audioFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('🤖 Starting Whisper transcription...');
      
      // Try virtual environment whisper path first, then system path
      const whisperPath = path.join(process.cwd(), 'venv', 'bin', 'whisper');
      const whisperArgs = [
        audioFile,
        '--model', 'tiny',  // Fast but less accurate model for real-time
        '--output_format', 'txt',
        '--output_dir', path.dirname(audioFile),
        '--verbose', 'True',  // Enable verbose for debugging
        '--language', 'en'    // Force English for better performance
      ];

      console.log(`🤖 Running: ${whisperPath} ${whisperArgs.join(' ')}`);
      
      const whisperProcess = spawn(whisperPath, whisperArgs, { 
        stdio: ['pipe', 'pipe', 'pipe'] 
      });

      let output = '';
      let error = '';

      if (whisperProcess.stdout) {
        whisperProcess.stdout.on('data', (data) => {
          const message = data.toString();
          output += message;
          console.log('🤖 Whisper stdout:', message.trim());
        });
      }

      if (whisperProcess.stderr) {
        whisperProcess.stderr.on('data', (data) => {
          const message = data.toString();
          error += message;
          console.log('🤖 Whisper stderr:', message.trim());
        });
      }

      whisperProcess.on('exit', (code) => {
        console.log(`🤖 Whisper finished with code: ${code}`);
        if (code === 0) {
          // Read the generated text file
          const textFile = audioFile.replace('.wav', '.txt');
          if (fs.existsSync(textFile)) {
            const transcription = fs.readFileSync(textFile, 'utf8');
            fs.unlinkSync(textFile); // Clean up
            console.log(`🤖 Whisper transcription: "${transcription.trim()}"`);
            resolve(transcription);
          } else {
            console.log('🤖 No transcription file generated');
            resolve('');
          }
        } else {
          console.error(`🤖 Whisper failed with code ${code}: ${error}`);
          reject(new Error(`Whisper failed: ${error}`));
        }
      });

      whisperProcess.on('error', (err) => {
        console.error('🤖 Whisper process error:', err);
        // Try system whisper as fallback
        console.log('🤖 Trying system whisper...');
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
      
      // Increase timeout for better transcription quality
      setTimeout(() => {
        if (!whisperProcess.killed) {
          console.log('🤖 Whisper timeout, killing process');
          whisperProcess.kill('SIGTERM');
          resolve(''); // Return empty instead of error for timeout
        }
      }, 10000); // 10 second timeout
    });
  }

  private async processCommand(command: string): Promise<void> {
    console.log(`🎯 Processing command: "${command}"`);
    
    // Look for command keywords with better matching
    const commands = ['top', 'bottom', 'play', 'pause'];
    
    for (const cmd of commands) {
      if (command.includes(cmd)) {
        console.log(`✨ COMMAND KEYWORD FOUND: "${cmd}"`);
        
        const handler = this.commandHandlers.get(cmd);
        if (handler) {
          console.log(`🎬 Executing handler for: "${cmd}"`);
          try {
            await handler();
          } catch (error) {
            console.error(`❌ Error executing handler for "${cmd}":`, error);
          }
        } else {
          console.log(`⚠️ No handler registered for command: "${cmd}"`);
        }
        
        // Also call the onCommand callback if set
        if (this.onCommand) {
          console.log(`📞 Calling onCommand callback with: "${cmd}"`);
          this.onCommand(cmd);
        }
        return;
      }
    }
    
    console.log(`❓ No matching command found in: "${command}"`);
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

    // Clean up temp files
    if (fs.existsSync(this.tempAudioFile)) {
      console.log('🗑️ Cleaning up temp audio file...');
      fs.unlinkSync(this.tempAudioFile);
    }

    // Clean up any remaining text files
    const tempDir = os.tmpdir();
    const textFile = this.tempAudioFile.replace('.wav', '.txt');
    if (fs.existsSync(textFile)) {
      fs.unlinkSync(textFile);
    }
    
    console.log('✅ Voice controller cleanup completed');
  }
}