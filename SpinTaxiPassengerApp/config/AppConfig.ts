import { NativeModules } from 'react-native';

export type AppType = 'driver' | 'passenger';

class AppConfig {
  private static instance: AppConfig;
  private appType: AppType = 'driver'; // Default
  private initialized: boolean = false;

  private constructor() {
    // Initialization happens async
    this.detectAppType();
  }

  private async detectAppType() {
    try {
      const AppConfigModule = NativeModules.AppConfigModule;
      if (AppConfigModule && AppConfigModule.getAppType) {
        const type = await AppConfigModule.getAppType();
        this.appType = type === 'passenger' ? 'passenger' : 'driver';
        console.log(`🎯 App Type Detected: ${this.appType}`);
      } else {
        console.log('⚠️ AppConfigModule not available, defaulting to driver');
      }
    } catch (error) {
      console.log('⚠️ Error detecting app type, defaulting to driver:', error);
    } finally {
      this.initialized = true;
    }
  }

  public static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  public getAppType(): AppType {
    return this.appType;
  }

  public isDriver(): boolean {
    return this.appType === 'driver';
  }

  public isPassenger(): boolean {
    return this.appType === 'passenger';
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export default AppConfig;
