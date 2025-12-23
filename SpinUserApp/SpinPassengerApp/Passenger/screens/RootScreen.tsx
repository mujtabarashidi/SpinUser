import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
// import HomeScreen from '../Home/HomeScreen';
// import OnboardingSubmittedScreen from '../screens/OnboardingSubmittedScreen';
// import WelcomeView from '../screens/WelcomeView';

// TODO: Replace with real onboarding state logic
const useOnboardingStatus = (userUid: string | null) => {
  // Placeholder: Assume onboarding is complete if userUid exists
  // Replace with Firestore or backend check as needed
  if (!userUid) return { loading: false, submitted: false };
  return { loading: false, submitted: false };
};

const RootScreen: React.FC = () => {
  const { isAuthenticated, userUid } = useAuth();
  const { loading, submitted } = useOnboardingStatus(userUid);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }
  // Routing sker nu i AppNavigator, så RootScreen returnerar null när klart
  return null;
};

export default RootScreen;
