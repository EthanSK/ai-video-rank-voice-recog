import { ExtensionSystem } from './ExtensionSystem';

async function main() {
  // Check for --allowLongDownload flag
  const allowLongDownload = process.argv.includes('--allowLongDownload');
  
  const system = new ExtensionSystem();
  
  try {
    console.log('🎬 Starting AI Video Ranking Voice Control System...');
    if (allowLongDownload) {
      console.log('🔄 Long download mode enabled - will use base model (may download 139MB)');
    }
    
    await system.initialize(allowLongDownload);
    
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