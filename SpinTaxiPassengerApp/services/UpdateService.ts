import DeviceInfo from 'react-native-device-info';
import FirebaseManager from '../firebase/FirebaseManager';

export type UpdateCheckResult = {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion?: string;
    mandatory?: boolean;
    releaseNotes?: string;
    storeUrl?: string;
};

function parseVersion(v?: string | null): string | undefined {
    if (!v) return undefined;
    const m = String(v).match(/\d+(?:\.\d+){0,3}/);
    return m?.[0];
}

function cmp(a: string, b: string): number {
    const pa = a.split('.').map((n) => parseInt(n, 10));
    const pb = b.split('.').map((n) => parseInt(n, 10));
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const va = pa[i] ?? 0;
        const vb = pb[i] ?? 0;
        if (va > vb) return 1;
        if (va < vb) return -1;
    }
    return 0;
}

async function readPossibleConfigs(firestore: any): Promise<Record<string, any> | null> {
    const candidates = [
        ['appConfig', 'driver'],
        ['config', 'app'],
        ['config', 'driverApp'],
        ['meta', 'app'],
    ] as const;
    for (const [col, doc] of candidates) {
        try {
            const snap = await firestore.collection(col).doc(doc).get();
            if (snap.exists) return snap.data() || null;
        } catch { }
    }
    return null;
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
    const current = DeviceInfo.getVersion();
    try {
        const fm = FirebaseManager.getInstance();
        if (!fm.isInitialized()) {
            await fm.initialize();
        }
        const fs = fm.getFirestore();
        const cfg = await readPossibleConfigs(fs);
        if (!cfg) return { hasUpdate: false, currentVersion: current };

        // Android only - iOS platform removed
        const keys = ['latestVersionAndroid', 'latestAndroid', 'androidLatest', 'latestVersion'];
        const minKeys = ['minVersionAndroid', 'androidMin', 'minSupportedAndroid', 'minSupportedVersion'];

        let latest: string | undefined;
        for (const k of keys) {
            latest = parseVersion(cfg[k]);
            if (latest) break;
        }

        let mandatory = false;
        for (const k of minKeys) {
            const min = parseVersion(cfg[k]);
            if (min && cmp(current, min) < 0) { mandatory = true; break; }
        }

        // Android only store URL
        const storeUrl = cfg.androidStoreUrl || undefined;
        const releaseNotes = cfg.releaseNotesAndroid || cfg.releaseNotes || undefined;

        if (latest && cmp(latest, current) > 0) {
            return { hasUpdate: true, currentVersion: current, latestVersion: latest, mandatory, releaseNotes, storeUrl };
        }
        return { hasUpdate: false, currentVersion: current };
    } catch (e) {
        // Fail-safe: never block UI; simply say no update if check fails
        return { hasUpdate: false, currentVersion: current };
    }
}

export default { checkForUpdate };
