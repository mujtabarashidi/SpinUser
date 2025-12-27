import firestore from '@react-native-firebase/firestore';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { SocketContext } from '../../context/SocketContext';
import TRIP_STATES, { TripState } from '../../src/constants/tripStates';
import { playArrivalChime } from '../../utils/ArrivalChime';
import { validateRating } from '../../utils/RatingValidator';
import DriverProfileSheet from '../Components/DriverProfileSheet';
import { HomeContext } from '../context/HomeContext';
import PaymentViewModel from '../Payment/PaymentViewModel';
import CancelReasonSheetView from './CancelReasonSheetView';
import DriverRatingModal from './DriverRatingModal';
import { RouteService } from '../utils/RouteService';

type Coordinate = { latitude: number; longitude: number; bearing?: number };

type TripAcceptedViewProps = {
  trip: any;
};

const AVERAGE_SPEED_KMH = 35;
const KMH_PER_MINUTE = AVERAGE_SPEED_KMH / 60;
const CANCEL_REASONS = [
  'Föraren tog för lång tid',
  'Behöver inte resa längre',
  'Fel destination',
  'Upptäckt ett annat transportmedel',
  'Annat skäl',
];

const TripAcceptedView: React.FC<TripAcceptedViewProps> = ({ trip: initialTrip }) => {
  const socket = useContext(SocketContext);
  const [trip, setTrip] = useState(initialTrip); // 🔄 Track live trip data

  const {
    setCurrentDriverLocation,
    estimatedArrivalTimeText,
    setEstimatedArrivalTimeText,
    driverETAtoPickup,
    setDriverETAtoPickup,
    estimatedArrivalDistance,
    setEstimatedArrivalDistance,
    setDestinationETA,
    setTrip: setGlobalTrip,
    // Map/route state
    pickupCoordinate: pickupCoordinateCtx,
    destinationCoordinate: destinationCoordinateCtx,
    setPickupCoordinate,
    setDestinationCoordinate,
    routePoints,
    setRoutePoints,
    setIsRouteLoading,
  } = useContext(HomeContext);

  const [showCancelReasonSheet, setShowCancelReasonSheet] = useState(false);
  const [hasDriverArrived, setHasDriverArrived] = useState(false);
  const [driverRatingAvg, setDriverRatingAvg] = useState<number | null>(null);
  const [driverRatingCount, setDriverRatingCount] = useState(0);
  const [showDriverDetailsModal, setShowDriverDetailsModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed at 40%

  const translateY = useRef(new Animated.Value(0)).current;
  const lastNotifiedStatus = useRef<string | null>(null);
  const ratingPromptedRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const cancelTypeRef = useRef<'passenger' | 'driver' | null>(null); // Spara cancel-typ

  // Theme detection and dynamic styles
  const scheme = useColorScheme();
  const isDarkMode = scheme === 'dark';
  const themeStyles = useMemo(() => ({
    // Sheet & borders (lighter glass look in dark)
    sheet: { backgroundColor: isDarkMode ? 'rgba(0, 7, 72, 0.96)' : '#fff' }, // slate-700 @ 96%
    sheetBorder: { borderWidth: 1, borderColor: isDarkMode ? 'rgba(203,213,225,0.48)' : 'rgba(0,0,0,0.06)' },

    // Headlines & meta
    headline: { color: isDarkMode ? '#FFFFFF' : '#111' },
    etaText: { color: isDarkMode ? '#F3F4F6' : '#495057' },
    distanceText: { color: isDarkMode ? '#E2E8F0' : '#6C757D' },
    separator: { backgroundColor: isDarkMode ? 'rgba(203,213,225,0.60)' : '#E9ECEF' },

    // Cards & chips
    card: { backgroundColor: isDarkMode ? 'rgba(148,163,184,0.36)' : '#E9F2FF' },
    driverAvatar: { backgroundColor: isDarkMode ? 'rgba(147,197,253,0.55)' : '#E3F2FD' },
    driverInitials: { color: isDarkMode ? '#DBEAFE' : '#1565C0' },
    driverName: { color: isDarkMode ? '#FFFFFF' : '#111' },
    driverRating: { color: isDarkMode ? '#A8B1C7' : '#6C757D' },

    paymentLabel: { color: isDarkMode ? '#F1F5F9' : '#495057' },
    paymentValue: { color: isDarkMode ? '#FFFFFF' : '#111' },

    addressLabel: { color: isDarkMode ? '#AFC1D4' : '#6C757D' },
    addressValue: { color: isDarkMode ? '#F1F5F9' : '#212529' },

    plate: { backgroundColor: isDarkMode ? 'rgba(248,250,252,0.16)' : '#fff', borderColor: isDarkMode ? '#93C5FD' : '#90CAF9' },
    plateText: { color: isDarkMode ? '#93C5FD' : '#0D47A1' },

    // ETA badge
    etaBadge: { backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.70)' : '#1976D2' },
    etaBadgeText: { color: isDarkMode ? '#EAF2FF' : '#fff' },

    // Modal
    modalSheet: { backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.98)' : '#fff' },
    modalTitle: { color: isDarkMode ? '#FFFFFF' : '#111' },
    modalLabel: { color: isDarkMode ? '#AFC1D4' : '#6C757D' },
    modalValue: { color: isDarkMode ? '#F1F5F9' : '#111' },
  }), [isDarkMode]);

  const pickupCoordinate = useMemo(() => normalizeCoordinate(trip?.pickupLocation), [trip]);
  const dropoffCoordinate = useMemo(() => normalizeCoordinate(trip?.dropoffLocation), [trip]);

  // Ensure map shows polyline from pickup → destination while TripAcceptedView is visible
  useEffect(() => {
    // Ensure HomeContext has pickup/destination so SpinMapView can show markers
    const from = pickupCoordinateCtx ?? normalizeCoordinate(trip?.pickupLocation);
    const to = destinationCoordinateCtx ?? normalizeCoordinate(trip?.dropoffLocation);
    if (from && (!pickupCoordinateCtx || (Math.abs(pickupCoordinateCtx.latitude - from.latitude) > 1e-6 || Math.abs(pickupCoordinateCtx.longitude - from.longitude) > 1e-6))) {
      setPickupCoordinate?.(from as any);
    }
    if (to && (!destinationCoordinateCtx || (Math.abs(destinationCoordinateCtx.latitude - to.latitude) > 1e-6 || Math.abs(destinationCoordinateCtx.longitude - to.longitude) > 1e-6))) {
      setDestinationCoordinate?.(to as any);
    }

    const fetchAndDrawRoute = async () => {
      try {
        const from = pickupCoordinateCtx ?? normalizeCoordinate(trip?.pickupLocation);
        const to = destinationCoordinateCtx ?? normalizeCoordinate(trip?.dropoffLocation);
        if (!from || !to) return;
        if (Array.isArray(routePoints) && routePoints.length > 0) return; // already drawn
        setIsRouteLoading?.(true);
        const pts = await RouteService.getRoute(from, to);
        setRoutePoints?.(pts as any);
      } catch (e) {
        // noop – SpinMapView has fallbacks
      } finally {
        setIsRouteLoading?.(false);
      }
    };
    fetchAndDrawRoute();
  }, [pickupCoordinateCtx, destinationCoordinateCtx, routePoints, setRoutePoints, setIsRouteLoading, trip?.pickupLocation, trip?.dropoffLocation]);

  const updateDriverLocation = useCallback(
    (coordinate: Coordinate | null) => {
      if (!coordinate) {
        return;
      }
      setCurrentDriverLocation(coordinate);
      if (pickupCoordinate) {
        const distanceMeters = calculateDistanceMeters(coordinate, pickupCoordinate);
        setEstimatedArrivalDistance(distanceMeters);
        const eta = Math.max(1, Math.round(distanceMeters / 1000 / KMH_PER_MINUTE));
        setDriverETAtoPickup(eta);
        setEstimatedArrivalTimeText(`${eta} min`);
      }
    },
    [
      pickupCoordinate,
      setCurrentDriverLocation,
      setDriverETAtoPickup,
      setEstimatedArrivalDistance,
      setEstimatedArrivalTimeText,
    ],
  );

  const handleDriverLocationUpdate = useCallback(
    (payload: any) => {
      const lat = Number(payload?.lat ?? payload?.latitude);
      const lng = Number(payload?.lng ?? payload?.longitude);
      const bearing = Number(payload?.bearing);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }
      const coord: Coordinate = {
        latitude: lat,
        longitude: lng,
        ...(Number.isFinite(bearing) ? { bearing } : {}),
      };
      updateDriverLocation(coord);
    },
    [updateDriverLocation],
  );

  // 🔄 CONSOLIDATED: Real-time listener for trip info + status updates
  // Single source of truth for trip document updates (eliminates duplicate listeners)
  useEffect(() => {
    if (!trip?.id) return;

    console.log(`🔍 [TripAcceptedView] Setting up consolidated real-time listener for trip: ${trip.id}`);

    const unsubscribe = firestore()
      .collection('trips')
      .doc(trip.id)
      .onSnapshot(
        (snapshot) => {
          if (!snapshot.exists || !snapshot.data()) {
            // Dokumentet saknas. Använd cancelTypeRef för att veta vem som avbokade
            const cancelType = cancelTypeRef.current || 'driver';

            console.warn(`⚠️ [TripAcceptedView] Trip document not found (${cancelType} cancel): ${trip.id}`);

            // Om redan passengercancelled, UI behöver inte uppdateras igen (redan gjort i handleCancelTrip)
            if (cancelType === 'passenger') {
              console.log(`✅ [TripAcceptedView] Trip already marked passengercancelled - UI already updated`);
              return;
            }

            // Annars är det driver-cancelled - uppdatera UI
            setTrip((prevTrip: any) => {
              if (!prevTrip) return prevTrip;
              return {
                ...prevTrip,
                state: TRIP_STATES.DRIVER_CANCELLED,
                status: TRIP_STATES.DRIVER_CANCELLED,
              };
            });

            setGlobalTrip((prevTrip: any) => {
              if (!prevTrip) return prevTrip;
              return {
                ...prevTrip,
                state: TRIP_STATES.DRIVER_CANCELLED,
                status: TRIP_STATES.DRIVER_CANCELLED,
              };
            });

            setShowCancelReasonSheet(false);
            return;
          }

          const liveTrip = snapshot.data();

          // 1️⃣ Update all trip info, but PRESERVE socket-provided driver info
          // (socket:trip:accepted provides driver info faster than Firestore)
          setTrip((prevTrip: any) => {
            // Fields that should come from Firestore (not from socket)
            const firestoreOnlyFields = {
              status: liveTrip?.status,
              state: liveTrip?.state,
              estimatedArrivalTime: liveTrip?.estimatedArrivalTime,
              driverLocation: liveTrip?.driverLocation,
              driverRating: liveTrip?.driverRating,
              passengercancelReason: liveTrip?.passengercancelReason,
              cancelSource: liveTrip?.cancelSource,
              cancelledAt: liveTrip?.cancelledAt,
              completedAt: liveTrip?.completedAt,
            };

            // 🟢 VIKTIGT: Om Firestore har driverSnapshot, använd den som fallback
            // Detta hanterar fallet där socket-eventet missades
            const driverSnapshot = liveTrip?.driverSnapshot;
            const socketProvidedFields: any = {};

            // Använd socket-data om tillgänglig, annars fallback till Firestore eller driverSnapshot
            if (prevTrip?.driverName) {
              socketProvidedFields.driverName = prevTrip.driverName;
            } else if (driverSnapshot?.name) {
              socketProvidedFields.driverName = driverSnapshot.name;
            } else if (liveTrip?.driverName) {
              socketProvidedFields.driverName = liveTrip.driverName;
            }

            if (prevTrip?.driverPhoneNumber) {
              socketProvidedFields.driverPhoneNumber = prevTrip.driverPhoneNumber;
            } else if (driverSnapshot?.phone) {
              socketProvidedFields.driverPhoneNumber = driverSnapshot.phone;
            } else if (liveTrip?.driverPhoneNumber) {
              socketProvidedFields.driverPhoneNumber = liveTrip.driverPhoneNumber;
            }

            if (prevTrip?.driverImageUrl) {
              socketProvidedFields.driverImageUrl = prevTrip.driverImageUrl;
            } else if (driverSnapshot?.photoUrl) {
              socketProvidedFields.driverImageUrl = driverSnapshot.photoUrl;
            } else if (liveTrip?.driverImageUrl) {
              socketProvidedFields.driverImageUrl = liveTrip.driverImageUrl;
            }

            if (prevTrip?.carDetails) {
              socketProvidedFields.carDetails = prevTrip.carDetails;
            } else if (driverSnapshot?.vehicle) {
              socketProvidedFields.carDetails = {
                brand: driverSnapshot.vehicle.brand || '',
                model: driverSnapshot.vehicle.model || '',
                color: driverSnapshot.vehicle.color || '',
                registration: driverSnapshot.vehicle.licensePlate || '',
              };
            } else if (liveTrip?.carDetails) {
              socketProvidedFields.carDetails = liveTrip.carDetails;
            }

            return {
              ...prevTrip,
              ...liveTrip,
              ...firestoreOnlyFields,
              ...socketProvidedFields,
            };
          });

          console.log(`✅ [TripAcceptedView] Trip updated:`, {
            driverName: liveTrip?.driverName || liveTrip?.driverSnapshot?.name,
            driverPhone: liveTrip?.driverPhoneNumber || liveTrip?.driverSnapshot?.phone,
            carBrand: liveTrip?.carDetails?.brand || liveTrip?.driverSnapshot?.vehicle?.brand,
            carModel: liveTrip?.carDetails?.model || liveTrip?.driverSnapshot?.vehicle?.model,
            registration: liveTrip?.carDetails?.registration || liveTrip?.driverSnapshot?.vehicle?.licensePlate,
            status: liveTrip?.status,
          });

          // 2️⃣ Handle status changes (consolidated from observeTripStatus)
          const rawStatus = String(liveTrip?.status || liveTrip?.state || '').toLowerCase();
          if (rawStatus && rawStatus !== lastNotifiedStatus.current) {
            lastNotifiedStatus.current = rawStatus;

            const driverAlreadyRated =
              typeof liveTrip?.driverRating === 'number' && liveTrip.driverRating > 0;

            switch (true) {
              case ['driverarrived', 'hasdriverarrived'].includes(rawStatus):
                setHasDriverArrived(true);
                // Play a short chime once when driver arrives
                try { playArrivalChime(); } catch { }
                Alert.alert('Din förare är här', 'Föraren har anlänt till upphämtningsplatsen.');
                break;
              case ['completed', 'tripcompleted'].includes(rawStatus):
                setDestinationETA(null);
                {
                  const shouldPromptRating = !driverAlreadyRated && !ratingPromptedRef.current;
                  if (shouldPromptRating) {
                    ratingPromptedRef.current = true;
                    setShowRatingModal(true);
                  } else {
                    ratingPromptedRef.current = true;
                  }
                }
                break;
              case [TRIP_STATES.DRIVER_CANCELLED, 'cancelled'].includes(rawStatus as TripState):
                setShowCancelReasonSheet(false);
                // Ensure Stripe reservation is released if driver cancels
                try {
                  const pid = (liveTrip?.paymentIntentId || (trip as any)?.paymentIntentId) as string | undefined;
                  const method = String(liveTrip?.paymentMethod || (trip as any)?.paymentMethod || '').toLowerCase();
                  const prepaid = Boolean(pid) && method !== 'kontant' && method !== 'cash';
                  if (prepaid && typeof pid === 'string') {
                    console.log('🔓 [TripAcceptedView] Releasing reserved Stripe payment due to driver cancel…', pid);
                    PaymentViewModel
                      .releaseReservedPayment(pid, 'driver_cancelled', trip?.id)
                      .then((ok) => console.log(ok ? '✅ [TripAcceptedView] Stripe reservation released' : '⚠️ [TripAcceptedView] Failed to release Stripe reservation'))
                      .catch((e) => console.warn('⚠️ [TripAcceptedView] Error releasing Stripe reservation (driver cancel):', e));
                  }
                } catch (e) {
                  console.warn('⚠️ [TripAcceptedView] Failed to evaluate Stripe release on driver cancel:', e);
                }
                // Uppdatera global state så HomeScreen reagerar
                setGlobalTrip((prevTrip: any) => (prevTrip ? { ...prevTrip, ...liveTrip } : prevTrip));
                // Låt HomeScreen visa central avboknings-alert. Ingen extra Alert här för att undvika dubbletter.
                break;
              case rawStatus === TRIP_STATES.PASSENGER_CANCELLED:
                // Uppdatera global state så HomeScreen reagerar på passenger cancel
                setGlobalTrip((prevTrip: any) => (prevTrip ? { ...prevTrip, ...liveTrip } : prevTrip));
                // HomeScreen hanterar denna status - stäng bara sheet
                setShowCancelReasonSheet(false);
                break;
              default:
                break;
            }
          }
        },
        (error) => {
          console.error(`❌ [TripAcceptedView] Real-time listener error:`, error);
        }
      );

    return () => {
      console.log(`🔌 [TripAcceptedView] Unsubscribing from consolidated trip listener`);
      unsubscribe();
    };
  }, [trip?.id, setGlobalTrip]);


  const fetchDriverRating = useCallback(() => {
    const driverUid = trip?.driverUid;
    if (!driverUid) {
      return;
    }
    firestore()
      .collection('drivers')
      .doc(driverUid)
      .get()
      .then(snapshot => {
        const ratings = snapshot.data()?.ratings;
        if (!ratings) {
          return;
        }
        let avg = ratings.avg;
        const count = ratings.count;
        // Validate and clamp rating to max 5 stars
        if (typeof avg === 'number') {
          avg = validateRating(avg);
          setDriverRatingAvg(avg);
        }
        if (typeof count === 'number') {
          setDriverRatingCount(count);
        }
      })
      .catch(error => {
        console.warn('Kunde inte hämta driver rating:', error);
      });
  }, [trip?.driverUid]);

  const handleCancelTrip = useCallback(
    async (reason: string) => {
      if (!trip?.id) {
        return;
      }

      const currentStatus = String(trip?.state || trip?.status || '').toLowerCase();
      if ([TRIP_STATES.DRIVER_CANCELLED, 'cancelled'].includes(currentStatus as TripState)) {
        setShowCancelReasonSheet(false);
        Alert.alert('Resan är redan avbokad', 'Föraren har redan avbrutit resan.');
        return;
      }

      try {
        setShowCancelReasonSheet(false);
        cancelTypeRef.current = 'passenger';

        // 1️⃣ OPTIMISTIC UI UPDATE - Uppdatera lokalt FÖRST för snabb feedback
        const cancelledTrip = {
          ...trip,
          state: TRIP_STATES.PASSENGER_CANCELLED,
          status: TRIP_STATES.PASSENGER_CANCELLED,
          passengerCancelReason: reason,
        };

        setTrip(cancelledTrip);
        setGlobalTrip(cancelledTrip);
        console.log('✅ [TripAcceptedView] Optimistic UI update - trip marked as cancelled locally');

        // 2️⃣ STRIPE - Release reservation if prepaid
        try {
          const paymentIntentId = trip?.paymentIntentId as string | undefined;
          const method = String(trip?.paymentMethod || '').toLowerCase();
          const isPrepaid = Boolean(paymentIntentId) && method !== 'kontant' && method !== 'cash';
          if (isPrepaid && typeof paymentIntentId === 'string') {
            console.log('🔓 [TripAcceptedView] Releasing reserved Stripe payment due to passenger cancel…', paymentIntentId);
            const ok = await PaymentViewModel.releaseReservedPayment(paymentIntentId, 'passenger_cancelled', trip?.id);
            console.log(ok ? '✅ [TripAcceptedView] Stripe reservation released' : '⚠️ [TripAcceptedView] Failed to release Stripe reservation');
          }
        } catch (err) {
          console.warn('⚠️ [TripAcceptedView] Error while releasing Stripe reservation on cancel:', err);
        }

        // 3️⃣ FIRESTORE + ARCHIVE + DELETE - Allt i en batch för consistency (matchar Server-logiken)
        try {
          const tripRef = firestore().collection('trips').doc(trip.id);
          const tripSnapshot = await tripRef.get();

          if (tripSnapshot.exists()) {
            const tripData = tripSnapshot.data();

            // ✅ Arkivera till deleted_trips INNAN vi raderar (matchar server socket.js)
            await firestore()
              .collection('deleted_trips')
              .doc(trip.id)
              .set({
                ...tripData,
                state: TRIP_STATES.PASSENGER_CANCELLED,
                status: TRIP_STATES.PASSENGER_CANCELLED,
                cancelledBy: 'passenger',
                passengerCancelReason: reason,
                cancelledAt: firestore.FieldValue.serverTimestamp(),
                deletedAt: firestore.FieldValue.serverTimestamp(),
              });
            console.log('✅ Trip archived to deleted_trips');

            // ✅ RADERA från trips collection omedelbar (matchar server socket.js)
            await tripRef.delete();
            console.log('✅ Trip deleted from trips collection immediately');
          } else {
            console.warn('⚠️ Trip document not found - driver may have cancelled already');
          }
        } catch (err: any) {
          const errorCode = String(err?.code || err?.message || '').toLowerCase();
          // Om dokumentet inte finns, det är ok - föraren kan ha avbokat redan
          if (!errorCode.includes('not-found') && !errorCode.includes('firestore/not-found')) {
            throw err;
          }
          console.warn('⚠️ Trip document not found during archive - driver may have cancelled already');
        }

        // 4️⃣ SOCKET - Notifiera förare och backend (matchar server logiken)
        try {
          socket?.emit('passengerCancelledTrip', {
            tripId: trip.id,
            passengerId: trip.passengerUid,
            reason: reason,
          });
          console.log('✅ Passenger cancellation event sent to backend');
        } catch (socketErr) {
          console.warn('⚠️ Failed to send socket event:', socketErr);
        }

      } catch (error: any) {
        const errorCode = String(error?.code || error?.message || '').toLowerCase();

        // Kontrollera om dokumentet redan är borttaget (förare avbokade)
        if (errorCode.includes('not-found') || errorCode.includes('firestore/not-found')) {
          console.warn('⚠️ [TripAcceptedView] Trip already deleted by driver - treating as driver cancellation');

          // UI redan uppdaterad optimistically, bara log detta
          // Skicka socket-event för att notifiera backend om passageraravbokningsförsök
          try {
            socket?.emit('passengerCancelledTrip', {
              tripId: trip.id,
              passengerId: trip.passengerUid,
              reason: reason,
            });
            console.log('✅ Passenger cancellation event sent to backend');
          } catch (socketErr) {
            console.warn('⚠️ Failed to send socket event:', socketErr);
          }

          Alert.alert('Resan är redan avbokad', 'Föraren avbokade redan denna resa.');
          return;
        }

        // Rollback optimistic UI update on error
        setTrip(trip);
        setGlobalTrip(trip);
        console.error('❌ [TripAcceptedView] Cancellation failed, rolled back UI:', error);

        Alert.alert('Kunde inte avboka', error?.message ?? 'Försök igen om en liten stund.');
      }
    },
    [trip, setGlobalTrip, socket],
  );

  const callDriver = useCallback(() => {
    const number =
      trip?.driverPhoneNumber ||
      trip?.driverPhone ||
      trip?.phoneNumber ||
      trip?.passengerPhoneNumber;
    if (!number) {
      Alert.alert('Kan inte ringa', 'Telefonnummer saknas.');
      return;
    }
    const telUrl = `tel://${number}`;
    Linking.canOpenURL(telUrl)
      .then(canOpen => {
        if (canOpen) {
          Linking.openURL(telUrl);
        } else {
          Alert.alert('Kan inte ringa', 'Den här enheten stöder inte telefonsamtal.');
        }
      })
      .catch(() => {
        Alert.alert('Kan inte ringa', 'Ett fel inträffade när samtalet skulle initieras.');
      });
  }, [trip]);

  const handleCloseRating = useCallback(() => {
    ratingPromptedRef.current = true;
    setShowRatingModal(false);
  }, []);

  const handleRatingSubmitted = useCallback(() => {
    ratingPromptedRef.current = true;
    setShowRatingModal(false);
    Alert.alert('Tack!', 'Ditt omdöme har sparats.');
    fetchDriverRating();
  }, [fetchDriverRating]);

  // Combined rating management: fetch rating and handle modal visibility
  useEffect(() => {
    if (!trip?.id) {
      ratingPromptedRef.current = false;
      setShowRatingModal(false);
      return;
    }

    // Fetch driver rating
    fetchDriverRating();

    // Check if already rated and update modal
    const alreadyRated = typeof trip?.driverRating === 'number' && trip.driverRating > 0;
    if (alreadyRated) {
      ratingPromptedRef.current = true;
      setShowRatingModal(false);
    }
  }, [trip?.id, trip?.driverRating, fetchDriverRating]);


  // Listen to server ETA updates within the trip room
  useEffect(() => {
    const handleEta = (payload: any) => {
      if (!payload || String(payload.tripId) !== String(trip?.id)) return;
      const etaNum = Number(payload.eta);
      if (Number.isFinite(etaNum)) {
        setDriverETAtoPickup(etaNum);
        setEstimatedArrivalTimeText(`${etaNum} min`);
      }
    };
    socket.on('eta-update', handleEta);
    return () => {
      socket.off('eta-update', handleEta);
    };
  }, [socket, trip?.id, setDriverETAtoPickup, setEstimatedArrivalTimeText]);

  useEffect(() => {
    if (pickupCoordinate && dropoffCoordinate) {
      const distanceKm = RouteDistanceKm(pickupCoordinate, dropoffCoordinate);
      const eta = Math.max(1, Math.round(distanceKm / KMH_PER_MINUTE));
      setDestinationETA(eta);
    }
  }, [pickupCoordinate, dropoffCoordinate, setDestinationETA]);

  useEffect(() => {
    const initialDriver = normalizeCoordinate(trip?.driverLocation);
    if (initialDriver) {
      updateDriverLocation(initialDriver);
    }
  }, [trip?.driverLocation, updateDriverLocation]);

  useEffect(() => {
    if (!trip?.id) {
      return;
    }
    const eventName = `trip:${trip.id}:driverLocation`;
    socket.on(eventName, handleDriverLocationUpdate);
    return () => {
      socket.off(eventName, handleDriverLocationUpdate);
    };
  }, [handleDriverLocationUpdate, socket, trip?.id]);

  // 🔥 Lyssna på trip:accepted för att omedelbart få förarinfo från servern
  // Denna lyssnare startar direkt när komponenten monteras (använder initialTrip.id)
  // för att fånga trip:accepted-eventet så snart det skickas från servern
  useEffect(() => {
    if (!initialTrip?.id || !initialTrip?.passengerUid) return;

    // 🔥 VIKTIGT: Anslut omedelbar till trip-rummet när komponenten monteras
    // Detta säkerställer att vi tar emot trip:accepted-eventet från servern
    // OCH triggar servern att skicka om eventet om trippen redan är accepted
    console.log(`📍 [TripAcceptedView] Ansluter till trip-rum för tripId: ${initialTrip.id}`);
    socket.emit('passengerJoinTrip', {
      passengerId: initialTrip.passengerUid,
      tripId: initialTrip.id,
    });

    const handleTripAccepted = (payload: any) => {
      console.log('🎉 [TripAcceptedView] trip:accepted event mottagen:', payload);

      // Uppdatera trip med förarinfo från servern
      setTrip((prevTrip: any) => {
        const updated = { ...prevTrip };

        if (payload.driverSnapshot) {
          updated.driverName = payload.driverSnapshot.name || prevTrip?.driverName;
          updated.driverPhoneNumber = payload.driverSnapshot.phone || prevTrip?.driverPhoneNumber;
          updated.driverImageUrl = payload.driverSnapshot.photoUrl || prevTrip?.driverImageUrl;

          if (payload.driverSnapshot.vehicle) {
            updated.carDetails = {
              brand: payload.driverSnapshot.vehicle.brand || '',
              model: payload.driverSnapshot.vehicle.model || '',
              color: payload.driverSnapshot.vehicle.color || '',
              registration: payload.driverSnapshot.vehicle.licensePlate || '',
            };
          }
        }

        // Fallback till toppnivå-fält om driverSnapshot saknas
        if (payload.driverName) updated.driverName = payload.driverName;
        if (payload.carDetails) updated.carDetails = payload.carDetails;
        if (payload.driverId) updated.driverUid = payload.driverId;

        console.log('✅ [TripAcceptedView] Trip uppdaterad med förarinfo från socket:', {
          driverName: updated.driverName,
          carBrand: updated.carDetails?.brand,
          carModel: updated.carDetails?.model,
          registration: updated.carDetails?.registration,
        });

        return updated;
      });
    };

    // Lyssna på globalt `trip:accepted` - servern skickar dit för alla i trip-rummet
    socket.on('trip:accepted', handleTripAccepted);

    return () => {
      socket.off('trip:accepted', handleTripAccepted);
    };
  }, [socket, initialTrip?.id, initialTrip?.passengerUid]);

  const etaText = useMemo(() => {
    if (hasDriverArrived) {
      return 'Din förare är framme';
    }
    if (estimatedArrivalTimeText) {
      return `Beräknad ankomst: ${estimatedArrivalTimeText}`;
    }
    return 'Beräknar ankomsttid...';
  }, [estimatedArrivalTimeText, hasDriverArrived]);

  const distanceText = useMemo(() => {
    if (typeof estimatedArrivalDistance === 'number') {
      return `• ${formatDistance(estimatedArrivalDistance)}`;
    }
    return null;
  }, [estimatedArrivalDistance]);

  const tripCostText = useMemo(() => formatCurrency(trip?.tripCost), [trip?.tripCost]);

  const toggleExpand = useCallback((expand: boolean) => {
    setIsExpanded(expand);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    if (expand) {
      // Scroll to top when expanding
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    }
  }, [translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only respond to significant vertical movement
          return Math.abs(gestureState.dy) > 5;
        },
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderMove: (_, gestureState) => {
          // Allow dragging up (negative dy) and down (positive dy)
          const newValue = gestureState.dy;

          if (isExpanded) {
            // When expanded, only allow dragging down
            if (newValue > 0) {
              translateY.setValue(newValue);
            }
          } else {
            // When collapsed, only allow dragging up
            if (newValue < 0) {
              translateY.setValue(newValue);
            }
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const threshold = 50; // pixels to trigger expand/collapse

          if (isExpanded) {
            // If dragged down past threshold, collapse
            if (gestureState.dy > threshold) {
              toggleExpand(false);
            } else {
              // Spring back to expanded position
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
              }).start();
            }
          } else {
            // If dragged up past threshold, expand
            if (gestureState.dy < -threshold) {
              toggleExpand(true);
            } else {
              // Spring back to collapsed position
              Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
              }).start();
            }
          }
        },
      }),
    [isExpanded, translateY, toggleExpand]
  );

  return (
    <>
      <View
        style={[styles.wrapper, isExpanded && styles.wrapperExpanded]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => false}
      >
        <View
          style={[
            styles.sheet,
            themeStyles.sheet,
            themeStyles.sheetBorder,
            isExpanded && styles.sheetExpanded,
          ]}
        >
          {/* Grabber - draggable handle */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.grabber,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.grabberHandle} />
            <Text style={styles.grabberHint}>
              {isExpanded ? 'Dra ner' : 'Dra upp för mer info'}
            </Text>
          </Animated.View>

          <ScrollView
            ref={scrollViewRef}
            style={[styles.scrollContent, !isExpanded && styles.scrollContentCollapsed]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={isExpanded}
            bounces={isExpanded}
          >
            {/* Header with icon */}
            <View style={styles.headerSection}>
              <View style={styles.headerIconContainer}>
                <Text style={styles.headerIcon}>{hasDriverArrived ? '✨' : '🚗'}</Text>
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headline, themeStyles.headline]}>
                  {hasDriverArrived ? 'Föraren är här!' : 'Din förare är på väg'}
                </Text>
                <View style={styles.etaRow}>
                  <Text style={[styles.etaText, themeStyles.etaText]}>{etaText}</Text>
                  {distanceText && <Text style={[styles.distanceText, themeStyles.distanceText]}>{distanceText}</Text>}
                </View>
              </View>
            </View>

            {/* Compact car details inline */}
            <CarDetailsInline
              brand={trip?.carDetails?.brand}
              model={trip?.carDetails?.model}
              registration={trip?.carDetails?.registration}
              color={trip?.carDetails?.color}
              themeStyles={themeStyles}
            />

            <View style={[styles.separator, themeStyles.separator]} />

            {/* Driver Info - moved to top for better UX */}
            <DriverInfoSection
              name={trip?.driverName}
              imageUrl={trip?.driverImageUrl}
              rating={driverRatingAvg}
              ratingCount={driverRatingCount}
              onPress={() => setShowDriverDetailsModal(true)}
              onCall={callDriver}
              themeStyles={themeStyles}
            />

            {/* Expanded content - only visible when expanded */}
            {isExpanded && (
              <>
                <View style={[styles.separator, themeStyles.separator]} />

                {/* Trip Details in Cards */}
                <View style={styles.tripDetailsContainer}>
                  {/* Pickup Address Card */}
                  <View style={[styles.addressCard, themeStyles.card]}>
                    <View style={styles.addressCardHeader}>
                      <View style={styles.iconCircle}>
                        <Text style={styles.pickupIcon}>📍</Text>
                      </View>
                      <View style={styles.addressCardContent}>
                        <Text style={[styles.addressCardLabel, themeStyles.addressLabel]}>Upphämtning</Text>
                        <Text style={[styles.addressCardValue, themeStyles.addressValue]} numberOfLines={2}>
                          {trip?.pickupLocationAddress || 'Okänd adress'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Destination Address Card */}
                  <View style={[styles.addressCard, themeStyles.card]}>
                    <View style={styles.addressCardHeader}>
                      <View style={styles.iconCircle}>
                        <Text style={styles.destinationIcon}>🎯</Text>
                      </View>
                      <View style={styles.addressCardContent}>
                        <Text style={[styles.addressCardLabel, themeStyles.addressLabel]}>Destination</Text>
                        <Text style={[styles.addressCardValue, themeStyles.addressValue]} numberOfLines={2}>
                          {trip?.dropoffLocationAddress || 'Okänd adress'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Payment Card */}
                  <View style={[styles.addressCard, themeStyles.card]}>
                    <View style={styles.addressCardHeader}>
                      <View style={styles.iconCircle}>
                        <Text style={styles.paymentIcon}>
                          {trip?.paymentMethod?.toLowerCase() === 'kontant' || trip?.paymentMethod?.toLowerCase() === 'cash' ? '💵' : '💳'}
                        </Text>
                      </View>
                      <View style={styles.addressCardContent}>
                        <Text style={[styles.addressCardLabel, themeStyles.addressLabel]}>Betalning</Text>
                        <View style={styles.paymentRowInCard}>
                          <Text style={[styles.addressCardValue, themeStyles.addressValue]}>
                            {trip?.paymentMethod || 'Okänd'}
                          </Text>
                          <Text style={[styles.priceInCard, themeStyles.paymentValue]}>{tripCostText || '—'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Cancel button - discrete link style at bottom */}
                <View style={styles.cancelSection}>
                  <TouchableOpacity
                    onPress={() => setShowCancelReasonSheet(true)}
                    activeOpacity={0.6}
                    style={styles.cancelLink}
                  >
                    <Text style={styles.cancelLinkText}>Avboka resa</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>

      <CancelReasonSheetView
        visible={showCancelReasonSheet}
        hasDriverArrived={hasDriverArrived}
        onClose={() => setShowCancelReasonSheet(false)}
        onReasonSelected={handleCancelTrip}
        reasons={CANCEL_REASONS}
      />

      <DriverProfileSheet
        visible={showDriverDetailsModal}
        onClose={() => setShowDriverDetailsModal(false)}
        trip={trip}
      />

      <DriverRatingModal
        visible={showRatingModal}
        trip={trip}
        onClose={handleCloseRating}
        onSubmitted={handleRatingSubmitted}
      />
    </>
  );
};

