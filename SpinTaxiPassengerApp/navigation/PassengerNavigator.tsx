import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import FirebaseManager from '../firebase/FirebaseManager';
import { useAuth } from '../Passenger/context/AuthContext';
import { HomeProvider } from '../Passenger/context/HomeContext';
import PassengerHomeScreen from '../Passenger/Home/HomeScreen';
import RegisterPassScreen from '../Passenger/SingUp/RegisterPassScreen';
import WelcomePassScreen from '../Passenger/SingUp/WelcomePassScreen';
import LoginPassScreen from '../Passenger/SingUp/LoginPassScreen';
import { useAppTheme } from '../theme/ThemeProvider';
import LaunchScreen from '../screens/LaunchScreen';

const Stack = createNativeStackNavigator();

const PassengerHomeWrapper = () => (
  <HomeProvider>
    <PassengerHomeScreen />
  </HomeProvider>
);

export default function PassengerNavigator() {
  const auth = useAuth();
  const firebaseManager = FirebaseManager.getInstance();
  const firebaseReady = firebaseManager.isInitialized();
  const { navigationTheme } = useAppTheme();

  if (!firebaseReady || !auth.isReady) {
    return <LaunchScreen />;
  }

  const shouldShowAuthFlow = !auth.isAuthenticated || !auth.userUid;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {shouldShowAuthFlow ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomePassScreen} />
            <Stack.Screen name="Login" component={LoginPassScreen} />
            <Stack.Screen name="Register" component={RegisterPassScreen} />
          </>
        ) : (
          // Authenticated passenger flow
          <Stack.Screen name="PassengerHome" component={PassengerHomeWrapper} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
