import React, { useContext, useMemo } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HomeContext } from '../context/HomeContext';

export default function SupportView() {
  const { trip } = useContext(HomeContext) as any;
  const tripId: string | undefined = trip?.id;

  const emailUrl = useMemo(() => {
    const to = 'support@spintaxi.se';
    const subject = encodeURIComponent(
      tripId ? `Support – Rese-ID ${tripId}` : 'Support – Spin'
    );
    const body = encodeURIComponent(
      `Hej Spin support,\n\nJag behöver hjälp med min resa.${tripId ? `\nRese-ID: ${tripId}` : ''}\n\nBeskrivning: `
    );
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [tripId]);

  const openEmail = () => Linking.openURL(emailUrl);
  const openPhone = () => Linking.openURL('tel:+46812345678');

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Support</Text>
      <Text style={styles.text}>Behöver du hjälp? Kontakta oss.</Text>
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Viktigt</Text>
        <Text style={styles.noticeText}>Ange alltid ditt Rese-ID när du kontaktar oss om en resa.</Text>
        <View style={styles.tripRow}>
          <Text style={styles.tripLabel}>Rese-ID:</Text>
          <Text style={styles.tripValue}>{tripId ?? '—'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={openEmail}>
        <Text style={styles.buttonText}>support@spintaxi.se</Text>
      </TouchableOpacity>

      

    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  text: { fontSize: 14, color: '#666', marginBottom: 16 },
  noticeBox: { backgroundColor: '#F1F5FF', borderColor: '#C6DAFF', borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 16 },
  noticeTitle: { fontSize: 12, fontWeight: '700', color: '#0D47A1', marginBottom: 6, textTransform: 'uppercase' },
  noticeText: { fontSize: 13, color: '#333', marginBottom: 8 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripLabel: { fontSize: 13, color: '#666' },
  tripValue: { fontSize: 14, fontWeight: '700', color: '#0D47A1' },
  button: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 10 },
  secondaryButton: { backgroundColor: '#2E7D32' },
  buttonText: { color: 'white', fontWeight: '600' },
});
