/**
 * Lets a release build sign itself from android/keystore.properties (never committed), so that
 * `./gradlew bundleRelease` produces a Play-ready, upload-key-signed .aab. Without that file the
 * release build falls back to the debug key, so a build never fails just because the key is missing
 * (such a file is NOT accepted by Play Console).
 * On EAS Build the check is skipped: EAS signs with the upload key stored in your Expo credentials.
 *
 * keystore.properties (inside mobile/android/):
 *   storeFile=../keys/upload-keystore.jks     # path relative to mobile/android/app
 *   storePassword=...
 *   keyAlias=upload
 *   keyPassword=...
 * The same four values may instead come from the environment: CPS_KEYSTORE_FILE, CPS_KEYSTORE_PASSWORD,
 * CPS_KEY_ALIAS, CPS_KEY_PASSWORD.
 */
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const MARK = '// cps-release-signing';

const LOADER = `${MARK}
def cpsKeystoreProps = new Properties()
def cpsKeystoreFile = rootProject.file('keystore.properties')
if (cpsKeystoreFile.exists()) {
    cpsKeystoreFile.withInputStream { cpsKeystoreProps.load(it) }
}
def cpsSigning = { String prop, String env -> cpsKeystoreProps.getProperty(prop) ?: System.getenv(env) }
`;

const RELEASE_CONFIG = `        ${MARK}
        release {
            def storePath = cpsSigning('storeFile', 'CPS_KEYSTORE_FILE')
            if (storePath) {
                storeFile file(storePath)
                storePassword cpsSigning('storePassword', 'CPS_KEYSTORE_PASSWORD')
                keyAlias cpsSigning('keyAlias', 'CPS_KEY_ALIAS')
                keyPassword cpsSigning('keyPassword', 'CPS_KEY_PASSWORD')
            }
        }
`;

// Stops a Play bundle from being built with the wrong key, and says what to do instead of failing deep inside Gradle.
const BUNDLE_GUARD = `
${MARK}-guard
gradle.taskGraph.whenReady { graph ->
    // On EAS Build (EAS_BUILD=true) the upload key comes from EAS's own credentials, which EAS wires into this
    // file after prebuild, so the local keystore.properties check must not run there.
    if (graph.hasTask(':app:bundleRelease') && System.getenv('EAS_BUILD') != 'true') {
        def cpsStore = cpsSigning('storeFile', 'CPS_KEYSTORE_FILE')
        if (!cpsStore) {
            throw new GradleException('bundleRelease needs your upload key. Create mobile/android/keystore.properties (see mobile/ANDROID_STUDIO_RELEASE.md). Without it the bundle would be signed with the debug key, which Play Console rejects.')
        }
        if (!file(cpsStore).exists()) {
            throw new GradleException("Keystore file not found: " + file(cpsStore).absolutePath + ". storeFile in keystore.properties is relative to mobile/android/app.")
        }
    }
}
`;

module.exports = function withReleaseSigning(config) {
  // Release builds (R8, Hermes, resources) run out of memory with the 2 GB default Gradle heap.
  config = withGradleProperties(config, (cfg) => {
    const items = cfg.modResults.filter((i) => !(i.type === 'property' && i.key === 'org.gradle.jvmargs'));
    items.push({ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8' });
    cfg.modResults = items;
    return cfg;
  });
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;
    // 1. read the properties before the android { } block
    src = src.replace(/\nandroid \{/, `\n${LOADER}\nandroid {`);
    // 2. add a "release" signing config next to "debug"
    src = src.replace(/(signingConfigs \{\n)/, `$1${RELEASE_CONFIG}`);
    // 3. use it for the release build type when a key is configured
    src = src.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig cpsSigning('storeFile', 'CPS_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug`
    );
    cfg.modResults.contents = `${src.trimEnd()}\n${BUNDLE_GUARD}`;
    return cfg;
  });
};
