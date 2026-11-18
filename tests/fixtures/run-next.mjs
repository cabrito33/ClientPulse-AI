// Build and serve the real application with the local fixture environment.
// Production mode avoids development HMR/manifest races during browser capture.
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const next = 'node_modules/next/dist/bin/next';
let child;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { child?.kill(signal); process.exit(0); });
}
child = spawn(process.execPath, [next, 'build'], { stdio: 'inherit', env: process.env });
const [code] = await once(child, 'exit');
if (code !== 0) process.exit(code ?? 1);
child = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', '3100'], {
  stdio: 'inherit', env: process.env,
});
const [exitCode] = await once(child, 'exit');
process.exit(exitCode ?? 1);
