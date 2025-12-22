import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CompanyProfile {
    id: string;
    name: string;
    orgNumber: string;
    address: string;
    email: string;
    costCenter?: string;
    reference?: string;
}

const KEY_PROFILES = 'companyProfiles';
const KEY_SELECTED_ID = 'selectedCompanyProfileId';

export default class CompanyProfileService {
    static async list(): Promise<CompanyProfile[]> {
        try {
            const json = await AsyncStorage.getItem(KEY_PROFILES);
            if (!json) return [];
            return JSON.parse(json);
        } catch {
            return [];
        }
    }

    static async saveAll(profiles: CompanyProfile[]): Promise<void> {
        await AsyncStorage.setItem(KEY_PROFILES, JSON.stringify(profiles));
    }

    static async add(profile: CompanyProfile): Promise<void> {
        const all = await this.list();
        all.push(profile);
        await this.saveAll(all);
    }

    static async remove(id: string): Promise<void> {
        const all = await this.list();
        await this.saveAll(all.filter(p => p.id !== id));
    }

    static async getSelectedId(): Promise<string | null> {
        return AsyncStorage.getItem(KEY_SELECTED_ID);
    }

    static async setSelectedId(id: string): Promise<void> {
        await AsyncStorage.setItem(KEY_SELECTED_ID, id);
    }
}
