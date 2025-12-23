import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PropsWithChildren } from 'react';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SocketContext } from '../../context/SocketContext';
import { PassengerLocationService } from '../../services/LocationService';
import TripStatusManager, { TripStatus } from '../../services/TripStatusManager';
import { Driver } from '../../types/Driver';
import { GeocodingService } from '../../utils/GeocodingService';

type Coordinate = { latitude: number; longitude: number };
type DriverCoordinate = Coordinate & { bearing?: number };

type RoutePoint = {
  latitude: number;
  longitude: number;
};

type HomeContextType = {
  showWelcomeView: boolean;
  setShowWelcomeView: React.Dispatch<React.SetStateAction<boolean>>;
  userLocation?: Coordinate | null;
  setUserLocation: React.Dispatch<React.SetStateAction<Coordinate | null>>;
  selectedSpinLocation?: any;
  setSelectedSpinLocation: React.Dispatch<React.SetStateAction<any>>;
  trip?: any;
  setTrip: React.Dispatch<React.SetStateAction<any>>;
  tripStatus: TripStatus;
  setTripStatus: React.Dispatch<React.SetStateAction<TripStatus>>;
  // Location search state
  pickupQueryFragment: string;
  setPickupQueryFragment: React.Dispatch<React.SetStateAction<string>>;
  queryFragment: string;
  setQueryFragment: React.Dispatch<React.SetStateAction<string>>;
  pickupCoordinate?: Coordinate | null;
  setPickupCoordinate: React.Dispatch<React.SetStateAction<Coordinate | null>>;
  destinationCoordinate?: Coordinate | null;
  setDestinationCoordinate: React.Dispatch<React.SetStateAction<Coordinate | null>>;
  currentLocation: string;
  setCurrentLocation: React.Dispatch<React.SetStateAction<string>>;
  // Route state
  routePoints: RoutePoint[];
  setRoutePoints: React.Dispatch<React.SetStateAction<RoutePoint[]>>;
  isRouteLoading: boolean;
  setIsRouteLoading: React.Dispatch<React.SetStateAction<boolean>>;
  // Drivers state
  nearbyDrivers: Driver[];
  setNearbyDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
  isLoadingDrivers: boolean;
  setIsLoadingDrivers: React.Dispatch<React.SetStateAction<boolean>>;
  currentDriverLocation: DriverCoordinate | null;
  setCurrentDriverLocation: React.Dispatch<React.SetStateAction<DriverCoordinate | null>>;
  estimatedArrivalTimeText: string | null;
  setEstimatedArrivalTimeText: React.Dispatch<React.SetStateAction<string | null>>;
  driverETAtoPickup: number | null;
  setDriverETAtoPickup: React.Dispatch<React.SetStateAction<number | null>>;
  estimatedArrivalDistance: number | null;
  setEstimatedArrivalDistance: React.Dispatch<React.SetStateAction<number | null>>;
  destinationETA: number | null;
  setDestinationETA: React.Dispatch<React.SetStateAction<number | null>>;
};

export const HomeContext = createContext<HomeContextType>({
  showWelcomeView: false,
  setShowWelcomeView: () => { },
  userLocation: null,
  setUserLocation: () => { },
  selectedSpinLocation: null,
  setSelectedSpinLocation: () => { },
  trip: null,
  setTrip: () => { },
  tripStatus: 'unknown',
  setTripStatus: () => { },
  pickupQueryFragment: '',
  setPickupQueryFragment: () => { },
  queryFragment: '',
  setQueryFragment: () => { },
  pickupCoordinate: null,
  setPickupCoordinate: () => { },
  destinationCoordinate: null,
  setDestinationCoordinate: () => { },
  currentLocation: '',
  setCurrentLocation: () => { },
  routePoints: [],
  setRoutePoints: () => { },
  isRouteLoading: false,
  setIsRouteLoading: () => { },
  nearbyDrivers: [],
  setNearbyDrivers: () => { },
  isLoadingDrivers: false,
  setIsLoadingDrivers: () => { },
  currentDriverLocation: null,
  setCurrentDriverLocation: () => { },
  estimatedArrivalTimeText: null,
  setEstimatedArrivalTimeText: () => { },
  driverETAtoPickup: null,
  setDriverETAtoPickup: () => { },
  estimatedArrivalDistance: null,
  setEstimatedArrivalDistance: () => { },
  destinationETA: null,
  setDestinationETA: () => { },
});

import { DriverService } from '../../services/DriverService';

