import type { ReactNativeFirebase } from '@react-native-firebase/app';
import { getApp, getApps } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getFunctions } from '@react-native-firebase/functions';

class FirebaseManager {
  private static instance: FirebaseManager;
  private initialized = false;
  private firebaseApp?: ReactNativeFirebase.FirebaseApp;

  static getInstance(): FirebaseManager {
    if (!FirebaseManager.instance) {
      FirebaseManager.instance = new FirebaseManager();
    }
    return FirebaseManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ge Firebase tid att initialiseras (speciellt på iOS)
      let attempts = 0;
      const maxAttempts = 10;
      
      while (getApps().length === 0 && attempts < maxAttempts) {
        console.log(`🔧 Väntar på Firebase initialisering... försök ${attempts + 1}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      // Kontrollera om Firebase är tillgängligt
      if (getApps().length === 0) {
        throw new Error('Firebase kunde inte initialiseras efter flera försök');
      }

      // Säkerställ att vi har en referens till appen
      this.firebaseApp = getApp();

      // Testa Firebase-tjänster
      const authInstance = getAuth(this.firebaseApp);
      const firestoreInstance = getFirestore(this.firebaseApp);
      
      console.log('✅ Firebase Auth är tillgängligt:', !!authInstance);
      console.log('✅ Firestore är tillgängligt:', !!firestoreInstance);
      console.log('✅ Firebase initialiserat med', getApps().length, 'app(s)');
      
      this.initialized = true;
      
    } catch (error) {
      console.error('❌ Firebase-initialisering misslyckades:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getAuth() {
    if (!this.initialized) {
      throw new Error('Firebase inte initialiserat. Kalla initialize() first.');
    }
    return getAuth(this.firebaseApp ?? getApp());
  }

  getFirestore() {
    if (!this.initialized) {
      throw new Error('Firebase inte initialiserat. Kalla initialize() first.');
    }
    return getFirestore(this.firebaseApp ?? getApp());
  }

  getFunctions() {
    if (!this.initialized) {
      throw new Error('Firebase inte initialiserat. Kalla initialize() first.');
    }
    return getFunctions(this.firebaseApp ?? getApp());
  }
}

export default FirebaseManager;
