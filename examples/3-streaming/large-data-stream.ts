#!/usr/bin/env node --loader ts-node/esm

/**
 * Large Data Stream Processing Examples
 * 
 * This example demonstrates handling large data streams efficiently,
 * including memory management, backpressure handling, and stream optimization.
 * 
 * Key concepts:
 * - Large data stream processing
 * - Memory management and backpressure
 * - Stream transformation and filtering
 * - Performance monitoring
 * - Graceful degradation under load
 */

import { spawn, waitForExit } from '../../src/index';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

/**
 * Example 1: Processing large log files
 */
async function processLargeLogFile() {
  separator('EXAMPLE 1: Processing Large Log Files');
  
  console.log('🔄 Generating and processing large log file...');
  
  // Create a large log file generator
  const logGeneratorScript = `
const startTime = Date.now();
let lineCount = 0;
const targetLines = 10000;

const logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
const components = ['API', 'Database', 'Cache', 'Queue', 'Auth'];
const actions = ['Request', 'Response', 'Query', 'Update', 'Insert', 'Delete'];

function generateLogLine() {
  const timestamp = new Date().toISOString();
  const level = logLevels[Math.floor(Math.random() * logLevels.length)];
  const component = components[Math.floor(Math.random() * components.length)];
  const action = actions[Math.floor(Math.random() * actions.length)];
  const duration = Math.floor(Math.random() * 1000);
  const userId = Math.floor(Math.random() * 10000);
  
  return \`[\${timestamp}] \${level} \${component}: \${action} completed in \${duration}ms (user: \${userId})\`;
}

// Generate logs with some realistic patterns
const interval = setInterval(() => {
  // Burst of logs
  const burstSize = Math.floor(Math.random() * 10) + 1;
  
  for (let i = 0; i < burstSize && lineCount < targetLines; i++) {
    console.log(generateLogLine());
    lineCount++;
    
    // Add some errors occasionally
    if (Math.random() < 0.05) {
      console.log(\`[\${new Date().toISOString()}] ERROR System: Connection timeout after 30s\`);
      lineCount++;
    }
  }
  
  if (lineCount >= targetLines) {
    clearInterval(interval);
    console.error(\`Generated \${lineCount} log lines in \${Date.now() - startTime}ms\`);
    process.exit(0);
  }
}, 10); // Generate bursts every 10ms
`;

  // Spawn log generator
  const generatorResult = await spawn('node', ['-e', logGeneratorScript]);
  
  if (generatorResult.isErr()) {
    console.error('❌ Failed to start log generator:', generatorResult.error.message);
    return;
  }
  
  const { process: generator } = generatorResult.value;
  
  // Set up log processing
  let totalLines = 0;
  let errorLines = 0;
  let warnLines = 0;
  let infoLines = 0;
  let debugLines = 0;
  let bytesProcessed = 0;
  
  const startTime = Date.now();
  let lastProgressTime = startTime;
  let lastLineCount = 0;
  
  // Process stdout stream
  if (generator.stdout) {
    generator.stdout.on('data', (chunk) => {
      const data = chunk.toString();
      bytesProcessed += Buffer.byteLength(data);
      
      const lines = data.split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          totalLines++;
          
          // Categorize log entries
          if (line.includes('ERROR')) {
            errorLines++;
          } else if (line.includes('WARN')) {
            warnLines++;
          } else if (line.includes('INFO')) {
            infoLines++;
          } else if (line.includes('DEBUG')) {
            debugLines++;
          }
          
          // Show progress every 1000 lines
          if (totalLines % 1000 === 0) {
            const currentTime = Date.now();
            const timeDiff = currentTime - lastProgressTime;
            const linesDiff = totalLines - lastLineCount;
            const linesPerSecond = Math.floor((linesDiff / timeDiff) * 1000);
            
            console.log(`📊 Processed ${totalLines} lines (${linesPerSecond} lines/sec, ${Math.floor(bytesProcessed / 1024)}KB)`);
            
            lastProgressTime = currentTime;
            lastLineCount = totalLines;
          }
        }
      }
    });
  }
  
  // Handle generator status
  if (generator.stderr) {
    generator.stderr.on('data', (chunk) => {
      const data = chunk.toString().trim();
      if (data) {
        console.log(`🔧 Generator: ${data}`);
      }
    });
  }
  
  // Wait for completion
  const exitResult = await waitForExit(generator);
  
  const totalTime = Date.now() - startTime;
  const throughput = Math.floor((totalLines / totalTime) * 1000);
  
  console.log('\n📈 Log Processing Summary:');
  console.log(`   Total lines processed: ${totalLines}`);
  console.log(`   ERROR entries: ${errorLines}`);
  console.log(`   WARN entries: ${warnLines}`);
  console.log(`   INFO entries: ${infoLines}`);
  console.log(`   DEBUG entries: ${debugLines}`);
  console.log(`   Data processed: ${Math.floor(bytesProcessed / 1024)}KB`);
  console.log(`   Processing time: ${totalTime}ms`);
  console.log(`   Throughput: ${throughput} lines/second`);
  
  if (exitResult.isOk()) {
    console.log(`   ✅ Generator completed with code: ${exitResult.value.code}`);
  }
}

