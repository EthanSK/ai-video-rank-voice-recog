import { VoiceController } from './src/VoiceController';

async function testVoiceRecognition() {
  console.log('🎤 Testing Voice Recognition System...');
  console.log('📝 This test will verify the improved real-time speech processing');
  console.log('');

  const voiceController = new VoiceController();

  // Set up command handlers
  voiceController.registerCommand('top', async () => {
    console.log('✅ TOP command executed!');
  });

  voiceController.registerCommand('bottom', async () => {
    console.log('✅ BOTTOM command executed!');
  });

  voiceController.registerCommand('play', async () => {
    console.log('✅ PLAY command executed!');
  });

  voiceController.registerCommand('pause', async () => {
    console.log('✅ PAUSE command executed!');
  });

  // Set up callback for all commands
  voiceController.onCommand = (command: string) => {
    console.log(`📞 onCommand callback received: "${command}"`);
  };

  try {
    await voiceController.initialize();
    console.log('🎤 Voice recognition started successfully!');
    console.log('🗣️  Try saying: "top", "bottom", "play", or "pause"');
    console.log('🔍 All audio processing will be logged in detail');
    console.log('');
    console.log('⏳ Voice recognition is now running... Press Ctrl+C to stop');

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping voice recognition test...');
      await voiceController.cleanup();
      process.exit(0);
    });

    // Keep alive
    setInterval(() => {
      // Just keep the process alive
    }, 1000);

  } catch (error) {
    console.error('❌ Failed to start voice recognition:', error);
    console.log('');
    console.log('💡 Required dependencies:');
    console.log('   • macOS: brew install sox');
    console.log('   • Linux: sudo apt-get install sox');
    console.log('   • Python: pip install openai-whisper');
    console.log('');
    console.log('🔧 Make sure your microphone is working and SoX can access it');
    process.exit(1);
  }
}

testVoiceRecognition().catch(console.error);