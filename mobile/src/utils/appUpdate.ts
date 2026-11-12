/** Pure rules for the "New update available" popup (tested in mobile/test/verify-app-update.ts). */

export interface AppUpdateDecision {
  show: boolean;
  force: boolean;
  message: string;
  versionLabel: string;
  storeUrl: string;
  packageName: string;
}

const PACKAGE = 'in.chanakyapublicschool.app';
const toInt = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** This phone's Android build number (versionCode). 0 when unknown (then no popup is shown). */
export function installedBuildNumber(constants: { nativeBuildVersion?: string | null; expoConfig?: { android?: { versionCode?: number } } | null }): number {
  return toInt(constants?.nativeBuildVersion) || toInt(constants?.expoConfig?.android?.versionCode);
}

/** Decide from the installed build number and the server's /api/app/version `android` block. */
export function decideAppUpdate(installed: number, server: any): AppUpdateDecision {
  const latest = toInt(server?.latestVersionCode);
  const min = toInt(server?.minVersionCode);
  const storeUrl = /^https:\/\/play\.google\.com\//.test(String(server?.storeUrl || ''))
    ? String(server.storeUrl)
    : `https://play.google.com/store/apps/details?id=${PACKAGE}`;
  const packageName = /^[a-z][a-z0-9_.]+$/i.test(String(server?.packageName || '')) ? String(server.packageName) : PACKAGE;
  const name = String(server?.latestVersionName || '').trim();
  const show = installed > 0 && latest > installed;
  return {
    show,
    force: show && min > installed,
    message: String(server?.message || '').trim(),
    versionLabel: name ? `New version ${name}` : '',
    storeUrl,
    packageName,
  };
}