/**
 * Example 2: Stream transformation with backpressure
 */
async function streamTransformationWithBackpressure() {
  separator('EXAMPLE 2: Stream Transformation with Backpressure');
  
  console.log('🔄 Demonstrating backpressure handling...');
  
  // Create data producer that generates data faster than it can be consumed
  const producerScript = `
let counter = 0;
const maxRecords = 5000;

function generateRecord() {
  return JSON.stringify({
    id: ++counter,
    timestamp: Date.now(),
    data: 'x'.repeat(100), // 100 bytes of data
    randomValue: Math.random()
  });
}

const interval = setInterval(() => {
  // Generate multiple records per interval
  for (let i = 0; i < 50 && counter < maxRecords; i++) {
    console.log(generateRecord());
  }
  
  if (counter >= maxRecords) {
    clearInterval(interval);
    console.error(\`Produced \${counter} records\`);
    process.exit(0);
  }
}, 10); // Fast production rate
`;

  // Spawn producer
  const producerResult = await spawn('node', ['-e', producerScript]);
  
  if (producerResult.isErr()) {
    console.error('❌ Failed to start producer:', producerResult.error.message);
    return;
  }
  
  const { process: producer } = producerResult.value;
  
  // Set up stream processing with artificial slowdown
  let processedRecords = 0;
  let droppedRecords = 0;
  let bufferSize = 0;
  const maxBufferSize = 100; // Limit buffer to demonstrate backpressure
  const buffer: string[] = [];
  
  const startTime = Date.now();
  
  // Process producer output
  if (producer.stdout) {
    producer.stdout.on('data', (chunk) => {
      const lines = chunk.toString().trim().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          if (buffer.length < maxBufferSize) {
            buffer.push(line);
            bufferSize++;
          } else {
            droppedRecords++;
            if (droppedRecords % 100 === 0) {
              console.log(`⚠️  Buffer full! Dropped ${droppedRecords} records`);
            }
          }
        }
      }
    });
  }
  
  // Process buffer with artificial delay (simulating slow consumer)
  const processBuffer = async () => {
    while (buffer.length > 0) {
      const record = buffer.shift();
      if (record) {
        try {
          const data = JSON.parse(record);
          
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 2));
          
          processedRecords++;
          bufferSize--;
          
          if (processedRecords % 250 === 0) {
            console.log(`📊 Processed: ${processedRecords}, Buffer: ${bufferSize}, Dropped: ${droppedRecords}`);
          }
        } catch (error) {
          console.log(`❌ Invalid record: ${record.substring(0, 50)}...`);
        }
      }
    }
  };
  
  // Start buffer processing
  const bufferProcessor = setInterval(processBuffer, 50);
  
  // Handle producer status
  if (producer.stderr) {
    producer.stderr.on('data', (chunk) => {
      const data = chunk.toString().trim();
      if (data) {
        console.log(`🏭 Producer: ${data}`);
      }
    });
  }
  
  // Wait for producer completion
  const exitResult = await waitForExit(producer);
  
  // Process remaining buffer
  console.log('🔄 Processing remaining buffer...');
  while (buffer.length > 0) {
    await processBuffer();
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  clearInterval(bufferProcessor);
  
  const totalTime = Date.now() - startTime;
  const throughput = Math.floor((processedRecords / totalTime) * 1000);
  
  console.log('\n📈 Backpressure Handling Summary:');
  console.log(`   Records processed: ${processedRecords}`);
  console.log(`   Records dropped: ${droppedRecords}`);
  console.log(`   Drop rate: ${((droppedRecords / (processedRecords + droppedRecords)) * 100).toFixed(2)}%`);
  console.log(`   Processing time: ${totalTime}ms`);
  console.log(`   Throughput: ${throughput} records/second`);
  
  if (exitResult.isOk()) {
    console.log(`   ✅ Producer completed with code: ${exitResult.value.code}`);
  }
}

