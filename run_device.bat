@echo off
set ANDROID_HOME=C:\Users\Talha\AppData\Local\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools
cd /d C:\Robotinn\RobotInn-CustomerApp
node --max-old-space-size=4096 node_modules/react-native/cli.js run-android --mode=release --device OJKZDIEELJDYMV55
