const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PID_FILE = path.resolve(__dirname, '../../.devserver-pids.json');
const PORTS = [3300, 5473, 5474];

if (!fs.existsSync(PID_FILE)) {
  console.log('[MindCalm] No dev stack running (no PID file). Cleaning ports...');
} else {
  const data = JSON.parse(fs.readFileSync(PID_FILE, 'utf-8'));

  if (data.manager) {
    try { process.kill(data.manager, 'SIGTERM'); } catch {}
  }

  if (Array.isArray(data.children)) {
    data.children.forEach(c => {
      console.log(`[MindCalm] Stopping ${c.name} (PID ${c.pid})...`);
      try { process.kill(c.pid, 'SIGTERM'); } catch {}
    });
  }

  try { fs.unlinkSync(PID_FILE); } catch {}
}

// Fallback: kill anything still listening on our ports
const portList = PORTS.join(',');
exec(`lsof -ti :${portList} 2>/dev/null | xargs -r kill -9 2>/dev/null || true`, () => {
  console.log('[MindCalm] Dev stack stopped.');
});
