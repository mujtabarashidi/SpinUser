/**
 * Location and Battery Optimization Utilities
 * Implements efficient location tracking similar to Uber/Bolt
 * 
 * Key optimizations:
 * - Adaptive distance filters based on state
 * - Throttling of location updates
 * - Background vs foreground tracking
 * - GPS accuracy management
 * - 🔄 PHASE 5D: Offline vs on-trip geolocation optimization
 */

export enum LocationTrackingState {
    IDLE = 'idle',                    // App not active - no tracking
    SEARCHING = 'searching',          // Passenger searching for ride - low frequency
    WAITING_FOR_DRIVER = 'waiting',   // Waiting for driver to accept - low frequency
    DRIVER_ARRIVING = 'arriving',     // Driver on the way - medium frequency
    IN_TRIP = 'in_trip',              // Trip in progress - high frequency
    DRIVER_ONLINE = 'driver_online',  // Driver online and active - medium frequency
}

/**
 * 🔄 PHASE 5D: Location tracking configuration per state
 * - Offline drivers use lower accuracy to save battery (50m threshold)
 * - On-trip drivers use higher accuracy for real-time tracking (10m threshold)
 */
export const LOCATION_CONFIG = {
    [LocationTrackingState.IDLE]: {
        enabled: false,
        distanceFilter: 0,  // No tracking
        accuracy: 'any',
        updateIntervalMs: 0,
        batteryLevel: 'any',
        enableHighAccuracy: false, // 🔄 PHASE 5D: Save battery when idle
    },
    [LocationTrackingState.SEARCHING]: {
        enabled: true,
        distanceFilter: 100, // Only update every 100m
        accuracy: 'coarse',
        updateIntervalMs: 30000, // 30 seconds max
        batteryLevel: 'ok', // Skip if battery too low
        enableHighAccuracy: false, // 🔄 PHASE 5D: Battery saving
    },
    [LocationTrackingState.WAITING_FOR_DRIVER]: {
        enabled: true,
        distanceFilter: 50, // 50m movements
        accuracy: 'coarse',
        updateIntervalMs: 20000, // 20 seconds max
        batteryLevel: 'ok',
        enableHighAccuracy: false, // 🔄 PHASE 5D: Battery saving
    },
    [LocationTrackingState.DRIVER_ARRIVING]: {
        enabled: true,
        distanceFilter: 25, // 25m movements
        accuracy: 'fine',
        updateIntervalMs: 10000, // 10 seconds max
        batteryLevel: 'critical_off', // Stop if battery critically low
        enableHighAccuracy: true, // 🔄 PHASE 5D: Need accuracy for pickup
    },
    [LocationTrackingState.IN_TRIP]: {
        enabled: true,
        distanceFilter: 10, // 10m movements (accurate tracking needed)
        accuracy: 'fine',
        updateIntervalMs: 5000, // 5 seconds max
        batteryLevel: 'critical_off',
        enableHighAccuracy: true, // 🔄 PHASE 5D: Critical for navigation
    },
    [LocationTrackingState.DRIVER_ONLINE]: {
        enabled: true,
        distanceFilter: 50, // 🔄 PHASE 5D: 50m for driver position (was 20m)
        accuracy: 'coarse', // 🔄 PHASE 5D: Coarse for battery saving (was 'fine')
        updateIntervalMs: 8000, // 8 seconds max
        batteryLevel: 'critical_off',
        enableHighAccuracy: false, // 🔄 PHASE 5D: Save battery when waiting for trips
    },
};

/**
 * 🔄 PHASE 5D: Get geolocation options based on current tracking state
 * Returns null if tracking is disabled for this state
 */
export function getLocationOptions(state: LocationTrackingState) {
    const config = LOCATION_CONFIG[state];

    if (!config.enabled) {
        return null;
    }

    // 🔄 PHASE 5D: Use explicit enableHighAccuracy from config (reduces battery drain)
    return {
        enableHighAccuracy: config.enableHighAccuracy ?? (config.accuracy === 'fine'),
        distanceFilter: config.distanceFilter,
        timeout: 15000,
        maximumAge: config.updateIntervalMs,
    };
}

