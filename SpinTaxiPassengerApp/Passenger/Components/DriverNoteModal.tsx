import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

interface DriverNoteModalProps {
    visible: boolean;
    initialNote?: string;
    onSave(note: string): void;
    onCancel(): void;
}

const QUICK_NOTES = [
    'Varm temperatur',
    'svalt i bilen',
    'Tyst omgivning',
    'Prata gärna',
    'Snabb resa',
];

export const DriverNoteModal: React.FC<DriverNoteModalProps> = ({ visible, initialNote = '', onSave, onCancel }) => {
    const [note, setNote] = useState(initialNote);

    useEffect(() => {
        if (visible) setNote(initialNote);
    }, [visible, initialNote]);

    const appendQuick = useCallback((text: string) => {
        setNote(prev => (prev.length === 0 ? text : prev + ', ' + text));
    }, []);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onCancel}
            transparent
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.grabber} />
                    <Text style={styles.title}>Kommentar till förare</Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow} contentContainerStyle={styles.quickContainer}>
                        {QUICK_NOTES.map(q => (
                            <Pressable key={q} style={styles.quickBtn} onPress={() => appendQuick(q)}>
                                <Text style={styles.quickText}>{q}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <TextInput
                        multiline
                        value={note}
                        onChangeText={setNote}
                        placeholder="Lägg till kommentar..."
                        style={styles.input}
                        placeholderTextColor="#888"
                    />

                    <Pressable style={styles.saveBtn} onPress={() => onSave(note.trim())}>
                        <Text style={styles.saveText}>Spara</Text>
                    </Pressable>
                    <Pressable style={styles.cancelBtn} onPress={onCancel}>
                        <Text style={styles.cancelText}>Avbryt</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
    grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', marginBottom: 12 },
    title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
    quickRow: { marginBottom: 12 },
    quickContainer: { flexDirection: 'row', gap: 8 },
    quickBtn: { backgroundColor: 'rgba(0,122,255,0.1)', borderColor: '#007AFF', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
    quickText: { color: '#007AFF', fontSize: 14 },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 10, minHeight: 80, textAlignVertical: 'top', fontSize: 16 },
    saveBtn: { backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
    saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    cancelText: { color: '#444', fontSize: 15 },
});

export default DriverNoteModal;
