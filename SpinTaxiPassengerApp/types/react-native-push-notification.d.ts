declare module 'react-native-push-notification' {
  export type Importance = 'default' | 'max' | 'high' | 'low' | 'min' | 'none' | 'unspecified';
  
  interface PushNotificationPermissions {
    alert?: boolean;
    badge?: boolean;
    sound?: boolean;
  }

  interface PushNotificationObject {
    /* Android only properties */
    channelId?: string;
    ticker?: string;
    showWhen?: boolean;
    autoCancel?: boolean;
    largeIcon?: string;
    largeIconUrl?: string;
    smallIcon?: string;
    bigText?: string;
    subText?: string;
    bigPictureUrl?: string;
    color?: string;
    vibrate?: boolean;
    vibration?: number;
    tag?: string;
    group?: string;
    ongoing?: boolean;
    priority?: 'max' | 'high' | 'low' | 'min' | 'default';
    visibility?: 'private' | 'public' | 'secret';
    importance?: Importance;
    allowWhileIdle?: boolean;
    ignoreInForeground?: boolean;
    shortcutId?: string;
    
    /* iOS and Android properties */
    id?: string;
    title?: string;
    message: string;
    userInfo?: object;
    playSound?: boolean;
    soundName?: string;
    number?: string;
    repeatType?: 'week' | 'day' | 'hour' | 'minute' | 'time';
    repeatTime?: number;
    
    /* iOS only properties */
    alertAction?: string;
    category?: string;
    
    /* Android and iOS properties */
    data?: any;
    userInteraction?: boolean;
  }

  interface PushNotificationChannel {
    channelId: string;
    channelName: string;
    channelDescription?: string;
    playSound?: boolean;
    soundName?: string;
    importance?: Importance;
    vibrate?: boolean;
    vibration?: number;
  }

  interface PushNotificationScheduleObject extends PushNotificationObject {
    date: Date;
  }

  interface PushNotificationDeliveredObject {
    id: string;
    title: string;
    body: string;
    tag: string;
    group: string;
  }

  export interface PushNotification {
    configure(options: {
      onRegister?: (token: { os: string, token: string }) => void,
      onNotification?: (notification: any) => void,
      onAction?: (notification: any) => void,
      onRegistrationError?: (error: any) => void,
      onRemoteFetch?: (notificationData: any) => void,
      popInitialNotification?: boolean,
      requestPermissions?: boolean,
      permissions?: PushNotificationPermissions
    }): void;
    
    unregister(): void;
    localNotification(notification: PushNotificationObject): void;
    localNotificationSchedule(notification: PushNotificationScheduleObject): void;
    cancelAllLocalNotifications(): void;
    removeAllDeliveredNotifications(): void;
    getDeliveredNotifications(callback: (notifications: PushNotificationDeliveredObject[]) => void): void;
    removeDeliveredNotifications(identifiers: string[]): void;
    cancelLocalNotifications(userInfo: object): void;
    getScheduledLocalNotifications(callback: (notifications: PushNotificationScheduleObject[]) => void): void;
    getChannels(callback: (channels: string[]) => void): void;
    channelExists(channel: string, callback: (exists: boolean) => void): void;
    createChannel(channel: PushNotificationChannel, callback?: (created: boolean) => void): void;
    deleteChannel(channel: string): void;
    setApplicationIconBadgeNumber(number: number): void;
    getApplicationIconBadgeNumber(callback: (badgeCount: number) => void): void;
    abandonPermissions(): void;
    checkPermissions(callback: (permissions: PushNotificationPermissions) => void): void;
    requestPermissions(permissions?: PushNotificationPermissions): void;
    registerNotificationActions(actions: string[]): void;
    clearAllNotifications(): void;
    presentLocalNotification(details: PushNotificationObject): void;
  }

  const PushNotification: PushNotification;
  export default PushNotification;
}