/**
 * Spin Passenger App
 * Main entry point
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, useColorScheme, ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider, useAuth } from './Passenger/context/AuthContext';
import { HomeProvider } from './Passenger/context/HomeContext';
import SocketProvider from './context/SocketProvider';
import FirebaseManager from './firebase/FirebaseManager';

// Import screens
import WelcomePassScreen from './Passenger/SingUp/WelcomePassScreen';
import LoginPassScreen from './Passenger/SingUp/LoginPassScreen';
import RegisterPassScreen from './Passenger/SingUp/RegisterPassScreen';
import HomeScreen from './Passenger/Home/HomeScreen';

// Stripe Publishable Key (Live mode)
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RMuwvGBroHhhnNcOqcH2icASZFIIE48yvztnj10HijgOSkQgCTDcOnKRf4HdchCNRXYTemg5WlE0kluECGCercG007vFVF8u7';

const Stack = createNativeStackNavigator();

// Separate component that uses auth context
function RootNavigator() {
  const { isAuthenticated, userDataMissing } = useAuth();

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? 'PassengerHome' : 'Welcome'}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomePassScreen} />
          <Stack.Screen name="Login" component={LoginPassScreen} />
          <Stack.Screen name="Register" component={RegisterPassScreen} />
        </>
      ) : (
        <Stack.Screen name="PassengerHome" component={HomeScreen} />
      )}
    </Stack.Navigator>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const fm = FirebaseManager.getInstance();
        await fm.initialize();
        setIsFirebaseReady(true);
      } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        setIsFirebaseReady(true); // Continue anyway to show error screens
      }
    };

    initializeFirebase();
  }, []);

  if (!isFirebaseReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.spintaxi"
      >
        <AuthProvider>
          <SocketProvider>
            <HomeProvider>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </HomeProvider>
          </SocketProvider>
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}

export default App;
