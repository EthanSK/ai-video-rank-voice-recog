#!/usr/bin/env python3
"""
Simple RealtimeSTT implementation that streams text in real-time
No file creation, just direct audio-to-text streaming
"""

import socket
import json
import time
import threading
from RealtimeSTT import AudioToTextRecorder

class SimpleRealtimeSTT:
    def __init__(self, host='localhost', port=8889):
        self.host = host
        self.port = port
        self.socket = None
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
    
    def on_realtime_transcription_update(self, text):
        """Callback for live transcription updates"""
        if text.strip():
            self.send_transcription(text.strip(), is_final=False)
    
    def on_realtime_transcription_stabilized(self, text):
        """Callback for final/stabilized transcriptions"""
        if text.strip():
            self.send_transcription(text.strip(), is_final=True)
    
    def start_streaming(self):
        """Start RealtimeSTT streaming"""
        print("🎤 Initializing RealtimeSTT...")
        
        try:
            # Stricter configuration to reduce false positives and improve confidence
            recorder_config = {
                'model': 'tiny.en',  # Fast model
                'realtime_model_type': 'tiny.en',
                'language': 'en',
                'enable_realtime_transcription': True,
                'on_realtime_transcription_update': self.on_realtime_transcription_update,
                
                # Performance optimizations from GitHub discussions
                'realtime_processing_pause': 0,  # Minimum latency
                'beam_size': 1,  # Reduce model bias and improve speed
                'normalize_audio': True,  # Consistent transcription quality
                'use_main_model_for_realtime': True,  # Better consistency
                
                # Stricter VAD parameters (correct parameter names)
                'silero_sensitivity': 0.6,  # Stricter Silero VAD (0.4 default -> 0.6)
                'webrtc_sensitivity': 2,    # Less sensitive WebRTC VAD (3 default -> 2)
                'silero_deactivity_detection': True,  # Better end-of-speech detection
                
                # Audio processing with stricter thresholds
                'post_speech_silence_duration': 0.5,  # Longer silence before stopping (0.6 default -> 0.5)
                'min_length_of_recording': 0.6,      # Require longer recordings (0.5 default -> 0.6)
                'pre_recording_buffer_duration': 0.8,  # Reduce context bleeding
                
                'use_microphone': True,
                'spinner': False,
                'level': 30
            }
            
            recorder = AudioToTextRecorder(**recorder_config)
            
            print("🚀 RealtimeSTT ready - speak now!")
            print("🎤 Listening for speech... (Ctrl+C to stop)")
            
            self.running = True
            
            # Continuous transcription loop (like in demo)
            while self.running:
                try:
                    # This gets complete transcriptions and triggers real-time callbacks
                    full_sentence = recorder.text(self.on_realtime_transcription_stabilized)
                    time.sleep(0.1)  # Small pause
                except Exception as e:
                    print(f"⚠️ Recording error: {e}")
                    time.sleep(1)
                    
        except KeyboardInterrupt:
            print("\n🛑 Stopping RealtimeSTT...")
            self.running = False
            
        finally:
            if self.socket:
                self.socket.close()
                print("✅ Disconnected from Node.js app")

def main():
    print("🎙️ Simple RealtimeSTT Streamer")
    print("=" * 40)
    
    streamer = SimpleRealtimeSTT()
    
    # Connect to Node.js app
    if not streamer.connect_to_nodejs():
        print("❌ Failed to connect. Make sure Node.js server is running on port 8889")
        return
    
    # Start streaming
    streamer.start_streaming()

if __name__ == "__main__":
    main()