import AsyncStorage from '@react-native-async-storage/async-storage';
import { StripeProvider } from '@stripe/stripe-react-native';
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ErrorBoundary from "./components/ErrorBoundary";
import AppConfig from "./config/AppConfig";
import SocketProvider from "./context/SocketProvider";
import PassengerNavigator from "./navigation/PassengerNavigator";
import { NetworkStatusBanner } from "./utils/NetworkMonitor";
import FirebaseManager from "./firebase/FirebaseManager";
import UpdateAvailableModal from './Passenger/Components/UpdateAvailableModal';
import { AuthProvider } from "./Passenger/context/AuthContext";
import { ThemeProvider, useAppTheme } from "./theme/ThemeProvider";
import { currentVersionDescription, hasNewerVersionThanCurrent, openStorePage } from './utils/AppVersionChecker';

// Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RMuwvGBroHhhnNcOqcH2icASZFIIE48yvztnj10HijgOSkQgCTDcOnKRf4HdchCNRXYTemg5WlE0kluECGCercG007vFVF8u7';

// Initialize app config
const appConfig = AppConfig.getInstance();

export default function App() {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize NotificationService once at app startup
  useEffect(() => {
    const initNotifications = async () => {
      try {
        const NotificationService = require('./services/NotificationService').default;
        console.log('Notification service initialized');

        // Initialize FCM Notification Handler
        const FCMNotificationHandler = require('./services/FCMNotificationHandler').default;

        // Request permissions
        const hasPermission = await FCMNotificationHandler.requestPermission();
        if (hasPermission) {
          // Get FCM token
          const token = await FCMNotificationHandler.getToken();
          if (token) {
            console.log('📱 FCM Token received, ready for notifications');
            // TODO: Send token to backend to associate with user
          }

          // Listen for token refresh
          FCMNotificationHandler.onTokenRefresh((newToken: string) => {
            console.log('🔄 FCM Token refreshed');
            // TODO: Update token in backend
          });
        }
      } catch (err) {
        console.error('Could not initialize notification service:', err);
      }
    };

    initNotifications();
  }, []);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseManager = FirebaseManager.getInstance();
        await firebaseManager.initialize();
        setFirebaseReady(true);
        console.log('🚀 App ready with Firebase');
      } catch (err: any) {
        console.error('❌ App Firebase error:', err);
        setError(err.message);
      }
    };

    initializeFirebase();
  }, []);

  return (
    <ErrorBoundary>
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.spintaxi"
        urlScheme="spintaxi"
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <ThemeProvider>
              <SocketProvider>
                <AppBootstrap firebaseReady={firebaseReady} error={error} />
              </SocketProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </StripeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

interface AppBootstrapProps {
  firebaseReady: boolean;
  error: string | null;
}

const AppBootstrap = ({ firebaseReady, error }: AppBootstrapProps) => {
  const { mode, colors } = useAppTheme();
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string | null; trackViewUrl?: string | null } | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isMandatory, setIsMandatory] = useState(true);
  const [currentDesc, setCurrentDesc] = useState('');

  // Run update check when app is ready
  useAppUpdateCheck(!!firebaseReady, ({ info, show, mandatory, desc }) => {
    setUpdateInfo(info);
    setShowUpdatePrompt(show);
    setIsMandatory(mandatory);
    setCurrentDesc(desc);
  });

  const renderStatus = (message: string) => (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.loadingText, { color: colors.textPrimary }]}>{message}</Text>
    </View>
  );

  if (error) {
    return renderStatus(`Firebase Error: ${error}`);
  }

  if (!firebaseReady) {
    return renderStatus('Initializing Firebase...');
  }

  return (
    <AuthProvider>
      <StatusBar
        translucent={true}
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
      />
      <NetworkStatusBanner />
      <PassengerNavigator />
      <UpdateAvailableModal
        visible={showUpdatePrompt}
        info={{ version: updateInfo?.version || '', releaseNotes: updateInfo?.releaseNotes }}
        currentVersionDescription={currentDesc}
        isMandatory={isMandatory}
        onDismiss={async () => {
          if (!updateInfo) { setShowUpdatePrompt(false); return; }
          try {
            await AsyncStorage.setItem('lastDismissedUpdateVersion', updateInfo.version);
          } catch { }
          setShowUpdatePrompt(false);
        }}
        onUpdate={async () => {
          const ok = await openStorePage({ version: updateInfo?.version || '', releaseNotes: updateInfo?.releaseNotes, trackViewUrl: updateInfo?.trackViewUrl });
          if (ok && updateInfo) {
            try { await AsyncStorage.setItem('lastDismissedUpdateVersion', updateInfo.version); } catch { }
          }
          setShowUpdatePrompt(false);
        }}
      />
    </AuthProvider>
  );
};

// Kick off update check after Firebase is ready
function useAppUpdateCheck(enabled: boolean, setState: (s: { info: { version: string; releaseNotes?: string | null; trackViewUrl?: string | null } | null; show: boolean; mandatory: boolean; desc: string; }) => void) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const desc = await currentVersionDescription();
        const dismissed = await AsyncStorage.getItem('lastDismissedUpdateVersion');
        const { isNewer, info } = await hasNewerVersionThanCurrent();
        if (cancelled) return;
        if (isNewer && info && info.version !== dismissed) {
          setState({ info: { version: info.version, releaseNotes: info.releaseNotes, trackViewUrl: info.trackViewUrl }, show: true, mandatory: true, desc });
        } else {
          setState({ info: null, show: false, mandatory: false, desc });
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, setState]);
}

