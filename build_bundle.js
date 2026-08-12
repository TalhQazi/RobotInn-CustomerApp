/**
 * Builds the release Android JS bundle straight through Metro.
 *
 * We don't go through `react-native bundle` because @react-native-community/cli
 * 20.1.0 can't register react-native 0.84's commands (it throws
 * "Cannot read properties of undefined (reading 'match')").
 *
 * Note this loads the project's own metro.config.js via metro-config's
 * loadConfig. Calling metro-config's getDefaultConfig directly does NOT work:
 * it returns a bare config whose projectRoot/watchFolders don't cover index.js,
 * and the build dies with "Failed to get the SHA-1 for: index.js".
 */
const path = require('path');
const fs = require('fs');

const Metro = require('metro');
const { loadConfig } = require('metro-config');

async function build() {
  const assetsDir = path.join(__dirname, 'android/app/src/main/assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const config = await loadConfig({ cwd: __dirname });
  const out = path.join(assetsDir, 'index.android.bundle');

  console.log('Bundling from', config.projectRoot);
  await Metro.runBuild(config, {
    entry: path.join(__dirname, 'index.js'),
    platform: 'android',
    dev: false,
    minify: false,
    out,
  });

  // Metro emits to `${out}.js` rather than `out`. If we don't move it into place,
  // the APK silently packages whatever stale index.android.bundle was already there.
  if (fs.existsSync(out + '.js')) {
    fs.copyFileSync(out + '.js', out);
  }

  const stat = fs.statSync(out);
  const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
  if (ageSeconds > 120) {
    throw new Error(
      `Bundle at ${out} is stale (mtime ${stat.mtime.toISOString()}). Metro did not write it.`,
    );
  }

  console.log('BUNDLE CREATED SUCCESSFULLY:', stat.size, 'bytes, mtime', stat.mtime.toISOString());
  process.exit(0);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