/**
 * Determine if location updates should be sent
 */
export function shouldSkipLocationUpdate(
    lastUpdateTime: number,
    state: LocationTrackingState,
    batteryLevel: number
): boolean {
    const config = LOCATION_CONFIG[state];

    // Skip if not enabled
    if (!config.enabled) return true;

    // Skip if battery too low
    if (config.batteryLevel === 'ok' && batteryLevel < 20) return true;
    if (config.batteryLevel === 'critical_off' && batteryLevel < 5) return true;

    // Skip if update too frequent
    const timeSinceLastUpdate = Date.now() - lastUpdateTime;
    if (timeSinceLastUpdate < config.updateIntervalMs) {
        return true;
    }

    return false;
}

/**
 * Check if location has moved significantly enough to warrant an update
 */
export function hasLocationChangedSignificantly(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
    minDistanceMeters: number
): boolean {
    // Simplified distance calculation (good enough for determining if moved)
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance >= minDistanceMeters;
}

/**
 * Simplify location data to reduce payload size
 * Store only necessary precision (reduces bandwidth and battery)
 */
export function simplifyLocationData(
    latitude: number,
    longitude: number,
    precision: number = 6 // Default: ~0.1m precision
) {
    return {
        lat: parseFloat(latitude.toFixed(precision)),
        lng: parseFloat(longitude.toFixed(precision)),
    };
}

/**
 * Check if location is valid (within Sweden approximately)
 */
export function isValidLocation(latitude: number, longitude: number): boolean {
    return (
        latitude >= 55 &&
        latitude <= 70 &&
        longitude >= 10 &&
        longitude <= 25
    );
}

/**
 * Get recommended tracking state based on app state
 */
export function getRecommendedTrackingState(
    isAppInForeground: boolean,
    hasActiveTrip: boolean,
    isDriverOnline: boolean,
    isSearching: boolean,
    isWaitingForDriver: boolean
): LocationTrackingState {
    // If app not in foreground, no tracking
    if (!isAppInForeground) {
        return LocationTrackingState.IDLE;
    }

    // Active trip - maximum tracking
    if (hasActiveTrip) {
        return LocationTrackingState.IN_TRIP;
    }

    // Driver online and active
    if (isDriverOnline) {
        return LocationTrackingState.DRIVER_ONLINE;
    }

    // Driver is arriving
    if (isWaitingForDriver) {
        return LocationTrackingState.DRIVER_ARRIVING;
    }

    // Searching for ride
    if (isSearching) {
        return LocationTrackingState.SEARCHING;
    }

    // Idle
    return LocationTrackingState.IDLE;
}

/**
 * Batch location updates to reduce socket emissions
 */
export class LocationUpdateBatcher {
    private locations: Array<{ lat: number; lng: number; timestamp: number }> = [];
    private batchIntervalMs: number;
    private maxBatchSize: number;
    private onBatch: (locations: Array<{ lat: number; lng: number; timestamp: number }>) => void;
    private batchTimer: NodeJS.Timeout | null = null;

    constructor(
        batchIntervalMs: number = 5000,
        maxBatchSize: number = 5,
        onBatch: (locations: Array<{ lat: number; lng: number; timestamp: number }>) => void = () => { }
    ) {
        this.batchIntervalMs = batchIntervalMs;
        this.maxBatchSize = maxBatchSize;
        this.onBatch = onBatch;
    }

    addLocation(lat: number, lng: number): void {
        this.locations.push({
            lat,
            lng,
            timestamp: Date.now(),
        });

        // Send batch if max size reached
        if (this.locations.length >= this.maxBatchSize) {
            this.sendBatch();
        } else if (!this.batchTimer) {
            // Schedule batch send
            this.batchTimer = setTimeout(() => {
                this.sendBatch();
            }, this.batchIntervalMs);
        }
    }

    private sendBatch(): void {
        if (this.locations.length > 0) {
            this.onBatch(this.locations);
            this.locations = [];
        }
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
    }

    clear(): void {
        this.locations = [];
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
    }
}
