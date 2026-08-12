const Metro = require('metro');
const path = require('path');
const fs = require('fs');

async function build() {
  const assetsDir = path.join(__dirname, 'android/app/src/main/assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const config = {
    projectRoot: __dirname,
    watchFolders: [__dirname],
    reporter: { update: () => {} },
  };

  console.log('🚀 Starting bundle generation...');
  await Metro.runBuild(config, {
    entry: 'index.js',
    platform: 'android',
    dev: false,
    out: path.join(assetsDir, 'index.android.bundle'),
    minify: false,
  });
  console.log('✅ BUNDLE FINISHED SUCCESSFULLY!');
}

build().catch(err => {
  console.error('❌ Build Error:', err);
  process.exit(1);
});
