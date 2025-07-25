#!/usr/bin/env node --loader ts-node/esm

/**
 * Process Monitoring Examples
 * 
 * This example demonstrates advanced process monitoring techniques,
 * including resource usage tracking, performance metrics, and alerting.
 * 
 * Key concepts:
 * - Resource usage monitoring (CPU, memory)
 * - Performance metrics collection
 * - Process behavior analysis
 * - Alerting and notification systems
 * - Metrics aggregation and reporting
 */

import { spawn, exec, waitForExit } from '../../src/index';
import { ChildProcess } from 'child_process';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

interface ProcessMetrics {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryMB: number;
  uptimeSeconds: number;
  fileDescriptors: number;
  threads: number;
  timestamp: number;
}

interface Alert {
  type: 'cpu' | 'memory' | 'uptime' | 'crash';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  processName: string;
}

class ProcessMonitor {
  private monitoredProcesses: Map<string, ChildProcess> = new Map();
  private metricsHistory: Map<string, ProcessMetrics[]> = new Map();
  private alerts: Alert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private thresholds = {
    cpuPercent: 80,
    memoryMB: 500,
    maxUptime: 3600 // 1 hour
  };

  /**
   * Add a process to monitoring
   */
  addProcess(name: string, process: ChildProcess): void {
    this.monitoredProcesses.set(name, process);
    this.metricsHistory.set(name, []);
    console.log(`📊 Added ${name} to monitoring (PID: ${process.pid})`);
    
    // Set up process event listeners
    this.setupProcessListeners(name, process);
  }

  /**
   * Remove a process from monitoring
   */
  removeProcess(name: string): void {
    this.monitoredProcesses.delete(name);
    console.log(`📊 Removed ${name} from monitoring`);
  }

