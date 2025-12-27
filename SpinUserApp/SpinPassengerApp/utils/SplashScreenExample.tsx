import { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface SplashScreenReturn {
  showSplash: (message?: string) => void;
  hideSplash: () => void;
  SplashComponent: React.ReactNode;
}

export const useSplashScreen = (): SplashScreenReturn => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  const showSplash = (msg: string = 'Laddar...') => {
    setMessage(msg);
    setVisible(true);
  };

  const hideSplash = () => {
    setVisible(false);
  };

  const SplashComponent = visible ? (
    <View style={styles.splashContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.splashText}>{message}</Text>
    </View>
  ) : null;

  return { showSplash, hideSplash, SplashComponent };
};

const styles = StyleSheet.create({
  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
  },
  splashText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
});