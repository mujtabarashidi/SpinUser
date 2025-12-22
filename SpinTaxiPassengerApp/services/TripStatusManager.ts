import firestore from '@react-native-firebase/firestore';

/**
 * 🔔 Central Trip Status Manager
 * 
 * Professional trip status synchronization with Firebase Firestore.
 * 
 * FIREBASE DOCUMENT STRUCTURE:
 * - `state`: Canonical trip state (lowercase: "accepted", "driverarrived", "passengercancelled", etc.)
 * - `status`: UI-friendly status (PascalCase: "Accepted", "driverArrived", "passengerCancelled", etc.)
 * 
 * PRIORITY: Always use `state` field as source of truth, fallback to `status` if needed.
 * 
 * TRIP LIFECYCLE:
 * 1. requested → Passenger creates trip
 * 2. accepted → Driver accepts trip
 * 3. driverarrived → Driver arrived at pickup location
 * 4. started/inprogress → Trip is actively in progress
 * 5. completed → Trip successfully completed
 * 6. passengercancelled → Passenger cancelled the trip
 * 7. drivercancelled → Driver cancelled the trip
 */

import { TRIP_STATES } from '../src/constants/tripStates';

export type TripStatus =
    | 'requested'
    | 'accepted'
    | 'driverarrived'
    | 'started'
    | 'inprogress'
    | 'completed'
    | 'passengercancelled'
    | 'drivercancelled'
    | 'cancelled' // Generic cancellation (when cancelledBy is not specified)
    | 'unknown';

export interface TripStatusChangeEvent {
    tripId: string;
    previousStatus: TripStatus;
    newStatus: TripStatus;
    tripData: any;
    timestamp: number;
}

export interface ITripStatusManager {
    subscribe(tripId: string, callback: (event: TripStatusChangeEvent) => void): () => void;
    getCurrentStatus(tripId: string): Promise<TripStatus>;
    stopListening(tripId: string): void;
    stopAllListening(): void;
}

class TripStatusManager implements ITripStatusManager {
    private listeners = new Map<string, () => void>();
    private subscribers = new Map<string, Set<(event: TripStatusChangeEvent) => void>>();
    private statusCache = new Map<string, TripStatus>();

    /**
     * Subscribe to trip status changes
     * @param tripId Trip ID to listen to
     * @param callback Called when status changes
     * @returns Unsubscribe function
     */
    subscribe(tripId: string, callback: (event: TripStatusChangeEvent) => void): () => void {
        console.log(`🔔 [TripStatusManager] Subscribing to trip ${tripId}`);

        // Add subscriber to set
        if (!this.subscribers.has(tripId)) {
            this.subscribers.set(tripId, new Set());
            this.setupListener(tripId);
        }

        const subscribers = this.subscribers.get(tripId)!;
        subscribers.add(callback);

        // Return unsubscribe function
        return () => {
            console.log(`🔕 [TripStatusManager] Unsubscribing from trip ${tripId}`);
            subscribers.delete(callback);

            // Clean up if no more subscribers
            if (subscribers.size === 0) {
                this.stopListening(tripId);
            }
        };
    }

