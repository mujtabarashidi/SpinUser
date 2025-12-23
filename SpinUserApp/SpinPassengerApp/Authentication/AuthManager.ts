import { useEffect, useState, useCallback } from 'react';
import FirebaseManager from '../firebase/FirebaseManager';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { AccountType } from '../Passenger/PassView/DeveloperPreview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import functions from '@react-native-firebase/functions';
import firestore from '@react-native-firebase/firestore';

export interface User {
  fullname: string;
  email: string;
  uid: string;
  phoneNumber: string;
  accountType: AccountType;
  stripeCustomerId?: string;
  profileImage?: string;
  coordinate?: {
    latitude: number;
    longitude: number;
  };
  carDetails?: {
    brand: string;
    model: string;
    registration: string;
    color: string;
    year?: string;
  };
}

export interface AuthViewModel {
  currentUser: User | null;
  fetchCurrentUser: () => Promise<void>;
  signOut: () => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registerUser: (email: string, password: string, fullname: string, phoneNumber: string, coordinate?: { latitude: number; longitude: number }) => Promise<{ ok: boolean; error?: string }>;
  signInAnonymouslyIfNeeded: () => Promise<void>;
  isAuthenticated: boolean;
  userDataMissing: boolean;
  userUid: string | null;
}

// Helper functions
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapAuthError(error: any): string {
  const code = error?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'Ogiltig e-postadress.';
    case 'auth/wrong-password':
      return 'Fel lösenord.';
    case 'auth/user-disabled':
      return 'Kontot är inaktiverat.';
    case 'auth/user-not-found':
      return 'Hittar inget konto med den e-postadressen.';
    case 'auth/network-request-failed':
      return 'Nätverksfel. Kontrollera anslutningen.';
    case 'auth/email-already-in-use':
      return 'E-postadressen är redan registrerad.';
    default:
      return error?.message ?? 'Ett fel uppstod';
  }
}

async function loadUserFromFirestore(
  db: FirebaseFirestoreTypes.Module,
  uid: string
): Promise<User | null> {
  try {
    const usersDoc = await db.collection('users').doc(uid).get();
    if (usersDoc.exists()) {
      const data = usersDoc.data() as any;
      
      // Handle legacy data structure
      const fullname = data.fullname || data.name || '';
      const coordinate = data.coordinate 
        ? { latitude: data.coordinate.latitude, longitude: data.coordinate.longitude }
        : data.location
        ? { latitude: data.location.latitude, longitude: data.location.longitude }
        : undefined;

      // Extract car details if available
      const carDetails = extractCarDetails(data);

      const user: User = {
        fullname,
        email: data.email || '',
        uid,
        phoneNumber: data.phoneNumber || '',
        accountType: AccountType.PASSENGER,
        stripeCustomerId: data.stripeCustomerId,
        coordinate,
      };

      // Add profile image if available
      if (data.profileImage) {
        user.profileImage = data.profileImage;
        console.log('✅ Profilbild hämtad:', data.profileImage);
      }

      // Add car details if available
      if (carDetails) {
        user.carDetails = carDetails;
        console.log('🚗 Bilinformation hämtad:', carDetails);
      }

      return user;
    }
    return null;
  } catch (error) {
    console.error('🔥 [Auth] Fel vid hämtning från users:', error);
    return null;
  }
}

// Helper to extract car details from Firestore data
function extractCarDetails(data: any): User['carDetails'] | undefined {
  const carMap = data.carDetails || {};
  
  const brand = firstNonEmptyString([carMap.brand, data.brand]);
  const model = firstNonEmptyString([carMap.model, data.model]);
  const registration = firstNonEmptyString([carMap.registration, data.registration]);
  const color = firstNonEmptyString([carMap.color, data.color]);
  
  // If all car details are empty, return undefined
  if (!brand && !model && !registration && !color) {
    return undefined;
  }
  
  const year = firstNonEmptyString([carMap.year, data.year]);
  
  return {
    brand,
    model,
    registration,
    color,
    year: year || undefined,
  };
}

// Helper to get first non-empty string from candidates
function firstNonEmptyString(candidates: any[]): string {
  for (const value of candidates) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return '';
}

