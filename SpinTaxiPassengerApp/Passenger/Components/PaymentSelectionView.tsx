import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import CompanyProfileService, { CompanyProfile } from '../../services/CompanyProfileService';
import { PaymentOption, PaymentOptionFactory } from '../../types/PaymentOption';
import { PaymentButton } from './PaymentButton';

interface Props {
    visible: boolean;
    onClose: () => void;
    personalOptions: PaymentOption[]; // Google Pay, Cash, cards, New card
    selected: PaymentOption | null;
    onSelect: (option: PaymentOption) => void;
    initialTab?: 'personal' | 'company';
}

type Tab = 'personal' | 'company';

const PaymentSelectionView: React.FC<Props> = ({ visible, onClose, personalOptions, selected, onSelect, initialTab = 'personal' }) => {
    const [tab, setTab] = useState<Tab>(initialTab);
    const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState<CompanyProfile>({ id: '', name: '', orgNumber: '', address: '', email: '' });
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;
        (async () => {
            const list = await CompanyProfileService.list();
            setProfiles(list);
            const sel = await CompanyProfileService.getSelectedId();
            setSelectedCompanyId(sel);
        })();
        setTab(initialTab);
    }, [visible, initialTab]);

    const submitCompany = async () => {
        if (!form.name || !form.orgNumber || !form.email) return;
        const p: CompanyProfile = { ...form, id: `${Date.now()}` };
        await CompanyProfileService.add(p);
        const list = await CompanyProfileService.list();
        setProfiles(list);
        setAdding(false);
        setForm({ id: '', name: '', orgNumber: '', address: '', email: '' });
    };

    const selectCompany = async (p: CompanyProfile) => {
        await CompanyProfileService.setSelectedId(p.id);
        setSelectedCompanyId(p.id);
        onSelect(PaymentOptionFactory.createCompany());
        onClose();
    };

    const headerTitle = useMemo(() => tab === 'personal' ? 'Välj betalningssätt' : 'Företagsbetalning', [tab]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} transparent>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View style={styles.grabber} />
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}><Icon name="times" size={20} color="#666" /></TouchableOpacity>
                    </View>

                    {/* iOS-style Segmented Control */}
                    <View style={styles.segmentedContainer}>
                        <View style={styles.segmentedControl}>
                            <TouchableOpacity
                                onPress={() => setTab('personal')}
                                style={[styles.segment, tab === 'personal' && styles.segmentActive]}
                            >
                                <Icon name="user" size={16} color={tab === 'personal' ? '#fff' : '#111'} />
                                <Text style={[styles.segmentText, tab === 'personal' && styles.segmentTextActive]}>Privat</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setTab('company')}
                                style={[styles.segment, tab === 'company' && styles.segmentActive]}
                            >
                                <Icon name="briefcase" size={16} color={tab === 'company' ? '#fff' : '#111'} />
                                <Text style={[styles.segmentText, tab === 'company' && styles.segmentTextActive]}>Företag</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Section Title */}
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIconContainer}>
                            <Icon name="credit-card" size={20} color="#007AFF" />
                        </View>
                        <Text style={styles.sectionTitle}>Betalningsmetoder</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>Välj hur du vill betala för resan</Text>

                    {tab === 'personal' ? (
                        <ScrollView style={{ paddingHorizontal: 20 }}>
                            {personalOptions.map(opt => (
                                <View key={opt.id} style={{ marginBottom: 12 }}>
                                    <PaymentButton paymentOption={opt} onPress={(o) => { onSelect(o); onClose(); }} style={selected?.id === opt.id ? styles.selected : undefined} size="large" />
                                </View>
                            ))}
                        </ScrollView>
                    ) : (
                        <ScrollView style={{ paddingHorizontal: 20 }}>
                            {profiles.length === 0 && !adding && (
                                <View style={styles.emptyBox}>
                                    <Text style={styles.emptyTitle}>Inga företagsprofiler</Text>
                                    <Text style={styles.emptySub}>Lägg till företag för fakturering</Text>
                                    <TouchableOpacity style={styles.primaryBtn} onPress={() => setAdding(true)}>
                                        <Icon name="plus" color="#fff" />
                                        <Text style={styles.primaryBtnText}>Lägg till företag</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {adding && (
                                <View style={styles.form}>
                                    <TextInput placeholder="Företagsnamn" style={styles.input} value={form.name} onChangeText={t => setForm(s => ({ ...s, name: t }))} />
                                    <TextInput placeholder="Organisationsnummer" style={styles.input} value={form.orgNumber} onChangeText={t => setForm(s => ({ ...s, orgNumber: t }))} />
                                    <TextInput placeholder="E-post för faktura" style={styles.input} value={form.email} onChangeText={t => setForm(s => ({ ...s, email: t }))} keyboardType="email-address" />
                                    <TextInput placeholder="Adress (valfritt)" style={styles.input} value={form.address} onChangeText={t => setForm(s => ({ ...s, address: t }))} />
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={submitCompany}><Text style={styles.primaryBtnText}>Spara</Text></TouchableOpacity>
                                        <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setAdding(false)}><Text style={styles.secondaryBtnText}>Avbryt</Text></TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {profiles.map(p => (
                                <TouchableOpacity key={p.id} style={[styles.profileRow, selectedCompanyId === p.id && styles.profileRowActive]} onPress={() => selectCompany(p)}>
                                    <View style={styles.profileIcon}><Icon name="building" color="#007AFF" /></View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.profileName}>{p.name}</Text>
                                        <Text style={styles.profileSub}>{p.orgNumber} • {p.email}</Text>
                                    </View>
                                    {selectedCompanyId === p.id && <Icon name="check" color="#007AFF" />}
                                </TouchableOpacity>
                            ))}

                            {profiles.length > 0 && !adding && (
                                <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={() => setAdding(true)}>
                                    <Icon name="plus" />
                                    <Text style={styles.secondaryBtnText}>Lägg till företag</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#F8F9FA', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 0, alignItems: 'center' },
    grabber: { width: 36, height: 4, backgroundColor: '#919194ff', borderRadius: 2, marginBottom: 8 },
    closeButton: { position: 'absolute', right: 16, top: 12, padding: 8, zIndex: 10 },

    // iOS-style Segmented Control
    segmentedContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: '#E8E9EB',
        borderRadius: 10,
        padding: 3,
        gap: 4
    },
    segment: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'transparent'
    },
    segmentActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2
    },
    segmentText: {
        fontWeight: '600',
        fontSize: 15,
        color: '#111'
    },
    segmentTextActive: {
        color: '#111',
        fontWeight: '700'
    },

    // Section Headers
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 4
    },
    sectionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E3F2FD',
        alignItems: 'center',
        justifyContent: 'center'
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111',
        flex: 1
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        paddingHorizontal: 20,
        paddingBottom: 12,
        paddingLeft: 72
    },

    // Legacy styles removed
    title: { fontSize: 18, fontWeight: '700' },
    tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22, backgroundColor: '#F2F2F7' },
    tabActive: { backgroundColor: '#007AFF' },
    tabText: { fontWeight: '700', color: '#111' },
    tabTextActive: { color: '#fff' },

    selected: { borderWidth: 2, borderColor: '#007AFF', backgroundColor: 'rgba(0,122,255,0.05)' },
    emptyBox: { alignItems: 'center', gap: 6, paddingVertical: 20, backgroundColor: '#fff', borderRadius: 12, marginTop: 6 },
    emptyTitle: { fontWeight: '800', fontSize: 16 },
    emptySub: { color: '#6b7280', marginBottom: 6 },
    primaryBtn: { backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
    primaryBtnText: { color: '#fff', fontWeight: '700' },
    secondaryBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
    secondaryBtnText: { color: '#111', fontWeight: '700' },
    form: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, gap: 8, marginTop: 6 },
    input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', marginTop: 8 },
    profileRowActive: { borderColor: '#007AFF', backgroundColor: 'rgba(0,122,255,0.05)' },
    profileIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#EEF6FF', alignItems: 'center', justifyContent: 'center' },
    profileName: { fontWeight: '700' },
    profileSub: { color: '#6b7280', fontSize: 12 }
});

export default PaymentSelectionView;