    /**
     * Setup Firebase listener for a trip
     * 
     * Robustly handles Firebase document changes:
     * - Prioritizes `state` field as source of truth
     * - Falls back to `status` field if `state` is missing
     * - Normalizes all variations to canonical format
     * - Tracks cancellation type (driver vs passenger)
     */
    private setupListener(tripId: string): void {
        // Stop existing listener if any
        if (this.listeners.has(tripId)) {
            this.listeners.get(tripId)!();
        }

        console.log(`🎧 [TripStatusManager] Setting up Firebase listener for trip: ${tripId}`);

        // Setup new listener
        const unsubscribe = firestore()
            .collection('trips')
            .doc(tripId)
            .onSnapshot(
                (snapshot) => {
                    if (!snapshot.exists) {
                        console.warn(`⚠️ [TripStatusManager] Trip ${tripId} does not exist or was deleted`);

                        // Notify subscribers of deletion with 'unknown' status
                        const previousStatus = this.statusCache.get(tripId) || 'unknown';
                        const event: TripStatusChangeEvent = {
                            tripId,
                            previousStatus,
                            newStatus: 'unknown',
                            tripData: null,
                            timestamp: Date.now(),
                        };

                        this.notifySubscribers(tripId, event);
                        this.statusCache.delete(tripId);
                        return;
                    }

                    const tripData = snapshot.data();

                    // PRIORITY: Use `state` field first, fallback to `status`
                    const rawState = tripData?.state || tripData?.status;
                    const cancelledBy = tripData?.cancelledBy;

                    const newStatus = this.normalizeStatus(rawState, cancelledBy);
                    const previousStatus = this.statusCache.get(tripId) || 'unknown';

                    console.log(`📊 [TripStatusManager] Trip ${tripId} Firebase data:`, {
                        state: tripData?.state,
                        status: tripData?.status,
                        cancelledBy: tripData?.cancelledBy,
                        normalized: newStatus,
                        previousStatus,
                    });

                    // Update cache
                    this.statusCache.set(tripId, newStatus);

                    // Only notify if status actually changed
                    if (previousStatus !== newStatus) {
                        console.log(`✅ [TripStatusManager] Status CHANGED: ${previousStatus} → ${newStatus}`);

                        const event: TripStatusChangeEvent = {
                            tripId,
                            previousStatus,
                            newStatus,
                            tripData,
                            timestamp: Date.now(),
                        };

                        this.notifySubscribers(tripId, event);
                    } else {
                        console.log(`📌 [TripStatusManager] Status unchanged: ${newStatus}`);
                    }
                },
                (error) => {
                    console.error(`❌ [TripStatusManager] Firestore listener error for trip ${tripId}:`, error);

                    // Notify subscribers of error
                    const previousStatus = this.statusCache.get(tripId) || 'unknown';
                    const event: TripStatusChangeEvent = {
                        tripId,
                        previousStatus,
                        newStatus: 'unknown',
                        tripData: { error: error.message },
                        timestamp: Date.now(),
                    };

                    this.notifySubscribers(tripId, event);
                }
            );

        this.listeners.set(tripId, unsubscribe);
    }

    /**
     * Notify all subscribers of a status change
     */
    private notifySubscribers(tripId: string, event: TripStatusChangeEvent): void {
        const subscribers = this.subscribers.get(tripId);
        if (!subscribers || subscribers.size === 0) {
            console.log(`ℹ️ [TripStatusManager] No subscribers for trip ${tripId}`);
            return;
        }

        console.log(`📢 [TripStatusManager] Notifying ${subscribers.size} subscriber(s) for trip ${tripId}`);

        subscribers.forEach((callback) => {
            try {
                callback(event);
            } catch (error) {
                console.error(`❌ [TripStatusManager] Error in subscriber callback:`, error);
            }
        });
    }

    /**
     * Normalize Firebase status to canonical format
     * 
     * Handles all Firebase status variations:
     * - Lowercase: "accepted", "driverarrived", "passengercancelled"
     * - PascalCase: "Accepted", "driverArrived", "passengerCancelled"
     * - Variations: "hasdriverarrived", "inprogress", "tripinprogress"
     * 
     * @param status Raw status from Firebase (`state` or `status` field)
     * @param cancelledBy Who cancelled the trip ("driver" or "passenger")
     * @returns Normalized canonical status
     */
    private normalizeStatus(status: string | undefined, cancelledBy?: string): TripStatus {
        if (!status) return 'unknown';

        // Normalize to lowercase and remove spaces/special chars
        const normalized = String(status)
            .toLowerCase()
            .trim()
            .replace(/[^a-z]/g, ''); // Remove non-alphabetic characters

        console.log(`🔄 [TripStatusManager] Normalizing status: "${status}" → "${normalized}" (cancelledBy: ${cancelledBy})`);

        // Map Firebase variations to canonical statuses
        switch (normalized) {
            // Requested state
            case 'requested':
                return 'requested';

            // Accepted state
            case 'accepted':
                return 'accepted';

            // Driver arrived variations
            case 'driverarrived':
            case 'hasdriverarrived':
                return 'driverarrived';

            // Trip started/in progress variations
            case 'started':
            case 'inprogress':
            case 'tripinprogress':
                return 'started';

            // Trip completed variations
            case 'completed':
            case 'tripcompleted':
                return 'completed';

            // Cancellation - distinguish between driver and passenger
            case TRIP_STATES.PASSENGER_CANCELLED:
                return TRIP_STATES.PASSENGER_CANCELLED;

            case TRIP_STATES.DRIVER_CANCELLED:
                return TRIP_STATES.DRIVER_CANCELLED;

            case 'cancelled':
                // Use cancelledBy to determine specific cancellation type
                if (cancelledBy) {
                    const normalizedCancelledBy = String(cancelledBy).toLowerCase();
                    if (normalizedCancelledBy === 'driver') return TRIP_STATES.DRIVER_CANCELLED;
                    if (normalizedCancelledBy === 'passenger') return TRIP_STATES.PASSENGER_CANCELLED;
                }
                // Generic cancellation if cancelledBy is not specified
                return 'cancelled';

            default:
                console.warn(`⚠️ [TripStatusManager] Unknown status: "${status}" (normalized: "${normalized}")`);
                return 'unknown';
        }
    }

