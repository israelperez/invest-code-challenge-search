// Runs the API and the web dev server together; Ctrl-C or SIGTERM stops both process trees.
import { spawn, spawnSync } from 'node:child_process';

const win = process.platform === 'win32';
const npm = win ? 'npm.cmd' : 'npm';
// POSIX: each child leads its own process group (pgid = its pid), so one signal reaches
// npm, the shell and nodemon/Vite, even after the npm leader itself has gone.
const run = (args) => spawn(npm, args, { stdio: 'inherit', detached: !win, shell: win });
const children = [run(['--prefix', 'api', 'start']), run(['--prefix', 'web', 'run', 'dev'])];
const groups = children.map((child) => child.pid);

const KILL_AFTER_MS = 5000;
let exitCode = null;
let alive = children.length;

function signalTrees(signal) {
  children.forEach((child, i) => {
    if (groups[i] === undefined) return; // never started
    try {
      if (!win) process.kill(-groups[i], signal);
      else if (child.exitCode === null) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    } catch (error) {
      // ESRCH: group already gone. EPERM: macOS reports a group of only zombies this way.
      if (error.code !== 'ESRCH' && error.code !== 'EPERM') throw error;
    }
  });
}

function finish() {
  signalTrees('SIGKILL');
  process.exit(exitCode);
}

function stop(signal, code) {
  if (exitCode !== null) return;
  exitCode = code;
  signalTrees(signal);
  setTimeout(finish, KILL_AFTER_MS).unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal, 0));
for (const child of children) {
  child.on('error', (error) => {
    console.error(`dev: failed to run a child process: ${error.message}`);
    stop('SIGTERM', 1);
    // A child that never started emits no 'exit', so count it as gone here.
    if (child.pid === undefined && --alive === 0) finish();
  });
  child.on('exit', (code) => {
    // One side exiting takes the other down too; once both leaders are gone, kill any stragglers.
    stop('SIGTERM', code ?? 1);
    if (--alive === 0) finish();
  });
}
