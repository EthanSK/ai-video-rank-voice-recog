import { RealtimeSTTServer } from './src/services/RealtimeSTTServer';

async function test() {
  const server = new RealtimeSTTServer(8889);
  
  server.on('transcription', (message) => {
    console.log(`🎯 Got transcription: "${message.text}" (${message.isFinal ? 'final' : 'live'})`);
  });
  
  try {
    await server.start();
    console.log('✅ RealtimeSTT server is running. Python script should connect now...');
    
    // Keep the server running
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
  }
}

test();