/**
 * LocationService.ts
 * 
 * Gemensam location service för både förare och passagerare
 * Undviker duplicerad kod genom konfigurerbar tracking
 * 
 * Features:
 * - Singleton pattern
 * - Observer pattern (subscribe/unsubscribe)
 * - Konfigurerbar precision och uppdateringsfrekvens
 * - Permission handling
 * - Stöd för både watchPosition (kontinuerlig) och getCurrentPosition (engångs)
 */

import { Alert, Linking, PermissionsAndroid } from 'react-native';
import Geolocation, { GeoError, GeoPosition } from 'react-native-geolocation-service';

// Types
export interface LocationCoordinates {
    latitude: number;
    longitude: number;
    accuracy?: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    timestamp?: number;
}

export interface LocationConfig {
    enableHighAccuracy: boolean;
    distanceFilter: number;
    interval?: number; // Android only
    fastestInterval?: number; // Android only
    timeout?: number;
    maximumAge?: number;
}

export interface LocationServiceOptions {
    roleType: 'driver' | 'passenger';
    config: LocationConfig;
    onLocationUpdate?: (location: LocationCoordinates) => void;
    onError?: (error: GeoError) => void;
}

// Predefined configs
export const DRIVER_CONFIG: LocationConfig = {
    enableHighAccuracy: false, // Lägre precision för batteri
    distanceFilter: 50, // 50 meter
    interval: 20000, // 20 sekunder
    fastestInterval: 15000, // 15 sekunder
    timeout: 15000,
    maximumAge: 5000,
};

export const PASSENGER_CONFIG: LocationConfig = {
    enableHighAccuracy: true, // Högre precision för noggrannhet
    distanceFilter: 6, // 6 meter
    interval: 3000, // 3 sekunder
    fastestInterval: 1500, // 1.5 sekunder
    timeout: 10000,
    maximumAge: 60000, // 60 sekunder cache
};

// Subscriber type
type LocationSubscriber = (location: LocationCoordinates | null) => void;

class LocationService {
    private static instances: Map<string, LocationService> = new Map();

    private watchId: number | null = null;
    private currentLocation: LocationCoordinates | null = null;
    private isTracking = false;
    private subscribers = new Set<LocationSubscriber>();
    private config: LocationConfig;
    private roleType: 'driver' | 'passenger';

    private constructor(roleType: 'driver' | 'passenger', config: LocationConfig) {
        this.roleType = roleType;
        this.config = config;
    }

    // Get or create instance for specific role
    static getInstance(roleType: 'driver' | 'passenger', config?: LocationConfig): LocationService {
        if (!LocationService.instances.has(roleType)) {
            const defaultConfig = roleType === 'driver' ? DRIVER_CONFIG : PASSENGER_CONFIG;
            LocationService.instances.set(
                roleType,
                new LocationService(roleType, config || defaultConfig)
            );
        }
        return LocationService.instances.get(roleType)!;
    }