/**
 * Example 3: Memory-efficient CSV processing
 */
async function memoryEfficientCsvProcessing() {
  separator('EXAMPLE 3: Memory-Efficient CSV Processing');
  
  console.log('🔄 Processing large CSV file...');
  
  // Create CSV generator
  const csvGeneratorScript = `
const rowCount = 50000;
let generated = 0;

// CSV header
console.log('id,name,email,age,city,country,salary,department');

const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Frank', 'Grace'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'];
const countries = ['USA', 'Canada', 'UK', 'Germany', 'France', 'Japan', 'Australia'];
const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations'];

function generateRow() {
  const id = ++generated;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const name = \`\${firstName} \${lastName}\`;
  const email = \`\${firstName.toLowerCase()}.\${lastName.toLowerCase()}@company.com\`;
  const age = Math.floor(Math.random() * 40) + 25;
  const city = cities[Math.floor(Math.random() * cities.length)];
  const country = countries[Math.floor(Math.random() * countries.length)];
  const salary = Math.floor(Math.random() * 100000) + 40000;
  const department = departments[Math.floor(Math.random() * departments.length)];
  
  return \`\${id},"\${name}",\${email},\${age},"\${city}",\${country},\${salary},\${department}\`;
}

const interval = setInterval(() => {
  // Generate in batches
  for (let i = 0; i < 100 && generated < rowCount; i++) {
    console.log(generateRow());
  }
  
  if (generated >= rowCount) {
    clearInterval(interval);
    console.error(\`Generated \${generated} CSV rows\`);
    process.exit(0);
  }
}, 5);
`;

  // Spawn CSV generator
  const generatorResult = await spawn('node', ['-e', csvGeneratorScript]);
  
  if (generatorResult.isErr()) {
    console.error('❌ Failed to start CSV generator:', generatorResult.error.message);
    return;
  }
  
  const { process: generator } = generatorResult.value;
  
  // CSV processing state
  let headerProcessed = false;
  let totalRows = 0;
  let validRows = 0;
  let invalidRows = 0;
  let csvBuffer = '';
  
  // Department statistics
  const departmentStats: Record<string, { count: number; totalSalary: number; totalAge: number }> = {};
  
  const startTime = Date.now();
  
  // Process CSV stream
  if (generator.stdout) {
    generator.stdout.on('data', (chunk) => {
      csvBuffer += chunk.toString();
      
      // Process complete lines
      const lines = csvBuffer.split('\n');
      csvBuffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          if (!headerProcessed) {
            console.log(`📋 CSV Header: ${line}`);
            headerProcessed = true;
            continue;
          }
          
          totalRows++;
          
          try {
            // Parse CSV row (simple parsing for demo)
            const parts = line.split(',');
            if (parts.length >= 8) {
              const id = parseInt(parts[0]);
              const name = parts[1].replace(/"/g, '');
              const email = parts[2];
              const age = parseInt(parts[3]);
              const city = parts[4].replace(/"/g, '');
              const country = parts[5];
              const salary = parseInt(parts[6]);
              const department = parts[7];
              
              // Validate data
              if (!isNaN(id) && !isNaN(age) && !isNaN(salary) && email.includes('@')) {
                validRows++;
                
                // Update department statistics
                if (!departmentStats[department]) {
                  departmentStats[department] = { count: 0, totalSalary: 0, totalAge: 0 };
                }
                
                departmentStats[department].count++;
                departmentStats[department].totalSalary += salary;
                departmentStats[department].totalAge += age;
                
                // Show progress
                if (validRows % 5000 === 0) {
                  const currentTime = Date.now();
                  const rate = Math.floor((validRows / (currentTime - startTime)) * 1000);
                  console.log(`📊 Processed ${validRows} valid rows (${rate} rows/sec)`);
                }
              } else {
                invalidRows++;
              }
            } else {
              invalidRows++;
            }
          } catch (error) {
            invalidRows++;
          }
        }
      }
    });
  }
  
  // Handle generator status
  if (generator.stderr) {
    generator.stderr.on('data', (chunk) => {
      const data = chunk.toString().trim();
      if (data) {
        console.log(`📊 Generator: ${data}`);
      }
    });
  }
  
  // Wait for completion
  const exitResult = await waitForExit(generator);
  
  // Process any remaining data in buffer
  if (csvBuffer.trim()) {
    totalRows++;
    // Process final line...
  }
  
  const totalTime = Date.now() - startTime;
  const throughput = Math.floor((validRows / totalTime) * 1000);
  
  console.log('\n📈 CSV Processing Summary:');
  console.log(`   Total rows: ${totalRows}`);
  console.log(`   Valid rows: ${validRows}`);
  console.log(`   Invalid rows: ${invalidRows}`);
  console.log(`   Validation rate: ${((validRows / totalRows) * 100).toFixed(2)}%`);
  console.log(`   Processing time: ${totalTime}ms`);
  console.log(`   Throughput: ${throughput} rows/second`);
  
  console.log('\n📊 Department Statistics:');
  for (const [dept, stats] of Object.entries(departmentStats)) {
    const avgSalary = Math.floor(stats.totalSalary / stats.count);
    const avgAge = Math.floor(stats.totalAge / stats.count);
    console.log(`   ${dept}: ${stats.count} employees, avg salary: $${avgSalary}, avg age: ${avgAge}`);
  }
  
  if (exitResult.isOk()) {
    console.log(`   ✅ Generator completed with code: ${exitResult.value.code}`);
  }
}

