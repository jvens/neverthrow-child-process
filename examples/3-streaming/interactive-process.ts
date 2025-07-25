#!/usr/bin/env node --loader ts-node/esm

/**
 * Interactive Process Examples
 * 
 * This example demonstrates two-way communication between parent and child
 * processes, including stdin/stdout interaction and real-time data exchange.
 * 
 * Key concepts:
 * - Two-way communication (stdin/stdout)
 * - Interactive command-line tools
 * - Real-time data exchange
 * - Process lifecycle management
 * - Input validation and error handling
 */

import { spawn, waitForExit } from '../../src/index';
import * as fs from 'fs';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

/**
 * Example 1: Interactive calculator
 */
async function interactiveCalculator() {
  separator('EXAMPLE 1: Interactive Calculator');
  
  console.log('🔄 Starting interactive calculator...');
  
  // Create a calculator script
  const calculatorScript = `
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'calc> '
});

console.log('Interactive Calculator Ready');
console.log('Enter expressions like: 2 + 3, 5 * 4, or "quit" to exit');
rl.prompt();

rl.on('line', (input) => {
  const line = input.trim();
  
  if (line === 'quit' || line === 'exit') {
    console.log('Calculator shutting down...');
    rl.close();
    return;
  }
  
  try {
    // Simple expression evaluation (be careful in real applications!)
    const result = eval(line);
    console.log(\`Result: \${result}\`);
  } catch (error) {
    console.log(\`Error: Invalid expression - \${error.message}\`);
  }
  
  rl.prompt();
}).on('close', () => {
  console.log('Calculator closed');
  process.exit(0);
});
`;

  // Spawn the calculator process
  const result = await spawn('node', ['-e', calculatorScript]);
  
  if (result.isErr()) {
    console.error('❌ Failed to start calculator:', result.error.message);
    return;
  }
  
  const { process: calcProcess } = result.value;
  
  // Set up output handling
  if (calcProcess.stdout) {
    calcProcess.stdout.on('data', (chunk) => {
      const data = chunk.toString().trim();
      if (data) {
        console.log(`📟 Calculator: ${data}`);
      }
    });
  }
  
  // Send commands to the calculator
  const commands = ['2 + 3', '10 * 7', '100 / 4', 'Math.sqrt(16)', 'invalid expression', 'quit'];
  
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    
    // Wait a bit between commands
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`📤 Sending: ${command}`);
    
    if (calcProcess.stdin) {
      calcProcess.stdin.write(`${command}\n`);
    }
  }
  
  // Wait for process to complete
  const exitResult = await waitForExit(calcProcess);
  
  if (exitResult.isOk()) {
    console.log(`✅ Calculator completed with code: ${exitResult.value.code}`);
  } else {
    console.log(`❌ Calculator failed: ${exitResult.error.message}`);
  }
}

/**
 * Example 2: Interactive file processor
 */