// Helper function to calculate distance between two coordinates
const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.latitude - point1.latitude) * (Math.PI / 180);
  const dLon = (point2.longitude - point1.longitude) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.latitude * (Math.PI / 180)) * Math.cos(point2.latitude * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * 🔄 PHASE 5C: Estimate ETA in minutes from driver to passenger
 * Uses simple distance-based estimation (5-10 minutes per km in urban area)
 * @param driverLocation - Driver's current location
 * @param passengerLocation - Passenger's current location
 * @returns Estimated minutes, or null if locations are invalid
 */
const estimateETA = (driverLocation: Coordinate | undefined, passengerLocation: Coordinate | undefined): number | null => {
  if (!driverLocation || !passengerLocation) return null;

  const distanceKm = calculateDistance(driverLocation, passengerLocation);
  // Average urban driving: 6-7 min/km
  const estimatedMinutes = Math.round(distanceKm * 6.5);
  return Math.max(1, estimatedMinutes); // Minimum 1 minute
};

export const HomeProvider = ({ children }: PropsWithChildren<{}>) => {
  const [showWelcomeView, setShowWelcomeView] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [selectedSpinLocation, setSelectedSpinLocation] = useState<any>(null);
  const [trip, setTrip] = useState<any>(null);
  const [isRestoringTrip, setIsRestoringTrip] = useState(true);

  // Location search state
  const [pickupQueryFragment, setPickupQueryFragment] = useState('');
  const [queryFragment, setQueryFragment] = useState('');
  const [pickupCoordinate, setPickupCoordinate] = useState<Coordinate | null>(null);
  const [destinationCoordinate, setDestinationCoordinate] = useState<Coordinate | null>(null);
  const [currentLocation, setCurrentLocation] = useState('');

  // Route state
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  // Drivers state
  const [nearbyDrivers, setNearbyDrivers] = useState<Driver[]>([]);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
  const [currentDriverLocation, setCurrentDriverLocation] = useState<DriverCoordinate | null>(null);
  const [estimatedArrivalTimeText, setEstimatedArrivalTimeText] = useState<string | null>(null);
  const [driverETAtoPickup, setDriverETAtoPickup] = useState<number | null>(null);
  const [estimatedArrivalDistance, setEstimatedArrivalDistance] = useState<number | null>(null);
  const [destinationETA, setDestinationETA] = useState<number | null>(null);

  // Trip status state
  const [tripStatus, setTripStatus] = useState<TripStatus>('unknown');

  const socket = useContext(SocketContext);

  // 🔄 Restore active trip from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem('activeTrip')
      .then(saved => {
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('✅ Restored trip:', parsed.id);
          setTrip(parsed);
        }
        setIsRestoringTrip(false);
      })
      .catch(err => {
        console.error('❌ Failed to restore trip:', err);
        setIsRestoringTrip(false);
      });
  }, []);

  // 🌍 Fetch user's exact address on mount
  useEffect(() => {
    const fetchUserAddress = async () => {
      try {
        // Get current position using LocationService
        const location = await PassengerLocationService.getCurrentPosition();

        if (!location) {
          console.error('❌ [PASSENGER] Failed to get location');
          setCurrentLocation('Min plats');
          setPickupQueryFragment('Min plats');
          return;
        }

        console.log('📍 [PASSENGER] Got user location:', location);
        setUserLocation({
          latitude: location.latitude,
          longitude: location.longitude
        });
        setPickupCoordinate({
          latitude: location.latitude,
          longitude: location.longitude
        });

        // Reverse geocode to get exact address
        try {
          const address = await GeocodingService.reverseGeocode({
            latitude: location.latitude,
            longitude: location.longitude
          });
          console.log('🏠 [PASSENGER] Got address:', address);

          if (address) {
            // Format address (remove country, keep meaningful parts)
            const formatAddress = (raw: string): string => {
              if (!raw) return 'Min plats';
              // If only coordinates are available, prefer a friendly label for the UI placeholder.
              if (/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(raw)) {
                return 'Min plats';
              }
              const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
              if (parts.length === 0) return 'Min plats';
              let first = parts[0];
              const countryBlacklist = ['Sverige', 'Sweden'];
              const cityCandidates = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping'];
              const city = parts.find(p => cityCandidates.includes(p) && !countryBlacklist.includes(p));
              // If first segment is only numeric (integer or decimal), prefer next meaningful part
              if (/^\d{1,3}(\.\d+)?$/.test(first) && parts.length > 1) {
                first = parts[1];
              }
              let result = first;
              if (city && city !== first) result += `, ${city}`;
              if (result.length > 40) result = result.slice(0, 37).trimEnd() + '…';
              return result;
            };

            const formattedAddress = formatAddress(address);
            setCurrentLocation(formattedAddress);
            setPickupQueryFragment(formattedAddress);
            console.log('✅ [PASSENGER] Set current location to:', formattedAddress);
          } else {
            setCurrentLocation('Min plats');
            setPickupQueryFragment('Min plats');
          }
        } catch (error) {
          console.error('❌ [PASSENGER] Failed to reverse geocode:', error);
          setCurrentLocation('Min plats');
          setPickupQueryFragment('Min plats');
        }
      } catch (error) {
        console.error('❌ [PASSENGER] Failed to fetch user address:', error);
        setCurrentLocation('Min plats');
        setPickupQueryFragment('Min plats');
      }
    };

    fetchUserAddress();
  }, []);

  // 💾 Auto-save trip to AsyncStorage
  useEffect(() => {
    if (trip?.id) {
      AsyncStorage.setItem('activeTrip', JSON.stringify(trip));
    } else {
      AsyncStorage.removeItem('activeTrip');
    }
  }, [trip]);

  // 🔔 Listen to Firebase trip updates
  useEffect(() => {
    if (!trip?.id) return;

    const unsubscribe = TripStatusManager.subscribe(trip.id, (event) => {
      console.log('📡 Trip update:', event.previousStatus, '→', event.newStatus);
      
      // Update trip with latest data from Firebase
      if (event.tripData) {
        setTrip(event.tripData);
      }
      
      setTripStatus(event.newStatus);

      // Clear trip on completion/cancellation
      if (['completed', 'cancelled', 'passengercancelled', 'drivercancelled'].includes(event.newStatus)) {
        setTimeout(() => setTrip(null), 2000);
      }
    });

    return () => unsubscribe();
  }, [trip?.id]);

  // Initialize real-time driver tracking (ONCE on mount) - Same as Swift HomeViewModel
  useEffect(() => {
    console.log('🏠 [HomeProvider] MOUNTING - Initializing real-time driver tracking NOW');

    let callbackCount = 0;

    DriverService.initializeDriverTracking((drivers: Driver[]) => {
      callbackCount++;
      console.log(`✅ [HomeProvider callback #${callbackCount}] Received drivers update:`, drivers.length, 'drivers');

      // Log by category for debugging
      const byCategory = new Map<string, number>();
      drivers.forEach(d => {
        const carType = d.carInfo?.carType || d.carType;
        const cat = String(carType);
        byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
      });
      console.log('   Drivers by category:', Object.fromEntries(byCategory));

      if (drivers.length > 0) {
        console.log('   First driver:', {
          id: drivers[0].id,
          location: drivers[0].currentLocation || drivers[0].location,
          carType: drivers[0].carInfo?.carType || drivers[0].carType,
        });
      }

      setNearbyDrivers(drivers);
      setIsLoadingDrivers(false);
    });

    // Cleanup on unmount
    return () => {
      console.log('🛑 [HomeProvider] UNMOUNTING - Cleaning up driver tracking');
      DriverService.cleanup();
    };
  }, []); // ← Initialize ONLY once on mount - just like Swift!  // Declare passenger interest to server when location changes (for optimized delta) - Like Swift's passengerDeclareInterest
  useEffect(() => {
    if (!userLocation) return;

    console.log('📍 [HomeProvider] Declaring passenger interest to server');

    // This tells the server which geo-region we're interested in
    // Server will send delta updates for drivers in this region
    DriverService.declarePassengerInterest({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      radiusKm: 20,
    });
  }, [userLocation]);

  useEffect(() => {
    if (!trip) {
      setCurrentDriverLocation(null);
      setEstimatedArrivalTimeText(null);
      setDriverETAtoPickup(null);
      setEstimatedArrivalDistance(null);
      setDestinationETA(null);
    }
  }, [trip]);

  return (
    <HomeContext.Provider value={useMemo(() => ({
      showWelcomeView,
      setShowWelcomeView,
      userLocation,
      setUserLocation,
      selectedSpinLocation,
      setSelectedSpinLocation,
      trip,
      setTrip,
      pickupQueryFragment,
      setPickupQueryFragment,
      queryFragment,
      setQueryFragment,
      pickupCoordinate,
      setPickupCoordinate,
      destinationCoordinate,
      setDestinationCoordinate,
      currentLocation,
      setCurrentLocation,
      routePoints,
      setRoutePoints,
      isRouteLoading,
      setIsRouteLoading,
      nearbyDrivers,
      setNearbyDrivers,
      isLoadingDrivers,
      setIsLoadingDrivers,
      currentDriverLocation,
      setCurrentDriverLocation,
      estimatedArrivalTimeText,
      setEstimatedArrivalTimeText,
      driverETAtoPickup,
      setDriverETAtoPickup,
      estimatedArrivalDistance,
      setEstimatedArrivalDistance,
      destinationETA,
      setDestinationETA,
      tripStatus,
      setTripStatus,
    }), [
      showWelcomeView,
      userLocation,
      selectedSpinLocation,
      trip,
      pickupQueryFragment,
      queryFragment,
      pickupCoordinate,
      destinationCoordinate,
      currentLocation,
      routePoints,
      isRouteLoading,
      nearbyDrivers,
      isLoadingDrivers,
      currentDriverLocation,
      estimatedArrivalTimeText,
      driverETAtoPickup,
      estimatedArrivalDistance,
      destinationETA,
      tripStatus,
    ])}>
      {children}
    </HomeContext.Provider>
  );
};
