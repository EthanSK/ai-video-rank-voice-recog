#!/usr/bin/env python3
"""
Real-time Speech-to-Text streamer using RealtimeSTT
Streams live transcriptions to Node.js app via TCP
"""

import socket
import json
import time
import threading
from RealtimeSTT import AudioToTextRecorder

class STTStreamer:
    def __init__(self, host='localhost', port=8889):
        self.host = host
        self.port = port
        self.socket = None
        self.recorder = None
        self.running = False
        
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
    
    def send_transcription(self, text):
        """Send transcription to Node.js app"""
        if not self.socket:
            return False
            
        try:
            message = {
                'type': 'transcription',
                'text': text,
                'timestamp': time.time()
            }
            
            json_data = json.dumps(message) + '\n'
            self.socket.send(json_data.encode('utf-8'))
            print(f"🗣️ Sent: '{text}'")
            return True
            
        except Exception as e:
            print(f"❌ Error sending transcription: {e}")
            return False
    
    def on_realtime_transcription_update(self, text):
        """Callback for real-time transcription updates"""
        if text.strip():  # Only send non-empty transcriptions
            print(f"🗣️ Live: '{text.strip()}'")  # Show what you're saying in real-time
            self.send_transcription(text.strip())
    
    def on_realtime_transcription_stabilized(self, text):
        """Callback for stabilized transcriptions (final results)"""
        if text.strip():
            print(f"🎯 Final: '{text.strip()}'")
            self.send_transcription(f"FINAL:{text.strip()}")
    
    def start_streaming(self):
        """Start the real-time STT streaming"""
        print("🎤 Initializing RealtimeSTT...")
        
        # Initialize RealtimeSTT with optimized settings
        self.recorder = AudioToTextRecorder(
            # Use faster, smaller model for real-time performance
            model="tiny.en",
            language="en",
            
            # Real-time callbacks
            on_realtime_transcription_update=self.on_realtime_transcription_update,
            on_realtime_transcription_stabilized=self.on_realtime_transcription_stabilized,
            
            # Performance settings
            use_microphone=True,
            spinner=False               # Disable spinner for cleaner output
        )
        
        print("🚀 Starting real-time speech recognition...")
        print("🎤 Speak now! (Ctrl+C to stop)")
        
        self.running = True
        
        try:
            # Start recording in a separate thread to keep it non-blocking
            def record_loop():
                while self.running:
                    try:
                        # This will trigger the callbacks automatically
                        self.recorder.text()
                    except Exception as e:
                        print(f"❌ Recording error: {e}")
                        time.sleep(0.1)
            
            record_thread = threading.Thread(target=record_loop, daemon=True)
            record_thread.start()
            
            # Keep main thread alive
            while self.running:
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            print("\n🛑 Stopping...")
            self.running = False
            
        finally:
            if self.socket:
                self.socket.close()
                print("✅ Disconnected from Node.js app")

def main():
    print("🎙️ RealtimeSTT Streamer for AI Video Ranking")
    print("=" * 50)
    
    streamer = STTStreamer()
    
    # Connect to Node.js app
    if not streamer.connect_to_nodejs():
        print("❌ Failed to connect to Node.js app. Make sure it's running on port 8889")
        return
    
    # Start streaming
    streamer.start_streaming()

if __name__ == "__main__":
    main()