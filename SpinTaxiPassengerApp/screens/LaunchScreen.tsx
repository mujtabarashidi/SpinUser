import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

export default function LaunchScreen() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Spin Taxi</Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  loader: {
    marginVertical: 20,
  },
  subtitle: {
    fontSize: 16,
  },
});