async function interactiveFileProcessor() {
  separator('EXAMPLE 2: Interactive File Processor');
  
  console.log('🔄 Starting interactive file processor...');
  
  // Create a file processing script
  const processorScript = `
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('File Processor Ready');
console.log('Commands: read <file>, write <file> <content>, list, help, quit');

let fileContents = new Map();

function processCommand(input) {
  const parts = input.trim().split(' ');
  const command = parts[0].toLowerCase();
  
  switch (command) {
    case 'read':
      if (parts.length < 2) {
        console.log('Usage: read <filename>');
        return;
      }
      const filename = parts[1];
      try {
        const content = fs.readFileSync(\`/tmp/\${filename}\`, 'utf8');
        fileContents.set(filename, content);
        console.log(\`File '\${filename}' loaded (\${content.length} chars)\`);
        console.log(\`Content preview: \${content.substring(0, 50)}...\`);
      } catch (error) {
        console.log(\`Error reading file: \${error.message}\`);
      }
      break;
      
    case 'write':
      if (parts.length < 3) {
        console.log('Usage: write <filename> <content>');
        return;
      }
      const writeFile = parts[1];
      const writeContent = parts.slice(2).join(' ');
      try {
        fs.writeFileSync(\`/tmp/\${writeFile}\`, writeContent);
        console.log(\`File '\${writeFile}' written (\${writeContent.length} chars)\`);
      } catch (error) {
        console.log(\`Error writing file: \${error.message}\`);
      }
      break;
      
    case 'list':
      if (fileContents.size === 0) {
        console.log('No files loaded');
      } else {
        console.log('Loaded files:');
        for (const [filename, content] of fileContents) {
          console.log(\`  \${filename}: \${content.length} chars\`);
        }
      }
      break;
      
    case 'help':
      console.log('Available commands:');
      console.log('  read <file>    - Read a file from /tmp/');
      console.log('  write <file> <content> - Write content to /tmp/file');
      console.log('  list           - List loaded files');
      console.log('  help           - Show this help');
      console.log('  quit           - Exit processor');
      break;
      
    case 'quit':
    case 'exit':
      console.log('File processor shutting down...');
      rl.close();
      return;
      
    default:
      console.log(\`Unknown command: \${command}. Type 'help' for available commands.\`);
  }
}

rl.on('line', (input) => {
  processCommand(input);
}).on('close', () => {
  console.log('File processor closed');
  process.exit(0);
});
`;

  // Spawn the processor
  const result = await spawn('node', ['-e', processorScript]);
  
  if (result.isErr()) {
    console.error('❌ Failed to start processor:', result.error.message);
    return;
  }
  
  const { process: processor } = result.value;
  
  // Set up output handling
  if (processor.stdout) {
    processor.stdout.on('data', (chunk) => {
      const data = chunk.toString().trim();
      if (data) {
        console.log(`📁 Processor: ${data}`);
      }
    });
  }
  
  // Prepare test file
  await new Promise((resolve, reject) => {
    fs.writeFile('/tmp/test-file.txt', 'Hello from test file!\nThis is line 2.\nAnd this is line 3.', (err) => {
      if (err) reject(err);
      else resolve(void 0);
    });
  });
  
  // Send commands to the processor
  const commands = [
    'help',
    'write sample.txt This is sample content',
    'read sample.txt',
    'read test-file.txt',
    'list',
    'write output.txt Processed data',
    'quit'
  ];
  
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    
    // Wait between commands
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    console.log(`📤 Command: ${command}`);
    
    if (processor.stdin) {
      processor.stdin.write(`${command}\n`);
    }
  }
  
  // Wait for completion
  const exitResult = await waitForExit(processor);
  
  // Cleanup
  try {
    fs.unlinkSync('/tmp/test-file.txt');
    fs.unlinkSync('/tmp/sample.txt');
    fs.unlinkSync('/tmp/output.txt');
  } catch (error) {
    // Ignore cleanup errors
  }
  
  if (exitResult.isOk()) {
    console.log(`✅ File processor completed with code: ${exitResult.value.code}`);
  } else {
    console.log(`❌ File processor failed: ${exitResult.error.message}`);
  }
}

/**
 * Example 3: Real-time chat simulation
 */
