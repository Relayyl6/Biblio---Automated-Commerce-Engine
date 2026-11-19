#!/usr/bin/env node
/**
 * scripts/start-backend.ts
 *
 * Unified Backend Runner for Biblio / ACE Autonomous Commerce Engine
 *
 * Spawns and supervises all 4 foundational backend microservices:
 * 1. Merchant API (Fastify REST & Realtime Stream on :3004)
 * 2. Baileys Gateway (WhatsApp Multi-Device Socket Manager on :3005)
 * 3. Comms Router (Sliding Debounce Queue & Turn Builder)
 * 4. Event Orchestrator (State Machine & Redis Event Relay)
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import dns from 'dns';
import { startRedisBridge } from './redis-bridge.js';

// Force Google DNS to fix EAI_AGAIN / ENOTFOUND on Windows (WSL bridge DNS is unreliable)
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

const require = createRequire(import.meta.url);
const TSX_CLI = require.resolve('tsx/cli');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';

interface ServiceConfig {
  name: string;
  tag: string;
  color: string;
  script: string;
  port?: number;
  description: string;
}

const SERVICES: ServiceConfig[] = [
  {
    name: 'Merchant API',
    tag: 'merchant-api',
    color: CYAN,
    script: 'ace-whatsapp/core/merchant-api/src/index.ts',
    port: 3004,
    description: 'Fastify REST & Realtime Stream Server (:3004)'
  },
  {
    name: 'Baileys Gateway',
    tag: 'baileys-gateway',
    color: GREEN,
    script: 'ace-whatsapp/core/baileys-gateway/src/index.ts',
    port: 3005,
    description: 'WhatsApp Web Multi-Device Socket Manager (:3005)'
  },
  {
    name: 'Comms Router',
    tag: 'comms-router',
    color: YELLOW,
    script: 'ace-whatsapp/core/comms-router/src/debounce.ts',
    description: 'Sliding Debounce Queue Worker (Customer Turn Builder)'
  },
  {
    name: 'Event Orchestrator',
    tag: 'orchestrator',
    color: MAGENTA,
    script: 'ace-whatsapp/core/event-orchestrator/src/index.ts',
    description: 'State Machine Transitions & Automation Daemon'
  },
  {
    name: 'Payment Verification',
    tag: 'payment',
    color: BLUE,
    script: 'ace-whatsapp/core/payment-verification/src/index.ts',
    port: 3002,
    description: 'Payment Webhooks, Timer Cron & Escrow Settlement (:3002)'
  },
  {
    name: 'Logistics Broker',
    tag: 'logistics',
    color: RED,
    script: 'ace-whatsapp/core/logistics/src/index.ts',
    description: 'Courier Auto-Assignment (Kwik/Fez/Gokada) & Live Tracking'
  },
  {
    name: 'SMS Webhook',
    tag: 'sms-webhook',
    color: '\x1b[96m',
    script: 'ace-whatsapp/core/comms-router/src/smsWebhook.ts',
    port: 3006,
    description: 'Vendor Communiqué 1-Digit SMS Decision Receiver (:3006)'
  }
];

const children: { service: ServiceConfig; process: ChildProcess }[] = [];
let isShuttingDown = false;

function printBanner() {
  console.log(`\n${BOLD}${BLUE}====================================================================${RESET}`);
  console.log(`${BOLD}${BLUE}   ⚡ BIBLIO / ACE — AUTONOMOUS COMMERCE ENGINE BACKEND SUITE       ${RESET}`);
  console.log(`${BOLD}${BLUE}====================================================================${RESET}`);
  console.log(`${DIM}Root Directory: ${ROOT_DIR}${RESET}\n`);

  console.log(`${BOLD}Supervising ${SERVICES.length} backend microservices:${RESET}`);
  SERVICES.forEach((s) => {
    const portStr = s.port ? ` [Port ${s.port}]` : '';
    console.log(`  ${s.color}●${RESET} ${BOLD}${s.name}${RESET}${portStr} — ${DIM}${s.description}${RESET}`);
  });
  console.log(`\n${DIM}Press Ctrl+C to terminate all services cleanly.${RESET}\n`);
}

function killProcessTree(pid?: number) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // Process might have already terminated
    }
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Ignored
      }
    }
  }
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${BOLD}${YELLOW}[SHUTDOWN] Terminating all backend child processes...${RESET}`);

  children.forEach(({ service, process: cp }) => {
    if (cp.pid && !cp.killed) {
      console.log(`  ${RED}✖${RESET} Stopping ${service.color}${service.name}${RESET} (PID ${cp.pid})...`);
      killProcessTree(cp.pid);
    }
  });

  console.log(`${GREEN}✔ All backend services stopped cleanly.${RESET}\n`);
  process.exit(exitCode);
}

// Trap termination signals
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));

function prefixStream(data: Buffer, service: ServiceConfig, isError = false) {
  const lines = data.toString('utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const tag = `${service.color}[${service.tag}]${RESET}`;
    const output = isError ? `${RED}${line}${RESET}` : line;
    console.log(`${tag} ${output}`);
  }
}

function startService(service: ServiceConfig) {
  const scriptPath = path.resolve(ROOT_DIR, service.script);

  const child = spawn(process.execPath, [TSX_CLI, '--env-file=.env', scriptPath], {
    cwd: ROOT_DIR,
    env: { 
      ...process.env, 
      REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6381',
      NODE_OPTIONS: '--max-old-space-size=2048 --dns-result-order=ipv4first',
      FORCE_COLOR: '1' 
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  children.push({ service, process: child });

  child.stdout?.on('data', (chunk: Buffer) => prefixStream(chunk, service, false));
  child.stderr?.on('data', (chunk: Buffer) => prefixStream(chunk, service, true));

  child.on('error', (err) => {
    console.error(`${RED}[${service.tag}] Failed to spawn process:${RESET}`, err.message);
  });

  child.on('close', (code, signal) => {
    if (!isShuttingDown) {
      console.log(
        `${YELLOW}[${service.tag}] Process exited with code ${code} (signal: ${signal || 'none'})${RESET}`
      );
    }
  });
}

async function main() {
  printBanner();
  await startRedisBridge();
  for (const s of SERVICES) {
    startService(s);
    // Stagger process startup to prevent simultaneous TSX compilation spikes on Windows
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  // Keep parent process alive while children run
  setInterval(() => {}, 60000);
}

main();
