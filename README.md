# AI Video Ranking Voice Control System

A TypeScript application that creates a custom dual-monitor interface for the Artificial Analysis video comparison website, with voice recognition controls using Whisper speech-to-text.

## Features

🎬 **Dual Monitor Setup**: Creates two browser windows titled "TOP" and "BOTTOM" for positioning on separate monitors
🗣️ **Voice Control**: Uses Whisper for speech-to-text to recognize voice commands
🎯 **Command Recognition**: Responds to "top", "bottom", "play", and "pause" voice commands
🔄 **Synchronized Control**: Voice commands control both the custom UI and reflect back to the original website
🎨 **Beautiful UI**: Custom styled video players with gradients, controls, and status indicators

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
2. **Python** with **pip**
3. **SoX** (for audio recording)
4. **OpenAI Whisper** (for speech recognition)

### Installation Steps

#### 1. Install SoX (macOS)
```bash
brew install sox
```

#### 2. Install Whisper
```bash
pip install openai-whisper
```

#### 3. Install Node.js Dependencies
```bash
npm install
```

## Usage

### Starting the System

```bash
npm run dev
```

This will:
1. Launch a browser with three tabs:
   - Original Artificial Analysis website 
   - "TOP" video display window
   - "BOTTOM" video display window
2. Start voice recognition listening
3. Begin monitoring for video comparisons

### Voice Commands

- **"top"** - Selects the top/left video as preferred
- **"bottom"** - Selects the bottom/right video as preferred  
- **"play"** - Plays both videos in the custom UI
- **"pause"** - Pauses both videos in the custom UI

### Monitor Setup

1. Position the "TOP" window on your right monitor (upper area)
2. Position the "BOTTOM" window on your right monitor (lower area)
3. Keep the original Artificial Analysis tab visible for monitoring

## How It Works

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Voice Input   │    │  Main Browser   │    │  Custom UI      │
│                 │    │                 │    │                 │
│ Microphone      │───▶│ Artificial      │───▶│ TOP Window      │
│ ↓               │    │ Analysis        │    │ BOTTOM Window   │
│ Whisper STT     │    │ Website         │    │                 │
│ ↓               │    │                 │    │                 │
│ Command Parser  │────┼─────────────────┤    └─────────────────┘
└─────────────────┘    └─────────────────┘           ↑
                                │                    │
                                ▼                    │
                       ┌─────────────────┐           │
                       │ Puppeteer       │───────────┘
                       │ Video Scraper   │
                       └─────────────────┘
```

### Process Flow

1. **Voice Recognition**: Continuously listens for voice commands using SoX and Whisper
2. **Video Monitoring**: Puppeteer scrapes video URLs from the Artificial Analysis website
3. **Display Management**: Custom HTML pages display videos with enhanced UI
4. **Command Execution**: Voice commands trigger actions on both custom UI and original website
5. **Synchronization**: Selections made via voice are reflected back to the original website

## Project Structure

```
src/
├── index.ts                 # Main entry point
├── VideoRankingSystem.ts    # Core system orchestration
├── VoiceController.ts       # Whisper speech recognition
└── VideoDisplayManager.ts   # Custom video UI management
```

## Configuration

### Audio Settings
- Sample Rate: 16kHz (optimal for speech)
- Format: 16-bit mono WAV
- Chunk Size: 3-second recordings

### Browser Settings
- Headless: Disabled (shows browser windows)
- Default Viewport: Disabled (full screen)
- Args: Optimized for stability and performance

## Troubleshooting

### Common Issues

**"Whisper not found" error:**
```bash
pip install openai-whisper
# or
pip3 install openai-whisper
```

**Audio recording issues:**
- Check microphone permissions
- Ensure SoX is installed: `sox --version`
- Test microphone: `sox -t coreaudio default test.wav trim 0 3`

**Video not loading:**
- Check internet connection
- Verify the Artificial Analysis website is accessible
- Wait for videos to fully load before issuing commands

**Voice commands not recognized:**
- Speak clearly and distinctly
- Commands are: "top", "bottom", "play", "pause" (lowercase)
- Allow 1-2 seconds between commands

### Performance Tips

- Close other resource-intensive applications
- Ensure stable internet connection for video streaming
- Position microphone appropriately for clear voice capture
- Use a quiet environment for better speech recognition

## Development

### Building
```bash
npm run build
```

### Running Production Build
```bash
npm start
```

## Dependencies

### Runtime Dependencies
- **puppeteer**: Browser automation and control
- **express**: Web server (for future enhancements)

### Development Dependencies
- **typescript**: TypeScript compiler
- **tsx**: TypeScript execution engine
- **@types/node**: Node.js type definitions

### External Dependencies
- **SoX**: Audio recording and processing
- **Whisper**: OpenAI's speech-to-text model

## License

MIT License - Feel free to modify and distribute.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Note**: This system requires microphone access and will continuously listen for voice commands while running. Ensure you're comfortable with this before starting the application.