/**
 * Example 4: Real-time data aggregation
 */
async function realTimeDataAggregation() {
  separator('EXAMPLE 4: Real-time Data Aggregation');
  
  console.log('🔄 Starting real-time data aggregation...');
  
  // Create metrics generator
  const metricsScript = `
let messageId = 0;
const startTime = Date.now();

const metrics = ['cpu_usage', 'memory_usage', 'disk_io', 'network_io', 'response_time'];
const services = ['api-server', 'database', 'cache', 'queue', 'auth-service'];

function generateMetric() {
  const metric = metrics[Math.floor(Math.random() * metrics.length)];
  const service = services[Math.floor(Math.random() * services.length)];
  const value = Math.random() * 100;
  const timestamp = Date.now();
  
  return JSON.stringify({
    id: ++messageId,
    metric,
    service,
    value: Math.round(value * 100) / 100,
    timestamp,
    tags: {
      environment: 'production',
      region: 'us-east-1'
    }
  });
}

// Generate metrics at varying rates
let baseRate = 50; // Base metrics per second
const rateVariation = setInterval(() => {
  baseRate = 30 + Math.floor(Math.random() * 40); // 30-70 metrics/sec
}, 5000);

const interval = setInterval(() => {
  const batchSize = Math.floor(baseRate / 10); // 10 batches per second
  
  for (let i = 0; i < batchSize; i++) {
    console.log(generateMetric());
  }
  
  // Stop after 30 seconds
  if (Date.now() - startTime > 30000) {
    clearInterval(interval);
    clearInterval(rateVariation);
    console.error(\`Generated \${messageId} metrics\`);
    process.exit(0);
  }
}, 100);
`;

  // Spawn metrics generator
  const generatorResult = await spawn('node', ['-e', metricsScript]);
  
  if (generatorResult.isErr()) {
    console.error('❌ Failed to start metrics generator:', generatorResult.error.message);
    return;
  }
  
  const { process: generator } = generatorResult.value;
  
  // Real-time aggregation state
  const aggregations: Record<string, Record<string, { sum: number; count: number; min: number; max: number }>> = {};
  let totalMetrics = 0;
  let processedMetrics = 0;
  let metricsBuffer = '';
  
  const startTime = Date.now();
  let lastAggregationTime = startTime;
  
  // Process metrics stream
  if (generator.stdout) {
    generator.stdout.on('data', (chunk) => {
      metricsBuffer += chunk.toString();
      
      const lines = metricsBuffer.split('\n');
      metricsBuffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          totalMetrics++;
          
          try {
            const metric = JSON.parse(line);
            
            // Initialize aggregation structures
            if (!aggregations[metric.service]) {
              aggregations[metric.service] = {};
            }
            
            if (!aggregations[metric.service][metric.metric]) {
              aggregations[metric.service][metric.metric] = {
                sum: 0,
                count: 0,
                min: Infinity,
                max: -Infinity
              };
            }
            
            // Update aggregations
            const agg = aggregations[metric.service][metric.metric];
            agg.sum += metric.value;
            agg.count++;
            agg.min = Math.min(agg.min, metric.value);
            agg.max = Math.max(agg.max, metric.value);
            
            processedMetrics++;
            
          } catch (error) {
            console.log(`❌ Invalid metric: ${line.substring(0, 50)}...`);
          }
        }
      }
      
      // Print aggregation summary every 5 seconds
      const currentTime = Date.now();
      if (currentTime - lastAggregationTime > 5000) {
        console.log('\\n📊 Real-time Aggregation Summary:');
        console.log(`   Metrics processed: ${processedMetrics}`);
        console.log(`   Rate: ${Math.floor((processedMetrics / (currentTime - startTime)) * 1000)} metrics/sec`);
        
        for (const [service, serviceMetrics] of Object.entries(aggregations)) {
          console.log(`   Service: ${service}`);
          for (const [metricName, agg] of Object.entries(serviceMetrics)) {
            const avg = agg.sum / agg.count;
            console.log(`     ${metricName}: avg=${avg.toFixed(2)}, min=${agg.min.toFixed(2)}, max=${agg.max.toFixed(2)}, count=${agg.count}`);
          }
        }
        
        lastAggregationTime = currentTime;
      }
    });
  }
  
  // Handle generator status
  if (generator.stderr) {
    generator.stderr.on('data', (chunk) => {
      const data = chunk.toString().trim();
      if (data) {
        console.log(`📈 Generator: ${data}`);
      }
    });
  }
  
  // Wait for completion
  const exitResult = await waitForExit(generator);
  
  const totalTime = Date.now() - startTime;
  const throughput = Math.floor((processedMetrics / totalTime) * 1000);
  
  console.log('\n📈 Final Aggregation Results:');
  console.log(`   Total metrics: ${totalMetrics}`);
  console.log(`   Processed metrics: ${processedMetrics}`);
  console.log(`   Processing time: ${totalTime}ms`);
  console.log(`   Throughput: ${throughput} metrics/second`);
  
  console.log('\n📊 Service Summary:');
  for (const [service, serviceMetrics] of Object.entries(aggregations)) {
    const totalCount = Object.values(serviceMetrics).reduce((sum, agg) => sum + agg.count, 0);
    console.log(`   ${service}: ${totalCount} metrics across ${Object.keys(serviceMetrics).length} metric types`);
  }
  
  if (exitResult.isOk()) {
    console.log(`   ✅ Generator completed with code: ${exitResult.value.code}`);
  }
}

// Main execution
async function main() {
  console.log('🌊 Large Data Stream Processing Examples');
  console.log('=========================================');
  
  try {
    await processLargeLogFile();
    await streamTransformationWithBackpressure();
    await memoryEfficientCsvProcessing();
    await realTimeDataAggregation();
    
    console.log('\n🎊 All large data stream examples completed successfully!');
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

export { main as runLargeDataStreamExamples };