import type { ReactNativeFirebase } from '@react-native-firebase/app';
import { getApp } from '@react-native-firebase/app';
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
      console.log('🔧 Initialiserar Firebase...');
      // Försök hämta default-appen; kastar fel om ingen app finns
      this.firebaseApp = getApp();

      // Testa Firebase-tjänster
      const authInstance = getAuth(this.firebaseApp);
      const firestoreInstance = getFirestore(this.firebaseApp);

      console.log('✅ Firebase Auth är tillgängligt:', !!authInstance);
      console.log('✅ Firestore är tillgängligt:', !!firestoreInstance);

      this.initialized = true;
      console.log('✅ Firebase initialiserat framgångsrikt');
    } catch (error: any) {
      const message =
        'Ingen Firebase-app hittades. Lägg till google-services.json i android/app, ' +
        'lägg till Google Services-plugin i Gradle och registrera paketnamnet (applicationId) com.spinpassengerapp i Firebase.';
      console.error('❌ Firebase-initialisering misslyckades:', error?.message || error);
      throw new Error(message);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getAuth() {
    if (!this.initialized) {
      throw new Error('Firebase inte initialiserat. Kalla initialize() först.');
    }
    return getAuth(this.firebaseApp);
  }

  getFirestore() {
    if (!this.initialized) {
      throw new Error('Firebase inte initialiserat. Kalla initialize() först.');
    }
    return getFirestore(this.firebaseApp);
  }

  getFunctions() {
    if (!this.initialized) {
      throw new Error('Firebase inte initialiserat. Kalla initialize() först.');
    }
    return getFunctions(this.firebaseApp);
  }
}

export default FirebaseManager;