async function realTimeChatSimulation() {
  separator('EXAMPLE 3: Real-time Chat Simulation');
  
  console.log('🔄 Starting chat simulation...');
  
  // Create chat server script
  const chatServerScript = `
const users = new Map();
let messageId = 0;

process.stdin.on('data', (data) => {
  const input = data.toString().trim();
  
  try {
    const message = JSON.parse(input);
    
    switch (message.type) {
      case 'join':
        users.set(message.userId, { name: message.name, joinTime: Date.now() });
        console.log(JSON.stringify({
          type: 'system',
          message: \`\${message.name} joined the chat\`,
          timestamp: new Date().toISOString()
        }));
        break;
        
      case 'message':
        if (users.has(message.userId)) {
          const user = users.get(message.userId);
          console.log(JSON.stringify({
            type: 'message',
            id: ++messageId,
            user: user.name,
            text: message.text,
            timestamp: new Date().toISOString()
          }));
        }
        break;
        
      case 'leave':
        if (users.has(message.userId)) {
          const user = users.get(message.userId);
          users.delete(message.userId);
          console.log(JSON.stringify({
            type: 'system',
            message: \`\${user.name} left the chat\`,
            timestamp: new Date().toISOString()
          }));
        }
        break;
        
      case 'status':
        console.log(JSON.stringify({
          type: 'status',
          users: Array.from(users.values()),
          messageCount: messageId,
          timestamp: new Date().toISOString()
        }));
        break;
        
      case 'shutdown':
        console.log(JSON.stringify({
          type: 'system',
          message: 'Chat server shutting down...',
          timestamp: new Date().toISOString()
        }));
        process.exit(0);
        break;
    }
  } catch (error) {
    console.log(JSON.stringify({
      type: 'error',
      message: \`Invalid message format: \${error.message}\`,
      timestamp: new Date().toISOString()
    }));
  }
});

console.log(JSON.stringify({
  type: 'system',
  message: 'Chat server started',
  timestamp: new Date().toISOString()
}));
`;

  // Spawn chat server
  const result = await spawn('node', ['-e', chatServerScript]);
  
  if (result.isErr()) {
    console.error('❌ Failed to start chat server:', result.error.message);
    return;
  }
  
  const { process: chatServer } = result.value;
  
  // Handle server output
  if (chatServer.stdout) {
    chatServer.stdout.on('data', (chunk) => {
      const lines = chunk.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            const timestamp = new Date(message.timestamp).toLocaleTimeString();
            
            switch (message.type) {
              case 'system':
                console.log(`🔔 [${timestamp}] System: ${message.message}`);
                break;
              case 'message':
                console.log(`💬 [${timestamp}] ${message.user}: ${message.text}`);
                break;
              case 'status':
                console.log(`📊 [${timestamp}] Status: ${message.users.length} users, ${message.messageCount} messages`);
                break;
              case 'error':
                console.log(`❌ [${timestamp}] Error: ${message.message}`);
                break;
            }
          } catch (error) {
            console.log(`📡 Raw: ${line}`);
          }
        }
      }
    });
  }
  
  // Simulate chat activity
  const chatActions = [
    { type: 'join', userId: 'user1', name: 'Alice' },
    { type: 'join', userId: 'user2', name: 'Bob' },
    { type: 'message', userId: 'user1', text: 'Hello everyone!' },
    { type: 'message', userId: 'user2', text: 'Hi Alice! How are you?' },
    { type: 'status' },
    { type: 'message', userId: 'user1', text: 'I am doing great, thanks!' },
    { type: 'join', userId: 'user3', name: 'Charlie' },
    { type: 'message', userId: 'user3', text: 'Hey folks!' },
    { type: 'message', userId: 'user2', text: 'Welcome Charlie!' },
    { type: 'leave', userId: 'user2' },
    { type: 'status' },
    { type: 'shutdown' }
  ];
  
  for (let i = 0; i < chatActions.length; i++) {
    const action = chatActions[i];
    
    // Wait between actions
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const actionJson = JSON.stringify(action);
    console.log(`📤 Sending: ${action.type} ${action.name || action.text || ''}`);
    
    if (chatServer.stdin) {
      chatServer.stdin.write(`${actionJson}\n`);
    }
  }
  
  // Wait for completion
  const exitResult = await waitForExit(chatServer);
  
  if (exitResult.isOk()) {
    console.log(`✅ Chat simulation completed with code: ${exitResult.value.code}`);
  } else {
    console.log(`❌ Chat simulation failed: ${exitResult.error.message}`);
  }
}

/**
 * Example 4: Data processing pipeline with feedback
 */
