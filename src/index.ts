import { ExtensionSystem } from './ExtensionSystem';

async function main() {
  const system = new ExtensionSystem();
  
  try {
    console.log('🎬 Starting AI Video Ranking Voice Control System...');
    await system.initialize();
    
    console.log('✅ System initialized successfully!');
    console.log('📱 Voice commands: "top", "bottom", "play", "pause"');
    console.log('🖥️  Two browser windows should now be open on your second monitor');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await system.cleanup();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start system:', error);
    process.exit(1);
  }
}

main().catch(console.error);