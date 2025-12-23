import React from 'react';
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Hook för att övervaka nätverksstatus
export function useNetworkMonitor() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  return isConnected;
}

// Banner-komponent
export function NetworkStatusBanner() {
  const isConnected = useNetworkMonitor();
  const [visible] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(visible, {
      toValue: isConnected ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isConnected]);

  if (isConnected) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          opacity: visible,
          transform: [{ translateY: visible.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="wifi" size={22} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.text}>Ingen internetanslutning</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 0,
    alignSelf: 'center',
    backgroundColor: '#e11d48',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    zIndex: 1000,
    marginTop: Platform.OS === 'ios' ? 0 : 24,
    elevation: 10,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
  },
});