const Metro = require('metro');
const path = require('path');
const fs = require('fs');

async function build() {
  const assetsDir = path.join(__dirname, 'android/app/src/main/assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  const config = await Metro.loadConfig();
  config.resetCache = true;
  await Metro.runBuild(config, {
    entry: 'index.js',
    platform: 'android',
    dev: false,
    out: path.join(assetsDir, 'index.android.bundle'),
    minify: false,
  });
  console.log('BUNDLE CREATED SUCCESSFULLY');
  process.exit(0);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
