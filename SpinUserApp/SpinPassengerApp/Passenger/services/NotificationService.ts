import { NativeModules } from 'react-native';

// Type definition för att hantera saknade typer
type Importance = 'default' | 'max' | 'high' | 'low' | 'min' | 'none' | 'unspecified';

// För Android använder vi vår egen implementation
const { NotificationModule } = NativeModules;

// Använd PushNotification om det finns, annars skapa en dummy-version
const PushNotification = require('react-native-push-notification').default || {
  configure: () => { },
  createChannel: () => { },
  localNotification: (options: any) => {
    if (NotificationModule) {
      NotificationModule.showNotification(
        options.title || '',
        options.message || '',
        options.data || {}
      );
    }
  },
  cancelAllLocalNotifications: () => { }
};

class NotificationService {
  private static instance: NotificationService;

  private constructor() {
    this.configure();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private configure() {
    // Konfigurera Push Notification
    PushNotification.configure({
      // (required) Callback när en notifikation tas emot eller öppnas
      onNotification: function (notification: any) {
        console.log("NOTIFICATION:", notification);

        // När en notifikation öppnas av användaren, process the notification data
        if (notification.userInteraction) {
          // Hantera notifikationen här
          console.log("Användare interagerade med notifikation:", notification);
        }
      },

      // Android notifications only

      // Bör processen fortsätta köra under "Headless JS" tillstånd
      popInitialNotification: true,
      requestPermissions: true,
    });

    // Skapa kanal för Android
    PushNotification.createChannel(
      {
        channelId: "driver-trip-requests", // (required)
        channelName: "Reseförfrågningar", // (required)
        channelDescription: "Notifikationer för nya reseförfrågningar", // (optional)
        playSound: true,
        soundName: "ankomst.mp3",
        importance: "high" as Importance,
        vibrate: true,
      },
      (created: boolean) => console.log(`CreateChannel returned '${created}'`) // (optional) callback returns whether the channel was created or already existed
    );
  }

  // Visa en lokal notifikation
  showNotification(title: string, message: string, data: object = {}) {
    const notificationOptions = {
      channelId: "driver-trip-requests", // (required) för Android
      title: title,
      message: message,
      playSound: true,
      soundName: 'ankomst',
      importance: 'high' as Importance,
      priority: 'high',
      vibrate: true,
      vibration: 1000,
      data: data,
      userInteraction: false,
      // För att få fullskärmsnotifikationer även när appen är i bakgrunden (endast Android)
      visibility: 'public',
      ongoing: true, // Notifikationen kan inte svepas bort
      autoCancel: false, // Försvinner inte automatiskt när man klickar
    };

    console.log(`Visar notifikation med ljud: ${notificationOptions.soundName}`);

    if (NotificationModule) {
      // Använd vår anpassade modul för Android
      NotificationModule.showNotification(
        title,
        message,
        data
      );
    } else {
      // Fallback till react-native-push-notification
      PushNotification.localNotification(notificationOptions);
    }
  }

  // Stäng alla notifikationer
  cancelAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }
}

export default NotificationService.getInstance();