# AI Video Ranking Voice Control System

A Chrome extension + Node.js backend system that enables voice-controlled ranking of AI video comparisons on Artificial Analysis. Uses your legitimate browser session to bypass all detection while providing a dual-monitor video display interface.

## 🎬 Features

✅ **Zero Detection**: Runs inside your real Chrome browser - bypasses all Cloudflare/bot detection  
✅ **Voice Control**: Hands-free ranking with "top", "bottom", "play", "pause" commands  
✅ **Dual Monitor Setup**: Separate TOP/BOTTOM video windows for optimal viewing  
✅ **Auto Extraction**: Extension automatically scrapes and streams video data  
✅ **Real Session**: Uses your actual browser session, cookies, and login status  
✅ **One-Time Setup**: Solve Cloudflare once, extension handles the rest  

## 🚀 Quick Start

### 1. Install Chrome Extension

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"** 
4. Select folder: `ai-video-rank-voice-recog/chrome-extension/`
5. Verify "Arena Helper" appears and is enabled

### 2. Install Dependencies & Start Backend

```bash
# Install Node.js dependencies
npm install

# Start the backend server
npm run dev
```

### 3. Use the System

1. **Navigate** to `https://artificialanalysis.ai/text-to-video/arena` in Chrome
2. **Solve Cloudflare** challenge manually (one-time only)
3. **Extension automatically** streams video data to backend
4. **Two video windows** open showing TOP and BOTTOM videos
5. **Use voice commands**: "top", "bottom", "play", "pause"

## 🏗️ System Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Chrome Extension  │    │   Node.js Backend   │    │   Display Windows   │
│                     │    │                     │    │                     │
│ • Content Script    │───▶│ • Express Server    │───▶│ • TOP Video Window  │
│ • Auto Video Scrape │    │ • Voice Recognition │    │ • BOTTOM Video Win  │
│ • Button Clicking   │    │ • Display Manager   │    │ • Real-time Updates │
│ • Real Browser      │    │ • HTTP API          │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
            ↑                        ↑
            │                        │
    ┌───────────────┐     ┌──────────────────┐
    │ Your Browser  │     │ Voice Commands   │
    │ Session       │     │ via Whisper      │
    └───────────────┘     └──────────────────┘
```

## 📁 Project Structure

```
ai-video-rank-voice-recog/
├── chrome-extension/           # Chrome Extension
│   ├── manifest.json          # Extension configuration  
│   ├── content.js             # Video scraping script
│   ├── bg.js                  # Background service worker
│   ├── popup.html            # Extension popup interface
│   └── popup.js              # Popup functionality
├── src/                       # Node.js Backend
│   ├── index.ts              # Main entry point
│   ├── ExtensionSystem.ts    # Core system with Express server
│   ├── BrowserDisplayManager.ts # Dual monitor video display
│   └── VoiceController.ts    # Whisper speech recognition
└── package.json              # Dependencies and scripts
```

## 🎙️ Voice Commands

| Command | Action |
|---------|--------|
| **"top"** | Selects the top/left video as preferred |
| **"bottom"** | Selects the bottom/right video as preferred |
| **"play"** | Plays both videos in display windows |
| **"pause"** | Pauses both videos in display windows |

## 🔧 Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
2. **Chrome Browser** (optional - only needed for video display)
3. **Python** with **pip**
4. **SoX** (for audio recording)
5. **OpenAI Whisper** (for speech recognition)

### Installation Steps

#### 1. Install SoX (macOS)
```bash
brew install sox
```

#### 2. Install SoX (Linux)
```bash
sudo apt-get install sox
```

#### 3. Install Whisper
```bash
pip install openai-whisper
```

#### 4. Install Node.js Dependencies  
```bash
npm install
```

## 🎤 Voice Recognition Improvements

The voice recognition system has been completely rearchitected for better real-time performance:

- ✅ **Better audio chunks**: 3-second chunks instead of 1.5s for better speech context
- ✅ **Comprehensive logging**: Detailed output for debugging speech recognition
- ✅ **Graceful error handling**: System continues even with missing dependencies  
- ✅ **Processing locks**: Prevents overlapping Whisper calls
- ✅ **Isolated testing**: Test voice recognition independently with `npm run test-voice`

### Testing Voice Recognition Only

To test just the voice recognition system (without browser automation):

```bash
npm run test-voice
```

This will start only the voice recognition system and log all speech processing in detail.

## 📖 How It Works

### The Magic: Extension-Based Approach

Unlike traditional web scraping, this system runs **inside your actual Chrome browser**:

1. **Chrome Extension** runs content script on `artificialanalysis.ai/text-to-video/arena`
2. **Auto-extracts** video URLs and prompt text every 3 seconds
3. **Posts data** to local Node.js backend via `http://localhost:7777/update`
4. **Backend receives** video data and updates dual monitor display
5. **Voice commands** trigger actions both in display and original website

