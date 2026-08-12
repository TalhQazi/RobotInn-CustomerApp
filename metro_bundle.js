/**
 * Starts Metro server and fetches the bundle via HTTP.
 * Avoids all CLI/config initialization hangs.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

const projectRoot = __dirname;
const bundleOutput = path.join(projectRoot, 'android/app/src/main/assets/index.android.bundle');
const METRO_PORT = 8088; // Use a non-default port to avoid conflicts

function waitForServer(port, retries = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryConnect = () => {
      const req = http.get(`http://localhost:${port}/status`, (res) => {
        resolve();
      });
      req.on('error', () => {
        attempts++;
        if (attempts >= retries) {
          reject(new Error(`Metro server didn't start after ${retries} attempts`));
        } else {
          setTimeout(tryConnect, 2000);
        }
      });
      req.setTimeout(1500, () => {
        req.destroy();
        attempts++;
        if (attempts >= retries) {
          reject(new Error('Metro server timeout'));
        } else {
          setTimeout(tryConnect, 2000);
        }
      });
    };
    tryConnect();
  });
}

function downloadBundle(port, outputPath) {
  return new Promise((resolve, reject) => {
    const bundleUrl = `http://localhost:${port}/index.bundle?platform=android&dev=false&minify=false`;
    console.log(`📥 Fetching bundle from: ${bundleUrl}`);
    
    const file = fs.createWriteStream(outputPath);
    const req = http.get(bundleUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        process.stdout.write(`\r   Downloaded: ${(downloaded / 1024 / 1024).toFixed(2)} MB`);
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('');
        resolve(downloaded);
      });
    });
    req.on('error', reject);
    req.setTimeout(300000); // 5 min timeout
  });
}

async function run() {
  console.log('🚀 Starting Metro dev server on port', METRO_PORT, '...');

  // Start metro using react-native start directly - it handles its own config
  const metroProcess = spawn(
    'node',
    [
      'node_modules/.bin/react-native',
      'start',
      '--port', String(METRO_PORT),
      '--reset-cache',
    ],
    {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
    }
  );

  let metroOutput = '';
  metroProcess.stdout.on('data', (d) => {
    const line = d.toString();
    metroOutput += line;
    if (line.includes('Metro') || line.includes('error') || line.includes('Error') || line.includes('ready') || line.includes('port')) {
      process.stdout.write('[metro] ' + line);
    }
  });
  metroProcess.stderr.on('data', (d) => {
    const line = d.toString();
    if (!line.includes('ExperimentalWarning')) {
      process.stderr.write('[metro-err] ' + line);
    }
  });

  metroProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Metro exited with code ${code}`);
    }
  });

  console.log('⏳ Waiting for Metro to be ready...');
  
  try {
    await waitForServer(METRO_PORT, 45);
    console.log('✅ Metro server is up!');
  } catch (e) {
    console.error('❌ Metro failed to start:', e.message);
    console.error('Metro output:', metroOutput.slice(-2000));
    metroProcess.kill();
    process.exit(1);
  }

  // Give Metro 2 more seconds to fully initialize
  await new Promise(r => setTimeout(r, 2000));

  try {
    fs.mkdirSync(path.dirname(bundleOutput), { recursive: true });
    
    console.log('\n📦 Downloading bundle (this takes 1-3 min)...');
    const size = await downloadBundle(METRO_PORT, bundleOutput);
    
    console.log(`\n✅ Bundle saved! Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Path: ${bundleOutput}`);
  } catch (e) {
    console.error('❌ Bundle download failed:', e.message);
    metroProcess.kill();
    process.exit(1);
  }

  console.log('\n🛑 Stopping Metro server...');
  metroProcess.kill();
  
  console.log('\n🎉 Done! Run: cd android && ./gradlew installDebug');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
