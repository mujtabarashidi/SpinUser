import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function AboutView() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Om SPIN</Text>
      <Text style={styles.text}>
        SPIN är en taxi‑app byggd i Stockholm. Vi fokuserar på säker, pålitlig och
        transparent resa för både passagerare och förare.
      </Text>
      <Text style={styles.version}>Version 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  text: { fontSize: 14, color: '#666', lineHeight: 20 },
  version: { marginTop: 12, fontSize: 12, color: '#999' },
});