### Key Advantages

- ✅ **No bot detection** - Extension runs in your real browser
- ✅ **Uses your session** - Cookies, login status, browsing history
- ✅ **Solve Cloudflare once** - Extension rides your legitimate session
- ✅ **Real-time updates** - Auto-detects new video comparisons
- ✅ **Voice integration** - Hands-free operation

## 🖥️ Monitor Setup

### Recommended Layout

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│           Monitor 1             │  │           Monitor 2             │
│                                 │  │                                 │
│  ┌─────────────────────────┐   │  │  ┌─────────────────────────┐   │
│  │   Chrome Browser        │   │  │  │      TOP Video          │   │
│  │   artificialanalysis.ai │   │  │  │     (Upper Half)        │   │
│  │                         │   │  │  └─────────────────────────┘   │
│  │   Original Arena Page   │   │  │                                 │
│  │   (manual CF solving)   │   │  │  ┌─────────────────────────┐   │
│  │                         │   │  │  │     BOTTOM Video        │   │
│  └─────────────────────────┘   │  │  │     (Lower Half)        │   │
│                                 │  │  └─────────────────────────┘   │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

## 🛠️ API Endpoints

The Node.js backend exposes these endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /status` | GET | Health check for extension popup |
| `POST /update` | POST | Receives video data from extension |
| `POST /voice-command` | POST | Manual voice command testing |

## 🐛 Troubleshooting

### Extension Issues

**Extension not loading:**
```bash
# Check chrome://extensions/
# Ensure Developer mode is ON
# Click "Load unpacked" and select chrome-extension/ folder
```

**Extension not connecting:**
- Check extension popup shows "✅ Backend connected"
- Ensure `npm run dev` is running
- Backend should be on `http://localhost:7777`

### Backend Issues

**Port 7777 in use:**
```bash
# Kill process using port 7777
lsof -ti:7777 | xargs kill -9

# Or change port in ExtensionSystem.ts and chrome-extension/content.js
```

**Voice recognition not working:**
```bash
# Test Whisper installation
whisper --help

# Test SoX audio
sox -t coreaudio default test.wav trim 0 3
```

### Website Issues

**Cloudflare blocking:**
- This system **solves** the Cloudflare problem!
- Just solve it once manually in your browser
- Extension uses your legitimate session thereafter

**Videos not extracting:**
- Check browser console on arena page
- Look for "🎬 Arena Helper: Scraped data" messages
- Ensure videos are fully loaded before expecting extraction

## 🔄 Development Workflow

### Making Changes

**To Extension:**
1. Edit files in `chrome-extension/`
2. Go to `chrome://extensions/`
3. Click refresh icon next to Arena Helper
4. Reload the arena page

**To Backend:**
1. Edit files in `src/`
2. Backend auto-restarts with `npm run dev`
3. No need to reload extension

### Testing

```bash
# Test backend health
curl http://localhost:7777/status

# Test voice command
curl -X POST http://localhost:7777/voice-command \
  -H "Content-Type: application/json" \
  -d '{"command": "top"}'

# Monitor extension logs
# Open browser console on arena page
```

## 🎯 Performance Tips

- **Close unused tabs** to reduce Chrome memory usage
- **Position microphone** clearly for voice recognition
- **Stable internet** required for video streaming
- **Quiet environment** improves speech recognition accuracy
- **Wait for videos** to fully load before voice commands

## 📦 Dependencies

### Runtime Dependencies
```json
{
  "express": "Web server for extension communication",
  "cors": "Enable cross-origin requests from extension", 
  "puppeteer": "Browser automation (legacy, now minimal usage)",
  "ws": "WebSocket support (future enhancement)"
}
```

### External Dependencies
- **SoX**: Audio recording and processing
- **Whisper**: OpenAI's speech-to-text model
- **Chrome Browser**: Required for extension

## 🚀 Build & Deploy

### Development
```bash
npm run dev  # Starts with auto-reload
```

### Production Build
```bash
npm run build  # Compiles TypeScript
npm start      # Runs compiled JavaScript
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly with real arena page
5. Submit a pull request

### Areas for Enhancement

- [ ] WebSocket communication for real-time commands
- [ ] Extension options page for configuration  
- [ ] Better error handling and recovery
- [ ] Support for other AI comparison sites
- [ ] Keyboard shortcuts as alternative to voice

## 📄 License

MIT License - Feel free to modify and distribute.

---

## ⚠️ Privacy & Security

- **Microphone Access**: System continuously listens for voice commands
- **Local Processing**: All data stays on your machine
- **No Data Collection**: Extension and backend don't send data externally  
- **Browser Session**: Uses your actual browser session and cookies
- **Legitimate Usage**: Designed for personal use with your own browser

---

**🎉 Enjoy hands-free AI video ranking with zero detection issues!**