/**
 * Emits React Native autolinking config for Gradle (see settings.gradle:
 * `autolinkLibrariesFromCommand(["node", "${rootDir}/autolink_config.js"])`).
 *
 * We can't shell out to `npx react-native config` here: @react-native-community/cli
 * 20.1.0 fails to register react-native 0.84's commands and dies with
 * "Cannot read properties of undefined (reading 'match')". Only the CLI's command
 * layer is broken though — cli-config's loader still works, so we call it directly.
 *
 * Resolving every dependency takes minutes, so the result is cached in
 * autolink_config.json. Delete that file after adding or removing a native
 * dependency to force a refresh.
 */
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const cachePath = path.join(__dirname, 'autolink_config.json');

if (fs.existsSync(cachePath)) {
  process.stdout.write(fs.readFileSync(cachePath, 'utf8'));
  return;
}

process.chdir(root);
const loadConfig = require(path.join(
  root,
  'node_modules/@react-native-community/cli-config',
)).default;

const config = loadConfig({selectedPlatform: 'android'});
const json = JSON.stringify(config, null, 2);

fs.writeFileSync(cachePath, json);
process.stdout.write(json);
