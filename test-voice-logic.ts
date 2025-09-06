import { VoiceController } from './src/VoiceController';

// Mock test to verify command processing logic
class MockVoiceController extends VoiceController {
  // Override the initialization to skip dependency checks for testing
  async initialize(): Promise<void> {
    console.log('🧪 Mock Voice Controller - Skipping dependency checks');
    return Promise.resolve();
  }

  // Expose the private method for testing
  public async testProcessCommand(command: string): Promise<void> {
    return (this as any).processCommand(command);
  }
}

async function testCommandProcessing() {
  console.log('🧪 Testing Voice Recognition Command Processing Logic...');
  console.log('');

  const mockController = new MockVoiceController();
  let commandsExecuted: string[] = [];

  // Set up command handlers
  mockController.registerCommand('top', async () => {
    commandsExecuted.push('TOP');
    console.log('✅ TOP command handler executed!');
  });

  mockController.registerCommand('bottom', async () => {
    commandsExecuted.push('BOTTOM');
    console.log('✅ BOTTOM command handler executed!');
  });

  mockController.registerCommand('play', async () => {
    commandsExecuted.push('PLAY');
    console.log('✅ PLAY command handler executed!');
  });

  mockController.registerCommand('pause', async () => {
    commandsExecuted.push('PAUSE');
    console.log('✅ PAUSE command handler executed!');
  });

  // Set up callback
  const callbackCommands: string[] = [];
  mockController.onCommand = (command: string) => {
    callbackCommands.push(command);
    console.log(`📞 onCommand callback: "${command}"`);
  };

  await mockController.initialize();

  // Test various speech inputs
  const testInputs = [
    'I want the top video',
    'select the bottom one',
    'please play the videos',
    'pause everything',
    'the top video is better',
    'bottom video looks good',
    'can you play that again',
    'pause the playback',
    'this is not a command',
    'top',
    'bottom',
    'play',
    'pause'
  ];

  console.log('🎯 Testing command detection from various speech inputs:');
  console.log('');

  for (const input of testInputs) {
    console.log(`🗣️  Testing: "${input}"`);
    await mockController.testProcessCommand(input);
    console.log('');
  }

  console.log('📊 Test Results:');
  console.log(`   Commands executed via handlers: ${commandsExecuted.length}`);
  console.log(`   Commands sent to callback: ${callbackCommands.length}`);
  console.log(`   Executed commands: ${commandsExecuted.join(', ')}`);
  console.log(`   Callback commands: ${callbackCommands.join(', ')}`);
  
  // Verify the expected commands were detected
  const expectedCommands = ['top', 'bottom', 'play', 'pause'];
  let allCommandsFound = true;
  
  for (const cmd of expectedCommands) {
    if (!callbackCommands.includes(cmd)) {
      console.log(`❌ Missing command: ${cmd}`);
      allCommandsFound = false;
    }
  }
  
  if (allCommandsFound && callbackCommands.length >= 4) {
    console.log('✅ All command detection tests passed!');
    console.log('✅ Voice recognition logic is working correctly');
  } else {
    console.log('❌ Some command detection tests failed');
  }
}

testCommandProcessing().catch(console.error);