/**
 * Passenger Location Optimization Hook
 * Battery-efficient location tracking for passenger side
 * 
 * Features:
 * - Adaptive distance filters
 * - Smart battery management
 * - Foreground/background detection
 * - Throttled updates
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {
    LocationTrackingState,
    getLocationOptions,
    getRecommendedTrackingState,
    hasLocationChangedSignificantly,
    isValidLocation,
    shouldSkipLocationUpdate,
} from '../../utils/LocationOptimizer';

interface PassengerLocationHookResult {
    userLocation: { latitude: number; longitude: number } | null;
    isTracking: boolean;
    error: string | null;
    batteryLevel: number;
}

export function usePassengerLocationTracking(
    hasActiveTrip: boolean,
    isWaitingForDriver: boolean,
    isSearching: boolean
): PassengerLocationHookResult {
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [batteryLevel, setBatteryLevel] = useState(100);
    const [appState, setAppState] = useState<AppStateStatus>('active');

    const watchIdRef = useRef<number | null>(null);
    const lastUpdateTimeRef = useRef<number>(0);
    const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
    const appStateSubscriptionRef = useRef<any>(null);

    // --- Helpers (Android focused) ---
    const ensureLocationPermission = useCallback(async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true; // Scope: Android-only app
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (e) {
            console.warn('⚠️ Permission request failed', e);
            return false;
        }
    }, []);

    const handleLocationError = useCallback((err: { code: number; message: string }) => {
        // https://github.com/Agontuk/react-native-geolocation-service#usage
        switch (err.code) {
            case 1: // PERMISSION_DENIED
                setError('Platsbehörighet nekad. Aktivera plats i Inställningar.');
                if (Platform.OS === 'android') Linking.openSettings().catch(() => { });
                break;
            case 2: // POSITION_UNAVAILABLE (provider off or no fix)
                setError('Plats otillgänglig. Slå på plats-tjänster (GPS).');
                break;
            case 3: // TIMEOUT
                setError('Tidsgräns för platsförfrågan. Försöker igen...');
                break;
            default:
                setError(err.message || 'Okänt platsfel');
        }
        console.error('❌ Passenger location error:', err);
    }, []);

    const getCurrentPositionSafe = useCallback(async (baseOptions: any) => {
        // Try COARSE first (battery friendly), then fall back to HIGH accuracy only if needed
        const optionsCoarse = {
            enableHighAccuracy: false,
            timeout: 6000,
            maximumAge: 5000,
            ...(baseOptions || {}),
            ...(Platform.OS === 'android'
                ? { forceRequestLocation: true, showLocationDialog: true }
                : {}),
        } as any;

        const optionsFine = {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 2000,
            ...(baseOptions || {}),
            ...(Platform.OS === 'android'
                ? { forceRequestLocation: true, showLocationDialog: true }
                : {}),
        } as any;

        const tryOnce = (opts: any) =>
            new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
                Geolocation.getCurrentPosition(
                    (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    (err) => reject(err),
                    opts
                );
            });

        try {
            return await tryOnce(optionsCoarse);
        } catch (e: any) {
            return tryOnce(optionsFine).catch(() => null);
        }
    }, []);

    // Get current tracking state
    const currentTrackingState = getRecommendedTrackingState(
        appState === 'active',
        hasActiveTrip,
        isSearching || isWaitingForDriver,
        isSearching,
        isWaitingForDriver
    );

    // Stop location tracking
    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            Geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setIsTracking(false);
    }, []);

    // Start location tracking with optimization
    const startTracking = useCallback(() => {
        if (isTracking) return; // Already tracking

        const locationOptions = getLocationOptions(currentTrackingState);
        if (!locationOptions) {
            stopTracking();
            return;
        }

        (async () => {
            const hasPerm = await ensureLocationPermission();
            if (!hasPerm) {
                setError('Platsbehörighet krävs för att spåra din position.');
                return;
            }

            // Seed an initial position for faster UX when starting the watch
            const seed = await getCurrentPositionSafe(locationOptions);
            if (seed) {
                setUserLocation(seed);
                lastLocationRef.current = { lat: seed.latitude, lng: seed.longitude };
                lastUpdateTimeRef.current = Date.now();
            }

            try {
                const watchId = Geolocation.watchPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;

                        if (!isValidLocation(latitude, longitude)) {
                            return; // silently skip
                        }

                        if (
                            shouldSkipLocationUpdate(
                                lastUpdateTimeRef.current,
                                currentTrackingState,
                                batteryLevel
                            )
                        ) {
                            return;
                        }

                        if (
                            lastLocationRef.current &&
                            !hasLocationChangedSignificantly(
                                lastLocationRef.current.lat,
                                lastLocationRef.current.lng,
                                latitude,
                                longitude,
                                locationOptions.distanceFilter
                            )
                        ) {
                            return;
                        }

                        setUserLocation({ latitude, longitude });
                        lastLocationRef.current = { lat: latitude, lng: longitude };
                        lastUpdateTimeRef.current = Date.now();

                        console.log(
                            `📍 [${currentTrackingState}] Location updated:`,
                            { latitude: latitude.toFixed(4), longitude: longitude.toFixed(4) }
                        );
                    },
                    (err) => handleLocationError(err as any),
                    {
                        ...locationOptions,
                        // Android-specific throttling knobs
                        ...(Platform.OS === 'android'
                            ? {
                                forceRequestLocation: true,
                                showLocationDialog: true,
                                interval: (locationOptions as any)?.maximumAge ?? 10000,
                                fastestInterval: Math.max(2000, Math.floor(((locationOptions as any)?.maximumAge ?? 10000) / 2)),
                            }
                            : {}),
                    } as any
                );

                watchIdRef.current = watchId as unknown as number;
                setIsTracking(true);
                setError(null);
            } catch (err: any) {
                console.error('❌ Failed to start tracking:', err?.message || err);
                setError(err?.message || 'Misslyckades att starta spårning');
            }
        })();
    }, [currentTrackingState, batteryLevel, isTracking, stopTracking, ensureLocationPermission, getCurrentPositionSafe, handleLocationError]);

    // Handle app state changes (foreground/background)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            setAppState(nextAppState);

            if (nextAppState === 'background') {
                // Background: stop tracking entirely to save battery
                stopTracking();
            } else if (nextAppState === 'active') {
                // Foreground: restart only if needed
                if (getRecommendedTrackingState(true, hasActiveTrip, isSearching || isWaitingForDriver, isSearching, isWaitingForDriver) !== LocationTrackingState.IDLE) {
                    startTracking();
                }
            }
        });

        appStateSubscriptionRef.current = subscription;

        return () => {
            subscription.remove();
        };
    }, [startTracking, stopTracking, hasActiveTrip, isSearching, isWaitingForDriver]);

    // Start/stop tracking based on state
    useEffect(() => {
        if (currentTrackingState === LocationTrackingState.IDLE) {
            stopTracking();
        } else if (!isTracking) {
            startTracking();
        }
    }, [currentTrackingState, isTracking, startTracking, stopTracking]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopTracking();
            if (appStateSubscriptionRef.current) {
                appStateSubscriptionRef.current.remove();
            }
        };
    }, [stopTracking]);

    return {
        userLocation,
        isTracking,
        error,
        batteryLevel,
    };
}
