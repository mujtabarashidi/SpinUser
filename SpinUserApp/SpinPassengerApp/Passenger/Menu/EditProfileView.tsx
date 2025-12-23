import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuthViewModel } from '../../Authentication/AuthManager';
import FirebaseManager from '../../firebase/FirebaseManager';
import DeleteReasonView from './DeleteReasonView';

interface EditProfileViewProps {
    onClose?: () => void;
}

const FIELD_GAP = 16;

const EditProfileView: React.FC<EditProfileViewProps> = ({ onClose }) => {
    const auth = useAuthViewModel();
    const user = auth.currentUser;

    const [fullname, setFullname] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [saving, setSaving] = useState(false);
    const [showDeleteReason, setShowDeleteReason] = useState(false);

    useEffect(() => {
        setFullname(user?.fullname ?? '');
        setEmail(user?.email ?? '');
        setPhoneNumber(user?.phoneNumber ?? '');
    }, [user?.uid, user?.fullname, user?.email, user?.phoneNumber]);

    const hasChanges = useMemo(() => {
        if (!user) {
            return false;
        }
        const trimmedName = fullname.trim();
        const trimmedPhone = phoneNumber.trim();
        const initialPhone = user.phoneNumber ?? '';
        return trimmedName !== (user.fullname ?? '') || trimmedPhone !== initialPhone;
    }, [fullname, phoneNumber, user]);

    const handleSave = async () => {
        if (!user || !hasChanges) {
            onClose?.();
            return;
        }

        try {
            setSaving(true);
            const firebaseManager = FirebaseManager.getInstance();
            const db = firebaseManager.getFirestore();
            const collectionName = user.accountType === 'driver' ? 'drivers' : 'users';
            await db.collection(collectionName).doc(user.uid).update({
                fullname: fullname.trim(),
                phoneNumber: phoneNumber.trim(),
            });
            await auth.fetchCurrentUser();
            Alert.alert('Klart', 'Din profil uppdaterades.');
            onClose?.();
        } catch (error: any) {
            Alert.alert('Fel', error?.message ?? 'Kunde inte spara ändringar. Försök igen.');
        } finally {
            setSaving(false);
        }
    };

    const confirmSignOut = () => {
        Alert.alert('Logga ut', 'Är du säker på att du vill logga ut?', [
            { text: 'Avbryt', style: 'cancel' },
            {
                text: 'Logga ut',
                style: 'destructive',
                onPress: () => {
                    (async () => {
                        const result = await auth.signOut();
                        if (!result.ok) {
                            Alert.alert('Fel', result.error ?? 'Kunde inte logga ut.');
                        }
                        onClose?.();
                    })();
                },
            },
        ]);
    };

    const handleDeleteAccount = () => {
        setShowDeleteReason(true);
    };

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.title}>Redigera profil</Text>
                <TouchableOpacity onPress={onClose}>
                    <Text style={styles.cancelText}>Stäng</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personlig information</Text>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Fullständigt namn</Text>
                        <TextInput
                            value={fullname}
                            onChangeText={setFullname}
                            style={styles.input}
                            autoCapitalize="words"
                            placeholder="Ditt namn"
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>E-postadress</Text>
                        <TextInput
                            value={email}
                            editable={false}
                            style={[styles.input, styles.disabledInput]}
                            placeholder="E-post"
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Telefonnummer</Text>
                        <TextInput
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            style={styles.input}
                            keyboardType="phone-pad"
                            placeholder="+46..."
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.primaryButton, !hasChanges || saving ? styles.buttonDisabled : undefined]}
                    onPress={handleSave}
                    disabled={!hasChanges || saving}
                >
                    <Text style={styles.primaryButtonText}>{saving ? 'Sparar...' : 'Spara ändringar'}</Text>
                </TouchableOpacity>

                <View style={styles.dangerSection}>
                    <TouchableOpacity style={styles.dangerButton} onPress={confirmSignOut}>
                        <Text style={styles.dangerText}>Logga ut</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
                        <Text style={styles.dangerText}>Ta bort konto</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <Modal
                visible={showDeleteReason}
                animationType="slide"
                onRequestClose={() => setShowDeleteReason(false)}
            >
                <View style={styles.modalContainer}>
                    <TouchableOpacity onPress={() => setShowDeleteReason(false)} style={styles.modalClose}>
                        <Text style={styles.cancelText}>Stäng</Text>
                    </TouchableOpacity>
                    <DeleteReasonView />
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#f7f8fa',
    },
    header: {
        paddingTop: 18,
        paddingHorizontal: 20,
        paddingBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#d1d5db',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
    },
    cancelText: {
        fontSize: 16,
        color: '#007AFF',
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingVertical: 24,
        gap: 24,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: FIELD_GAP,
        color: '#111827',
    },
    fieldGroup: {
        marginBottom: FIELD_GAP,
    },
    label: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    disabledInput: {
        color: '#9ca3af',
        backgroundColor: '#f3f4f6',
    },
    primaryButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    buttonDisabled: {
        backgroundColor: '#9ca3af',
    },
    dangerSection: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    dangerButton: {
        paddingVertical: 12,
    },
    dangerText: {
        fontSize: 16,
        color: '#dc2626',
        textAlign: 'center',
        fontWeight: '600',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    modalClose: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        alignItems: 'flex-end',
    },
});

export default EditProfileView;