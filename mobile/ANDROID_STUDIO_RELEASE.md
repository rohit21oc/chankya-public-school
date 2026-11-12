# Build the app bundle (.aab) and APK with Android Studio

**No Expo or EAS account is needed.** `app.json` has no Expo `owner`, `projectId` or update URL, so the build never talks to Expo's servers. Everything below runs on your PC. Consequences:
- Phone push notifications use Firebase directly (no Expo). They switch on once `google-services.json` is in `mobile/` before prebuild AND the server has `FIREBASE_SERVICE_ACCOUNT_JSON` (see section P). Without them the app still works; messages, notices and the bell inside the app just do not buzz the phone.
- OTA updates are off (`updates.enabled: false`): every change goes out as a new `.aab` with a higher `android.versionCode`.
- To go back to EAS cloud builds later, run `npx eas-cli init` in `mobile/` (it adds `owner` and `projectId` again).

The native `android/` folder is generated from `app.json` and the plugins, and is not committed. Generate it again whenever `app.json`, a plugin or a native dependency changes.

## A. One-time setup on your PC
1. Install **Node.js 20 or 22 LTS** and check `node -v` in a terminal.
2. Install **Android Studio** (latest stable). On first start accept the SDK install, then open **More Actions > SDK Manager** and make sure these are installed:
   - SDK Platforms: **Android 16 (API 36)**
   - SDK Tools: Android SDK Build-Tools, Platform-Tools, **NDK (Side by side)**, CMake
3. Java: Android Studio ships JDK 17. You do not need to install Java separately.
4. Set `ANDROID_HOME` (Windows: `%LOCALAPPDATA%\Android\Sdk`, macOS: `~/Library/Android/sdk`, Linux: `~/Android/Sdk`) and add `platform-tools` to PATH.
5. `cd mobile && npm install`

## B. Generate the Android project
```
cd mobile
npm run android:prebuild
```
This creates `mobile/android/`. Add `mobile/android/local.properties` only if Android Studio says "SDK location not found":
```
sdk.dir=C\:\\Users\\YOU\\AppData\\Local\\Android\\Sdk
```
Open Android Studio > **Open** > choose the folder `mobile/android` (not `mobile`). Wait until the Gradle sync at the bottom finishes (first time: 5 to 15 minutes, it downloads Gradle and libraries).

Start Android Studio from a terminal opened inside `mobile` if it cannot find `node` ("A problem occurred evaluating project ':app'" with `node` errors): the build calls Node.

## C. Create the upload key (once; keep it forever)
```
keytool -genkeypair -v -storetype PKCS12 -keystore cps-upload.keystore -alias cps-upload -keyalg RSA -keysize 2048 -validity 10000
```
Use a strong password and answer the name questions. Move `cps-upload.keystore` to a safe folder, for example `mobile/android/keys/`, and **back it up (pen drive and cloud) with the passwords**. Never put it in Git (already ignored).

Create `mobile/android/keystore.properties`:
```
storeFile=../keys/cps-upload.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=cps-upload
keyPassword=YOUR_KEY_PASSWORD
```
`storeFile` is relative to `mobile/android/app`, so `../keys/...` means `mobile/android/keys/...`.

## D. Build the AAB (for Play Console)
**Android Studio:** menu **Build > Generate Signed App Bundle / APK > Android App Bundle > Next**. Choose the keystore file, enter the passwords, alias `cps-upload`, tick Remember, **Next**, choose **release**, **Create**. When the event log says "generated successfully", click **locate**.

**Terminal (same result):**
```
cd mobile/android
./gradlew bundleRelease          # Windows: gradlew.bat bundleRelease
```
Output: `mobile/android/app/build/outputs/bundle/release/app-release.aab`

If `keystore.properties` is missing, a local `bundleRelease` stops with a clear message (this check is skipped on EAS Build, which signs with the key stored in Expo) instead of making a debug-signed file that Play would reject.

