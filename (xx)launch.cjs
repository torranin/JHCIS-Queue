const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const root = __dirname;
let port = 3000;
let url = `http://127.0.0.1:${port}`;
const logFile = path.join(root, 'data', 'launcher.log');
let logStart;

async function running() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return false;
    const html = await response.text();
    if (!html.includes('JHCIS Queue')) throw new Error(`Port ${port} is used by another application.`);
    return true;
  } catch (error) {
    if (error.message.includes('another application')) throw error;
    return false;
  }
}

async function choosePort() {
  for (const candidate of [3000, 3001, 3002, 3100, 8080]) {
    port = candidate;
    url = `http://127.0.0.1:${port}`;
    try { if (await running()) return true; }
    catch (error) {
      if (!error.message.includes('another application')) throw error;
      console.log(`Port ${port} is occupied. Trying another port...`);
      continue;
    }
    const available = await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', error => {
        if (['EACCES', 'EADDRINUSE'].includes(error.code)) resolve(false);
        else reject(error);
      });
      probe.listen({host:'127.0.0.1', port, exclusive:true}, () => probe.close(() => resolve(true)));
    });
    if (available) return false;
    console.log(`Port ${port} is blocked or occupied. Trying another port...`);
  }
  throw new Error('Cannot open a local port. Windows blocked or reserved ports 3000, 3001, 3002, 3100 and 8080.');
}

async function main() {
  const alreadyRunning = await choosePort();
  console.log(`JHCIS Queue: ${url}`);
  if (!alreadyRunning) {
    const next = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
    if (!fs.existsSync(next)) throw new Error('Dependencies missing. Run npm install in the project folder first.');
    if (!fs.existsSync(path.join(root, '.next', 'BUILD_ID'))) {
      console.log('Preparing the production build. Please wait...');
      await new Promise((resolve, reject) => {
        const build = spawn(process.execPath, [next, 'build'], { cwd: root, windowsHide: true, stdio: 'inherit' });
        build.on('error', reject);
        build.on('exit', code => code === 0 ? resolve() : reject(new Error('Production build failed.')));
      });
    }
    fs.mkdirSync(path.join(root, 'data'), { recursive: true });
    const log = fs.openSync(logFile, 'a');
    logStart = fs.fstatSync(log).size;
    fs.writeSync(log, `\n--- JHCIS Queue start ${new Date().toISOString()} ---\n`);
    const server = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, NODE_ENV: 'production' },
    });
    let failure;
    server.on('error', error => { failure = error; });
    server.on('exit', (code, signal) => {
      failure = new Error(`Server stopped before it was ready (exit ${code ?? signal}). See data/launcher.log.`);
    });
    server.unref();
    fs.closeSync(log);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (failure) throw failure;
      if (await running()) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('Server did not start. See data/launcher.log.');
  }
  const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', url], { detached: true, windowsHide: true, stdio: 'ignore' });
  browser.on('error', error => { console.error(error.message); process.exitCode = 1; });
  browser.unref();
}
main().catch(error => {
  console.error(error.message);
  if (logStart !== undefined) {
    try {
      const log = fs.readFileSync(logFile).subarray(logStart).toString('utf8').trim();
      if (log) console.error(`\nServer log from this attempt:\n${log.slice(-12000)}`);
    } catch { /* Keep the original error if the log cannot be read. */ }
  }
  process.exitCode = 1;
});