  /**
   * Start monitoring all registered processes
   */
  startMonitoring(intervalMs = 5000): void {
    if (this.monitoringInterval) {
      console.log('⚠️  Monitoring already running');
      return;
    }

    console.log(`📈 Starting process monitoring (interval: ${intervalMs}ms)`);
    
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      this.analyzeMetrics();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('📈 Process monitoring stopped');
    }
  }

  /**
   * Get latest metrics for a process
   */
  getLatestMetrics(processName: string): ProcessMetrics | undefined {
    const history = this.metricsHistory.get(processName);
    return history && history.length > 0 ? history[history.length - 1] : undefined;
  }

  /**
   * Get metrics history for a process
   */
  getMetricsHistory(processName: string, limit = 10): ProcessMetrics[] {
    const history = this.metricsHistory.get(processName) || [];
    return history.slice(-limit);
  }

  /**
   * Get all alerts
   */
  getAlerts(severity?: Alert['severity']): Alert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  /**
   * Generate monitoring report
   */
  generateReport(): void {
    console.log('\n📊 MONITORING REPORT');
    console.log('===================');
    
    for (const [name, process] of this.monitoredProcesses) {
      console.log(`\n🔍 Process: ${name} (PID: ${process.pid})`);
      
      const metrics = this.getLatestMetrics(name);
      if (metrics) {
        console.log(`   CPU: ${metrics.cpuPercent.toFixed(2)}%`);
        console.log(`   Memory: ${metrics.memoryMB.toFixed(2)} MB`);
        console.log(`   Uptime: ${metrics.uptimeSeconds}s`);
        console.log(`   File Descriptors: ${metrics.fileDescriptors}`);
        console.log(`   Threads: ${metrics.threads}`);
      } else {
        console.log('   No metrics available');
      }
      
      // Show trend
      const history = this.getMetricsHistory(name, 5);
      if (history.length >= 2) {
        const cpuTrend = this.calculateTrend(history.map(m => m.cpuPercent));
        const memTrend = this.calculateTrend(history.map(m => m.memoryMB));
        
        console.log(`   CPU Trend: ${this.formatTrend(cpuTrend)}`);
        console.log(`   Memory Trend: ${this.formatTrend(memTrend)}`);
      }
    }
    
    // Show alerts summary
    const recentAlerts = this.alerts.filter(a => 
      Date.now() - a.timestamp < 300000 // Last 5 minutes
    );
    
    if (recentAlerts.length > 0) {
      console.log('\n🚨 RECENT ALERTS (Last 5 minutes)');
      console.log('=================================');
      
      recentAlerts.forEach(alert => {
        const timeAgo = Math.floor((Date.now() - alert.timestamp) / 1000);
        console.log(`   ${this.getSeverityIcon(alert.severity)} [${alert.severity.toUpperCase()}] ${alert.processName}: ${alert.message} (${timeAgo}s ago)`);
      });
    }
  }

  private async collectMetrics(): Promise<void> {
    for (const [name, process] of this.monitoredProcesses) {
      if (!process.pid) continue;

      try {
        const metrics = await this.getProcessMetrics(process.pid, name);
        
        const history = this.metricsHistory.get(name)!;
        history.push(metrics);
        
        // Keep only last 100 metrics
        if (history.length > 100) {
          history.shift();
        }
        
      } catch (error) {
        console.log(`⚠️  Failed to collect metrics for ${name}:`, error);
      }
    }
  }

  private async getProcessMetrics(pid: number, name: string): Promise<ProcessMetrics> {
    // Use ps command to get process information
    const psResult = await exec(`ps -p ${pid} -o pid,pcpu,rss,etime,nlwp 2>/dev/null || echo "NOTFOUND"`);
    
    if (psResult.isErr() || psResult.value.stdout.includes('NOTFOUND')) {
      throw new Error(`Process ${pid} not found`);
    }
    
    const lines = psResult.value.stdout.trim().split('\n');
    if (lines.length < 2) {
      throw new Error(`Invalid ps output for PID ${pid}`);
    }
    
    const data = lines[1].trim().split(/\s+/);
    const cpuPercent = parseFloat(data[1]) || 0;
    const memoryKB = parseInt(data[2]) || 0;
    const memoryMB = memoryKB / 1024;
    const etimeStr = data[3] || '0';
    const threads = parseInt(data[4]) || 1;
    
    // Parse elapsed time (format can be: MM:SS, HH:MM:SS, or DD-HH:MM:SS)
    const uptimeSeconds = this.parseElapsedTime(etimeStr);
    
    // Get file descriptor count (simplified)
    let fileDescriptors = 0;
    try {
      const fdResult = await exec(`ls /proc/${pid}/fd 2>/dev/null | wc -l`);
      if (fdResult.isOk()) {
        fileDescriptors = parseInt(fdResult.value.stdout.trim()) || 0;
      }
    } catch {
      // Ignore errors - file descriptors not critical
    }
    
    return {
      pid,
      name,
      cpuPercent,
      memoryMB,
      uptimeSeconds,
      fileDescriptors,
      threads,
      timestamp: Date.now()
    };
  }

  private parseElapsedTime(etimeStr: string): number {
    // Parse formats like: MM:SS, HH:MM:SS, DD-HH:MM:SS
    if (etimeStr.includes('-')) {
      const [days, time] = etimeStr.split('-');
      const daySeconds = parseInt(days) * 24 * 3600;
      return daySeconds + this.parseElapsedTime(time);
    }
    
    const parts = etimeStr.split(':').map(p => parseInt(p) || 0);
    
    if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    return 0;
  }

  private analyzeMetrics(): void {
    for (const [name, process] of this.monitoredProcesses) {
      const metrics = this.getLatestMetrics(name);
      if (!metrics) continue;
      
      // CPU usage alerts
      if (metrics.cpuPercent > this.thresholds.cpuPercent) {
        this.addAlert({
          type: 'cpu',
          severity: metrics.cpuPercent > 95 ? 'critical' : 'high',
          message: `High CPU usage: ${metrics.cpuPercent.toFixed(2)}%`,
          processName: name,
          timestamp: Date.now()
        });
      }
      
      // Memory usage alerts
      if (metrics.memoryMB > this.thresholds.memoryMB) {
        this.addAlert({
          type: 'memory',
          severity: metrics.memoryMB > 1000 ? 'critical' : 'medium',
          message: `High memory usage: ${metrics.memoryMB.toFixed(2)} MB`,
          processName: name,
          timestamp: Date.now()
        });
      }
      
      // Uptime alerts (for processes that should restart periodically)
      if (metrics.uptimeSeconds > this.thresholds.maxUptime) {
        this.addAlert({
          type: 'uptime',
          severity: 'low',
          message: `Process has been running for ${Math.floor(metrics.uptimeSeconds / 3600)} hours`,
          processName: name,
          timestamp: Date.now()
        });
      }
    }
  }

  private addAlert(alert: Alert): void {
    // Avoid duplicate alerts within 1 minute
    const recentSimilar = this.alerts.find(a => 
      a.type === alert.type &&
      a.processName === alert.processName &&
      Date.now() - a.timestamp < 60000
    );
    
    if (!recentSimilar) {
      this.alerts.push(alert);
      console.log(`🚨 [${alert.severity.toUpperCase()}] ${alert.processName}: ${alert.message}`);
      
      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts.shift();
      }
    }
  }

  private setupProcessListeners(name: string, process: ChildProcess): void {
    process.on('exit', (code, signal) => {
      this.addAlert({
        type: 'crash',
        severity: code === 0 ? 'low' : 'high',
        message: `Process exited with code ${code}, signal ${signal}`,
        processName: name,
        timestamp: Date.now()
      });
    });
    
    process.on('error', (error) => {
      this.addAlert({
        type: 'crash',
        severity: 'critical',
        message: `Process error: ${error.message}`,
        processName: name,
        timestamp: Date.now()
      });
    });
  }

  private calculateTrend(values: number[]): 'rising' | 'falling' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    const threshold = first * 0.1; // 10% change
    
    if (Math.abs(diff) < threshold) return 'stable';
    return diff > 0 ? 'rising' : 'falling';
  }

  private formatTrend(trend: 'rising' | 'falling' | 'stable'): string {
    switch (trend) {
      case 'rising': return '📈 Rising';
      case 'falling': return '📉 Falling';
      case 'stable': return '➡️  Stable';
    }
  }

  private getSeverityIcon(severity: Alert['severity']): string {
    switch (severity) {
      case 'low': return '💙';
      case 'medium': return '💛';
      case 'high': return '🧡';
      case 'critical': return '❤️';
    }
  }
}