    /**
     * Get current status of a trip (one-time fetch)
     * 
     * @param tripId Trip ID to fetch status for
     * @returns Current normalized status
     */
    async getCurrentStatus(tripId: string): Promise<TripStatus> {
        // Check cache first for performance
        if (this.statusCache.has(tripId)) {
            const cachedStatus = this.statusCache.get(tripId)!;
            console.log(`💾 [TripStatusManager] Using cached status for ${tripId}: ${cachedStatus}`);
            return cachedStatus;
        }

        // Fetch from Firestore if not cached
        try {
            console.log(`🔍 [TripStatusManager] Fetching current status from Firestore: ${tripId}`);

            const snapshot = await firestore().collection('trips').doc(tripId).get();

            if (!snapshot.exists) {
                console.warn(`⚠️ [TripStatusManager] Trip ${tripId} does not exist`);
                return 'unknown';
            }

            const data = snapshot.data();
            const rawState = data?.state || data?.status;
            const cancelledBy = data?.cancelledBy;

            const status = this.normalizeStatus(rawState, cancelledBy);

            console.log(`✅ [TripStatusManager] Fetched status for ${tripId}:`, {
                state: data?.state,
                status: data?.status,
                cancelledBy: data?.cancelledBy,
                normalized: status,
            });

            // Cache the result
            this.statusCache.set(tripId, status);
            return status;
        } catch (error) {
            console.error(`❌ [TripStatusManager] Error fetching status for ${tripId}:`, error);
            return 'unknown';
        }
    }

    /**
     * Stop listening to a specific trip
     */
    stopListening(tripId: string): void {
        console.log(`🛑 [TripStatusManager] Stopping listener for trip ${tripId}`);

        if (this.listeners.has(tripId)) {
            this.listeners.get(tripId)!();
            this.listeners.delete(tripId);
        }

        this.subscribers.delete(tripId);
        // IMPORTANT: Keep status cache so we don't re-notify same status
        // This prevents infinite loops when trip is set back to null and then re-set
        // The cache will be cleared when a completely new trip is created
    }

    /**
     * Stop all listeners
     */
    stopAllListening(): void {
        console.log(`🛑 [TripStatusManager] Stopping ALL listeners`);

        this.listeners.forEach((unsubscribe) => unsubscribe());
        this.listeners.clear();
        this.subscribers.clear();
        this.statusCache.clear();
    }
}

// Singleton instance
let instance: TripStatusManager | null = null;

/**
 * Get or create TripStatusManager singleton
 */
export function getTripStatusManager(): ITripStatusManager {
    if (!instance) {
        instance = new TripStatusManager();
    }
    return instance;
}

/**
 * Destroy singleton (for cleanup in tests)
 */
export function destroyTripStatusManager(): void {
    if (instance) {
        instance.stopAllListening();
        instance = null;
    }
}

export default getTripStatusManager();