async function dataProcessingPipeline() {
  separator('EXAMPLE 4: Data Processing Pipeline with Feedback');
  
  console.log('🔄 Starting data processing pipeline...');
  
  // Create data processor script
  const processorScript = `
let processedCount = 0;
let errorCount = 0;

process.stdin.on('data', (data) => {
  const lines = data.toString().trim().split('\\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const item = JSON.parse(line);
      
      // Simulate processing
      const processed = {
        id: item.id,
        originalData: item.data,
        processedData: item.data.toUpperCase(),
        processedAt: new Date().toISOString(),
        processingTime: Math.floor(Math.random() * 100)
      };
      
      processedCount++;
      
      // Send processed result
      console.log(JSON.stringify(processed));
      
      // Send progress update every 5 items
      if (processedCount % 5 === 0) {
        console.error(JSON.stringify({
          type: 'progress',
          processed: processedCount,
          errors: errorCount,
          timestamp: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      errorCount++;
      console.error(JSON.stringify({
        type: 'error',
        message: error.message,
        input: line,
        timestamp: new Date().toISOString()
      }));
    }
  }
});

process.on('SIGINT', () => {
  console.error(JSON.stringify({
    type: 'summary',
    totalProcessed: processedCount,
    totalErrors: errorCount,
    timestamp: new Date().toISOString()
  }));
  process.exit(0);
});

console.error(JSON.stringify({
  type: 'ready',
  message: 'Data processor ready',
  timestamp: new Date().toISOString()
}));
`;

  // Spawn processor
  const result = await spawn('node', ['-e', processorScript]);
  
  if (result.isErr()) {
    console.error('❌ Failed to start processor:', result.error.message);
    return;
  }
  
  const { process: processor } = result.value;
  
  // Handle outputs
  if (processor.stdout) {
    processor.stdout.on('data', (chunk) => {
      const lines = chunk.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const result = JSON.parse(line);
            console.log(`✅ Processed item ${result.id}: ${result.originalData} → ${result.processedData} (${result.processingTime}ms)`);
          } catch (error) {
            console.log(`📤 Output: ${line}`);
          }
        }
      }
    });
  }
  
  if (processor.stderr) {
    processor.stderr.on('data', (chunk) => {
      const lines = chunk.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            switch (message.type) {
              case 'ready':
                console.log(`🟢 ${message.message}`);
                break;
              case 'progress':
                console.log(`📊 Progress: ${message.processed} processed, ${message.errors} errors`);
                break;
              case 'error':
                console.log(`❌ Processing error: ${message.message}`);
                break;
              case 'summary':
                console.log(`📈 Final: ${message.totalProcessed} processed, ${message.totalErrors} errors`);
                break;
            }
          } catch (error) {
            console.log(`⚠️  Status: ${line}`);
          }
        }
      }
    });
  }
  
  // Send test data
  const testData = [
    { id: 1, data: 'hello world' },
    { id: 2, data: 'process this text' },
    { id: 3, data: 'another item' },
    { id: 4, data: 'data transformation' },
    { id: 5, data: 'pipeline testing' },
    { id: 6, data: 'real-time processing' },
    { id: 7, data: 'streaming data' },
    { id: 8, data: 'final item' },
    'invalid json', // This will cause an error
    { id: 9, data: 'recovery test' },
    { id: 10, data: 'last item' }
  ];
  
  for (let i = 0; i < testData.length; i++) {
    const item = testData[i];
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const dataStr = typeof item === 'string' ? item : JSON.stringify(item);
    console.log(`📤 Sending: ${typeof item === 'object' ? `item ${item.id}` : 'invalid data'}`);
    
    if (processor.stdin) {
      processor.stdin.write(`${dataStr}\n`);
    }
  }
  
  // Wait a bit then send termination signal
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (processor.pid) {
    process.kill(processor.pid, 'SIGINT');
  }
  
  // Wait for completion
  const exitResult = await waitForExit(processor);
  
  if (exitResult.isOk()) {
    console.log(`✅ Data processing pipeline completed`);
  } else {
    console.log(`❌ Data processing pipeline failed: ${exitResult.error.message}`);
  }
}

// Main execution
async function main() {
  console.log('🔄 Interactive Process Examples');
  console.log('================================');
  
  try {
    await interactiveCalculator();
    await interactiveFileProcessor();
    await realTimeChatSimulation();
    await dataProcessingPipeline();
    
    console.log('\n🎊 All interactive process examples completed successfully!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { main as runInteractiveProcessExamples };