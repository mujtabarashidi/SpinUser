import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import NotificationService from '../services/NotificationService';

const NotificationTester: React.FC = () => {
  const testSound = () => {
    console.log('🔊 [NotificationTester] Sound playback disabled (library incompatible)');
  };

  const testNotification = () => {
    // Testa notifikation med ljud
    console.log('Visar testnotifikation med ljud...');

    NotificationService.showNotification(
      'Testnotifikation',
      'Detta är en testnotifikation med ljud',
      { test: true }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifikationstest</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Testa ljud"
          onPress={testSound}
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title="Testa notifikation med ljud"
          onPress={testNotification}
          color="#4CAF50"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonContainer: {
    marginVertical: 10,
  },
});

export default NotificationTester;