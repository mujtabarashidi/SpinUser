import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';

class NotificationService {
  private static instance: NotificationService;
  private channelId = 'passenger-notifications';

  private constructor() {
    this.configure();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async configure() {
    // Skapa notifikationskanal för Android
    await notifee.createChannel({
      id: this.channelId,
      name: 'Passenger Notifications',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });

    // Begär notifikationsbehörigheter
    await this.requestPermission();

    // Hantera meddelanden i förgrunden
    messaging().onMessage(async remoteMessage => {
      console.log('Meddelande mottaget i förgrunden:', remoteMessage);
      if (remoteMessage.notification) {
        await this.showNotification(
          remoteMessage.notification.title || 'Notification',
          remoteMessage.notification.body || '',
          remoteMessage.data || {}
        );
      }
    });

    // Hantera notifikationer när appen öppnas från en notifikation
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app from background:', remoteMessage);
    });

    // Kolla om appen öppnades från en notifikation vid start
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Notification opened app from quit state:', remoteMessage);
        }
      });
  }

  private async requestPermission(): Promise<boolean> {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Notifikationsbehörighet beviljad:', authStatus);
    }

    return enabled;
  }

  // Visa en lokal notifikation
  async showNotification(title: string, message: string, data: object = {}) {
    try {
      await notifee.displayNotification({
        title,
        body: message,
        data: data as Record<string, string>,
        android: {
          channelId: this.channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          sound: 'default',
          vibrationPattern: [300, 500],
        },
        ios: {
          sound: 'default',
        },
      });
    } catch (error) {
      console.error('Fel vid visning av notifikation:', error);
    }
  }

  // Stäng alla notifikationer
  async cancelAllNotifications() {
    await notifee.cancelAllNotifications();
  }

  // Hämta FCM token
  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Fel vid hämtning av FCM token:', error);
      return null;
    }
  }
}

export default NotificationService.getInstance();