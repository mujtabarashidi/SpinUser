import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TRIP_STATES, { TripState } from '../src/constants/tripStates';

export interface TripRequestParams {
  pickupAddress?: string;
  pickupCoordinate?: { latitude: number; longitude: number };
  destinationAddress?: string;
  destinationCoordinate?: { latitude: number; longitude: number };
  rideType?: string;
  currentUser?: any;
  selectedSpinLocation?: any;
  selectedPickupLocation?: any;
  customRidePrice?: number;
  distanceInMeters?: number;
  paymentIntentId?: string;
  driverNote?: string;
  paymentMethod?: string;
  paymentOptionId?: string;
  selectedRideTypeId?: string;
  scheduledPickupAt?: Date;
}

export interface TripManager {
  requestTrip: (params: TripRequestParams) => Promise<void>;
  trip: any | null;
  isSendingTrip: boolean;
  tripStatus: TripState | 'idle' | string;
  lastError?: string;
}

/**
 * Minimal stub implementation to satisfy runtime while backend wiring is in progress.
 * It tracks a local trip state and exposes a `requestTrip` that simulates dispatch.
 */
export function useTripManager(): TripManager {
  const [trip, setTrip] = useState<any | null>(null);
  const [isSendingTrip, setIsSendingTrip] = useState(false);
  const [tripStatus, setTripStatus] = useState<TripState | 'idle' | string>('idle');
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  const requestTrip = useCallback(async (params: TripRequestParams) => {
    try {
      setIsSendingTrip(true);
      setLastError(undefined);
      // Simulate sending a request and receiving an accepted trip
      await new Promise((r) => setTimeout(r, 500));
      const mockTrip = {
        id: Math.random().toString(36).slice(2),
        pickupAddress: params.pickupAddress,
        destinationAddress: params.destinationAddress,
        state: TRIP_STATES.REQUESTED,
        status: TRIP_STATES.REQUESTED,
      };
      setTrip(mockTrip);
      setTripStatus(TRIP_STATES.REQUESTED);
    } catch (e: any) {
      setLastError(e?.message ?? 'Trip request failed');
    } finally {
      setIsSendingTrip(false);
    }
  }, []);

  // Expose the manager API
  return {
    requestTrip,
    trip,
    isSendingTrip,
    tripStatus,
    lastError,
  };
}