## E. Build the APK (to install on a phone or share for testing)
**Android Studio:** **Build > Generate Signed App Bundle / APK > APK**, same keystore, **release**.
**Terminal:**
```
cd mobile/android
./gradlew assembleRelease        # Windows: gradlew.bat assembleRelease
```
Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`. Copy it to the phone (WhatsApp or cable), allow "Install unknown apps" once, and install. Play Console wants the AAB, not the APK.

## F. Every new release
1. In `app.json` increase `android.versionCode` by 1 (must be higher than the last upload) and change `version` if needed.
2. `npm run android:prebuild` again (keeps `android/keystore.properties`; use `android:prebuild:clean` only after native dependency changes, then recreate `keystore.properties` and `keys/`).
3. Build the AAB again and upload.

## G. Upload to Play Console
1. Play Console > **Create app** (name, language, App, Free, accept policies).
2. Finish the **Set up your app** tasks: privacy policy URL `https://<your-domain>/privacy-policy`, App access (give reviewer test logins for staff, parent and student), Ads (none), Content rating questionnaire, Target audience, **Data safety** (below), Government/Financial features (none), Account deletion (link or contact from the Privacy Policy, section "Account and data deletion").
3. **Testing > Internal testing > Create release**, accept **Play App Signing**, upload the `.aab`, add release notes, Save, Review, **Start rollout**. Add testers by email and install from the opt-in link.
4. After testing: **Production > Create release** (or promote from testing). New personal developer accounts must first run a closed test with at least 12 testers for 14 days before production access; organisation accounts do not.

**Data safety answers:** collects name, email, phone, address, photos (student photo), user IDs, payment info (handled by PhonePe on its own payment page, not stored by the app), app activity, device ID (push token). Encrypted in transit: yes. Users can request deletion: yes. Data shared: with service providers only. Data sold: no. Ads: none.
**Permissions to declare:** CAMERA (scan ID cards for attendance) and POST_NOTIFICATIONS (school alerts). Storage, overlay and microphone are blocked in `app.json`.

## H. Problems and fixes
| Message | Fix |
|---|---|
| `SDK location not found` | Create `mobile/android/local.properties` with `sdk.dir=...` (section B). |
| `node: command not found` / error evaluating `:app` | Start Android Studio from a terminal where `node -v` works; restart Studio. |
| `Java heap space` / `OutOfMemoryError` | Already set to 4 GB in `gradle.properties` by the plugin. Close other apps; on a 4 GB PC use `-Xmx3072m`. |
| `NDK not configured` / `ndkVersion ... not found` | SDK Manager > SDK Tools > NDK (Side by side) > install the version shown in the error. |
| `Unsupported class file major version` | Use Studio's JDK 17: Settings > Build Tools > Gradle > Gradle JDK = `jbr-17` / "Embedded JDK". |
| `google-services.json is missing` or wrong package | The file must be at `mobile/google-services.json` with the package set in `app.json` (`in.chanakyapublicschool.app`); run prebuild again. If it is for another package it is skipped and the app builds without push. |
| `bundleRelease needs your upload key` | Create `keystore.properties` (section C). |
| `Keystore file not found` | Fix `storeFile` (relative to `mobile/android/app`). |
| Play: "Version code 1 has already been used" | Increase `android.versionCode` (section F). |
| Play: "You uploaded a debug-signed bundle" | Build was made without `keystore.properties`. Recreate it and rebuild. |
| Build is very slow first time | Normal (Gradle and NDK downloads). Next builds take 1 to 3 minutes. |

## I. Expo Go note
Remote push notifications do not work in Expo Go on Android. For local testing use a development build: `cd mobile && npx expo run:android` (phone with USB debugging, or an emulator).


## P. Turning on push notifications (Firebase, no Expo)

1. Firebase console > your project > add an Android app with package `in.chanakyapublicschool.app`. Download `google-services.json` into `mobile/` (next to `app.json`). It is not secret-sensitive like a key, but do not commit it.
2. Firebase console > Project settings > Service accounts > Generate new private key. This JSON is a SECRET. Never put it in the repo or in chat.
3. On the server (MilesWeb) open `~/school-api/.env` and add `FIREBASE_SERVICE_ACCOUNT_JSON=` followed by the whole JSON on one line (or its base64: `base64 -w0 key.json`). Restart the Node app.
4. Rebuild the app (`npx expo prebuild --platform android`, then `bundleRelease`) and install it. Sign in, allow notifications, then use "Send me a test" in the app.
5. If the test says no device or nothing arrives: check `server.log` for `[push] Firebase` lines.
