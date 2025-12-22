import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type UpdateInfo = {
    version: string;
    releaseNotes?: string | null;
};

type Props = {
    visible: boolean;
    info: UpdateInfo;
    currentVersionDescription: string;
    isMandatory?: boolean;
    onDismiss: () => void;
    onUpdate: () => void;
};

export default function UpdateAvailableModal({ visible, info, currentVersionDescription, isMandatory, onDismiss, onUpdate }: Props) {
    const notes = useMemo(() => {
        const raw = (info.releaseNotes || '').replace(/\r\n?/g, '\n');
        return raw
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
    }, [info.releaseNotes]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!isMandatory) onDismiss(); }}>
            <View style={styles.backdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { if (!isMandatory) onDismiss(); }} />
                <View style={styles.card}>
                    <View style={{ alignItems: 'center', marginTop: 8 }}>
                        <Text style={styles.title}>Ny version</Text>
                        <Text style={styles.subtitle}>v{info.version}</Text>
                        {isMandatory ? (
                            <Text style={styles.mandatory}>Uppdatering krävs för att fortsätta använda appen.</Text>
                        ) : null}
                    </View>

                    <View style={{ width: '100%', marginTop: 12 }}>
                        <Text style={styles.sectionTitle}>Nyheter</Text>
                        <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ paddingVertical: 6 }}>
                            {notes.length === 0 ? (
                                <Text style={styles.note}>Vi har förbättrat appen med nya funktioner och bugfixar.</Text>
                            ) : (
                                notes.map((n, i) => (
                                    <View key={`${i}-${n}`} style={styles.noteRow}>
                                        <View style={styles.bullet} />
                                        <Text style={styles.note}>{n}</Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>

                    <View style={{ width: '100%', marginTop: 12 }}>
                        <TouchableOpacity style={styles.updateButton} onPress={onUpdate}>
                            <Text style={styles.updateText}>Uppdatera nu</Text>
                        </TouchableOpacity>
                        {!isMandatory && (
                            <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center' }} onPress={onDismiss}>
                                <Text style={styles.dismissText}>Senare</Text>
                            </TouchableOpacity>
                        )}
                        <Text style={styles.footer}>{currentVersionDescription}</Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    card: {
        width: 320,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 20,
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 12 },
        elevation: 8,
    },
    title: { fontSize: 18, fontWeight: '600', color: '#111827' },
    subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
    mandatory: { marginTop: 6, fontSize: 12, fontWeight: '600', color: '#111827', textAlign: 'center' },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
    noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginVertical: 4 },
    bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', marginTop: 6 },
    note: { fontSize: 12, color: '#6b7280', flexShrink: 1 },
    updateButton: { backgroundColor: '#f59e0b', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
    updateText: { color: '#fff', fontWeight: '700' },
    dismissText: { color: '#6b7280', fontWeight: '600' },
    footer: { fontSize: 10, color: '#6b7280', textAlign: 'center', marginTop: 4 },
});