export function useAuthViewModel(): AuthViewModel {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userDataMissing, setUserDataMissing] = useState(false);

  // Fetch user data
  const fetchUser = useCallback(async (uid: string) => {
    try {
      const fm = FirebaseManager.getInstance();
      const db = fm.getFirestore();
      
      const user = await loadUserFromFirestore(db, uid);
      
      if (user) {
        setCurrentUser(user);
        setUserDataMissing(false);
        console.log('✅ [Auth] Användardata laddad för:', user.fullname || user.email);
      } else {
        // Handle no user found - passenger app continues as guest
        console.log('👤 Ingen användardata hittades – antas vara gästanvändare.');
        setCurrentUser(null);
        setIsAuthenticated(true);
        setUserDataMissing(true);
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('isGuestUser', 'true');
      }
    } catch (error) {
      console.error('🔥 [Auth] Fel vid hämtning av användardata:', error);
      setCurrentUser(null);
      setUserDataMissing(true);
    }
  }, []);

  // Auth state observer
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const fm = FirebaseManager.getInstance();
        if (!fm.isInitialized()) {
          await fm.initialize();
        }
        const auth = fm.getAuth();

        unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
          if (!mounted) return;

          if (firebaseUser) {
            setUserUid(firebaseUser.uid);
            setIsAuthenticated(true);
            await fetchUser(firebaseUser.uid);
          } else {
            setUserUid(null);
            setCurrentUser(null);
            setIsAuthenticated(false);
            setUserDataMissing(false);
            await AsyncStorage.removeItem('isLoggedIn');
            await AsyncStorage.removeItem('isGuestUser');
          }
        });
      } catch (e) {
        console.error('🔥 [Auth] Fel vid initialisering av auth state observer:', e);
      }
    })();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [fetchUser]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const fm = FirebaseManager.getInstance();
      if (!fm.isInitialized()) {
        await fm.initialize();
      }
      const auth = fm.getAuth();
      const firebaseUser = auth.currentUser;
      
      if (!firebaseUser) {
        setCurrentUser(null);
        return;
      }
      
      await fetchUser(firebaseUser.uid);
    } catch (e: any) {
      console.error('🔥 [Auth] fetchCurrentUser error:', e);
    }
  }, [fetchUser]);

  // Check and restore account from deletion
  const checkAndRestoreAccount = useCallback(async (): Promise<boolean> => {
    try {
      const fm = FirebaseManager.getInstance();
      const auth = fm.getAuth();
      
      if (!auth.currentUser) return false;

      const result = await functions().httpsCallable('checkAndRestoreAccount')({});
      const data = result.data as any;
      
      if (data?.restored) {
        console.log('✅ Account restored from deletion:', data.message || 'Welcome back!');
        return true;
      }
      return false;
    } catch (error) {
      console.log('⚠️ Could not check account restoration status:', error);
      return false;
    }
  }, []);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const fm = FirebaseManager.getInstance();
      if (!fm.isInitialized()) {
        await fm.initialize();
      }
      const auth = fm.getAuth();
      const normalizedEmail = normalizeEmail(email);
      
      const credential = await auth.signInWithEmailAndPassword(normalizedEmail, password);
      
      // Check and restore account if needed
      const wasRestored = await checkAndRestoreAccount();
      
      // Always fetch user data after successful sign-in
      if (credential.user) {
        if (wasRestored) {
          console.log('🔄 Account was restored, fetching user data from restored collection...');
        }
        await fetchUser(credential.user.uid);
      }

      return { ok: true };
    } catch (e: any) {
      const message = mapAuthError(e);
      return { ok: false, error: `❌ Misslyckades att logga in: ${message}` };
    }
  }, [checkAndRestoreAccount, fetchUser]);

  // Register user
  const registerUser = useCallback(async (
    email: string,
    password: string,
    fullname: string,
    phoneNumber: string,
    coordinate?: { latitude: number; longitude: number }
  ) => {
    try {
      const fm = FirebaseManager.getInstance();
      if (!fm.isInitialized()) {
        await fm.initialize();
      }
      const auth = fm.getAuth();
      const db = fm.getFirestore();
      const normalizedEmail = normalizeEmail(email);

      const credential = await auth.createUserWithEmailAndPassword(normalizedEmail, password);
      const uid = credential.user.uid;

      await AsyncStorage.setItem('isLoggedIn', 'true');

      const userData: any = {
        uid,
        fullname,
        email: normalizedEmail,
        phoneNumber,
        accountType: AccountType.PASSENGER,
      };

      if (coordinate) {
        userData.coordinate = new firestore.GeoPoint(coordinate.latitude, coordinate.longitude);
      }

      await db.collection('users').doc(uid).set(userData);
      
      // Send welcome email (fire and forget)
      sendWelcomeEmail(normalizedEmail, fullname);
      
      console.log('✅ [Auth] Ny passagerare registrerad:', { uid, email: normalizedEmail, fullname });
      
      return { ok: true };
    } catch (e: any) {
      const code = e?.code;
      if (code === 'auth/email-already-in-use') {
        return { ok: false, error: 'E-postadressen är redan registrerad. Logga in eller återställ lösenordet.' };
      }
      const message = mapAuthError(e);
      return { ok: false, error: message };
    }
  }, []);

  // Sign in anonymously if needed
  const signInAnonymouslyIfNeeded = useCallback(async () => {
    try {
      const fm = FirebaseManager.getInstance();
      if (!fm.isInitialized()) {
        await fm.initialize();
      }
      const auth = fm.getAuth();
      
      if (!auth.currentUser) {
        await auth.signInAnonymously();
        console.log('✅ Inloggad anonymt');
      }
    } catch (error) {
      console.error('❌ Anonym inloggning misslyckades:', error);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      const fm = FirebaseManager.getInstance();
      if (!fm.isInitialized()) {
        await fm.initialize();
      }
      const auth = fm.getAuth();
      
      // Clear FCM token before logout (if you have FCM implemented)
      // await clearFCMToken();
      
      await auth.signOut();
      console.log('✅ [AUTH] Användare loggad ut');
      return { ok: true };
    } catch (e: any) {
      console.error('❌ [AUTH] Misslyckades att logga ut:', e);
      return { ok: false, error: e?.message ?? 'Sign out failed' };
    }
  }, []);

  // Send welcome email (fire and forget)
  const sendWelcomeEmail = useCallback((email: string, name: string) => {
    // Implement mail service call here if needed
    // mailService.sendWelcomeEmail(email, name, AccountType.PASSENGER);
    console.log('📧 Welcome email would be sent to:', email, name);
  }, []);

  return {
    currentUser,
    fetchCurrentUser,
    signOut,
    signIn,
    registerUser,
    signInAnonymouslyIfNeeded,
    isAuthenticated,
    userDataMissing,
    userUid,
  };
}

export { AccountType };
