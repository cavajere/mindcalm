const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PID_FILE = path.resolve(__dirname, '../../.devserver-pids.json');
const ROOT = path.resolve(__dirname, '../..');
const isWin = process.platform === 'win32';

const useSsrFrontend = process.env.MINDCALM_FRONTEND_MODE === 'ssr';
const frontendWorkspace = useSsrFrontend ? 'frontend-ssr' : 'frontend';
const frontendPort = useSsrFrontend ? 5573 : 5473;

const PORTS = [3300, frontendPort, 5474];

const services = [
  { name: 'api', cmd: 'npm', args: ['run', 'dev', '-w', 'backend'] },
  { name: 'frontend', cmd: 'npm', args: ['run', 'dev', '-w', frontendWorkspace] },
  { name: 'admin', cmd: 'npm', args: ['run', 'dev', '-w', 'admin'] },
];

function killExistingProcesses() {
  return new Promise((resolve) => {
    console.log('[MindCalm] Checking for existing dev processes...');

    if (fs.existsSync(PID_FILE)) {
      console.log('[MindCalm] Found existing dev stack, stopping it...');
      try {
        const data = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
        (data.children || []).forEach(c => {
          try { process.kill(c.pid, 'SIGTERM'); } catch {}
        });
      } catch {}
      try { fs.unlinkSync(PID_FILE); } catch {}
    }

    const portList = PORTS.join(',');
    const killCommands = [
      `pkill -f "vite.*mindcalm" 2>/dev/null || true`,
      `pkill -f "nuxt.*mindcalm" 2>/dev/null || true`,
      `pkill -f "tsx.*mindcalm" 2>/dev/null || true`,
      `lsof -ti :${portList} 2>/dev/null | xargs -r kill -9 2>/dev/null || true`,
    ];

    let completed = 0;
    killCommands.forEach(cmd => {
      exec(cmd, () => {
        completed++;
        if (completed === killCommands.length) {
          console.log('[MindCalm] Cleanup completed, starting fresh...');
          setTimeout(resolve, 1000);
        }
      });
    });
  });
}

function ensureDocker() {
  return new Promise((resolve) => {
    const composePath = path.resolve(ROOT, 'docker/development');
    exec(
      'docker compose ps --services --filter status=running',
      { cwd: composePath },
      (_err, stdout) => {
        const running = (stdout || '').trim().split('\n').filter(Boolean);
        const required = ['postgres', 'mailhog'];
        const missing = required.filter(s => !running.includes(s));

        if (missing.length === 0) {
          console.log('[MindCalm] Docker services already running');
          resolve();
          return;
        }

        console.log(`[MindCalm] Starting docker services (${missing.join(', ')})...`);
        exec('docker compose up -d', { cwd: composePath }, (err2) => {
          if (err2) {
            console.error('[MindCalm] Failed to start docker services:', err2.message);
          } else {
            console.log('[MindCalm] Docker services started');
          }
          resolve();
        });
      }
    );
  });
}

function ensureMigrations() {
  return new Promise((resolve) => {
    const backendDir = path.resolve(ROOT, 'backend');
    exec('npx prisma migrate status', { cwd: backendDir }, (_err, stdout) => {
      if (stdout && stdout.includes('have not yet been applied')) {
        console.log('[MindCalm] Pending migrations found, applying...');
        exec('npx prisma migrate deploy', { cwd: backendDir }, (err2, _stdout2, stderr2) => {
          if (err2) {
            console.error('[MindCalm] Migration failed:', stderr2 || err2.message);
          } else {
            console.log('[MindCalm] Migrations applied successfully');
          }
          resolve();
        });
      } else {
        console.log('[MindCalm] Database migrations up to date');
        resolve();
      }
    });
  });
}

async function start() {
  await killExistingProcesses();
  await ensureDocker();
  await ensureMigrations();

  const children = [];

  function shutdownAll() {
    console.log('\n[MindCalm] Shutting down all services...');
    children.forEach(c => {
      try { process.kill(c.pid, 'SIGTERM'); } catch {}
    });
    try { fs.unlinkSync(PID_FILE); } catch {}
    setTimeout(() => process.exit(0), 1000);
  }

  process.on('SIGINT', shutdownAll);
  process.on('SIGTERM', shutdownAll);

  services.forEach(svc => {
    const child = spawn(svc.cmd, svc.args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: isWin,
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    children.push({ name: svc.name, pid: child.pid });

    child.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.error(`[${svc.name}] exited with code ${code}`);
        shutdownAll();
      }
    });
  });

  fs.writeFileSync(PID_FILE, JSON.stringify({
    manager: process.pid,
    children: children.map(c => ({ name: c.name, pid: c.pid })),
  }, null, 2));

  console.log(`
╔══════════════════════════════════════════════╗
║           MindCalm Dev Stack                 ║
╠══════════════════════════════════════════════╣
║  Mode:      ${useSsrFrontend ? 'SSR (Nuxt)' : 'SPA (Vite)'}${useSsrFrontend ? '           ' : '          '}║
║  API:       http://localhost:3300            ║
║  Frontend:  http://localhost:${frontendPort}            ║
║  Admin:     http://localhost:5474/admin/     ║
║  Postgres:  localhost:5435                   ║
║  MailHog:   http://localhost:3326            ║
╚══════════════════════════════════════════════╝
  `);
}

start().catch(err => {
  console.error('[MindCalm] Failed to start dev stack:', err);
  process.exit(1);
});
