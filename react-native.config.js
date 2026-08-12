module.exports = {
  platforms: {
    android: {
      npmPackageName: '@react-native-community/cli-platform-android',
      projectConfig: require('@react-native-community/cli-config-android').projectConfig,
      dependencyConfig: require('@react-native-community/cli-config-android').dependencyConfig,
    },
  },
  project: {
    android: {
      sourceDir: './android',
      appName: 'app',
      packageName: 'com.robotinncustomerapp',
    },
  },
  assets: ['./src/assets/fonts/'],
};





