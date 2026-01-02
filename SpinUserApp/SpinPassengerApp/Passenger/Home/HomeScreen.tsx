import { CommonActions, useNavigation } from '@react-navigation/native';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Modal, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useTripManager } from '../../Authentication/HomeViewModel';
import { SocketContext } from '../../context/SocketContext';
import TRIP_STATES from '../../src/constants/tripStates';
import { PaymentOption } from '../../types/PaymentOption';
import RideRequestView, { RideType } from '../Components/RideRequestView';
import { useAuth } from '../context/AuthContext';
import { HomeContext } from '../context/HomeContext';
import { usePassengerLocationTracking } from '../hooks/usePassengerLocationTracking';
import PassengerTripHistoryView from '../Menu/PassengerTripHistoryView';
import SettingsView from '../Menu/SettingsView';
import TripAcceptedView from '../PassView/TripAcceptedView';
import TripLoadingView from '../PassView/TripLoadingView';
import PaymentViewModel from '../Payment/PaymentViewModel';
import LocationSearchActivationView from './LocationSearchActivationView';
import LocationSearchView from './LocationSearchView';
import MapViewActionButton from './MapViewActionButton';
import SideMenu from './SideMenu';
import SpinMapView from './SpinMapView';

// Import prebooking components
import BookingDatePickerView from '../Forbokning/BookingDatePickerView';
import ReserveradView from '../Forbokning/ReserveradView';

// Import RatingView
import RatingView from '../Rating/RatingView';

// Placeholder/fallback components for overlays and modals
const TripCancelledView = () => null;
const LocationPermissionBanner = () => null;
const WelcomeView = ({ onClose }: { onClose: () => void }) => null;


type HomeContextType = {
  showWelcomeView: boolean;
  setShowWelcomeView: (v: boolean) => void;
  userLocation?: any;
  setUserLocation?: (v: any) => void;
  selectedSpinLocation?: any;
  setSelectedSpinLocation?: (v: any) => void;
  trip?: any;
  setTrip?: (v: any) => void;
  currentLocation: string;
  pickupCoordinate?: any;
  destinationCoordinate?: any;
  queryFragment?: string;
  // add setters used to clear state when closing RideRequestView
  setDestinationCoordinate?: (v: any) => void;
  setQueryFragment?: (v: string) => void;
  setRoutePoints?: (v: any[]) => void;
};

