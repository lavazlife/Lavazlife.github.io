# LavazLife — Android APK Build Guide

Complete step-by-step instructions to build the unified **Lava Notes Workspace + 3D Typography Studio** app as an Android `.apk` using **Ionic Capacitor**.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 LTS | https://nodejs.org |
| npm | ≥ 9 | bundled with Node |
| Java JDK | 17 (LTS) | https://adoptium.net |
| Android Studio | Hedgehog+ | https://developer.android.com/studio |
| Android SDK | API 34 (Android 14) | via Android Studio SDK Manager |
| Gradle | bundled by Android Studio | — |

Set environment variables:

```bash
# macOS / Linux — add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME="$HOME/Library/Android/sdk"          # macOS default
# export ANDROID_HOME="$HOME/Android/Sdk"                # Linux default
export PATH="$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools"
export JAVA_HOME=$(/usr/libexec/java_home -v 17)         # macOS
# export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"  # Linux
```

---

## 1 — Project Initialisation

```bash
# Clone / enter the repo
cd /path/to/Lavazlife.github.io

# Install all JavaScript dependencies
npm install

# Build the Tailwind CSS bundle (generates src/styles/app.css)
npm run build:css
```

---

## 2 — Add Capacitor Android Platform

```bash
# Initialise Capacitor (already configured via capacitor.config.json)
npx cap init LavazLife com.lavazlife.app --web-dir .

# Add the Android platform
npx cap add android

# Sync web assets into the Android project
npx cap sync android
```

---

## 3 — Android Project Configuration

### 3a — Set minimum SDK (optional, default is fine)

Edit `android/variables.gradle`:

```gradle
ext {
    minSdkVersion = 23        // Android 6.0+
    compileSdkVersion = 34
    targetSdkVersion = 34
    androidxActivityVersion = '1.8.0'
    androidxAppCompatVersion = '1.6.1'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.12.0'
    androidxFragmentVersion = '1.6.2'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.1.5'
    androidxEspressoCoreVersion = '3.5.1'
    cordovaAndroidVersion = '10.0.0'
}
```

### 3b — Internet permission (already added by Capacitor)

Verify `android/app/src/main/AndroidManifest.xml` contains:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

---

## 4 — Build a Debug APK

```bash
# Option A: use npm script
npm run apk:debug

# Option B: direct Gradle commands
cd android
./gradlew assembleDebug
```

Output APK location:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Install directly to a connected device:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 5 — Build a Release APK (Unsigned)

```bash
cd android
./gradlew assembleRelease
```

Output:
```
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

---

## 6 — Sign the Release APK

### 6a — Generate a keystore (one-time)

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias lavazlife \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

> **Keep `release.keystore` and its passwords safe — you need the same keystore for every future update.**

### 6b — Configure signing in Gradle

Edit `android/app/build.gradle` and add to the `android { ... }` block:

```gradle
signingConfigs {
    release {
        storeFile     file("../../release.keystore")
        storePassword System.getenv("KEYSTORE_PASSWORD") ?: "YOUR_STORE_PASS"
        keyAlias      "lavazlife"
        keyPassword   System.getenv("KEY_PASSWORD")      ?: "YOUR_KEY_PASS"
    }
}
buildTypes {
    release {
        signingConfig    signingConfigs.release
        minifyEnabled    false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

### 6c — Build and sign in one step

```bash
# From repo root
export KEYSTORE_PASSWORD="your_store_password"
export KEY_PASSWORD="your_key_password"

cd android
./gradlew assembleRelease
```

Signed APK output:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 7 — Align and Verify (optional, for Play Store)

```bash
# zipalign (bundled with Android SDK build-tools)
$ANDROID_HOME/build-tools/34.0.0/zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release.apk \
  lavazlife-aligned.apk

# Verify signature
$ANDROID_HOME/build-tools/34.0.0/apksigner verify lavazlife-aligned.apk
```

---

## 8 — Full Build Sequence (copy-paste)

```bash
# From repo root — complete pipeline
npm install
npm run build:css
npx cap sync android
cd android
./gradlew assembleRelease
```

---

## 9 — Live Reload During Development

```bash
# Terminal 1 — watch Tailwind
npm run dev

# Terminal 2 — Capacitor live reload (requires device on same Wi-Fi)
npx cap run android --livereload --external
```

---

## 10 — Opening in Android Studio (GUI)

```bash
npx cap open android
```

From Android Studio you can:
- Run on emulator or physical device
- Use the APK Analyzer
- Generate a signed bundle / APK via **Build → Generate Signed Bundle / APK**

---

## API Keys Setup

The app prompts for API keys on first launch. You can also hard-code them for testing by editing `src/app.js` (search for `store.geminiKey`). **Never commit real API keys to the repository.**

| API | Endpoint | Required for |
|-----|----------|-------------|
| Google Gemini 2.5 Flash | `generativelanguage.googleapis.com` | Style Forge vision, Prompt Crafter, 3D brainstorm |
| Google Imagen 4.0 | `generativelanguage.googleapis.com` | 3D Typography batch render |
| Firebase / Firestore | `firestore.googleapis.com` | Cloud note sync (optional) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ANDROID_HOME not set` | Export `ANDROID_HOME` as shown in Prerequisites |
| `Gradle wrapper not found` | Run `npx cap add android` first |
| `SDK 34 not installed` | Open Android Studio → SDK Manager → install API 34 |
| `JDK version mismatch` | Set `JAVA_HOME` to JDK 17 |
| API returns 403 / 429 | Check Gemini API key and quota in Google AI Studio |
| Images don't save on device | Grant Storage permission in device Settings → Apps → LavazLife |
