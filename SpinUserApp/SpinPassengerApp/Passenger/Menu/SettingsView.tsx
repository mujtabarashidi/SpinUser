import React, { useState } from 'react';
import { Alert, Linking, Modal, NativeModules, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import EditProfileView from './EditProfileView';
import WalletView from './WalletView';

const fallbackUser = {
    fullname: 'Spin Taxi',
    email: 'spin@spintaxi.se',
    phoneNumber: '+46701234567',
};

const appVersion = '1.0.9';

function initials(name?: string | null) {
    if (!name || typeof name !== 'string') {
        return 'S';
    }
    const normalized = name.trim();
    if (normalized.length === 0) {
        return 'S';
    }

    const parts = normalized.split(/\s+/);
    const first = parts[0]?.[0]?.toUpperCase() || 'S';
    const last = parts[1]?.[0]?.toUpperCase() || '';
    return first + last;
}

function SettingsRow({ icon, color, title, onPress }: { icon: string; color: string; title: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress}>
            <View style={[styles.iconCircle, { backgroundColor: color + '22' }]}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
            </View>
            <Text style={styles.rowText}>{title}</Text>
            <Icon name="chevron-forward" size={16} color="#9ca3af" />
        </TouchableOpacity>
    );
}

export default function SettingsView({ user }: { user?: any }) {
    const userData = user || fallbackUser;
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showWallet, setShowWallet] = useState(false);

    const openNotificationSettings = async () => {
        try {
            // Android only
            if (Platform.OS === 'android') {
                const platformConstants = NativeModules.PlatformConstants?.getConstants?.();
                const packageName =
                    platformConstants?.androidPackageName ||
                    platformConstants?.packageName ||
                    'com.spintaxidriverapp'; // Fallback to current applicationId

                const sendIntent = (Linking as any).sendIntent;
                if (typeof sendIntent === 'function') {
                    const extras = [
                        { key: 'android.provider.extra.APP_PACKAGE', value: packageName },
                        { key: 'android.intent.extra.PACKAGE_NAME', value: packageName },
                        { key: 'app_package', value: packageName },
                    ];

                    try {
                        await sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', extras);
                        return;
                    } catch (androidIntentError) {
                        console.warn('Notification intent failed, falling back to openSettings()', androidIntentError);
                    }
                }

                await Linking.openSettings();
                return;
            }

            await Linking.openSettings();
        } catch (error) {
            console.warn('Failed to open notification settings', error);
            Alert.alert('Kunde inte öppna', 'Öppna notisinställningar manuellt i systeminställningarna.');
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profilkort */}
                <TouchableOpacity style={styles.profileCard} onPress={() => setShowEditProfile(true)}>
                    <View style={styles.profileCircle}>
                        <Text style={styles.initials}>{initials(userData.fullname)}</Text>
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{userData.fullname}</Text>
                        <Text style={styles.profileEmail}>{userData.email}</Text>
                        {userData.phoneNumber ? (
                            <Text style={styles.profilePhone}>{userData.phoneNumber}</Text>
                        ) : null}
                    </View>
                    <Icon name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>

                {/* Inställningar */}
                <Text style={styles.sectionHeader}>Inställningar</Text>
                <SettingsRow icon="🔔" color="#a259ff" title="Notiser" onPress={openNotificationSettings} />
                <SettingsRow icon="💳" color="#007AFF" title="Betalningsmetoder" onPress={() => setShowWallet(true)} />

                {/* Driva & dela */}
                <Text style={styles.sectionHeader}>Driva & dela</Text>
                <SettingsRow icon="💸" color="#34c759" title="Tjäna pengar på att köra" onPress={() => Linking.openURL('https://www.spintaxi.se/')} />
                <SettingsRow icon="🎁" color="#ffa500" title="Bjud in en vän" onPress={() => Linking.openURL('https://apps.apple.com/se/app/spin-taxi/id6743411086')} />

                {/* Support & juridik */}
                <Text style={styles.sectionHeader}>Support & juridik</Text>
                <SettingsRow icon="🌐" color="#007AFF" title="Besök spintaxi.se" onPress={() => Linking.openURL('https://www.spintaxi.se/')} />
                <SettingsRow icon="✋" color="#ff2d55" title="Integritetspolicy" onPress={() => Linking.openURL('https://www.spintaxi.se/integritetspolicy/')} />
                <SettingsRow icon="📄" color="#8e8e93" title="Användarvillkor" onPress={() => Linking.openURL('https://www.spintaxi.se/integritetspolicy/')} />

                {/* Om appen */}
               
            </ScrollView>

            <Modal
                visible={showEditProfile}
                animationType="slide"
                onRequestClose={() => setShowEditProfile(false)}
            >
                <View style={{ flex: 1 }}>
                    <EditProfileView onClose={() => setShowEditProfile(false)} />
                </View>
            </Modal>
            <Modal
                visible={showWallet}
                animationType="slide"
                onRequestClose={() => setShowWallet(false)}
            >
                <View style={{ flex: 1 }}>
                    <WalletView onClose={() => setShowWallet(false)} />
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    scrollContent: { padding: 16, paddingBottom: 40 },

    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f6f6f7',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    profileCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#dde1ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileInfo: { marginLeft: 16, flex: 1 },
    initials: { fontWeight: '700', fontSize: 20, color: '#1c1c1e' },
    profileName: { fontSize: 18, fontWeight: '600', color: '#1c1c1e' },
    profileEmail: { fontSize: 14, color: '#6b7280', marginTop: 2 },
    profilePhone: { fontSize: 14, color: '#6b7280', marginTop: 2 },

    sectionHeader: { fontSize: 13, color: '#6b7280', marginTop: 16, marginBottom: 8, fontWeight: '600' },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e5e7eb',
    },
    iconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    rowText: { flex: 1, fontSize: 16, color: '#111827' },
});