    // Subscribe to location updates (Observer pattern)
    subscribe(callback: LocationSubscriber): () => void {
        this.subscribers.add(callback);
        // Emit current location immediately
        callback(this.currentLocation);

        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    // Notify all subscribers
    private notifySubscribers() {
        for (const callback of this.subscribers) {
            callback(this.currentLocation);
        }
    }

    // Update configuration
    updateConfig(newConfig: Partial<LocationConfig>) {
        this.config = { ...this.config, ...newConfig };

        // If tracking, restart with new config
        if (this.isTracking) {
            this.stopTracking();
            this.startTracking();
        }
    }

    // Request permissions
    async requestPermission(): Promise<boolean> {
        try {
            // Android only - iOS support removed
            const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
            const hasPermission = await PermissionsAndroid.check(fine);

            if (hasPermission) return true;

            const result = await PermissionsAndroid.request(fine, {
                title: `Platsåtkomst för ${this.roleType === 'driver' ? 'förare' : 'passagerare'}`,
                message: `Vi behöver din plats för att ${this.roleType === 'driver' ? 'matcha dig med passagerare' : 'hämta dig'}`,
                buttonPositive: 'Tillåt',
                buttonNegative: 'Avbryt',
            });

            return result === PermissionsAndroid.RESULTS.GRANTED;
        } catch (error) {
            console.error(`[${this.roleType.toUpperCase()}] Permission request failed:`, error);
            return false;
        }
    }

    // Handle location errors
    private handleError(error: GeoError) {
        console.warn(`[${this.roleType.toUpperCase()}] Location error:`, error.code, error.message);

        // Code 1: Permission denied
        if (error.code === 1) {
            Alert.alert(
                'Platsbehörighet krävs',
                'Tillåt platsbehörighet för att använda appen.',
                [
                    { text: 'Avbryt', style: 'cancel' },
                    { text: 'Öppna inställningar', onPress: () => Linking.openSettings() },
                ]
            );
            this.stopTracking();
            return;
        }

        // Code 2: Position unavailable
        if (error.code === 2) {
            Alert.alert(
                'Platstjänster avstängda',
                'Slå på platstjänster (GPS) för att hitta din position.',
                [
                    { text: 'Avbryt', style: 'cancel' },
                    { text: 'Öppna inställningar', onPress: () => Linking.openSettings() },
                ]
            );
            return;
        }

        // Code 3: Timeout - just log, don't alert
        if (error.code === 3) {
            console.log(`[${this.roleType.toUpperCase()}] Location request timeout`);
            return;
        }
    }

    // Get current position (one-time)
    async getCurrentPosition(): Promise<LocationCoordinates | null> {
        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
            console.error(`[${this.roleType.toUpperCase()}] Permission denied`);
            return null;
        }

        return new Promise((resolve) => {
            Geolocation.getCurrentPosition(
                (position: GeoPosition) => {
                    const location: LocationCoordinates = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: position.timestamp,
                    };

                    this.currentLocation = location;
                    this.notifySubscribers();

                    console.log(`[${this.roleType.toUpperCase()}] Got current position:`, {
                        lat: location.latitude.toFixed(5),
                        lon: location.longitude.toFixed(5),
                    });

                    resolve(location);
                },
                (error: GeoError) => {
                    this.handleError(error);
                    resolve(null);
                },
                {
                    enableHighAccuracy: this.config.enableHighAccuracy,
                    timeout: this.config.timeout || 15000,
                    maximumAge: this.config.maximumAge || 0,
                    forceRequestLocation: true,
                }
            );
        });
    }

    // Start continuous tracking
    async startTracking(): Promise<boolean> {
        if (this.isTracking) {
            console.log(`[${this.roleType.toUpperCase()}] Already tracking`);
            return true;
        }

        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
            console.error(`[${this.roleType.toUpperCase()}] Permission denied`);
            return false;
        }

        console.log(`[${this.roleType.toUpperCase()}] Starting tracking with config:`, this.config);

        this.isTracking = true;

        this.watchId = Geolocation.watchPosition(
            (position: GeoPosition) => {
                const location: LocationCoordinates = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: position.timestamp,
                };

                this.currentLocation = location;
                this.notifySubscribers();

                console.log(
                    `[${this.roleType.toUpperCase()}] Location update:`,
                    `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                );
            },
            (error: GeoError) => {
                this.handleError(error);

                // Stop tracking on permission error
                if (error.code === 1) {
                    this.stopTracking();
                }
            },
            {
                enableHighAccuracy: this.config.enableHighAccuracy,
                distanceFilter: this.config.distanceFilter,
                interval: this.config.interval,
                fastestInterval: this.config.fastestInterval,
                showsBackgroundLocationIndicator: false,
                forceRequestLocation: false,
                useSignificantChanges: false,
            }
        );

        console.log(`[${this.roleType.toUpperCase()}] Tracking started with watchId:`, this.watchId);
        return true;
    }

    // Stop tracking
    stopTracking() {
        if (this.watchId !== null) {
            Geolocation.clearWatch(this.watchId);
            console.log(`[${this.roleType.toUpperCase()}] Tracking stopped (watchId: ${this.watchId})`);
            this.watchId = null;
        }
        this.isTracking = false;
    }

    // Get last known location
    getLastKnownLocation(): LocationCoordinates | null {
        return this.currentLocation;
    }

    // Check if tracking is active
    isCurrentlyTracking(): boolean {
        return this.isTracking;
    }

    // Clear all subscribers
    clearSubscribers() {
        this.subscribers.clear();
    }

    // Calculate distance between two points (Haversine)
    static calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    // Calculate bearing between two points
    static calculateBearing(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const toDeg = (rad: number) => (rad * 180) / Math.PI;

        const φ1 = toRad(lat1);
        const φ2 = toRad(lat2);
        const λ1 = toRad(lon1);
        const λ2 = toRad(lon2);

        const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
        const θ = Math.atan2(y, x);

        return (toDeg(θ) + 360) % 360;
    }
}

// Lazy-load singleton instances to avoid class loading issues on app startup
let driverLocationServiceInstance: LocationService | null = null;
let passengerLocationServiceInstance: LocationService | null = null;

export function getDriverLocationService(): LocationService {
    if (!driverLocationServiceInstance) {
        driverLocationServiceInstance = LocationService.getInstance('driver', DRIVER_CONFIG);
    }
    return driverLocationServiceInstance;
}

export function getPassengerLocationService(): LocationService {
    if (!passengerLocationServiceInstance) {
        passengerLocationServiceInstance = LocationService.getInstance('passenger', PASSENGER_CONFIG);
    }
    return passengerLocationServiceInstance;
}

// Export convenient singletons - lazy initialization on first access
export const DriverLocationService = {
    getInstance: () => getDriverLocationService(),
    getCurrentPosition: () => getDriverLocationService().getCurrentPosition(),
    startTracking: () => getDriverLocationService().startTracking(),
    stopTracking: () => getDriverLocationService().stopTracking(),
    subscribe: (callback: LocationSubscriber) => getDriverLocationService().subscribe(callback),
    getLastKnownLocation: () => getDriverLocationService().getLastKnownLocation(),
    isCurrentlyTracking: () => getDriverLocationService().isCurrentlyTracking(),
    requestPermission: () => getDriverLocationService().requestPermission(),
    updateConfig: (config: Partial<LocationConfig>) => getDriverLocationService().updateConfig(config),
    clearSubscribers: () => getDriverLocationService().clearSubscribers(),
};

export const PassengerLocationService = {
    getInstance: () => getPassengerLocationService(),
    getCurrentPosition: () => getPassengerLocationService().getCurrentPosition(),
    startTracking: () => getPassengerLocationService().startTracking(),
    stopTracking: () => getPassengerLocationService().stopTracking(),
    subscribe: (callback: LocationSubscriber) => getPassengerLocationService().subscribe(callback),
    getLastKnownLocation: () => getPassengerLocationService().getLastKnownLocation(),
    isCurrentlyTracking: () => getPassengerLocationService().isCurrentlyTracking(),
    requestPermission: () => getPassengerLocationService().requestPermission(),
    updateConfig: (config: Partial<LocationConfig>) => getPassengerLocationService().updateConfig(config),
    clearSubscribers: () => getPassengerLocationService().clearSubscribers(),
};

export default LocationService;
