# Streaming Data Examples

These examples demonstrate advanced streaming patterns for handling real-time data flow between parent and child processes, including two-way communication and large data processing.

## Files

- **`basic-streaming.ts`** - Fundamental streaming concepts and stdout/stderr capture
- **`interactive-process.ts`** - Two-way communication with child processes
- **`large-data-stream.ts`** - Memory-efficient processing of large data streams

## Key Concepts

### Stream Types and Patterns

#### Basic Streaming
- **Output Capture** - Collecting stdout/stderr from child processes
- **Real-time Processing** - Handling data as it flows from processes
- **Buffer Management** - Efficiently handling stream chunks and line boundaries
- **Multi-stream Coordination** - Managing multiple processes simultaneously

#### Interactive Communication
- **Two-way Communication** - Sending data to stdin and receiving from stdout
- **Command/Response Patterns** - Building interactive command-line tools
- **JSON Message Passing** - Structured communication protocols
- **Process Lifecycle Management** - Proper startup and shutdown procedures

#### Large Data Processing
- **Memory Efficiency** - Processing large datasets without excessive memory usage
- **Backpressure Handling** - Managing flow control when consumers are slower than producers
- **Stream Transformation** - Real-time data filtering and transformation
- **Performance Monitoring** - Tracking throughput and processing metrics

## Running Examples

```bash
# Run basic streaming examples
ts-node examples/3-streaming/basic-streaming.ts

# Run interactive process examples
ts-node examples/3-streaming/interactive-process.ts

# Run large data stream examples
ts-node examples/3-streaming/large-data-stream.ts
```

## What You'll Learn

### Basic Streaming (basic-streaming.ts)
- **stdout/stderr Capture** - How to collect and process command output
- **Real-time Stream Processing** - Handling data as it arrives
- **Large Output Handling** - Processing streams with thousands of lines
- **JSON Stream Processing** - Parsing structured data streams
- **Multi-stream Coordination** - Managing multiple concurrent processes

### Interactive Processes (interactive-process.ts)
- **Interactive Calculator** - Building command-response applications
- **File Processor** - Creating interactive file manipulation tools
- **Chat Simulation** - Real-time bidirectional communication
- **Data Processing Pipeline** - Streaming data transformation with feedback

### Large Data Streams (large-data-stream.ts)
- **Log File Processing** - Handling large log files efficiently
- **Backpressure Management** - Dealing with fast producers and slow consumers
- **CSV Processing** - Memory-efficient processing of large CSV files
- **Real-time Aggregation** - Computing statistics on streaming data

## Advanced Patterns

### Stream Capture
```typescript
// Capture output for later processing
const result = await spawn('command', [], {}, { 
  captureStdout: true, 
  captureStderr: true 
});

if (result.isOk()) {
  const [stdout, stderr] = await Promise.all([
    result.value.stdout,
    result.value.stderr
  ]);
}
```

### Real-time Processing
```typescript
// Process data as it arrives
const result = await spawn('streaming-command');
if (result.isOk()) {
  result.value.process.stdout?.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        processLine(line);
      }
    }
  });
}
```

### Interactive Communication
```typescript
// Send commands and receive responses
const result = await spawn('interactive-tool');
if (result.isOk()) {
  const process = result.value.process;
  
  // Send command
  process.stdin?.write('command\n');
  
  // Handle response
  process.stdout?.on('data', (chunk) => {
    console.log('Response:', chunk.toString());
  });
}
```

### Backpressure Handling
```typescript
// Manage flow control
const buffer: string[] = [];
const maxBufferSize = 1000;

stream.on('data', (chunk) => {
  if (buffer.length < maxBufferSize) {
    buffer.push(chunk.toString());
  } else {
    console.warn('Buffer full, dropping data');
  }
});
```

## Performance Considerations

### Memory Management
- Use streaming processing to avoid loading entire datasets into memory
- Implement proper buffer limits to prevent memory exhaustion
- Clear processed data promptly to allow garbage collection

### Throughput Optimization
- Process data in chunks rather than line-by-line for better performance
- Use parallel processing when data can be processed independently
- Monitor processing rates and adjust buffer sizes accordingly

### Error Recovery
- Handle malformed data gracefully without stopping the stream
- Implement retry logic for transient errors
- Provide meaningful error reporting while continuing processing

## Real-World Applications

These streaming patterns are essential for:
- **Log Processing** - Real-time log analysis and monitoring
- **Data Pipelines** - ETL processes and data transformation
- **Monitoring Systems** - Real-time metrics collection and aggregation
- **Interactive Tools** - Building CLI applications with rich interaction
- **Batch Processing** - Efficient processing of large datasets
- **Real-time Analytics** - Computing statistics on live data streams

## Best Practices

1. **Buffer Management** - Use appropriate buffer sizes for your use case
2. **Error Handling** - Handle stream errors without losing data
3. **Flow Control** - Implement backpressure to prevent memory issues
4. **Resource Cleanup** - Properly close streams and processes
5. **Performance Monitoring** - Track processing rates and memory usage
6. **Data Validation** - Validate stream data before processing
7. **Graceful Shutdown** - Handle process termination cleanly