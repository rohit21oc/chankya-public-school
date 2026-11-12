/** npx tsx mobile/test/verify-app-update.ts */
import assert from 'node:assert/strict';
import { decideAppUpdate, installedBuildNumber } from '../src/utils/appUpdate';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('PASS', name); };

t('older build sees the popup; same or newer does not', () => {
  assert.equal(decideAppUpdate(5, { latestVersionCode: 6 }).show, true);
  assert.equal(decideAppUpdate(6, { latestVersionCode: 6 }).show, false);
  assert.equal(decideAppUpdate(7, { latestVersionCode: 6 }).show, false);
});
t('nothing configured or unknown build → no popup', () => {
  assert.equal(decideAppUpdate(5, {}).show, false);
  assert.equal(decideAppUpdate(5, null).show, false);
  assert.equal(decideAppUpdate(0, { latestVersionCode: 9 }).show, false);
  assert.equal(decideAppUpdate(5, { latestVersionCode: 'abc' }).show, false);
});
t('below the required version the popup cannot be skipped', () => {
  assert.equal(decideAppUpdate(4, { latestVersionCode: 6, minVersionCode: 5 }).force, true);
  assert.equal(decideAppUpdate(5, { latestVersionCode: 6, minVersionCode: 5 }).force, false);
  assert.equal(decideAppUpdate(6, { latestVersionCode: 6, minVersionCode: 7 }).force, false, 'no popup → never forced');
});
t('store link is only ever Google Play; label and message passed through', () => {
  const d = decideAppUpdate(5, { latestVersionCode: 6, latestVersionName: '1.0.6', message: ' Fixes ', storeUrl: 'https://evil.example' });
  assert.equal(d.storeUrl, 'https://play.google.com/store/apps/details?id=in.chanakyapublicschool.app');
  assert.equal(d.packageName, 'in.chanakyapublicschool.app');
  assert.equal(d.versionLabel, 'New version 1.0.6');
  assert.equal(d.message, 'Fixes');
});
t('installed build number from the native build, else app config', () => {
  assert.equal(installedBuildNumber({ nativeBuildVersion: '7', expoConfig: { android: { versionCode: 5 } } }), 7);
  assert.equal(installedBuildNumber({ nativeBuildVersion: null, expoConfig: { android: { versionCode: 5 } } }), 5);
  assert.equal(installedBuildNumber({}), 0);
});
console.log(`\nAPP UPDATE: ${n} passed`);
