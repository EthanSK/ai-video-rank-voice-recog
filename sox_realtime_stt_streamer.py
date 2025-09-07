#!/usr/bin/env python3
"""
Hybrid Sox + Faster-Whisper Real-time STT Streamer
Uses Sox for reliable audio recording and faster-whisper for transcription
Streams live transcriptions to Node.js app via TCP
"""

import socket
import json
import time
import subprocess
import threading
import tempfile
import os
from pathlib import Path

class SoxRealtimeSTTStreamer:
    def __init__(self, host='localhost', port=8889):
        self.host = host
        self.port = port
        self.socket = None
        self.running = False
        self.temp_dir = tempfile.mkdtemp()
        self.segment_counter = 0
        self.last_heartbeat = time.time()
        
    def connect_to_nodejs(self):
        """Establish TCP connection to Node.js app"""
        max_retries = 5
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.socket.connect((self.host, self.port))
                print(f"✅ Connected to Node.js app at {self.host}:{self.port}")
                return True
            except ConnectionRefusedError:
                print(f"❌ Connection attempt {attempt + 1} failed, retrying in {retry_delay}s...")
                if self.socket:
                    self.socket.close()
                time.sleep(retry_delay)
        
        print(f"❌ Failed to connect after {max_retries} attempts")
        return False
    
    def send_transcription(self, text, is_final=False):
        """Send transcription to Node.js app"""
        if not self.socket:
            return False
            
        try:
            message = {
                'type': 'transcription',
                'text': text,
                'timestamp': time.time(),
                'isFinal': is_final
            }
            
            json_data = json.dumps(message) + '\n'
            self.socket.send(json_data.encode('utf-8'))
            
            prefix = "🎯 Final" if is_final else "🗣️ Live"
            print(f"{prefix}: '{text}'")
            return True
            
        except Exception as e:
            print(f"❌ Error sending transcription: {e}")
            return False
    
    def transcribe_audio_chunk(self, audio_file):
        """Transcribe audio using faster-whisper"""
        try:
            print(f"🔄 Starting transcription of {audio_file}...")
            
            # Use faster-whisper for transcription with shorter timeout
            cmd = [
                'python3', '-c', f"""
import sys
import signal
import time

def timeout_handler(signum, frame):
    print("⏰ Transcription timeout", flush=True)
    sys.exit(1)

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(5)  # 5 second timeout

try:
    from faster_whisper import WhisperModel
    
    # Load tiny model for speed
    model = WhisperModel("tiny.en", device="cpu", compute_type="float32")
    
    # Transcribe
    segments, info = model.transcribe("{audio_file}", language="en", vad_filter=True, beam_size=1)
    
    # Get text quickly
    text = ""
    for segment in segments:
        text += segment.text.strip() + " "
    
    signal.alarm(0)  # Cancel timeout
    print(text.strip(), flush=True)
except Exception as e:
    signal.alarm(0)
    print(f"Error: {{e}}", file=sys.stderr, flush=True)
    sys.exit(1)
"""
            ]
            
            # Run with shorter timeout and better error handling
            result = subprocess.run(cmd, 
                                   capture_output=True, 
                                   text=True, 
                                   timeout=8,  # Reduced timeout
                                   cwd=os.getcwd(),
                                   env=dict(os.environ, PYTHONPATH=f"{os.getcwd()}/venv/lib/python3.13/site-packages"))
            
            print(f"✅ Transcription completed (return code: {result.returncode})")
            
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
            else:
                if result.stderr:
                    print(f"⚠️ Transcription stderr: {result.stderr.strip()}")
                return ""
                
        except subprocess.TimeoutExpired:
            print(f"⏰ Transcription timeout for {audio_file} - killing hanging processes")
            # Kill any hanging faster-whisper processes
            try:
                subprocess.run(['pkill', '-f', 'faster_whisper'], timeout=2)
            except:
                pass
            return ""
        except Exception as e:
            print(f"❌ Transcription error: {e}")
            return ""
    
    def record_and_process_audio(self):
        """Record audio with Sox and process with faster-whisper"""
        while self.running:
            try:
                # Create unique audio file
                audio_file = os.path.join(self.temp_dir, f"audio_{self.segment_counter}.wav")
                self.segment_counter += 1
                
                # Record 2 seconds of audio with Sox
                sox_cmd = [
                    'sox', '-t', 'coreaudio', 'default',
                    '-r', '16000',  # 16kHz sample rate
                    '-c', '1',      # Mono
                    '-b', '16',     # 16-bit
                    audio_file,
                    'trim', '0', '2'  # 2 second chunks
                ]
                
                # Record audio
                sox_process = subprocess.run(sox_cmd, 
                                           capture_output=True, 
                                           timeout=5)
                
                if sox_process.returncode == 0 and os.path.exists(audio_file):
                    # Check if file has meaningful audio
                    file_size = os.path.getsize(audio_file)
                    if file_size > 8000:  # Increased threshold for better speech detection
                        # Only show processing message occasionally to reduce spam
                        if self.segment_counter % 5 == 0:  # Every 5th chunk
                            print(f"🎵 Listening... (processing {file_size/1024:.1f}KB)")
                        
                        # Transcribe the audio
                        transcription = self.transcribe_audio_chunk(audio_file)
                        
                        if transcription and len(transcription.strip()) > 2:  # Only meaningful text
                            # Send as final transcription
                            self.send_transcription(transcription, is_final=True)
                
                # Periodic heartbeat to keep connection alive
                current_time = time.time()
                if current_time - self.last_heartbeat > 30:  # Every 30 seconds
                    try:
                        # Send a small keepalive message
                        keepalive = {'type': 'heartbeat', 'timestamp': current_time}
                        self.socket.send((json.dumps(keepalive) + '\n').encode('utf-8'))
                        self.last_heartbeat = current_time
                    except:
                        pass  # Ignore heartbeat failures
                    # Remove spam about silence - just continue quietly
                
                # Clean up
                if os.path.exists(audio_file):
                    os.unlink(audio_file)
                    
                # Brief pause between recordings
                time.sleep(0.2)
                
            except subprocess.TimeoutExpired:
                print("⚠️ Sox recording timeout, continuing...")
                # Clean up partial file
                if os.path.exists(audio_file):
                    os.unlink(audio_file)
                continue
            except Exception as e:
                print(f"❌ Recording error: {e}")
                # Clean up partial file
                if os.path.exists(audio_file):
                    os.unlink(audio_file)
                
                # Check if connection is still alive
                if not self.socket or self.socket.fileno() == -1:
                    print("🔌 Lost connection to Node.js, attempting reconnect...")
                    if self.connect_to_nodejs():
                        print("✅ Reconnected successfully")
                    else:
                        print("❌ Reconnection failed, continuing anyway...")
                
                time.sleep(2)  # Longer pause after errors
                continue
    
    def start_streaming(self):
        """Start the Sox + faster-whisper streaming"""
        print("🎤 Initializing Sox + faster-whisper STT...")
        
        # Test Sox
        try:
            test_result = subprocess.run(['sox', '--version'], 
                                       capture_output=True, timeout=5)
            if test_result.returncode != 0:
                raise Exception("Sox not available")
            print("✅ Sox audio system ready")
        except Exception as e:
            print(f"❌ Sox test failed: {e}")
            print("💡 Install Sox: brew install sox")
            return
        
        # Test faster-whisper
        try:
            test_cmd = ['python3', '-c', 'from faster_whisper import WhisperModel; print("✅ faster-whisper ready")']
            test_result = subprocess.run(test_cmd, 
                                       capture_output=True, 
                                       timeout=10,
                                       cwd=os.getcwd(),
                                       env=dict(os.environ, PYTHONPATH=f"{os.getcwd()}/venv/lib/python3.13/site-packages"))
            if test_result.returncode != 0:
                raise Exception("faster-whisper not available")
            print(test_result.stdout.decode().strip())
        except Exception as e:
            print(f"❌ faster-whisper test failed: {e}")
            return
        
        print("🚀 Starting continuous speech recognition with Sox + faster-whisper...")
        print("🎤 Speak now! (Ctrl+C to stop)")
        
        self.running = True
        
        try:
            # Start recording thread
            record_thread = threading.Thread(target=self.record_and_process_audio, daemon=True)
            record_thread.start()
            
            # Keep main thread alive
            while self.running:
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            print("\n🛑 Stopping...")
            self.running = False
            
        finally:
            # Cleanup
            if self.socket:
                self.socket.close()
                print("✅ Disconnected from Node.js app")
            
            # Clean up temp directory
            import shutil
            if os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)

def main():
    print("🎙️ Sox + faster-whisper Real-time STT Streamer")
    print("=" * 50)
    
    streamer = SoxRealtimeSTTStreamer()
    
    # Connect to Node.js app
    if not streamer.connect_to_nodejs():
        print("❌ Failed to connect to Node.js app. Make sure it's running on port 8889")
        return
    
    # Start streaming
    streamer.start_streaming()

if __name__ == "__main__":
    main()