/**
 * Example 1: Basic resource monitoring
 */
async function basicResourceMonitoring() {
  separator('EXAMPLE 1: Basic Resource Monitoring');
  
  const monitor = new ProcessMonitor();
  
  console.log('🔄 Starting resource monitoring example...');
  
  // Start a CPU-intensive process
  const cpuIntensiveResult = await spawn('node', ['-e', `
    console.log('Starting CPU-intensive process...');
    
    function cpuBurn() {
      const start = Date.now();
      while (Date.now() - start < 200) {
        // Burn CPU for 200ms
        Math.sqrt(Math.random());
      }
    }
    
    const interval = setInterval(() => {
      cpuBurn();
      console.log('CPU work completed');
    }, 1000);
    
    setTimeout(() => {
      clearInterval(interval);
      console.log('CPU-intensive work finished');
      process.exit(0);
    }, 15000);
  `]);
  
  if (cpuIntensiveResult.isOk()) {
    monitor.addProcess('cpu-worker', cpuIntensiveResult.value.process);
  }
  
  // Start a memory-intensive process
  const memIntensiveResult = await spawn('node', ['-e', `
    console.log('Starting memory-intensive process...');
    
    const chunks = [];
    let counter = 0;
    
    const interval = setInterval(() => {
      // Allocate 10MB chunks
      const chunk = Buffer.alloc(10 * 1024 * 1024, counter++);
      chunks.push(chunk);
      
      console.log(\`Allocated chunk \${counter}, total memory: \${chunks.length * 10}MB\`);
      
      // Keep only last 20 chunks (200MB max)
      if (chunks.length > 20) {
        chunks.shift();
      }
    }, 2000);
    
    setTimeout(() => {
      clearInterval(interval);
      console.log('Memory-intensive work finished');
      process.exit(0);
    }, 15000);
  `]);
  
  if (memIntensiveResult.isOk()) {
    monitor.addProcess('memory-worker', memIntensiveResult.value.process);
  }
  
  // Start monitoring
  monitor.startMonitoring(3000);
  
  // Let them run and generate reports
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    monitor.generateReport();
  }
  
  monitor.stopMonitoring();
  
  // Wait for processes to finish
  if (cpuIntensiveResult.isOk()) {
    await waitForExit(cpuIntensiveResult.value.process);
  }
  if (memIntensiveResult.isOk()) {
    await waitForExit(memIntensiveResult.value.process);
  }
}

/**
 * Example 2: Performance trend analysis
 */
async function performanceTrendAnalysis() {
  separator('EXAMPLE 2: Performance Trend Analysis');
  
  const monitor = new ProcessMonitor();
  
  console.log('🔄 Starting performance trend analysis...');
  
  // Start a process with varying load
  const varyingLoadResult = await spawn('node', ['-e', `
    console.log('Starting varying load process...');
    
    let phase = 0;
    let counter = 0;
    
    const interval = setInterval(() => {
      counter++;
      phase = Math.floor(counter / 5) % 3; // Change phase every 5 iterations
      
      switch (phase) {
        case 0: // Low load
          console.log('Phase 1: Low load');
          setTimeout(() => {}, 100);
          break;
        case 1: // Medium load
          console.log('Phase 2: Medium load');
          const start1 = Date.now();
          while (Date.now() - start1 < 300) {
            Math.sqrt(Math.random());
          }
          break;
        case 2: // High load
          console.log('Phase 3: High load');
          const start2 = Date.now();
          while (Date.now() - start2 < 600) {
            Math.sqrt(Math.random());
          }
          break;
      }
      
      if (counter >= 20) {
        clearInterval(interval);
        console.log('Varying load test completed');
        process.exit(0);
      }
    }, 2000);
  `]);
  
  if (varyingLoadResult.isOk()) {
    monitor.addProcess('varying-load', varyingLoadResult.value.process);
  }
  
  // Start monitoring with shorter intervals for better trend analysis
  monitor.startMonitoring(2000);
  
  // Monitor for the duration and generate periodic reports
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    console.log(`\n📊 Trend Analysis Report #${i + 1}`);
    console.log('========================');
    
    const history = monitor.getMetricsHistory('varying-load', 5);
    if (history.length >= 2) {
      console.log('Recent metrics:');
      history.forEach((metric, index) => {
        console.log(`  ${index + 1}. CPU: ${metric.cpuPercent.toFixed(2)}%, Memory: ${metric.memoryMB.toFixed(2)}MB`);
      });
    }
  }
  
  monitor.stopMonitoring();
  
  if (varyingLoadResult.isOk()) {
    await waitForExit(varyingLoadResult.value.process);
  }
}

