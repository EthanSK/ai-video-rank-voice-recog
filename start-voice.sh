#!/bin/bash

echo "🎙️ Starting RealtimeSTT Voice Recognition System"
echo "================================================"

# Kill any existing Python STT processes (not Node.js)
echo "🔄 Checking for existing Python STT processes..."
if pgrep -f "realtime_stt_streamer.py\|sox_realtime_stt_streamer.py\|simple_realtime_stt.py" > /dev/null 2>&1; then
    echo "🛑 Killing existing Python STT processes..."
    pkill -f "realtime_stt_streamer.py\|sox_realtime_stt_streamer.py\|simple_realtime_stt.py" 2>/dev/null
    sleep 1
    echo "✅ Python STT processes cleared"
else
    echo "✅ No existing Python STT processes"
fi

# Activate virtual environment and run the Python script
echo "🚀 Starting Simple RealtimeSTT script..."
source venv/bin/activate && python3 -u simple_realtime_stt.py