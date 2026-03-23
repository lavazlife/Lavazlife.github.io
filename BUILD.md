# Building the Lava Notes Android APK

## Prerequisites

- **Node.js** (v18 or later): https://nodejs.org/
- **Java JDK 17**: Required by Android Gradle. Install via `sudo apt install openjdk-17-jdk` (Linux) or download from https://adoptium.net/
- **Android SDK**: Install via [Android Studio](https://developer.android.com/studio) or the command-line tools. Ensure `ANDROID_HOME` is set (e.g., `export ANDROID_HOME=$HOME/Android/Sdk`).
- **Android SDK Build-Tools** and **Platform 34** (or latest): Install via `sdkmanager "build-tools;34.0.0" "platforms;android-34"`.

## Step-by-Step Build Commands

```bash
# 1. Navigate to the project root
cd /path/to/Lavazlife.github.io

# 2. Install Node.js dependencies (Capacitor CLI + Core + Android)
npm install

# 3. Initialize Capacitor (only needed once, already configured via capacitor.config.json)
#    If capacitor.config.json already exists, skip this step.
#    npx cap init "Lava Notes" com.lavazlife.lavanotes --web-dir www

# 4. Add the Android platform (creates the android/ directory)
npx cap add android

# 5. Sync web assets into the Android project
npx cap sync android

# 6. Build a debug APK
cd android
./gradlew assembleDebug

# The debug APK will be located at:
#   android/app/build/outputs/apk/debug/app-debug.apk
```

## Building a Release APK

For a signed release APK, you need a keystore:

```bash
# Generate a keystore (one-time)
keytool -genkey -v -keystore lava-notes-release.keystore \
  -alias lavanotes -keyalg RSA -keysize 2048 -validity 10000

# Build the release APK
cd android
./gradlew assembleRelease

# The unsigned release APK will be at:
#   android/app/build/outputs/apk/release/app-release-unsigned.apk

# Sign it:
apksigner sign --ks ../lava-notes-release.keystore \
  --ks-key-alias lavanotes \
  app/build/outputs/apk/release/app-release-unsigned.apk
```

## Opening in Android Studio

```bash
npx cap open android
```

This opens the `android/` project in Android Studio where you can run it on an emulator or device.

## Quick Reference (npm scripts)

| Command                   | Description                          |
|---------------------------|--------------------------------------|
| `npm run cap:add:android` | Add Android platform                 |
| `npm run cap:sync`        | Sync web assets to Android           |
| `npm run cap:open`        | Open in Android Studio               |
| `npm run build:apk:debug` | Build debug APK via Gradle           |
| `npm run build:apk:release` | Build release APK via Gradle      |

## Output Locations

- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release-unsigned.apk`
