import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SplashScreen } from './SplashScreen';

interface SplashScreenReturn {
  showSplash: (msg?: string) => void;
  hideSplash: () => void;
  SplashComponent: React.ReactNode;
  visible: boolean;
}

/**
 * Hook för att hantera splash screen under datainladdning
 * 
 * @example
 * const { showSplash, hideSplash, SplashComponent } = useSplashScreen();
 * 
 * useEffect(() => {
 *   const loadData = async () => {
 *     showSplash('Laddar data...');
 *     try {
 *       await fetchUserData();
 *     } finally {
 *       hideSplash();
 *     }
 *   };
 *   loadData();
 * }, []);
 * 
 * return (
 *   <View>
 *     <YourComponent />
 *     {SplashComponent}
 *   </View>
 * );
 */
