import { Linking } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export type AppStoreInfo = {
    version: string;
    releaseNotes?: string | null;
    trackViewUrl?: string | null;
};

type LookupResponse = {
    resultCount: number;
    results: AppStoreInfo[];
};

export const currentVersionDescription = async (): Promise<string> => {
    try {
        const version = DeviceInfo.getVersion();
        const build = DeviceInfo.getBuildNumber();
        return `Version ${version} (${build})`;
    } catch {
        return 'Version ? (?)';
    }
};

export const fallbackAppStoreURL = (): string | null => {
    // Optional: provide a fallback URL via env or hardcoded
    return null;
};

export async function fetchAppStoreInfo(bundleId?: string, country?: string): Promise<AppStoreInfo | null> {
    try {
        const effectiveBundleId = bundleId || DeviceInfo.getBundleId();
        const region = (country || 'se').toLowerCase();
        const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(effectiveBundleId)}&country=${encodeURIComponent(region)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = (await res.json()) as LookupResponse;
        return data.results && data.results.length > 0 ? data.results[0] : null;
    } catch {
        return null;
    }
}

export async function hasNewerVersionThanCurrent(bundleId?: string): Promise<{ isNewer: boolean; info: AppStoreInfo | null }> {
    try {
        const info = await fetchAppStoreInfo(bundleId);
        if (!info) return { isNewer: false, info: null };
        const current = DeviceInfo.getVersion();
        const newer = compareVersions(info.version, current) > 0;
        return { isNewer: newer, info };
    } catch {
        return { isNewer: false, info: null };
    }
}

export function deepLinkToAppStore(url: string): string {
    try {
        // Android only - uses market scheme or https
        return url;
    } catch {
        return url;
    }
}

export function storeURL(info?: AppStoreInfo | null, fallback?: string | null): string | null {
    if (info?.trackViewUrl) return deepLinkToAppStore(info.trackViewUrl);
    if (fallback) return deepLinkToAppStore(fallback);
    const fb = fallbackAppStoreURL();
    return fb ? deepLinkToAppStore(fb) : null;
}

export async function openStorePage(info?: AppStoreInfo | null): Promise<boolean> {
    const url = storeURL(info);
    if (!url) return false;
    try {
        await Linking.openURL(url);
        return true;
    } catch {
        return false;
    }
}

// ---------- Helpers ----------
function compareVersions(a: string, b: string): number {
    const as = a.split('.').map((x) => parseInt(x, 10));
    const bs = b.split('.').map((x) => parseInt(x, 10));
    const len = Math.max(as.length, bs.length);
    for (let i = 0; i < len; i++) {
        const ai = as[i] || 0;
        const bi = bs[i] || 0;
        if (ai > bi) return 1;
        if (ai < bi) return -1;
    }
    return 0;
}
