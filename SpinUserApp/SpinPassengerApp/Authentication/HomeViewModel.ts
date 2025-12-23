import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import TRIP_STATES, { TripState } from '../src/constants/tripStates';
import socket from '../services/socket/client';
import { SocketContext } from '../context/SocketContext';

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
 * Hook för att hantera trip creation via Socket.IO och Firestore
 */
export function useTripManager(): TripManager {
  const [trip, setTrip] = useState<any | null>(null);
  const [isSendingTrip, setIsSendingTrip] = useState(false);
  const [tripStatus, setTripStatus] = useState<TripState | 'idle' | string>('idle');
  const [lastError, setLastError] = useState<string | undefined>(undefined);
  const tripUnsubscribeRef = useRef<(() => void) | null>(null);

  // Lyssna på trip uppdateringar från Firestore
  useEffect(() => {
    if (!trip?.id) {
      // Cleanup om trip försvinner
      if (tripUnsubscribeRef.current) {
        tripUnsubscribeRef.current();
        tripUnsubscribeRef.current = null;
      }
      return;
    }

    console.log(`🔥 [useTripManager] Startar Firestore listener för trip: ${trip.id}`);
    
    const unsubscribe = firestore()
      .collection('trips')
      .doc(trip.id)
      .onSnapshot(
        (docSnapshot) => {
          if (!docSnapshot.exists) {
            console.log(`⚠️ Trip ${trip.id} finns inte längre i Firestore`);
            return;
          }

          const updatedTrip = docSnapshot.data();
          const newStatus = (updatedTrip?.status || updatedTrip?.state || '').toLowerCase();
          
          console.log(`🔄 [useTripManager] Trip uppdaterad:`, {
            tripId: trip.id,
            status: newStatus,
            driverId: updatedTrip?.driverId,
          });

          // Uppdatera trip state
          setTrip({ ...updatedTrip, id: trip.id });

          // Uppdatera trip status
          switch (newStatus) {
            case 'requested':
              setTripStatus(TRIP_STATES.REQUESTED);
              break;
            case 'accepted':
              setTripStatus(TRIP_STATES.ACCEPTED);
              break;
            case 'driverarrived':
            case 'hasdriverarrived':
              setTripStatus(TRIP_STATES.DRIVER_ARRIVED);
              break;
            case 'started':
            case 'inprogress':
            case 'tripinprogress':
              setTripStatus(TRIP_STATES.IN_PROGRESS);
              break;
            case 'completed':
            case 'tripcompleted':
              setTripStatus(TRIP_STATES.COMPLETED);
              break;
            case 'cancelled':
              setTripStatus(TRIP_STATES.DRIVER_CANCELLED);
              break;
            case TRIP_STATES.PASSENGER_CANCELLED:
              setTripStatus(TRIP_STATES.PASSENGER_CANCELLED);
              break;
            default:
              setTripStatus(newStatus);
          }
        },
        (error) => {
          console.error(`❌ [useTripManager] Firestore listener error:`, error);
        }
      );

    tripUnsubscribeRef.current = unsubscribe;

    return () => {
      console.log(`🔥 [useTripManager] Stoppar Firestore listener för trip: ${trip.id}`);
      if (tripUnsubscribeRef.current) {
        tripUnsubscribeRef.current();
        tripUnsubscribeRef.current = null;
      }
    };
  }, [trip?.id]);

  const requestTrip = useCallback(async (params: TripRequestParams) => {
    try {
      console.log('🚀 [useTripManager] Skapar ny resa via Socket.IO...');
      console.log('📦 Trip parameters:', {
        passenger: params.currentUser?.uid,
        pickup: params.selectedPickupLocation?.title,
        destination: params.selectedSpinLocation?.title,
        rideType: params.rideType,
        distance: params.distanceInMeters,
      });

      setIsSendingTrip(true);
      setLastError(undefined);
      setTripStatus('creating');
      console.log('📍 [useTripManager] Status set to: creating');

      // Kontrollera socket connection
      if (!socket.connected) {
        console.log('⚠️ Socket inte ansluten, försöker ansluta...');
        const { ensureSocketConnected } = await import('../services/socket/client');
        await ensureSocketConnected();
      }

      console.log('✅ [useTripManager] Socket connected:', socket.connected);

      // Bygg tripData objekt som servern förväntar sig
      const tripData = {
        passengerUid: params.currentUser?.uid,
        passengerName: params.currentUser?.fullname || params.currentUser?.displayName || '',
        passengerPhoneNumber: params.currentUser?.phoneNumber || '',
        
        // Pickup location
        pickupLocation: params.selectedPickupLocation?.coordinate 
          ? {
              latitude: params.selectedPickupLocation.coordinate.latitude,
              longitude: params.selectedPickupLocation.coordinate.longitude,
            }
          : params.pickupCoordinate,
        pickupLocationAddress: params.selectedPickupLocation?.title || params.pickupAddress || '',
        pickupLocationName: params.selectedPickupLocation?.title || params.pickupAddress || '',
        
        // Dropoff location
        dropoffLocation: params.selectedSpinLocation?.coordinate 
          ? {
              latitude: params.selectedSpinLocation.coordinate.latitude,
              longitude: params.selectedSpinLocation.coordinate.longitude,
            }
          : params.destinationCoordinate,
        dropoffLocationAddress: params.selectedSpinLocation?.title || params.destinationAddress || '',
        dropoffLocationName: params.selectedSpinLocation?.title || params.destinationAddress || '',
        
        // Passenger location (samma som pickup i de flesta fall)
        passengerLocation: params.pickupCoordinate || params.selectedPickupLocation?.coordinate,
        
        // Trip details
        selectedRideType: params.rideType || params.selectedRideTypeId || 'Spin',
        rideType: params.rideType || params.selectedRideTypeId || 'Spin',
        tripCost: params.customRidePrice || 0,
        customPrice: params.customRidePrice,
        distanceTodropoffLocation: params.distanceInMeters || 0,
        
        // Driver note
        driverNote: params.driverNote || '',
        
        // Payment
        paymentMethod: params.paymentMethod || 'Kontant',
        paymentIntentId: params.paymentIntentId,
        stripeCustomerId: params.currentUser?.stripeCustomerId || '',
        
        // Scheduled pickup (if any)
        scheduledPickupAt: params.scheduledPickupAt,
      };

      console.log('📤 Skickar createTrip event till servern...');
      
      // Skicka till servern via Socket.IO
      socket.emit('createTrip', tripData);

      // Vänta på svar från servern
      const result = await new Promise<{ success: boolean; tripId?: string; error?: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: Ingen respons från servern efter 15 sekunder'));
        }, 15000);

        socket.once('tripCreated', (response: any) => {
          clearTimeout(timeout);
          console.log('📥 Mottog tripCreated respons:', response);
          resolve(response);
        });

        socket.once('noDriversAvailable', (data: any) => {
          clearTimeout(timeout);
          console.log('📥 Inga förare tillgängliga:', data);
          resolve({ success: false, error: 'Inga förare tillgängliga just nu' });
        });
      });

      if (!result.success || !result.tripId) {
        throw new Error(result.error || 'Kunde inte skapa resa');
      }

      console.log(`✅ Resa skapad med ID: ${result.tripId}`);
      
      // Sätt initial trip state
      const newTrip = {
        id: result.tripId,
        tripId: result.tripId,
        status: 'requested',
        state: 'requested',
        passengerUid: params.currentUser?.uid,
        pickupLocationAddress: params.selectedPickupLocation?.title || params.pickupAddress,
        dropoffLocationAddress: params.selectedSpinLocation?.title || params.destinationAddress,
      };
      
      console.log('📍 [useTripManager] Setting trip state:', newTrip);
      setTrip(newTrip);
      
      console.log('📍 [useTripManager] Status set to: searching');
      setTripStatus('searching');

      // Vänta på att antingen en förare accepterar eller timeout
      const acceptTimeout = setTimeout(() => {
        console.log('⏱️ Ingen förare accepterade inom 30 sekunder');
        setTripStatus('noDrivers');
        setLastError('Inga förare tillgängliga just nu. Försök igen om en stund.');
      }, 30000); // 30 sekunder timeout

      // Lyssna på trip:accepted event
      socket.once('trip:accepted', (acceptData: any) => {
        clearTimeout(acceptTimeout);
        console.log('🎉 Förare accepterade resan!', acceptData);
        // Trip state uppdateras via Firestore listener
      });

    } catch (error: any) {
      console.error('❌ [useTripManager] Fel vid skapande av resa:', error);
      setLastError(error?.message || 'Kunde inte skapa resa. Försök igen.');
      setTripStatus('idle');
      setTrip(null);
    } finally {
      setIsSendingTrip(false);
    }
  }, []);

  // Cleanup vid unmount
  useEffect(() => {
    return () => {
      if (tripUnsubscribeRef.current) {
        tripUnsubscribeRef.current();
        tripUnsubscribeRef.current = null;
      }
    };
  }, []);

  return {
    requestTrip,
    trip,
    isSendingTrip,
    tripStatus,
    lastError,
  };
}
