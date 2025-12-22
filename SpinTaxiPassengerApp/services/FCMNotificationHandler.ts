import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import {
    doc,
    getDoc,
    getFirestore,
    serverTimestamp,
    setDoc
} from '@react-native-firebase/firestore';
import {
    AuthorizationStatus,
    FirebaseMessagingTypes,
    getInitialNotification,
    getMessaging,
    getToken as getMessagingToken,
    onMessage,
    onNotificationOpenedApp,
    onTokenRefresh,
    requestPermission,
    setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { DeviceEventEmitter } from 'react-native';
import NotificationService from './NotificationService';

/**
 * FCM Notification Handler för Passagerare-appen
 * Hanterar alla Firebase Cloud Messaging notifikationer från backend
 */
class FCMNotificationHandler {
    private static instance: FCMNotificationHandler;

    private constructor() {
        this.setupListeners();
    }

    static getInstance(): FCMNotificationHandler {
        if (!FCMNotificationHandler.instance) {
            FCMNotificationHandler.instance = new FCMNotificationHandler();
        }
        return FCMNotificationHandler.instance;
    }

    /**
     * Konfigurera FCM listeners
     */
    private setupListeners() {
        const app = getApp();
        const msg = getMessaging(app);
        // 📱 Foreground messages (när appen är öppen)
        onMessage(msg, async (remoteMessage) => {
            console.log('📥 FCM Foreground Message:', remoteMessage);
            this.handleNotification(remoteMessage);
        });

        // 📱 Background/Quit messages (när appen är stängd eller i bakgrunden)
        setBackgroundMessageHandler(msg, async (remoteMessage) => {
            console.log('📥 FCM Background Message:', remoteMessage);
            this.handleNotification(remoteMessage);
        });

        // 📱 Notification opened (när användaren klickar på notisen)
        onNotificationOpenedApp(msg, (remoteMessage) => {
            console.log('📱 Notification opened:', remoteMessage);
            this.handleNotificationTap(remoteMessage);
        });

        // 📱 Initial notification (om appen öppnades från en notis)
        getInitialNotification(msg).then((remoteMessage) => {
            if (remoteMessage) {
                console.log('📱 App opened from notification:', remoteMessage);
                this.handleNotificationTap(remoteMessage);
            }
        });

        // Spara FCM-token i Firestore efter att vi hämtat den
        getMessagingToken(msg)
            .then((token) => {
                if (token) {
                    console.log('📱 Initial FCM token:', token);
                    this.saveFCMTokenToFirebase(token);
                }
            })
            .catch((err) => console.warn('🔒 Error getting FCM token:', err));

        // Lyssna på token refresh och spara uppdaterad token
        onTokenRefresh(msg, (token) => {
            console.log('🔄 FCM Token refreshed:', token);
            this.saveFCMTokenToFirebase(token);
        });
    }

    /**
     * Huvudmetod för att hantera inkommande FCM-notifikationer
     */
    private handleNotification(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
        const { notification, data } = remoteMessage;

        if (!data || !data.type) {
            console.warn('⚠️ FCM message saknar type i data');
            return;
        }

        const notificationType = data.type;

        console.log(`🔔 Handling FCM notification type: ${notificationType}`);

        // Hantera olika notifikationstyper
        switch (notificationType) {
            case 'trip_accepted':
                this.handleTripAccepted(data, notification);
                break;

            case 'driver_arriving':
                this.handleDriverArriving(data, notification);
                break;

            case 'trip_started':
                this.handleTripStarted(data, notification);
                break;

            case 'trip_completed':
                this.handleTripCompleted(data, notification);
                break;

            case 'new_trip_request':
                this.handleNewTripRequest(data, notification);
                break;

            case 'trip_cancelled':
                this.handleTripCancelled(data, notification);
                break;

            default:
                console.warn(`⚠️ Unknown notification type: ${notificationType}`);
                // Visa generisk notis ändå
                if (notification?.title && notification?.body) {
                    NotificationService.showNotification(
                        notification.title,
                        notification.body,
                        data
                    );
                }
        }
    }

    /**
     * Hanterar ny reseförfrågan för förare (FCM push från backend)
     */
    private handleNewTripRequest(
        data: { [key: string]: string | object },
        notification?: FirebaseMessagingTypes.Notification
    ) {
        const app = getApp();
        const uid = getAuth(app).currentUser?.uid;
        if (!uid) {
            console.log('⚠️ Inget uid, hoppar över new_trip_request');
            return;
        }

        // Kolla om användaren är en förare
        const db = getFirestore(app);
        getDoc(doc(db, 'drivers', uid))
            .then((snap) => {
                if (!snap.exists()) {
                    console.log('ℹ️ Ignorerar new_trip_request – användare är inte förare');
                    return;
                }

                // Normalisera payload (samma shape som Socket-emissioner)
                const pickupAddress =
                    data?.pickupAddress || data?.pickupLocationAddress || data?.pickupLocationName || 'Okänd adress';
                const dropoffAddress =
                    data?.dropoffAddress || data?.dropoffLocationAddress || data?.dropoffLocationName || 'Okänd adress';

                // Visa lokal notifikation
                const title = notification?.title || 'Ny reseförfrågan';
                const body = notification?.body || `${pickupAddress} → ${dropoffAddress}`;
                NotificationService.showNotification(title, body, {
                    type: 'new_trip_request',
                    tripId: data.tripId,
                });

                // Emit event för att visa AcceptTripView i förarappen
                try {
                    DeviceEventEmitter.emit('incomingTripRequest', {
                        pickupAddress,
                        dropoffAddress,
                        ...data,
                    });
                } catch (e) {
                    console.warn('⚠️ emit incomingTripRequest failed', e);
                }
            })
            .catch((err) => console.error('❌ Error checking driver doc for new_trip_request:', err));
    }

    /**
     * Spara FCM-token i Firestore (spegel av iOS-implementation)
     */
    private async saveFCMTokenToFirebase(token: string) {
        try {
            const app = getApp();
            const uid = getAuth(app).currentUser?.uid;
            if (!uid) {
                console.log('⚠️ Ingen inloggad användare för att spara FCM token');
                return;
            }

            const db = getFirestore(app);
            const driverSnap = await getDoc(doc(db, 'drivers', uid));
            const userSnap = await getDoc(doc(db, 'users', uid));

            const driverExists = driverSnap.exists();
            const userExists = userSnap.exists();

            const tokenData: any = {
                fcmToken: token,
                fcmTokenUpdatedAt: serverTimestamp(),
                platform: 'android',
            };

            // Spara i users om användare är passagerare eller okänd
            if (userExists || !driverExists) {
                await setDoc(doc(db, 'users', uid), tokenData, { merge: true });
                console.log('✅ FCM token sparad i users collectionen för:', uid);
            }

            // Spara i drivers om användare är förare
            if (driverExists) {
                await setDoc(doc(db, 'drivers', uid), tokenData, { merge: true });
                console.log('✅ FCM token sparad i drivers collectionen för:', uid);
            }
        } catch (err) {
            console.error('❌ Kunde inte spara FCM token i Firestore:', err);
        }
    }

    /**
     * 🚕 Föraren har accepterat resan
     */
    private handleTripAccepted(
        data: { [key: string]: string | object },
        notification?: FirebaseMessagingTypes.Notification
    ) {
        const driverName = String(data.driverName || 'En förare');
        const eta = data.eta ? `${data.eta} min` : 'Strax';

        const title = notification?.title || '🚕 Förare på väg!';
        const message = notification?.body || `${driverName} har accepterat din resa. Beräknad ankomst: ${eta}`;

        NotificationService.showNotification(title, message, {
            type: 'trip_accepted',
            tripId: data.tripId,
            driverId: data.driverId,
            driverName,
            eta: data.eta,
        });
    }

    /**
     * 📍 Föraren närmar sig / har anlänt
     */
    private handleDriverArriving(
        data: { [key: string]: string | object },
        notification?: FirebaseMessagingTypes.Notification
    ) {
        const minutesAway = parseInt(String(data.minutesAway || '0'), 10);
        const driverName = String(data.driverName || 'Föraren');

        let title = notification?.title || '📍 Föraren närmar sig';
        let message = notification?.body || '';

        if (minutesAway === 0) {
            title = '📍 Föraren är här!';
            message = `${driverName} väntar på dig`;
        } else if (minutesAway <= 5) {
            message = `${driverName} är ${minutesAway} ${minutesAway === 1 ? 'minut' : 'minuter'} bort`;
        } else {
            message = `${driverName} är på väg`;
        }

        NotificationService.showNotification(title, message, {
            type: 'driver_arriving',
            tripId: data.tripId,
            driverId: data.driverId,
            minutesAway: minutesAway.toString(),
        });
    }

    /**
     * 🚗 Resan har startat
     */
    private handleTripStarted(
        data: { [key: string]: string | object },
        notification?: FirebaseMessagingTypes.Notification
    ) {
        const title = notification?.title || '🚗 Resan har startat';
        const message = notification?.body || 'Ha en trevlig resa!';

        NotificationService.showNotification(title, message, {
            type: 'trip_started',
            tripId: data.tripId,
        });
    }

    /**
     * ✅ Resan är avslutad
     */
    private handleTripCompleted(
        data: { [key: string]: string | object },
        notification?: FirebaseMessagingTypes.Notification
    ) {
        const tripCost = String(data.tripCost || '');
        const title = notification?.title || '✅ Resan avslutad';
        const message = notification?.body || (tripCost ? `Totalt: ${tripCost} kr. Tack för att du valde Spin!` : 'Tack för att du valde Spin!');

        NotificationService.showNotification(title, message, {
            type: 'trip_completed',
            tripId: data.tripId,
            tripCost,
        });
    }

    /**
     * ❌ Resan har avbrutits
     */
    private handleTripCancelled(
        data: { [key: string]: string | object },
        notification?: FirebaseMessagingTypes.Notification
    ) {
        const cancelledBy = String(data.cancelledBy || 'unknown');
        const reason = String(data.reason || '');

        let title = notification?.title || '❌ Resan avbröts';
        let message = notification?.body || '';

        if (cancelledBy === 'driver') {
            message = reason || 'Föraren avbröt resan';
        } else if (cancelledBy === 'passenger') {
            message = 'Din resa har avbrutits';
        } else {
            message = 'Resan avbröts';
        }

        NotificationService.showNotification(title, message, {
            type: 'trip_cancelled',
            tripId: data.tripId,
            cancelledBy,
            reason,
        });
    }

    /**
     * Hantera när användaren klickar på en notifikation
     */
    private handleNotificationTap(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
        const { data } = remoteMessage;

        if (!data) return;

        console.log('👆 User tapped notification:', data);

        // TODO: Navigera till rätt skärm baserat på notifikationstyp
        // Exempel: navigera till TripDetailsScreen om det är en trip-relaterad notis

        const notificationType = data.type;
        const tripId = data.tripId;

        switch (notificationType) {
            case 'trip_accepted':
            case 'driver_arriving':
            case 'trip_started':
                // Navigera till aktiv resa-vy
                console.log(`📱 Navigate to active trip: ${tripId}`);
                // TODO: Implementera navigation här
                break;

            case 'trip_completed':
                // Navigera till betygsättning eller kvitto
                console.log(`📱 Navigate to trip rating/receipt: ${tripId}`);
                // TODO: Implementera navigation här
                break;

            case 'trip_cancelled':
                // Navigera tillbaka till home screen
                console.log(`📱 Navigate to home screen after cancellation`);
                // TODO: Implementera navigation här
                break;
        }
    }

    /**
     * Begär notifikationsbehörigheter (iOS kräver detta)
     */
    async requestPermission(): Promise<boolean> {
        try {
            const app = getApp();
            const msg = getMessaging(app);
            const authStatus = await requestPermission(msg);
            const enabled =
                authStatus === AuthorizationStatus.AUTHORIZED ||
                authStatus === AuthorizationStatus.PROVISIONAL;

            if (enabled) {
                console.log('✅ FCM Permission granted:', authStatus);
            } else {
                console.log('❌ FCM Permission denied');
            }

            return enabled;
        } catch (error) {
            console.error('❌ Error requesting FCM permission:', error);
            return false;
        }
    }

    /**
     * Hämta FCM token för denna enhet
     */
    async getToken(): Promise<string | null> {
        try {
            const app = getApp();
            const msg = getMessaging(app);
            const token = await getMessagingToken(msg);
            console.log('📱 FCM Token:', token);
            return token;
        } catch (error) {
            console.error('❌ Error getting FCM token:', error);
            return null;
        }
    }

    /**
     * Lyssna på token refresh
     */
    onTokenRefresh(callback: (token: string) => void) {
        const app = getApp();
        const msg = getMessaging(app);
        return onTokenRefresh(msg, (token) => {
            console.log('🔄 FCM Token refreshed:', token);
            callback(token);
        });
    }
}

export default FCMNotificationHandler.getInstance();
