import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import NotificationService from '../services/NotificationService';

// Konfigurera ljud en gång vid uppstart
Sound.setCategory('Playback');

const NotificationTester: React.FC = () => {
  const testSound = () => {
    // Testa ljud direkt
    console.log('Testar ljuduppspelning...');

    const soundName = Platform.OS === 'android' ? 'ankomst.mp3' : 'ankomst.mp3';
    const sound = new Sound(soundName, Sound.MAIN_BUNDLE, (error) => {
      if (error) {
        console.log('Kunde inte ladda ljud:', error);
        return;
      }

      console.log('Ljud laddades framgångsrikt');

      sound.play((success) => {
        if (success) {
          console.log('Ljuduppspelning lyckades');
        } else {
          console.log('Ljuduppspelning misslyckades');
        }
      });
    });
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