/**
 * Example 3: Alert system demonstration
 */
async function alertSystemDemo() {
  separator('EXAMPLE 3: Alert System Demonstration');
  
  const monitor = new ProcessMonitor();
  
  console.log('🔄 Demonstrating alert system...');
  
  // Start a process that will trigger various alerts
  const alertTriggerResult = await spawn('node', ['-e', `
    console.log('Starting alert trigger process...');
    
    let phase = 0;
    const phases = [
      { name: 'normal', duration: 5000 },
      { name: 'cpu-spike', duration: 8000 },
      { name: 'memory-leak', duration: 10000 }
    ];
    
    let currentPhase = phases[0];
    let phaseStart = Date.now();
    let memoryChunks = [];
    
    function nextPhase() {
      phase++;
      if (phase < phases.length) {
        currentPhase = phases[phase];
        phaseStart = Date.now();
        console.log(\`Entering phase: \${currentPhase.name}\`);
      } else {
        console.log('All phases completed');
        process.exit(0);
      }
    }
    
    const interval = setInterval(() => {
      const phaseElapsed = Date.now() - phaseStart;
      
      switch (currentPhase.name) {
        case 'normal':
          console.log('Normal operation');
          break;
          
        case 'cpu-spike':
          console.log('CPU spike simulation');
          const start = Date.now();
          while (Date.now() - start < 800) {
            Math.sqrt(Math.random());
          }
          break;
          
        case 'memory-leak':
          console.log('Memory leak simulation');
          const chunk = Buffer.alloc(5 * 1024 * 1024); // 5MB
          memoryChunks.push(chunk);
          console.log(\`Allocated 5MB, total: \${memoryChunks.length * 5}MB\`);
          break;
      }
      
      if (phaseElapsed >= currentPhase.duration) {
        nextPhase();
      }
    }, 1000);
    
    console.log(\`Starting phase: \${currentPhase.name}\`);
  `]);
  
  if (alertTriggerResult.isOk()) {
    monitor.addProcess('alert-trigger', alertTriggerResult.value.process);
  }
  
  // Start monitoring with frequent checks
  monitor.startMonitoring(2000);
  
  // Monitor and show alerts
  const alertCheckInterval = setInterval(() => {
    const criticalAlerts = monitor.getAlerts('critical');
    const highAlerts = monitor.getAlerts('high');
    
    if (criticalAlerts.length > 0 || highAlerts.length > 0) {
      console.log('\n🚨 ACTIVE ALERTS:');
      [...criticalAlerts, ...highAlerts].slice(-3).forEach(alert => {
        const timeAgo = Math.floor((Date.now() - alert.timestamp) / 1000);
        console.log(`   ${alert.severity.toUpperCase()}: ${alert.message} (${timeAgo}s ago)`);
      });
    }
  }, 3000);
  
  // Wait for process completion
  if (alertTriggerResult.isOk()) {
    await waitForExit(alertTriggerResult.value.process);
  }
  
  clearInterval(alertCheckInterval);
  monitor.stopMonitoring();
  
  // Final alert summary
  console.log('\n📋 FINAL ALERT SUMMARY:');
  const allAlerts = monitor.getAlerts();
  const alertsByType = allAlerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(alertsByType).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} alerts`);
  });
}

// Main execution
async function main() {
  console.log('📊 Process Monitoring Examples');
  console.log('===============================');
  
  try {
    await basicResourceMonitoring();
    await performanceTrendAnalysis();
    await alertSystemDemo();
    
    console.log('\n🎊 All process monitoring examples completed successfully!');
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

export { ProcessMonitor, main as runProcessMonitoringExamples };