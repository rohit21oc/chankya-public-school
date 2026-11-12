const fs = require('fs');
const path = require('path');

/**
 * Wraps app.json. Android push notifications need the Firebase file google-services.json in the build.
 * It is picked up from, in order: the GOOGLE_SERVICES_JSON file variable (EAS), or ./google-services.json
 * next to this file. Without either, the app still builds and runs; only phone push is unavailable.
 */
module.exports = ({ config }) => {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  const local = path.join(__dirname, 'google-services.json');
  const candidate = fromEnv && fs.existsSync(fromEnv) ? fromEnv : fs.existsSync(local) ? './google-services.json' : undefined;
  if (!candidate) return config;

  // The Firebase file is tied to one Android package. If it belongs to a different package (for example
  // after the app id changed), the Google Services Gradle plugin fails the whole build, so skip it:
  // the app still builds and runs, only phone push is off until a matching google-services.json is added.
  const pkg = config.android && config.android.package;
  try {
    const abs = path.isAbsolute(candidate) ? candidate : path.join(__dirname, candidate);
    const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const packages = (json.client || []).map((c) => c && c.client_info && c.client_info.android_client_info && c.client_info.android_client_info.package_name);
    if (pkg && !packages.includes(pkg)) {
      console.warn(`[google-services] ${candidate} is for ${packages.filter(Boolean).join(', ') || 'another package'}, not ${pkg}. Skipping it: push notifications stay off until you add the google-services.json of ${pkg}.`);
      return config;
    }
  } catch (e) {
    console.warn('[google-services] Could not read the Firebase file, skipping it:', e.message);
    return config;
  }
  return { ...config, android: { ...config.android, googleServicesFile: candidate } };
};
