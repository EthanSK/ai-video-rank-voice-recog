#!/bin/bash

# Fix OpenMP library conflict on Intel Macs - set before any Python execution
export KMP_DUPLICATE_LIB_OK=TRUE
export OMP_NUM_THREADS=1

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
source venv/bin/activate && env KMP_DUPLICATE_LIB_OK=TRUE OMP_NUM_THREADS=1 python3 -u simple_realtime_stt.py