export default function HomeScreen() {
  const [mapState, setMapState] = useState('HomeView');
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showTripsModal, setShowTripsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false); // NEW: För förbokningsmodal
  const [showBookingsModal, setShowBookingsModal] = useState(false); // NEW: För att visa bokningar
  const [bookingCount, setBookingCount] = useState(0); // NEW: Antal förbokningar för badge
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(new Date(Date.now() + 30 * 60 * 1000)); // Default: nu + 30 min
  const [isScheduledBooking, setIsScheduledBooking] = useState(false); // NEW: Flagga för om det är förbokning
  const [isActivelyBooking, setIsActivelyBooking] = useState(false); // Guard to prevent state changes during booking
  const [showRatingView, setShowRatingView] = useState(false); // Show rating modal after trip completion
  const [ratingTrip, setRatingTrip] = useState<any | null>(null); // Trip data for rating

  const { currentUser, signOut } = useAuth();
  const homeContext = useContext(HomeContext) as HomeContextType;
  const socket = useContext(SocketContext);
  const navigation = useNavigation<any>();
  const userLocation = homeContext.userLocation;
  const setUserLocation = homeContext.setUserLocation ?? (() => { });
  const selectedSpinLocation = homeContext.selectedSpinLocation;
  const setSelectedSpinLocation = homeContext.setSelectedSpinLocation ?? (() => { });
  const trip = homeContext.trip;
  const setTrip = homeContext.setTrip ?? (() => { });
  const currentLocation = homeContext.currentLocation;
  const pickupCoordinate = homeContext.pickupCoordinate;
  const destinationCoordinate = homeContext.destinationCoordinate;
  const setDestinationCoordinate = homeContext.setDestinationCoordinate ?? (() => { });
  const setQueryFragment = homeContext.setQueryFragment ?? (() => { });
  const setRoutePoints = homeContext.setRoutePoints ?? (() => { });

  const { requestTrip, trip: managedTrip, isSendingTrip, tripStatus, lastError } = useTripManager();
  const lastHandledStatusRef = useRef<typeof tripStatus>('idle');
  const cancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Optimized location tracking using custom hook
  // Track location whenever we're in HomeView or have an active trip
  const isInHomeView = mapState === 'HomeView';
  const hasActiveTrip = !!trip && ['accepted', 'in_progress', 'driverarrived', 'hasdriverarrived', 'started', 'inprogress', 'tripinprogress'].includes((trip?.state || trip?.status || '').toLowerCase());
  const isSearchingOrWaiting = mapState === 'searchingForLocation' || mapState === 'polylineAdded';

  const { userLocation: optimizedLocation, batteryLevel } = usePassengerLocationTracking(
    isInHomeView || hasActiveTrip || isSearchingOrWaiting, // hasActiveTrip param
    !!trip && ['accepted', 'driverarrived', 'hasdriverarrived'].includes((trip?.state || trip?.status || '').toLowerCase()), // isWaitingForDriver
    isInHomeView || isSearchingOrWaiting // isSearching - track in HomeView to show blue dot
  );

  useEffect(() => {
    if (currentUser) {
      console.log('👤 [HomeScreen] Current user updated:', currentUser.uid);
      
      // Notify server that passenger is online
      if (socket && socket.connected) {
        console.log(`👤 [HomeScreen] Notifierar servern: passagerare ${currentUser.uid} online`);
        socket.emit('passengerOnline', { passengerId: currentUser.uid });
      }
    }
  }, [currentUser, socket]);

  // Join trip room if there's an active trip
  useEffect(() => {
    if (trip?.id && currentUser?.uid && socket && socket.connected) {
      console.log(`🔌 [HomeScreen] Joinar trip room: ${trip.id}`);
      socket.emit('passengerJoinTrip', { 
        passengerId: currentUser.uid, 
        tripId: trip.id 
      });
    }
  }, [trip?.id, currentUser?.uid, socket]);

  // Request location permission on mount for showsUserLocation to work
  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Platsbehörighet krävs',
              message: 'Spin Taxi behöver åtkomst till din plats för att visa din position på kartan',
              buttonNeutral: 'Fråga mig senare',
              buttonNegative: 'Avböj',
              buttonPositive: 'OK',
            }
          );
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log('✅ Location permission granted');
          } else {
            console.log('❌ Location permission denied');
          }
        } catch (err) {
          console.warn('⚠️ Permission error:', err);
        }
      }
    };
    requestLocationPermission();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 [HomeScreen] Cleaning up on unmount...');
      if (cancelTimeoutRef.current) {
        clearTimeout(cancelTimeoutRef.current);
        cancelTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Treat terminal trips from useTripManager as cleared to avoid loops
    if (managedTrip) {
      console.log('🔄 [HomeScreen] managedTrip updated:', {
        id: managedTrip.id,
        status: managedTrip.status,
        state: managedTrip.state,
      });
      
      const mState = String(managedTrip?.status || managedTrip?.state || '').toLowerCase();
      const isTerminal = [TRIP_STATES.PASSENGER_CANCELLED, 'drivercancelled', 'cancelled', 'completed', 'tripcompleted'].includes(mState);
      const isActiveTrip = ['accepted', 'driverarrived', 'hasdriverarrived', 'inprogress', 'tripinprogress', 'started'].includes(mState);
      const isSearching = ['requested', 'pending', 'creating', 'searching'].includes(mState);

      if (isTerminal) {
        console.log('⚠️ Trip is terminal, clearing...');
        if (trip !== null) {
          setTrip(null);
        }
        return;
      }

      if (isActiveTrip || isSearching) {
        console.log('✅ Setting trip from managedTrip:', mState);
        setTrip(managedTrip);
        return;
      }
      // For any other non-terminal state, prefer clearing to avoid stale loops
      console.log('⚠️ Unknown trip state, clearing...');
      if (trip !== null) {
        setTrip(null);
      }
    } else if (!managedTrip && trip) {
      // Don't clear trip if it's already accepted (restored from AsyncStorage)
      const tripStatus = String(trip?.status || trip?.state || '').toLowerCase();
      const isActiveTrip = ['accepted', 'driverarrived', 'hasdriverarrived', 'inprogress', 'tripinprogress', 'started'].includes(tripStatus);

      if (!isActiveTrip) {
        // Only clear if trip is not in active state
        setTrip(null);
      }
    }
  }, [managedTrip, setTrip, trip]);

  // Update home context with optimized location
  useEffect(() => {
    if (optimizedLocation && setUserLocation) {
      setUserLocation(optimizedLocation);
    }
  }, [optimizedLocation, setUserLocation]);

  // Show battery warning if needed
  useEffect(() => {
    if (batteryLevel < 20 && mapState !== 'HomeView') {
      console.warn(`⚠️ Battery low: ${batteryLevel}%`);
    }
  }, [batteryLevel, mapState]);

  // Monitor coordinate changes and automatically trigger RideRequestView
  // Avoid reopening while a trip is being requested or is active
  useEffect(() => {
    // If actively booking, never interfere with mapState
    if (isActivelyBooking) {
      console.log('🔒 [HomeScreen] Booking in progress, blocking coordinate effect');
      return;
    }

    // If mapState is already 'tripRequested', don't interfere - we're searching for a driver
    if (mapState === 'tripRequested') {
      return;
    }

    const normalizedStatus = String(tripStatus || trip?.status || trip?.state || '').toLowerCase();
    const isTripActiveOrRequested = Boolean(trip) || (
      ['creating','searching','requested','accepted','driverarrived','hasdriverarrived','inprogress','tripinprogress','started']
        .includes(normalizedStatus)
    );

    if (isTripActiveOrRequested) {
      // Do not reopen RideRequestView during search/active trip
      return;
    }

    if (homeContext.pickupCoordinate &&
      homeContext.destinationCoordinate &&
      (mapState === 'HomeView' || mapState === 'searchingForLocation')) {
      const t = setTimeout(() => {
        setMapState('polylineAdded');
      }, 500); // Small delay to ensure coordinates are properly set
      return () => clearTimeout(t);
    }
  }, [homeContext.pickupCoordinate, homeContext.destinationCoordinate, mapState, trip, tripStatus, isActivelyBooking]);

  // 🔥 Lyssna på socket events för trip status uppdateringar från server
  useEffect(() => {
    if (!trip?.id) return;

    // Don't re-register if trip is being cancelled to avoid loops
    const tripStatus = String(trip?.status || trip?.state || '').toLowerCase();
    if ([TRIP_STATES.PASSENGER_CANCELLED, TRIP_STATES.DRIVER_CANCELLED, 'cancelled'].includes(tripStatus)) {
      console.log(`🔌 [HomeScreen] SKIPPING socket listeners - trip cancelled: ${trip.id}`);
      return;
    }

    console.log(`🔌 [HomeScreen] Registrering socket listeners för trip: ${trip.id}`);

    // Lyssna på trip:accepted
    const handleTripAccepted = (data: any) => {
      console.log('📡 Socket event: trip:accepted', data);
      setTrip({ ...trip, status: 'accepted', state: 'accepted' });
    };

    // Lyssna på trip:${tripId}:driverArrived
    const handleDriverArrived = (data: any) => {
      console.log('📡 Socket event: trip:driverArrived', data);
      setTrip({ ...trip, status: 'driverarrived', state: 'driverarrived' });
    };

    // Lyssna på tripClosed / cancellation
    const handleTripClosed = (data: any) => {
      console.log('📡 Socket event: tripClosed', data);
      // Let the trip status effect handle cancellation to avoid double state updates
      // that cause flickering. The trip document in Firebase will be updated,
      // TripStatusManager will detect it, and HomeContext will propagate the change.
      if (data?.reason === 'CancelledByDriver' || data?.reason === 'drivercancelled') {
        console.log('📡 Driver cancelled - waiting for Firebase update');
      }
    };

    // Lyssna på noDriversAvailable
    const handleNoDrivers = (data: any) => {
      console.log('📡 Socket event: noDriversAvailable', data);
      // Don't clear trip immediately - let the normal status effect handle it
      // to prevent state update conflicts
      console.log('📡 No drivers available');
    };

    socket.on('trip:accepted', handleTripAccepted);
    socket.on(`trip:${trip.id}:driverArrived`, handleDriverArrived);
    socket.on('tripClosed', handleTripClosed);
    socket.on('noDriversAvailable', handleNoDrivers);

    return () => {
      console.log(`🔌 [HomeScreen] Tar bort socket listeners för trip: ${trip.id}`);
      socket.off('trip:accepted', handleTripAccepted);
      socket.off(`trip:${trip.id}:driverArrived`, handleDriverArrived);
      socket.off('tripClosed', handleTripClosed);
      socket.off('noDriversAvailable', handleNoDrivers);
    };
  }, [trip?.id, socket]);

  // Handle trip state changes
  // Handle trip state changes - Simplified (sheets shown based on trip data)
  useEffect(() => {
    if (!trip) {
      if (mapState === 'tripRequested' || mapState === 'tripAccepted') {
        setMapState('HomeView');
      }
      return;
    }

    const state = String(trip?.state || trip?.status || '').toLowerCase();
    console.log('🔄 Trip status changed:', state);

    switch (state) {
      case 'completed':
      case 'tripcompleted':
        console.log('🎉 Trip completed - showing rating view');
        // Show RatingView with trip data
        setRatingTrip(trip);
        setShowRatingView(true);
        break;

      case 'cancelled':
      case TRIP_STATES.DRIVER_CANCELLED:
        console.log('❌ Trip cancelled by driver');
        // Visa meddelande om att föraren avbokade resan
        Alert.alert(
          'Resan avbokad',
          'Föraren avbokade din resa.',
          [{
            text: 'OK',
            onPress: () => {
              // Avsluta och gå tillbaka till HomeView
              setMapState('HomeView');
              if (setTrip) setTrip(null);
              // Rensa sök-/destinationsstate för att förhindra auto-öppning
              setQueryFragment('');
              setDestinationCoordinate(null);
              setSelectedSpinLocation(null);
              setRoutePoints([]);
              // Avbryt väntande fallback-timer om den finns
              if (cancelTimeoutRef.current) {
                clearTimeout(cancelTimeoutRef.current);
                cancelTimeoutRef.current = null;
              }
            }
          }]
        );
        // Release any reserved Stripe authorization if present (driver cancelled)
        try {
          const paymentIntentId = trip?.paymentIntentId as string | undefined;
          const method = String(trip?.paymentMethod || '').toLowerCase();
          const isPrepaid = Boolean(paymentIntentId) && method !== 'kontant' && method !== 'cash';
          if (isPrepaid && typeof paymentIntentId === 'string') {
            console.log('🔓 Releasing reserved Stripe payment due to driver cancel…', paymentIntentId);
            PaymentViewModel
              .releaseReservedPayment(paymentIntentId, 'driver_cancelled', trip.id)
              .then((ok) => console.log(ok ? '✅ Stripe reservation released' : '⚠️ Failed to release Stripe reservation'))
              .catch((e) => console.warn('⚠️ Error releasing Stripe reservation (driver cancel):', e));
          }
        } catch (e) {
          console.warn('⚠️ Failed to evaluate Stripe release on driver cancel:', e);
        }
        setMapState('tripCancelledByDriver');
        // Clear any existing timeout
        if (cancelTimeoutRef.current) {
          clearTimeout(cancelTimeoutRef.current);
        }
        // Set new timeout to return to home after showing cancellation message
        cancelTimeoutRef.current = setTimeout(() => {
          setMapState('HomeView');
          if (setTrip) setTrip(null);
          // Also clear destination/search state to prevent RideRequestView auto-reopen
          setQueryFragment('');
          setDestinationCoordinate(null);
          setSelectedSpinLocation(null);
          setRoutePoints([]);
          cancelTimeoutRef.current = null;
        }, 2500);
        break;

      case TRIP_STATES.PASSENGER_CANCELLED:
        console.log('❌ Trip cancelled by passenger');
        // Release any reserved Stripe authorization if present (passenger cancelled)
        try {
          const paymentIntentId = trip?.paymentIntentId as string | undefined;
          const method = String(trip?.paymentMethod || '').toLowerCase();
          const isPrepaid = Boolean(paymentIntentId) && method !== 'kontant' && method !== 'cash';
          if (isPrepaid && typeof paymentIntentId === 'string') {
            console.log('🔓 Releasing reserved Stripe payment due to passenger cancel…', paymentIntentId);
            PaymentViewModel
              .releaseReservedPayment(paymentIntentId, 'passenger_cancelled', trip.id)
              .then((ok) => console.log(ok ? '✅ Stripe reservation released' : '⚠️ Failed to release Stripe reservation'))
              .catch((e) => console.warn('⚠️ Error releasing Stripe reservation (passenger cancel):', e));
          }
        } catch (e) {
          console.warn('⚠️ Failed to evaluate Stripe release on passenger cancel:', e);
        }
        // Visa bekräftelse direkt och gå tillbaka till HomeView
        Alert.alert(
          'Resan avbokad',
          'Din resa avbokades.',
          [{
            text: 'OK',
            onPress: () => {
              setMapState('HomeView');
              if (setTrip) setTrip(null);
              // Clear destination/search state to prevent RideRequestView auto-reopen
              setQueryFragment('');
              setDestinationCoordinate(null);
              setSelectedSpinLocation(null);
              setRoutePoints([]);
            }
          }]
        );
        // Fallback: gå tillbaka automatiskt efter 3 sekunder om användaren inte trycker OK
        if (cancelTimeoutRef.current) {
          clearTimeout(cancelTimeoutRef.current);
        }
        cancelTimeoutRef.current = setTimeout(() => {
          setMapState('HomeView');
          if (setTrip) setTrip(null);
          // Clear destination/search state to prevent RideRequestView auto-reopen
          setQueryFragment('');
          setDestinationCoordinate(null);
          setSelectedSpinLocation(null);
          setRoutePoints([]);
          cancelTimeoutRef.current = null;
        }, 3000);
        break;

      default:
        console.log('❓ Unknown trip state:', state);
        break;
    }
  }, [trip, currentUser, setTrip]);

  // Handle Android hardware back to close overlays/sheets
  useEffect(() => {
    const onBackPress = () => {
      // Close modals first
      if (showScheduleModal) {
        setShowScheduleModal(false);
        return true;
      }
      if (showBookingsModal) {
        setShowBookingsModal(false);
        return true;
      }
      // Close side menu
      if (showSideMenu) {
        setShowSideMenu(false);
        return true;
      }
      // Close search or sheet overlays
      if (mapState === 'searchingForLocation') {
        setMapState('HomeView');
        setIsScheduledBooking(false); // Avbryt förbokning om man går tillbaka
        return true;
      }
      if (mapState === 'tripRequested') {
        // Cancel search -> back to sheet
        setMapState('polylineAdded');
        if (setTrip) setTrip(null);
        return true;
      }
      if (mapState === 'polylineAdded') {
        // Close RideRequestView and clear destination to avoid immediate reopen
        setQueryFragment('');
        setDestinationCoordinate(null);
        setSelectedSpinLocation(null);
        setRoutePoints([]);
        setMapState('HomeView');
        return true;
      }
      return false; // default back behavior
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [mapState, showSideMenu, showScheduleModal, showBookingsModal, showRatingView, setTrip]);

  // Handle trip booking
  const handleBookTrip = async (rideType: RideType, paymentOption: PaymentOption, note: string, scheduledDate?: Date, customPrice?: number) => {
    console.log('🚗 Starting trip booking process...');
    console.log('📍 Parameters:', {
      rideType: rideType?.id,
      paymentOption: paymentOption?.type,
      note,
      scheduledDate: scheduledDate?.toISOString(),
      customPrice,
      currentUser: currentUser?.uid,
      selectedSpinLocation: selectedSpinLocation?.title,
      pickupCoordinate,
      destinationCoordinate: homeContext.destinationCoordinate,
      queryFragment: homeContext.queryFragment,
    });

    // Create trip object
    if (!currentUser) {
      console.log('⚠️ Ingen användare inloggad – avbryter bokning');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        })
      );
      return;
    }

    // Build selectedSpinLocation from destinationCoordinate if not already set
    let effectiveSpinLocation = selectedSpinLocation;
    if (!effectiveSpinLocation && homeContext.destinationCoordinate) {
      effectiveSpinLocation = {
        coordinate: homeContext.destinationCoordinate,
        title: homeContext.queryFragment || 'Destination',
      };
      console.log('✅ Built effectiveSpinLocation from destinationCoordinate:', effectiveSpinLocation);
    }

    if (!effectiveSpinLocation || !pickupCoordinate) {
      console.log('⚠️ Saknar koordinater för resa');
      console.log('   effectiveSpinLocation:', effectiveSpinLocation);
      console.log('   pickupCoordinate:', pickupCoordinate);
      return;
    }

    // Beräkna distans i meter (fallback: haversine om ingen rutt finns)
    const haversineDistanceMeters = (a: { latitude: number; longitude: number; }, b: { latitude: number; longitude: number; }) => {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371e3; // jordradie i meter
      const dLat = toRad(b.latitude - a.latitude);
      const dLon = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);
      const sinDLat = Math.sin(dLat / 2);
      const sinDLon = Math.sin(dLon / 2);
      const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
      const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
      return R * c;
    };

    const distanceInMeters = (pickupCoordinate && effectiveSpinLocation?.coordinate)
      ? haversineDistanceMeters(pickupCoordinate, effectiveSpinLocation.coordinate)
      : 0;

    console.log('📏 Beräknad distans (m):', Math.round(distanceInMeters));

    if (scheduledDate) {
      console.log('📅 Scheduled booking for:', scheduledDate.toISOString());

      // Spara förbokad resa direkt till Firestore (inte via socket)
      try {
        const firestore = (await import('@react-native-firebase/firestore')).default;
        const tripId = `trip_${Date.now()}`;

        await firestore().collection('trips').doc(tripId).set({
          tripId,
          id: tripId,
          passengerUid: currentUser.uid,
          passengerName: currentUser.fullname || '',
          passengerPhoneNumber: currentUser.phoneNumber || '',
          pickupLocationAddress: currentLocation,
          pickupLocationName: currentLocation,
          dropoffLocationAddress: effectiveSpinLocation.title || '',
          dropoffLocationName: effectiveSpinLocation.title || '',
          pickupLocation: new (firestore as any).GeoPoint(
            pickupCoordinate.latitude,
            pickupCoordinate.longitude
          ),
          dropoffLocation: new (firestore as any).GeoPoint(
            effectiveSpinLocation.coordinate.latitude,
            effectiveSpinLocation.coordinate.longitude
          ),
          passengerLocation: new (firestore as any).GeoPoint(
            pickupCoordinate.latitude,
            pickupCoordinate.longitude
          ),
          driverLocation: new (firestore as any).GeoPoint(0, 0),
          driverUid: '',
          driverId: '',
          driverName: '',
          driverImageUrl: '',
          driverPhoneNumber: '',
          driverNote: note || '',
          tripCost: customPrice || rideType.basePrice,
          customPrice: customPrice || null,
          distanceTodropoffLocation: Math.round(distanceInMeters),
          selectedRideType: rideType.id.charAt(0).toUpperCase() + rideType.id.slice(1), // Capitalize: "spin" → "Spin"
          rideType: rideType.id.charAt(0).toUpperCase() + rideType.id.slice(1), // Capitalize
          // Skriv ett lokaliserat, UI-vänligt värde till Firestore
          paymentMethod: paymentOption?.firestoreValue || 'Kontant',
          status: 'scheduled', // Lowercase to match Swift
          state: 'requested', // Match Swift format
          scheduledPickupAt: scheduledDate, // Save as Timestamp, not ISO string
          ratingStatus: 'pending',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        console.log('✅ Förbokad resa sparad:', tripId);

        // Rensa state
        setQueryFragment('');
        setDestinationCoordinate(null);
        setSelectedSpinLocation(null);
        setRoutePoints([]);
        setMapState('HomeView');
        // Visa bokningslistan direkt
        setShowBookingsModal(true);
        // Rensa valt datum och förbokningsflagga för nästa bokning
        setSelectedScheduleDate(new Date(Date.now() + 30 * 60 * 1000));
        setIsScheduledBooking(false);
      } catch (error) {
        console.error('❌ Fel vid skapande av förbokad resa:', error);
        Alert.alert('Fel', 'Kunde inte spara förbokad resa. Försök igen.');
      }
      return;
    }

    // Sätt mapState först så UI:t uppdateras omedelbart
    // Stäng RideRequestView och visa TripLoadingView under sökning
    console.log('🚀 [handleBookTrip] Starting booking flow, setting mapState to tripRequested');
    setMapState('tripRequested');
    setIsActivelyBooking(true); // Set guard to prevent state changes during booking
    
    // Anropa requestTrip
    requestTrip({
      currentUser,
      selectedSpinLocation: effectiveSpinLocation,
      selectedPickupLocation: {
        coordinate: pickupCoordinate,
        title: currentLocation,
      },
      rideType: rideType.id ?? rideType.name ?? 'ride',
      customRidePrice: customPrice || rideType.basePrice,
      distanceInMeters: Math.round(distanceInMeters),
      paymentIntentId: undefined,
      driverNote: note,
      // Skicka ett redan lokaliserat värde så servern sparar "Kontant" i trip.paymentMethod på iOS
      paymentMethod: paymentOption?.firestoreValue || 'Kontant',
      paymentOptionId: paymentOption?.id,
      selectedRideTypeId: rideType.id,
      scheduledPickupAt: scheduledDate,
    });
    console.log('✅ [handleBookTrip] requestTrip called with rideType:', rideType.id, 'customPrice:', customPrice);
  };

  useEffect(() => {
    console.log('🔄 [HomeScreen] tripStatus changed:', tripStatus, 'mapState:', mapState, 'isActivelyBooking:', isActivelyBooking);

    switch (tripStatus) {
      case 'noDrivers':
        setIsActivelyBooking(false);
        Alert.alert(
          'Ingen förare hittades',
          lastError || 'Det finns inga lediga förare i närheten just nu. Försök igen om en stund.',
          [
            {
              text: 'OK',
              onPress: () => {
                setMapState('polylineAdded');
                setIsActivelyBooking(false);
              },
            },
          ],
        );
        break;
      case 'error':
        setIsActivelyBooking(false);
        if (lastError) {
          Alert.alert('Kunde inte boka resan', lastError);
        }
        if (mapState === 'tripRequested') {
          setMapState('polylineAdded');
        }
        break;
      case 'cancelled':
        setIsActivelyBooking(false);
        if (mapState === 'tripRequested') {
          setMapState('polylineAdded');
        }
        break;
      case 'searching':
      case 'creating':
        // Keep booking guard active during these states
        if (!isActivelyBooking) {
          console.log('📦 [HomeScreen] Setting booking guard during search...');
          setIsActivelyBooking(true);
        }
        break;
      default:
        // For any other status (idle, etc), clear booking guard if it was set
        if (isActivelyBooking && tripStatus === 'idle') {
          console.log('📦 [HomeScreen] Clearing booking guard (idle state)');
          setIsActivelyBooking(false);
        }
        break;
    }

    lastHandledStatusRef.current = tripStatus;
  }, [tripStatus, lastError, mapState, isActivelyBooking]);

  // Overlay logic (bottom overlays)
  const renderCurrentMapOverlay = useMemo(() => () => {
    console.log('🎯 [renderCurrentMapOverlay] mapState:', mapState, 'tripStatus:', tripStatus, 'isSendingTrip:', isSendingTrip);
    
    switch (mapState) {
      case 'polylineAdded':
        return (
          <RideRequestView
            visible={true}
            onClose={() => {
              // Clear destination-related state so effect doesn't reopen the sheet immediately
              setQueryFragment('');
              setDestinationCoordinate(null);
              setSelectedSpinLocation(null);
              setRoutePoints([]);
              setMapState('HomeView');
              // Rensa också valt datum och förbokningsflagga när man stänger
              setSelectedScheduleDate(new Date(Date.now() + 30 * 60 * 1000));
              setIsScheduledBooking(false);
            }}
            onBookTrip={handleBookTrip}
            pickupLocation={currentLocation || (pickupCoordinate ? `${pickupCoordinate.latitude.toFixed(5)}, ${pickupCoordinate.longitude.toFixed(5)}` : 'Välj upphämtningsplats')}
            destinationLocation={homeContext.queryFragment || 'Destination'}
            initialScheduledDate={isScheduledBooking ? selectedScheduleDate : undefined}
          />
        );
      case 'tripCancelledByDriver':
        return <TripCancelledView />;
      default:
        return null;
    }
  }, [mapState, currentUser, trip, isSendingTrip, tripStatus, currentLocation, homeContext.queryFragment, isScheduledBooking, selectedScheduleDate, handleBookTrip, setQueryFragment, setDestinationCoordinate, setSelectedSpinLocation, setRoutePoints, setMapState, setSelectedScheduleDate, setIsScheduledBooking, setTrip]);

  // Keep map state in sync with accepted trip so SpinMapView can fit markers/route
  useEffect(() => {
    const normalizedStatus = String(tripStatus || trip?.status || trip?.state || '').toLowerCase();
    const hasDriver = Boolean(trip?.driverId || trip?.driverUid || trip?.driverSnapshot || trip?.driverName);
    const shouldShowAccepted = hasDriver && currentUser?.accountType === 'passenger' &&
      ![TRIP_STATES.PASSENGER_CANCELLED, TRIP_STATES.DRIVER_CANCELLED, 'cancelled', 'completed', 'tripcompleted'].includes(normalizedStatus as any);

    if (shouldShowAccepted && mapState !== 'tripAccepted') {
      console.log('✅ [HomeScreen] Driver assigned, switching to tripAccepted state');
      setMapState('tripAccepted');
      setIsActivelyBooking(false); // Clear booking guard when driver is assigned
    } else if (!shouldShowAccepted && mapState === 'tripAccepted') {
      console.log('🔄 [HomeScreen] No longer in accepted state, returning to HomeView');
      setMapState('HomeView');
    }
  }, [trip, tripStatus, currentUser?.accountType, mapState]);

  return (
    <View style={{ flex: 1 }}>
      {/* Map */}
      <SpinMapView
        mapState={mapState}
        userLocation={userLocation ?? null}
      />

      {/* Location permission banner */}
      <LocationPermissionBanner />

      {/* Login CTA */}
      {!currentUser && (
        <>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={async () => {
              try {
                await signOut();
              } catch (error) {
                console.warn('Misslyckades att rensa auth-state innan navigation:', error);
              }
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Welcome' }],
                })
              );
            }}
          >
            <Text style={styles.loginButtonText}></Text>
          </TouchableOpacity>
        </>
      )}

      {/* Search view/activation */}
      {mapState === 'searchingForLocation' && (
        <Modal visible={true} animationType="slide">
          <LocationSearchView onClose={() => {
            console.log('🧭 LocationSearchView onClose - Forcing RideRequestView!');
            setMapState('polylineAdded');
          }} />
        </Modal>
      )}
      {currentUser?.accountType !== 'driver' && mapState === 'HomeView' && (
        <View style={styles.searchActivation}>
          <LocationSearchActivationView
            onPress={() => {
              setIsScheduledBooking(false); // Direkt bokning
              setMapState('searchingForLocation');
            }}
            scheduledDate={selectedScheduleDate}
            onSchedulePress={() => {
              if (!currentUser) {
                Alert.alert('Logga in', 'Du måste vara inloggad för att förboka en resa.');
                return;
              }
              setIsScheduledBooking(true); // Förbokad bokning
              setShowScheduleModal(true);
            }}
            onHomePress={() => {
              setShowTripsModal(false);
              setShowProfileModal(false);
              setMapState('HomeView');
            }}
            onTripsPress={() => {
              setShowProfileModal(false);
              setShowTripsModal(true);
            }}
            onProfilePress={() => {
              setShowTripsModal(false);
              setShowProfileModal(true);
            }}
          />
        </View>
      )}

      {/* Left action button */}
      {mapState !== 'tripAccepted' && (
        <MapViewActionButton
          mapState={mapState}
          setMapState={setMapState}
          showSideMenu={showSideMenu}
          setShowSideMenu={setShowSideMenu}
          onBackToHome={() => {
            // Clear anything that can trigger RideRequestView to reopen
            setQueryFragment('');
            setDestinationCoordinate(null);
            setSelectedSpinLocation(null);
            setRoutePoints([]);
            setMapState('HomeView');
          }}
        />
      )}

      {/* Side menu overlay */}
      {currentUser && showSideMenu && (
        <View style={styles.sideMenuOverlay}>
          <SideMenu
            user={currentUser}
            onClose={() => setShowSideMenu(false)}
            bookingCount={bookingCount}
            onShowBookings={() => setShowBookingsModal(true)}
          />
          <TouchableOpacity
            style={styles.sideMenuBackdrop}
            onPress={() => setShowSideMenu(false)}
          />
        </View>
      )}

      {/* Trip history modal */}
      <Modal
        visible={showTripsModal}
        animationType="slide"
        onRequestClose={() => setShowTripsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTripsModal(false)} style={styles.modalCloseButton}>
              <Icon name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Resor</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <PassengerTripHistoryView />
        </View>
      </Modal>

      {/* Profile/settings modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        onRequestClose={() => setShowProfileModal(false)}
        transparent={false}
        statusBarTranslucent={false}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProfileModal(false)} style={styles.modalCloseButton}>
              <Icon name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Profil</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <SettingsView user={currentUser ?? undefined} />
        </View>
      </Modal>

      {/* Förboknings-modal - Datumväljare */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowScheduleModal(false)} style={styles.modalCloseButton}>
              <Icon name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Förboka resa</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <BookingDatePickerView
            selectedDate={selectedScheduleDate}
            onConfirm={(date) => {
              setSelectedScheduleDate(date);
              setShowScheduleModal(false);
              setIsScheduledBooking(true); // Markera som förbokning
              // Öppna LocationSearchView om ingen destination är vald
              if (!selectedSpinLocation) {
                setMapState('searchingForLocation');
              } else {
                // Om destination redan är vald, öppna RideRequestView direkt
                setMapState('destinationSelected');
              }
            }}
            onClose={() => {
              setShowScheduleModal(false);
              setIsScheduledBooking(false); // Avbryt förbokning om man stänger
            }}
          />
        </View>
      </Modal>

      {/* Bokningar-modal - Visa förbokade resor */}
      <Modal
        visible={showBookingsModal}
        animationType="slide"
        onRequestClose={() => setShowBookingsModal(false)}
      >
        <ReserveradView
          onBack={() => setShowBookingsModal(false)}
          onBookingCountChange={setBookingCount}
        />
      </Modal>

      {/* Bottom overlays */}
      <View style={styles.overlayBottom} pointerEvents="box-none">
        {renderCurrentMapOverlay()}
      </View>

      {(() => {
        const normalizedStatus = String(tripStatus || trip?.status || trip?.state || '').toLowerCase();
        const hasDriver = Boolean(trip?.driverId || trip?.driverUid || trip?.driverSnapshot || trip?.driverName);

        // Show loading sheet while we are creating/searching/requested/accepted but no driver attached yet
        // Also show while mapState is 'tripRequested'
        const shouldShowLoading = (!hasDriver) && (
          normalizedStatus === 'creating' ||
          normalizedStatus === 'searching' ||
          normalizedStatus === 'requested' ||
          normalizedStatus === 'accepted' ||
          normalizedStatus === TRIP_STATES.REQUESTED.toLowerCase() ||
          mapState === 'tripRequested'
        );

        // Show accepted view once driver has been assigned (either hasDriver=true OR status='accepted')
        // Check this BEFORE shouldShowLoading to prevent conflicts
        const shouldShowAccepted = (hasDriver || normalizedStatus === 'accepted') && currentUser?.accountType === 'passenger';

        if (shouldShowAccepted) {
          console.log('🟢 Rendering TripAcceptedView', { normalizedStatus, hasDriver, tripId: trip?.id });
          return (
            <View style={styles.fullscreenOverlay} pointerEvents="box-none">
              <TripAcceptedView trip={trip} />
            </View>
          );
        }

        if (shouldShowLoading) {
          console.log('🟢 Rendering TripLoadingView', { normalizedStatus, hasDriver, mapState, tripId: trip?.id });
          // isLoading should be true during all search phases: creating, searching, requested, and pending
          const isActivelySearching = 
            normalizedStatus === 'creating' || 
            normalizedStatus === 'searching' || 
            normalizedStatus === 'requested' || 
            normalizedStatus === 'pending';
          return (
            <View style={styles.fullscreenOverlay} pointerEvents="box-none">
              <TripLoadingView
                visible={true}
                isLoading={isActivelySearching}
                status={normalizedStatus}
                onCancel={async () => {
                  console.log('🚫 Trip search cancelled by user');
                  try {
                    // Always release Stripe reservation if this trip was prepaid
                    const paymentIntentId = trip?.paymentIntentId;
                    const method = String(trip?.paymentMethod || '').toLowerCase();
                    const isPrepaid = Boolean(paymentIntentId) && method !== 'kontant' && method !== 'cash';
                    if (isPrepaid && typeof paymentIntentId === 'string') {
                      console.log('🔓 Releasing reserved Stripe payment due to passenger cancel (searching)…', paymentIntentId);
                      const ok = await PaymentViewModel.releaseReservedPayment(paymentIntentId, 'passenger_cancelled', trip?.id);
                      console.log(ok ? '✅ Stripe reservation released' : '⚠️ Failed to release Stripe reservation');
                    }
                  } catch (e) {
                    console.warn('⚠️ Error while releasing Stripe reservation on cancel:', e);
                  } finally {
                    setMapState('polylineAdded'); // Go back to RideRequestView
                    if (setTrip) setTrip(null); // Clear trip state
                  }
                }}
              />
            </View>
          );
        }

        console.log('ℹ️ No trip sheet rendered', { normalizedStatus, hasDriver, tripId: trip?.id });
        return null;
      })()}

      {/* Rating View - Show after trip completion */}
      <RatingView
        visible={showRatingView}
        trip={ratingTrip}
        onClose={() => {
          setShowRatingView(false);
          setRatingTrip(null);
          // Clear trip and return to HomeView
          if (setTrip) setTrip(null);
          setMapState('HomeView');
          // Clear search state to prevent RideRequestView auto-reopen
          setQueryFragment('');
          setDestinationCoordinate(null);
          setSelectedSpinLocation(null);
          setRoutePoints([]);
        }}
        onRatingSubmitted={() => {
          console.log('✅ Rating submitted, clearing trip state');
          setShowRatingView(false);
          setRatingTrip(null);
          if (setTrip) setTrip(null);
          setMapState('HomeView');
          // Clear search state to prevent RideRequestView auto-reopen
          setQueryFragment('');
          setDestinationCoordinate(null);
          setSelectedSpinLocation(null);
          setRoutePoints([]);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loginButton: {
    position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: 'yellow', borderRadius: 16, padding: 14, zIndex: 10,
  },
  loginButtonText: { color: 'black', fontWeight: 'bold' },
  searchActivation: { position: 'absolute', bottom: 0, width: '100%' },
  sideMenuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', zIndex: 20 },
  sideMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 50,
  },
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    // Make background transparent to avoid dimming the map
    backgroundColor: 'transparent',
    zIndex: 60,
    elevation: 60,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalHeaderSpacer: {
    width: 32,
  },
});

