import * as net from 'net';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';

export interface TranscriptionMessage {
  type: 'transcription';
  text: string;
  timestamp: number;
  isFinal?: boolean;
}

export class RealtimeSTTServer extends EventEmitter {
  private server: net.Server | null = null;
  private client: net.Socket | null = null;
  private port: number;
  private buffer: string = '';

  constructor(port: number = 8889) {
    super();
    this.port = port;
  }

  private killExistingProcesses(): Promise<void> {
    return new Promise((resolve) => {
      console.log(`🔄 Checking for existing RealtimeSTT server instances...`);
      
      // Only kill Node.js processes that look like RealtimeSTT servers
      const pgrepProcess = spawn('pgrep', ['-f', 'RealtimeSTTServer|test_realtime_stt']);
      let pids = '';
      
      pgrepProcess.stdout.on('data', (data) => {
        pids += data.toString();
      });
      
      pgrepProcess.on('close', (code) => {
        if (pids.trim()) {
          console.log(`🛑 Killing existing RealtimeSTT server instances...`);
          const pidList = pids.trim().split('\n').filter(pid => pid.trim() && pid.trim() !== process.pid.toString());
          
          pidList.forEach(pid => {
            try {
              process.kill(parseInt(pid), 'SIGTERM'); // Use SIGTERM instead of SIGKILL for graceful shutdown
              console.log(`✅ Terminated RealtimeSTT server process ${pid}`);
            } catch (err) {
              // Process may already be dead, ignore error
            }
          });
          
          // Wait a moment for cleanup
          setTimeout(() => resolve(), 500);
        } else {
          console.log(`✅ No existing RealtimeSTT server instances found`);
          resolve();
        }
      });
      
      pgrepProcess.on('error', () => {
        // pgrep command failed, no matching processes
        console.log(`✅ No existing RealtimeSTT server instances found`);
        resolve();
      });
    });
  }

  async start(): Promise<void> {
    // Kill any existing processes on this port first
    await this.killExistingProcesses();
    
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        console.log('🎤 RealtimeSTT Python client connected');
        this.client = socket;

        socket.on('data', (data) => {
          this.handleIncomingData(data);
        });

        socket.on('end', () => {
          console.log('🔌 RealtimeSTT client disconnected');
          this.client = null;
        });

        socket.on('error', (err) => {
          console.error('❌ Socket error:', err);
          this.client = null;
        });
      });

      this.server.on('error', (err) => {
        console.error('❌ Server error:', err);
        reject(err);
      });

      this.server.listen(this.port, () => {
        console.log(`🚀 RealtimeSTT server listening on port ${this.port}`);
        console.log('💡 Run: python3 realtime_stt_streamer.py');
        resolve();
      });
    });
  }

  stop(): void {
    if (this.client) {
      this.client.end();
    }
    if (this.server) {
      this.server.close();
    }
    console.log('🛑 RealtimeSTT server stopped');
  }

  private handleIncomingData(data: Buffer): void {
    // Append new data to buffer
    this.buffer += data.toString('utf-8');

    // Process complete JSON messages (separated by newlines)
    const lines = this.buffer.split('\n');
    
    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';

    // Process each complete line
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          
          // Handle different message types
          if (message.type === 'heartbeat') {
            // Silently handle heartbeat messages - just keep connection alive
            continue;
          } else if (message.type === 'transcription') {
            this.processTranscription(message as TranscriptionMessage);
          }
        } catch (err) {
          console.error('❌ Failed to parse JSON:', line, err);
        }
      }
    }
  }

  private processTranscription(message: TranscriptionMessage): void {
    // Ensure message has required properties
    if (!message.text || typeof message.text !== 'string') {
      console.warn('⚠️ Invalid transcription message:', message);
      return;
    }
    
    // Check if this is a final transcription
    const isFinal = message.text.startsWith('FINAL:');
    
    if (isFinal) {
      message.text = message.text.replace('FINAL:', '');
      message.isFinal = true;
    }

    // Only emit non-empty transcriptions
    if (message.text.trim()) {
      console.log(`${isFinal ? '🎯' : '🗣️'} ${isFinal ? 'Final' : 'Live'}: "${message.text}"`);
      this.emit('transcription', message);
    }
  }

  isConnected(): boolean {
    return this.client !== null;
  }
}