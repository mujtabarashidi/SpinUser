import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Text,
  Animated,
} from 'react-native';

interface SplashScreenProps {
  visible: boolean;
  message?: string;
}

const { width, height } = Dimensions.get('window');

export const SplashScreen: React.FC<SplashScreenProps> = ({
  visible,
  message = 'Laddar...',
}) => {
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!visible) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(1);
    }
  }, [visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <Text style={styles.logo}>SPIN</Text>
        
        {/* Loading Spinner */}
        <ActivityIndicator
          size="large"
          color="#FFFFFF"
          style={styles.spinner}
        />
        
        {/* Loading Message */}
        <Text style={styles.message}>{message}</Text>
        
        {/* Tagline */}
        <Text style={styles.tagline}>Your Ride, Your Way</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1682C8',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 30,
    letterSpacing: 2,
  },
  spinner: {
    marginVertical: 20,
  },
  message: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 20,
    opacity: 0.9,
  },
  tagline: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 40,
    opacity: 0.7,
  },
});