type DriverInfoProps = {
  name?: string;
  imageUrl?: string;
  rating: number | null;
  ratingCount: number;
  onPress: () => void;
  onCall: () => void;
  themeStyles?: any;
};

const DriverInfoSection: React.FC<DriverInfoProps> = ({
  name,
  imageUrl,
  rating,
  ratingCount,
  onPress,
  onCall,
  themeStyles = {},
}) => (
  <View style={styles.driverRow}>
    <TouchableOpacity style={styles.driverInfo} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.driverAvatar, themeStyles.driverAvatar]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.driverAvatarImage}
          />
        ) : (
          <Text style={[styles.driverInitials, themeStyles.driverInitials]}>{initialsFromName(name)}</Text>
        )}
      </View>
      <View style={styles.driverTextContainer}>
        <Text style={[styles.driverName, themeStyles.driverName]}>{name || 'Din förare'}</Text>
        <View style={styles.ratingContainer}>
          <Text style={[styles.driverRating, themeStyles.driverRating]}>
            {rating ? `⭐ ${rating.toFixed(1)}` : '⭐ Nytt'}
          </Text>
          {ratingCount > 0 && (
            <Text style={[styles.ratingCount, themeStyles.driverRating]}>
              ({ratingCount} omdömen)
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
    <TouchableOpacity style={styles.callButton} onPress={onCall} activeOpacity={0.8}>
      <Text style={styles.callButtonIcon}>📞</Text>
      <Text style={styles.callButtonText}>Ring</Text>
    </TouchableOpacity>
  </View>
);

const LicensePlateView: React.FC<{ registration?: string; themeStyles?: any }> = ({ registration, themeStyles = {} }) => {
  if (!registration) return null;
  return (
    <View style={[styles.plate, themeStyles.plate]}>
      <Text style={[styles.plateText, themeStyles.plateText]}>{registration.toUpperCase()}</Text>
    </View>
  );
};

type CarDetailsInlineProps = {
  brand?: string;
  model?: string;
  registration?: string;
  color?: string;
  themeStyles?: any;
};

const CarDetailsInline: React.FC<CarDetailsInlineProps> = ({
  brand,
  model,
  registration,
  color,
  themeStyles = {},
}) => {
  const hasMain = Boolean(brand || model);
  const hasReg = Boolean(registration);
  if (!hasMain && !hasReg) return null;

  const title = `${brand ?? ''} ${model ?? ''}`.trim() || 'Bil';

  return (
    <View style={styles.carInlineRow}>
      {hasMain && (
        <Text style={[styles.carInlineText, themeStyles.addressValue]} numberOfLines={1}>
          {title}{color ? ` · ${color}` : ''}
        </Text>
      )}
      {hasReg && (
        <View style={[styles.carInlinePlate, themeStyles.plate]}>
          <Text style={[styles.carInlinePlateText, themeStyles.plateText]}>
            {registration!.toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
};

function formatDistance(meters: number) {
  if (meters >= 500) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatCurrency(value?: number) {
  if (typeof value !== 'number') {
    return '—';
  }
  return `${Math.round(value)} kr`;
}

function initialsFromName(name?: string) {
  if (!name) {
    return '🎯';
  }
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
}

function normalizeCoordinate(value: any): Coordinate | null {
  if (!value) {
    return null;
  }
  const lat =
    value.latitude ??
    value.lat ??
    value._latitude ??
    (Array.isArray(value) ? value[0] : undefined);
  const lng =
    value.longitude ??
    value.lng ??
    value._longitude ??
    value._long ??
    (Array.isArray(value) ? value[1] : undefined);
  const bearing = value.bearing ?? value.heading;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const coord: Coordinate = { latitude: Number(lat), longitude: Number(lng) };
  if (Number.isFinite(bearing)) {
    coord.bearing = Number(bearing);
  }
  return coord;
}

function calculateDistanceMeters(from: Coordinate, to: Coordinate) {
  const R = 6371e3;
  const φ1 = toRadians(from.latitude);
  const φ2 = toRadians(to.latitude);
  const Δφ = toRadians(to.latitude - from.latitude);
  const Δλ = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function RouteDistanceKm(from: Coordinate, to: Coordinate) {
  return calculateDistanceMeters(from, to) / 1000;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  wrapperExpanded: {
    paddingTop: 20,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 8,
    maxHeight: SCREEN_HEIGHT * 0.4, // 40% of screen height (collapsed)
  },
  sheetExpanded: {
    borderRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85, // 85% of screen height (expanded)
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  scrollContentCollapsed: {
    maxHeight: 200, // Limit scroll area when collapsed
  },
  grabber: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  grabberHandle: {
    width: 40,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#CED4DA',
    marginBottom: 6,
  },
  grabberHint: {
    fontSize: 11,
    color: '#6C757D',
    fontWeight: '600',
  },
  grabberText: {
    marginTop: 6,
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '600',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerIcon: {
    fontSize: 26,
  },
  headerTextContainer: {
    flex: 1,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  etaText: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '600',
  },
  distanceText: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
  },
  // Compact inline car details (visible in collapsed header)
  carInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
    marginBottom: 8,
  },
  carInlineText: {
    fontSize: 13,
    fontWeight: '700',
  },
  carInlinePlate: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 2,
  },
  carInlinePlateText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  separator: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: 10,
  },
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  // New car details card styles
  carDetailsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E3F2FD',
  },
  carCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  carBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carBadgeEmoji: {
    fontSize: 20,
  },
  carCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C757D',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  carMainInfo: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  carBrandModel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0D1B2A',
    textAlign: 'left',
    letterSpacing: 0.3,
  },
  registrationContainer: {
    alignItems: 'flex-start',
    marginTop: 6,
    marginBottom: 10,
  },
  carColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    paddingVertical: 2,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  carColorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C757D',
  },
  carColorValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1B2A',
  },
  carHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  carIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  carEmoji: {
    fontSize: 20,
  },
  carHeaderContent: {
    flex: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardSpacer: {
    flex: 1,
  },
  cardCost: {
    alignItems: 'flex-end',
  },
  tripCostText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D47A1',
  },
  rideTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976D2',
  },
  carTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1B2A',
    marginBottom: 3,
  },
  carSubtitle: {
    fontSize: 11,
    color: '#6C757D',
  },
  carDot: {
    fontSize: 11,
    color: '#CED4DA',
    marginHorizontal: 4,
  },
  carDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  etaBadgeContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  etaBadge: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#1976D2',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 5,
  },
  etaBadgeEmoji: {
    fontSize: 18,
  },
  etaBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#90CAF9',
  },
  driverAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  driverInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1565C0',
  },
  driverTextContainer: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverRating: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 11,
    color: '#8E9AAF',
  },
  callButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#34C759',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  callButtonIcon: {
    fontSize: 14,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tripDetailsContainer: {
    gap: 8,
  },
  addressCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 10,
  },
  addressCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pickupIcon: {
    fontSize: 18,
  },
  destinationIcon: {
    fontSize: 18,
  },
  paymentIcon: {
    fontSize: 18,
  },
  addressCardContent: {
    flex: 1,
  },
  addressCardLabel: {
    fontSize: 10,
    color: '#6C757D',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  addressCardValue: {
    fontSize: 13,
    color: '#212529',
    fontWeight: '600',
    lineHeight: 18,
  },
  paymentRowInCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  priceInCard: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D47A1',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 15,
    color: '#495057',
    fontWeight: '700',
  },
  paymentValue: {
    fontSize: 17,
    color: '#111',
    fontWeight: '700',
  },
  addressSection: {
    gap: 4,
  },
  addressLabel: {
    fontSize: 11,
    color: '#6C757D',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  addressValue: {
    fontSize: 13,
    color: '#212529',
    fontWeight: '500',
  },
  addressSpacer: {
    height: 6,
  },
  cancelSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  cancelLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelLinkText: {
    color: '#6C757D',
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  cancelTripButton: {
    alignSelf: 'center',
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelTripText: {
    color: '#D00000',
    fontSize: 14,
    fontWeight: '600',
  },
  plate: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#0D47A1',
    shadowColor: '#0D47A1',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  plateText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D47A1',
    letterSpacing: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  modalValue: {
    fontSize: 14,
    color: '#111',
    marginTop: 2,
  },
  modalCloseButton: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0D47A1',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TripAcceptedView;
