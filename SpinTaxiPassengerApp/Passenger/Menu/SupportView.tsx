import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SupportView() {
  const openEmail = () => Linking.openURL('mailto:support@spintaxi.se');
  const openPhone = () => Linking.openURL('tel:+46812345678');

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Support</Text>
      <Text style={styles.text}>Behöver du hjälp? Kontakta oss.</Text>

      <TouchableOpacity style={styles.button} onPress={openEmail}>
        <Text style={styles.buttonText}>E‑posta support@spintaxi.se</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={openPhone}>
        <Text style={styles.buttonText}>Ring +46 8 123 45 678</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  text: { fontSize: 14, color: '#666', marginBottom: 16 },
  button: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 10 },
  buttonText: { color: 'white', fontWeight: '600' },
});
