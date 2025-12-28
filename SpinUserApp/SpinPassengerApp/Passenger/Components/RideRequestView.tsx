// RideRequestView.tsx

import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SocketContext } from '../../context/SocketContext';
import FirebaseManager from '../../firebase/FirebaseManager';
import { DriverService } from '../../services/DriverService';
import PassengerLocationService from '../../services/PassengerLocationService';
import PaymentManager from '../../services/PaymentManager';
import { CarType } from '../../types/Driver';
import { PaymentOption, PaymentOptionFactory } from '../../types/PaymentOption';
import { availableCategories, computePrice, passengerCount as paxCount, tagline as pricingTagline } from '../../utils/Pricing';
import { RouteService } from '../../utils/RouteService';
import { HomeContext } from '../context/HomeContext';
import BookingDatePickerView from '../Forbokning/BookingDatePickerView';
import DriverNoteModal from './DriverNoteModal';
import PaymentSelectionView from './PaymentSelectionView';
import CustomPriceView from '../PassView/CustomPriceView';

// Helper to shorten long addresses (keep first meaningful part + city/district if possible)
function formatAddress(raw: string): string {
  if (!raw) return '';
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return raw;
  const first = parts[0];
  const countryBlacklist = ['Sverige', 'Sweden'];
  const cityCandidates = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping'];
  const city = parts.find(p => cityCandidates.includes(p) && !countryBlacklist.includes(p));
  let result = first;
  if (city && city !== first) result += `, ${city}`;
  if (result.length > 40) result = result.slice(0, 37).trimEnd() + '…';
  return result;
}

export interface RideType {
  id: string;
  name: string;
  description: string;
  carType: CarType;
  passengerCount: number;
  basePrice: number;
  imageName: string;
  isAvailable: boolean;
  estimatedTime?: string;
}

interface RideRequestViewProps {
  visible: boolean;
  onClose: () => void;
  onBookTrip?: (rideType: RideType, paymentOption: PaymentOption, note: string, scheduledDate?: Date, customPrice?: number) => void;
  pickupLocation: string;
  destinationLocation: string;
  initialScheduledDate?: Date;
}

export default function RideRequestView({
  visible,
  onClose,
  onBookTrip,
  pickupLocation,
  destinationLocation,
  initialScheduledDate,
}: RideRequestViewProps) {
  // Normalize car type keys across sources (server enums/strings can vary)
  const normalizeTypeKey = (v: string | number) => String(v).toLowerCase().trim();
  // UI sizing: cap the visible height of the ride list and force scrolling
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const LIST_MAX_HEIGHT = Math.min(340, Math.round(SCREEN_HEIGHT * 0.36));
  const homeContext = useContext(HomeContext);
  const { nearbyDrivers, userLocation, pickupCoordinate, destinationCoordinate, routePoints, setNearbyDrivers } = homeContext as any;
  const socket = useContext(SocketContext);

  // Firestore-driven categories from online drivers (Pricing names)
  type PricingKey = 'Spin Go' | 'Spin' | 'Komfort' | 'XL' | 'Premium' | 'Limousine';
  const [onlineCategoryNames, setOnlineCategoryNames] = useState<Set<PricingKey>>(new Set());

  // Map Firestore category keys to Pricing names used in UI
  const mapCategoryKeyToPricingName = (raw: string): PricingKey | null => {
    const key = String(raw).toLowerCase().trim();
    switch (key) {
      case 'spingo':
      case 'spin go':
      case 'go':
        return 'Spin Go';
      case 'spin':
        return 'Spin';
      case 'komfort':
      case 'comfort':
        return 'Komfort';
      case 'xl':
        return 'XL';
      case 'premium':
        return 'Premium';
      case 'limousine':
      case 'limosin':
      case 'limo':
        return 'Limousine';
      default:
        return null;
    }
  };

  // Listen directly to Firestore for online drivers' activeCategories
  useEffect(() => {
    if (!visible) return;

    let unsubscribe: (() => void) | null = null;
    let mounted = true;

    const start = async () => {
      try {
        const fm = FirebaseManager.getInstance();
        if (!fm.isInitialized()) {
          await fm.initialize();
        }
        const db = fm.getFirestore();
        // Query all online drivers; we only need their categories
        unsubscribe = db
          .collection('drivers')
          .where('isOnline', '==', true)
          .onSnapshot((snap: FirebaseFirestoreTypes.QuerySnapshot) => {
            if (!mounted) return;
            const names = new Set<PricingKey>();
            snap.forEach(doc => {
              const data = doc.data() as any;
              // Strict: only use activeCategories (no fallback)
              const cats: string[] = Array.isArray(data?.activeCategories) ? data.activeCategories : [];
              cats.forEach(c => {
                const name = mapCategoryKeyToPricingName(c);
                if (name) names.add(name);
              });
            });
            setOnlineCategoryNames(names);
            try {
              console.log('🟢 [RideRequestView] Firestore online categories:', Array.from(names));
            } catch { }
          }, (err) => {
            console.error('🔥 Firestore onSnapshot error (drivers/isOnline):', err);
          });
      } catch (e) {
        console.error('🔥 Failed to start Firestore listener for online categories:', e);
      }
    };

    start();

    return () => {
      mounted = false;
      try { unsubscribe && unsubscribe(); } catch { }
    };
  }, [visible]);

  // Real-time: refresh driver list on socket deltas while the sheet is visible
  useEffect(() => {
    if (!visible) return;

    let isActive = true;
    const lastRefreshAtRef = { current: 0 } as { current: number };
    const MIN_REFRESH_MS = 400;

    const origin = (pickupCoordinate || userLocation) as { latitude: number; longitude: number } | null;

    const refreshDrivers = async (reason: string) => {
      if (!isActive) return;
      const now = Date.now();
      if (now - lastRefreshAtRef.current < MIN_REFRESH_MS) return; // throttle
      lastRefreshAtRef.current = now;
      try {
        if (!origin) return;
        const drivers = await DriverService.fetchNearbyDrivers({ userLocation: origin, radiusKm: 20 });
        if (!isActive) return;
        if (Array.isArray(drivers)) {
          setNearbyDrivers(drivers);
        }
      } catch (e) {
        // Silent – keep UI responsive even if a fetch fails transiently
      }
    };

    // Initial refresh when view opens
    refreshDrivers('initial');

    // Handlers for full and delta updates
    const onOnlineDrivers = () => refreshDrivers('onlineDrivers');
    const onDriverDelta = () => refreshDrivers('driverDelta');
    const onSocketConnect = () => refreshDrivers('socketConnect');
    const onSocketReconnect = () => refreshDrivers('socketReconnect');

    // Guard if socket is not available
    if (socket && typeof socket.on === 'function') {
      socket.on('onlineDrivers', onOnlineDrivers);
      socket.on('driverDelta', onDriverDelta);
      socket.on('connect', onSocketConnect);
      socket.on('reconnect', onSocketReconnect);
    }

    return () => {
      isActive = false;
      if (socket && typeof socket.off === 'function') {
        socket.off('onlineDrivers', onOnlineDrivers);
        socket.off('driverDelta', onDriverDelta);
        socket.off('connect', onSocketConnect);
        socket.off('reconnect', onSocketReconnect);
      }
    };
  }, [visible, socket, pickupCoordinate, userLocation, setNearbyDrivers]);

  // 🔄 PHASE 5C: Use drivers from HomeContext
  // HomeContext initializes DriverService which listens to socket events
  // Just ensure we have the latest data when sheet opens
  useEffect(() => {
    if (!visible) {
      console.log('📡 [RideRequestView] Hidden - not logging drivers');
      return;
    }

    if (!pickupCoordinate) {
      console.log('📡 [RideRequestView] Visible but NO pickup coordinate yet');
      return;
    }

    console.log('═══════════════════════════════════════════');
    console.log('📡 [RideRequestView] OPENED - Current driver status:');
    console.log(`   Total drivers available: ${nearbyDrivers.length}`);

    // Log drivers by category for debugging (both raw and normalized)
    const byCategory = new Map<string, number>();
    const byCategoryNormalized = new Map<string, number>();
    nearbyDrivers.forEach((d: any) => {
      const raw = String(d?.carInfo?.carType ?? 'unknown');
      const norm = normalizeTypeKey(raw);
      byCategory.set(raw, (byCategory.get(raw) || 0) + 1);
      byCategoryNormalized.set(norm, (byCategoryNormalized.get(norm) || 0) + 1);
    });

    if (byCategory.size > 0) {
      console.log('   Drivers by category (raw):');
      byCategory.forEach((count, cat) => {
        console.log(`     - ${cat}: ${count} driver(s)`);
      });
      console.log('   Drivers by category (normalized):');
      byCategoryNormalized.forEach((count, cat) => {
        console.log(`     - ${cat}: ${count} driver(s)`);
      });
    } else {
      console.log('   ⚠️ NO DRIVERS in nearbyDrivers array!');
    }
    console.log('═══════════════════════════════════════════');
  }, [visible, pickupCoordinate, nearbyDrivers]);

  // Helper: ETA from km using average city speed (35 km/h)
  const KMH_PER_MINUTE = 35 / 60;
  const minutesFromKm = (km: number) => Math.max(1, Math.round(km / KMH_PER_MINUTE));

  // Helper distance calculation (memoized)
  const calcDistanceKm = useMemo(() => {
    return (a: any, b: any) => {
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(b.latitude - a.latitude);
      const dLon = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);
      const sinDLat = Math.sin(dLat / 2);
      const sinDLon = Math.sin(dLon / 2);
      const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
      return R * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
    };
  }, []);

  // Compute dynamic ETA per car type based on nearest online drivers (memoized)
  const etaByType = useMemo(() => {
    const origin = (pickupCoordinate || userLocation) as { latitude: number; longitude: number } | null;
    if (!origin || nearbyDrivers.length === 0) return {} as Record<string, string>;

    const groups: Record<string, number[]> = {};

    nearbyDrivers.forEach((d: any) => {
      const km: number = calcDistanceKm(origin, d.currentLocation);
      const key: string = normalizeTypeKey(d?.carInfo?.carType);
      if (!groups[key]) groups[key] = [];
      groups[key].push(minutesFromKm(km));
    });

    const result: Record<string, string> = {};
    Object.keys(groups).forEach(key => {
      const list = groups[key].sort((a, b) => a - b).slice(0, 4); // up to 4 nearest
      if (list.length === 0) return;
      const min = list[0];
      const max = list[Math.max(0, list.length - 1)];
      result[key] = min === max ? `${min} min` : `${min}-${max} min`;
    });
    // Debug keys we computed to correlate with ride types
    try {
      console.log('[RideRequestView] ETA keys (normalized):', Object.keys(result));
    } catch { }
    return result;
  }, [nearbyDrivers, userLocation, pickupCoordinate, calcDistanceKm]);

  // Build availability counts by normalized type key – capped to the 5 nearest drivers per type
  const availabilityByType = useMemo(() => {
    // If we have an origin, count nearest 5 per type; else, clamp totals to 5
    const origin = (pickupCoordinate || userLocation) as { latitude: number; longitude: number } | null;

    // Collect distances per type
    const distancesByType: Record<string, number[]> = {};
    nearbyDrivers.forEach((d: any) => {
      const key = normalizeTypeKey(d?.carInfo?.carType);
      if (!distancesByType[key]) distancesByType[key] = [];
      if (origin && d?.currentLocation) {
        try {
          const km = calcDistanceKm(origin, d.currentLocation);
          distancesByType[key].push(km);
        } catch {
          // Ignore malformed coordinates
        }
      } else {
        // No origin to compute distance – we'll mark with a sentinel to count later
        distancesByType[key].push(Number.POSITIVE_INFINITY);
      }
    });

    const map: Record<string, number> = {};
    Object.keys(distancesByType).forEach((key) => {
      const arr = distancesByType[key];
      if (origin) {
        // Sort by distance ascending and take up to 5 nearest
        const count = arr.sort((a, b) => a - b).slice(0, 5).length;
        map[key] = count;
      } else {
        // No origin available, clamp total to max 5
        map[key] = Math.min(arr.length, 5);
      }
    });

    try {
      console.log('[RideRequestView] Availability (nearest up to 5) by type:', map);
    } catch { }
    return map;
  }, [nearbyDrivers, pickupCoordinate, userLocation, calcDistanceKm]);

  // State
  const [selectedRideType, setSelectedRideType] = useState<RideType | null>(null);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentOption | null>(null);
  const [driverNote, setDriverNote] = useState('');
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [tripPayer, setTripPayer] = useState<'personal' | 'company'>('personal');

  // Swift-like extras
  const [showCustomPriceSheet, setShowCustomPriceSheet] = useState(false);
  const [fixPrices, setFixPrices] = useState<Record<string, number>>({}); // key: rideType.id
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lastScheduledDate, setLastScheduledDate] = useState<Date | null>(initialScheduledDate || null);
  // Prevent double submit / double booking
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastSubmitAtRef = useRef<number>(0);

  // Car images by normalized key
  const getCarImageByKey = (key: string) => {
    switch (key) {
      case 'spingo':
        return require('../../assets/spingo.png');
      case 'spin':
        return require('../../assets/Spin.png');
      case 'komfort':
        // Komfort image (lowercase extension to avoid Metro issues)
        return require('../../assets/komfort.png');
      case 'xl':
      case 'XL':
        return require('../../assets/XL.png');
      case 'premium':
        // Premium image (lowercase extension)
        return require('../../assets/premium.png');
      case 'limousine':
      case 'limosin':
        // Limousine image file provided as 'limosin.png'
        return require('../../assets/limosin.png');
      default:
        return require('../../assets/Spin.png');
    }
  };

  // Uppdatera lastScheduledDate när initialScheduledDate ändras
  useEffect(() => {
    if (initialScheduledDate) {
      setLastScheduledDate(initialScheduledDate);
    }
  }, [initialScheduledDate]);

  // Compute trip distance in meters (sum route polyline if available, fallback to straight-line)
  const distanceMeters = useMemo(() => {
    try {
      // ALWAYS use straight-line distance like iOS (not route polyline)
      // iOS uses CLLocation.distance(from:) which is straight-line Haversine distance
      if (pickupCoordinate && destinationCoordinate) {
        const km = RouteService.calculateDistance(pickupCoordinate, destinationCoordinate);
        return Math.round(km * 1000);
      }
      return 0;
    } catch {
      return 0;
    }
  }, [pickupCoordinate, destinationCoordinate]);

  // Auto-close if opened without required inputs (e.g., user backed out of search)
  useEffect(() => {
    if (!visible) return;
    const hasPickup = !!(pickupLocation && pickupLocation.trim().length > 0);
    const hasDestination = !!(destinationLocation && destinationLocation.trim().length > 0);
    // Do NOT require route yet; allow sheet to show while route computes
    if (!hasPickup || !hasDestination) {
      const t = setTimeout(() => {
        try { onClose(); } catch { }
      }, 10); // allow parent/context to flush cleared state
      return () => clearTimeout(t);
    }
  }, [visible, pickupLocation, destinationLocation, routePoints]);

  // Android hardware back closes the sheet ONLY when visible
  useEffect(() => {
    if (!visible) return;

    const onBack = () => {
      onClose();
      return true; // Only consume event when component is visible
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible, onClose]);

  // Ride types based on available drivers
  // Om förbokad (lastScheduledDate finns), visa alla bilar som tillgängliga
  interface NearbyDriverAvailability {
    carInfo: { carType: CarType };
  }

  const isPrebooked = !!lastScheduledDate;

  // Hämta aktuell stad baserat på destination eller användarens position
  const currentCity = useMemo(() => {
    // Om destination finns, använd det för stad-detektering
    // Annars använd pickup-platsen
    const location = destinationCoordinate || userLocation || pickupCoordinate;
    if (!location) {
      console.log('⚠️ No location available for city detection');
      return null;
    }
    const city = PassengerLocationService.getCurrentCity(location);
    console.log('🏛️ Current city detected:', city, 'from location:', location, '(destination?', !!destinationCoordinate, ')');
    return city;
  }, [destinationCoordinate, userLocation, pickupCoordinate]);

  // Hämta tillgängliga kategorier baserat på stad
  const allowedCategories = useMemo(() => {
    const categories = availableCategories(currentCity);
    console.log('🚗 Allowed categories for', currentCity || 'unknown city', ':', categories);
    return categories;
  }, [currentCity]);

  // Build ride types from a mapping so we reuse Pricing.ts consistently

  // Pricing map used to render ride types
  const typeMap: Array<{
    id: string;
    name: PricingKey;
    carType: CarType;
    imageName: string;
    description: string;
  }> = [
      { id: 'spingo', name: 'Spin Go', carType: (CarType as any).SpinGo ?? CarType.Spin, imageName: 'car-spingo', description: pricingTagline['Spin Go'] },
      { id: 'spin', name: 'Spin', carType: CarType.Spin, imageName: 'car-standard', description: pricingTagline.Spin },
      { id: 'komfort', name: 'Komfort', carType: CarType.Komfort ?? (CarType as any).komfort, imageName: 'car-comfort', description: pricingTagline.Komfort },
      { id: 'XL', name: 'XL', carType: CarType.Van, imageName: 'car-xl', description: pricingTagline.XL },
      { id: 'premium', name: 'Premium', carType: CarType.Premium, imageName: 'car-premium', description: pricingTagline.Premium },
      // Limousine support (prebook or if drivers of this type are online)
      { id: 'limousine', name: 'Limousine', carType: (CarType as any).Limousine ?? (CarType as any).Premium, imageName: 'car-limo', description: pricingTagline.Limousine },
    ];

  const rideTypes: RideType[] = typeMap
    .filter(t => {
      // Filtrera baserat på tillåtna kategorier för staden
      // Combine city-based allowed categories with Firestore online categories
      const isAllowed = allowedCategories.includes(t.name);
      if (!isAllowed) {
        console.log(`  ❌ ${t.name} filtered out - not in allowedCategories: ${JSON.stringify(allowedCategories)}`);
        return false;
      }
      // iOS parity: when prebooking, show only Spin, Komfort, XL
      if (isPrebooked) {
        const isPrebookedType = t.id === 'spin' || t.id === 'komfort' || t.id === 'XL';
        if (!isPrebookedType) {
          console.log(`  ⏳ ${t.name} filtered out - not available for prebooked trips`);
        }
        return isPrebookedType;
      }
      console.log(`  ✅ ${t.name} included`);
      return true;
    })
    .map((t) => {
      const enumName = (CarType as any)[t.carType as any];
      const normKey = normalizeTypeKey(enumName ?? t.carType);
      const available = isPrebooked || onlineCategoryNames.has(t.name);
      const etaKey = normKey;

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        carType: t.carType,
        passengerCount: paxCount[t.name],
        basePrice: computePrice(t.name, distanceMeters),
        imageName: t.imageName,
        isAvailable: available,
        estimatedTime: isPrebooked ? undefined : etaByType[etaKey],
      } as RideType;
    });

  // Formatters
  const formatCurrency = useMemo(() => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }), []);
  const bookingButtonSubtitle = useMemo(() => {
    if (!lastScheduledDate) return null;
    // Show only date and time (no 10-minute margin window)
    const dateStr = lastScheduledDate.toLocaleDateString('sv-SE'); // e.g., 2025-11-03
    const timeStr = lastScheduledDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }); // e.g., 16:30
    return `${dateStr}, ${timeStr}`;
  }, [lastScheduledDate]);

  // Hämta tillgängliga betalningsalternativ från PaymentManager (async)
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [loadingPaymentOptions, setLoadingPaymentOptions] = useState(true);

  useEffect(() => {
    const loadPaymentOptions = async () => {
      setLoadingPaymentOptions(true);
      const paymentManager = PaymentManager.getInstance();
      const options = await paymentManager.getAvailablePaymentOptions();
      setPaymentOptions(options);
      setLoadingPaymentOptions(false);
    };

    if (visible) {
      loadPaymentOptions();
    }
  }, [visible]);

  // Set default selections
  useEffect(() => {
    if (!selectedRideType && rideTypes.length > 0) {
      const availableRide = rideTypes.find(r => r.isAvailable);
      setSelectedRideType(availableRide || rideTypes[0]);
    }
    // Default to first available payment option
    if (!selectedPaymentOption && paymentOptions.length > 0) {
      setSelectedPaymentOption(paymentOptions[0]);
    }
  }, [nearbyDrivers, paymentOptions, isPrebooked]);

  // Keep tripPayer in sync with the selected payment option
  useEffect(() => {
    if (!selectedPaymentOption) return;
    const isCompany = String(selectedPaymentOption.type).toLowerCase() === 'company';
    setTripPayer(isCompany ? 'company' : 'personal');
  }, [selectedPaymentOption]);

  // When toggling payer, enforce a suitable selectedPaymentOption
  useEffect(() => {
    if (tripPayer === 'company') {
      if (!selectedPaymentOption || String(selectedPaymentOption.type).toLowerCase() !== 'company') {
        setSelectedPaymentOption(PaymentOptionFactory.createCompany());
      }
    } else {
      if (selectedPaymentOption && String(selectedPaymentOption.type).toLowerCase() === 'company') {
        if (paymentOptions.length > 0) setSelectedPaymentOption(paymentOptions[0]);
        else setSelectedPaymentOption(null);
      }
    }
  }, [tripPayer, paymentOptions]);

  // 🎁 Auto-tillämpa 10% rabatt på samtliga åktyper (visa alltid nedsatt pris)
  useEffect(() => {
    if (!visible || rideTypes.length === 0) return;

    // iOS parity: remove discount when prebooking
    if (isPrebooked) {
      if (Object.keys(fixPrices).length > 0) {
        setFixPrices({});
      }
      return;
    }

    const newPrices: Record<string, number> = { ...fixPrices };
    let hasChanges = false;

    rideTypes.forEach(ride => {
      if (fixPrices[ride.id] == null) {
        const original = ride.basePrice;
        const discounted = Math.round(original * 0.90);
        newPrices[ride.id] = discounted;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setFixPrices(newPrices);
    }
  }, [visible, rideTypes, isPrebooked]);

  const displayedPrice = (ride: RideType) => {
    const custom = fixPrices[ride.id];
    // compute baseline fresh to ensure it's in sync with latest distance
    const baseline = computePrice(ride.name as any, distanceMeters);
    return typeof custom === 'number' ? Math.round(custom) : baseline;
  };
  const hasCustomPrice = (ride: RideType) => fixPrices[ride.id] != null;

  // Helper: Convert technical payment error to user-friendly message
  const getPaymentErrorMessage = (techError: string | undefined): string => {
    if (!techError) return 'Betalningen gick inte igenom. Kontrollera dina kortuppgifter och försök igen.';

    const errorLower = techError.toLowerCase();

    // Map technical errors to user-friendly messages
    if (errorLower.includes('declined') || errorLower.includes('declined')) {
      return 'Kortet blev nekad. Kontrollera att kortnumret och utgångsdatumet är korrekt.';
    }
    if (errorLower.includes('insufficient') || errorLower.includes('funds')) {
      return 'Du har inte tillräckligt med pengar på kontot. Välj en annan betalmetod.';
    }
    if (errorLower.includes('expired')) {
      return 'Ditt kort har gått ut. Välj en annan betalmetod.';
    }
    if (errorLower.includes('invalid') || errorLower.includes('customer') || errorLower.includes('tripid')) {
      return 'Betalningen kunde inte genomföras. Försök välja en annan betalmetod.';
    }
    if (errorLower.includes('network') || errorLower.includes('timeout')) {
      return 'Nätverksfel. Kontrollera din internetanslutning och försök igen.';
    }

    // Default user-friendly message
    return 'Betalningen misslyckades. Försök välja en annan betalmetod eller kontakta supporten.';
  };

  const handleBooking = async () => {
    // Guard: prevent double tap & throttle submissions
    if (isSubmitting) return;
    const now = Date.now();
    if (now - lastSubmitAtRef.current < 1500) return;
    setIsSubmitting(true);
    lastSubmitAtRef.current = now;
    if (!selectedRideType) { Alert.alert('Fel', 'Välj en resa först'); return; }
    if (!selectedPaymentOption) { Alert.alert('Fel', 'Välj betalningsmetod'); return; }

    const price = displayedPrice(selectedRideType);

    try {
      // Processa betalning om det inte är kontant eller företag
      if (selectedPaymentOption.type !== 'cash' && selectedPaymentOption.type !== 'company') {
        const paymentManager = PaymentManager.getInstance();
        const paymentRequest = { merchantName: 'Spin', amount: String(price), currencyCode: 'SEK', countryCode: 'SE' } as const;
        const paymentResult = await paymentManager.processPayment(selectedPaymentOption, paymentRequest);
        if (!paymentResult.success) {
          const userMessage = getPaymentErrorMessage(paymentResult.error);
          Alert.alert('Betalning misslyckades', userMessage);
          return;
        }
      }

      if (onBookTrip) {
        onBookTrip(selectedRideType, selectedPaymentOption, driverNote, lastScheduledDate || undefined, price);
      } else {
        onClose();
      }
    } finally {
      // Keep a short throttle window via lastSubmitAtRef; re-enable UI now
      setIsSubmitting(false);
    }
  };

  // Scheduling (simple presets like Swift flow)
  const preparePrebooking = () => {
    console.log('🕐 preparePrebooking called');
    console.log('📍 selectedRideType:', selectedRideType);
    console.log('✅ isAvailable:', selectedRideType?.isAvailable);
    setShowDatePicker(true);
  };

  const confirmSchedule = (date: Date) => {
    console.log('✅ Schedule confirmed:', date);
    setLastScheduledDate(date);
    setShowDatePicker(false);
  };

  const openCustomPrice = (ride: RideType) => {
    setSelectedRideType(ride);
    setShowCustomPriceSheet(true);
  };

  // UI
  return (
    <View style={[styles.container, { display: visible ? 'flex' : 'none', backgroundColor: visible ? '#FFFFFF' : 'transparent' }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.dragIndicator} />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Icon name="close" size={20} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Content area (fills space above bottom controls) */}
      <View style={styles.contentFlex}>
        {/* Trip Info */}
        <View style={styles.tripInfo}>
          <View style={styles.tripRoute}>
            <View style={styles.routeIndicators}>
              <Icon name="location" size={14} color="#007AFF" />
              <View style={styles.routeLine} />
              <Icon name="location" size={14} color="#FF3B30" />
            </View>
            <View style={styles.routeTexts}>
              <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                {formatAddress(pickupLocation)}
              </Text>
              <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                {formatAddress(destinationLocation)}
              </Text>
            </View>
          </View>
        </View>

        {/* Scrollable content (ride types) */}
        <ScrollView
          style={[styles.rideTypesContainer, { maxHeight: LIST_MAX_HEIGHT }]}
          showsVerticalScrollIndicator={true}
          alwaysBounceVertical={true}
          scrollEventThrottle={16}
          indicatorStyle="black"
          contentContainerStyle={{ paddingBottom: 12 }}
        >
          {rideTypes.map((ride, index) => {
            const isActive = selectedRideType?.id === ride.id;
            const isDisabled = !ride.isAvailable;
            const enumName = (CarType as any)[ride.carType as any];
            const normKey = normalizeTypeKey(enumName ?? ride.carType);
            const availCount = availabilityByType[normKey] || 0;
            const price = displayedPrice(ride);
            return (
              <View key={ride.id} style={styles.rideRowWrapper}>
                <TouchableOpacity
                  style={[styles.rideTypeCard, isActive && styles.rideTypeActive, isDisabled && styles.rideTypeDisabled]}
                  onPress={() => {
                    if (!(ride.isAvailable || isPrebooked)) return;
                    if (isActive) {
                      openCustomPrice(ride);
                    } else {
                      setSelectedRideType(ride);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.rideLeft}>
                    <View style={[styles.carIconContainerEnhanced, isDisabled && { opacity: 0.4 }]}>
                      <Image source={getCarImageByKey(normKey)} style={styles.carImage} resizeMode="contain" />
                    </View>
                    <View>
                      <Text style={[styles.rideTypeName, isDisabled && styles.disabledText]}>{ride.name}</Text>
                      <View style={styles.metaRow}>
                        <Icon name="person" size={12} color="#8E8E93" />
                        <Text style={styles.passengerCount}>{ride.passengerCount}</Text>
                        {isPrebooked && (
                          <View style={styles.prebookChip}>
                            <Icon name="calendar" size={12} color="#2E7D32" />
                          </View>
                        )}
                        {!isPrebooked && !ride.isAvailable && (
                          <Text style={[styles.availableText, styles.unavailable]}>Upptagen</Text>
                        )}
                      </View>
                      {!isDisabled && (
                        <Text style={[styles.rideTypeTagline, isDisabled && styles.disabledText]}>{ride.description}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.priceBlock}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.priceText, isDisabled && styles.disabledText]}>{formatCurrency.format(price)}</Text>
                      {isActive && (
                        <TouchableOpacity onPress={() => !isDisabled && openCustomPrice(ride)} activeOpacity={0.8}>
                          <Icon name="add-circle" size={16} color={isDisabled ? '#C7C7CC' : '#007AFF'} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {hasCustomPrice(ride) && (
                      <Text style={styles.strikePrice}>{formatCurrency.format(ride.basePrice)}</Text>
                    )}
                    {!isDisabled && !isPrebooked && (
                      <View style={styles.priceEtaRow}>
                        <Icon name="time" size={12} color="#8E8E93" />
                        <Text style={styles.priceEtaText}>{ride.estimatedTime || 'Beräknar...'}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                {index < rideTypes.length - 1 && <View style={styles.divider} />}
              </View>
            );
          })}
        </ScrollView>

      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControlsWrapper}>
        {/* Unified bottom card: Payment + Book/Prebook in same container */}
        <View style={styles.bottomCard}>
          {/* Payer toggle button + comment inline row (iOS style) */}
          <View style={styles.payerNoteRow}>
            <TouchableOpacity
              style={styles.payerToggleButton}
              onPress={() => setTripPayer(tripPayer === 'personal' ? 'company' : 'personal')}
              activeOpacity={0.9}
            >
              <View style={styles.payerIconActive}>
                <Icon
                  name={tripPayer === 'personal' ? 'person' : 'briefcase'}
                  size={18}
                  color="#fff"
                />
              </View>

              <View style={styles.payerLabelColumnHorizontal}>
                <Text style={styles.payerTextActive}>
                  {tripPayer === 'personal' ? 'Privat' : 'Företag'}
                </Text>
                <Text style={styles.payerSubText} numberOfLines={1}>
                  {selectedPaymentOption?.displayName || 'Kontant'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setShowPaymentSelection(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="chevron-down" size={16} color="#8E8E93" />
              </TouchableOpacity>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.noteButtonInline}
              onPress={() => setShowNoteInput(true)}
              activeOpacity={0.8}
            >
              <Icon name="create-outline" size={18} color="#8E8E93" />
              <Text style={styles.noteButtonInlineText} numberOfLines={1}>
                {driverNote || 'Kommentar till förare'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.bookButton,
                (!selectedRideType?.isAvailable || isSubmitting) && styles.disabledBookButton,
              ]}
              onPress={handleBooking}
              disabled={!selectedRideType?.isAvailable || isSubmitting}
              activeOpacity={0.9}
            >
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.bookButtonText}>
                  {`Boka ${selectedRideType?.name || 'Resa'}`}
                </Text>
                {!!bookingButtonSubtitle && (
                  <Text style={styles.bookButtonSubtitle}>{bookingButtonSubtitle}</Text>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={preparePrebooking}
              style={[styles.scheduleBtn, { backgroundColor: lastScheduledDate ? '#34C759' : '#0A84FF' }]}
              activeOpacity={0.9}
              disabled={isSubmitting}
            >
              <Icon name={lastScheduledDate ? 'checkmark-circle' : 'calendar'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <DriverNoteModal
          visible={showNoteInput}
          initialNote={driverNote}
          onSave={note => { setDriverNote(note); setShowNoteInput(false); }}
          onCancel={() => setShowNoteInput(false)}
        />

        <PaymentSelectionView
          visible={showPaymentSelection}
          personalOptions={paymentOptions}
          selected={selectedPaymentOption}
          onSelect={setSelectedPaymentOption}
          initialTab={tripPayer}
          onClose={() => setShowPaymentSelection(false)}
        />
      </View>

      {/* Custom Price Sheet */}
      <CustomPriceView
        visible={showCustomPriceSheet}
        originalPrice={selectedRideType ? selectedRideType.basePrice : 0}
        onClose={() => setShowCustomPriceSheet(false)}
        onSave={(value: number) => {
          if (!selectedRideType) return;
          setFixPrices(prev => ({ ...prev, [selectedRideType.id]: Math.round(value) }));
          setShowCustomPriceSheet(false);
        }}
      />

      {/* Full Date & Time Picker (iOS-like) */}
      <Modal
        visible={showDatePicker}
        transparent={false}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {/* Header */}
          <View style={styles.datePickerHeader}>
            <TouchableOpacity
              onPress={() => setShowDatePicker(false)}
              style={styles.datePickerCloseBtn}
            >
              <Icon name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.datePickerTitle}>Förboka resa</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Date Picker Content */}
          <BookingDatePickerView
            selectedDate={lastScheduledDate ?? new Date(Date.now() + 30 * 60 * 1000)}
            onConfirm={(d) => { confirmSchedule(d); }}
            onClose={() => setShowDatePicker(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

function PresetChip({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.chip} activeOpacity={0.9}>
      <Text style={styles.chipText}>{title}</Text>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    maxHeight: '52%',
    minHeight: 500,
  },
  header: { paddingTop: 8, paddingBottom: 6, alignItems: 'center' },
  dragIndicator: { width: 32, height: 3, backgroundColor: '#919194ff', borderRadius: 2 },
  closeButton: { position: 'absolute', right: 16, top: 8, padding: 8 },
  contentFlex: { flex: 1 },
  tripInfo: { backgroundColor: '#F8F9FA', marginHorizontal: 12, marginBottom: 0, borderRadius: 12, padding: 8 },
  tripRoute: { flexDirection: 'row', alignItems: 'stretch' },
  routeIndicators: { alignItems: 'center', marginRight: 12 },
  routeLine: { width: 2, flex: 1, minHeight: 32, backgroundColor: '#0A84FF', marginVertical: 4, borderRadius: 1 },
  routeTexts: { flex: 1, justifyContent: 'space-between', minHeight: 48 },
  locationText: { fontSize: 14, fontWeight: '600', color: '#8E8E93', marginBottom: 6 },
  rideTypesContainer: { backgroundColor: '#FFFFFF', marginHorizontal: 12, borderRadius: 12, flex: 1, marginBottom: 0 },
  rideRowWrapper: { marginVertical: 0 },
  prebookBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#34C759',
  },
  prebookBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    flex: 1,
  },
  prebookChip: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  prebookChipText: {
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: '600',
  },
  rideTypeCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 19, backgroundColor: '#FFF' },
  rideTypeActive: { borderWidth: 1.8, borderColor: '#000ac0ff' },
  rideTypeDisabled: { opacity: 0.8 },
  rideLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carIconContainerEnhanced: { width: 60, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F1F3' },
  carImage: { width: 50, height: 40 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  etaChip: { backgroundColor: '#F1F2F4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  etaText: { fontSize: 12, },
  priceBlock: { alignItems: 'flex-end' },
  divider: { height: 1, backgroundColor: '#E6E6EA', marginLeft: 5 },
  bottomControlsWrapper: { paddingHorizontal: 0, paddingBottom: 0 },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 4,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    paddingBottom: 22,
  },
  bookingSection: { paddingTop: 8, paddingBottom: 48 },
  paymentSectionBelow: { backgroundColor: 'transparent', borderRadius: 0, padding: 0, marginTop: 6, shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  bookButton: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8, flex: 1 },
  fullscreenBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  fullscreenCard: {
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    alignSelf: 'stretch',
    paddingBottom: 14,
  },
  disabledBookButton: { backgroundColor: '#C7C7CC' },
  bookButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  bookButtonSubtitle: { marginTop: 2, color: '#E5E7EB', fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 },
  // Privat/Företag toggle button
  payerToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D6F0FF',
    borderRadius: 16,
    paddingVertical: 2,
    paddingHorizontal: 12,
    minHeight: 18,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  payerIconButton: {
    padding: 0,
  },
  payerIconActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF'
  },
  payerSegment: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  payerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F4F7',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  payerChipActive: { backgroundColor: 'rgba(10,132,255,0.10)', borderColor: '#0A84FF' },
  payerIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' },
  payerText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  payerTextActive: { color: '#000000', fontSize: 14, fontWeight: '600' },
  payerLabelColumnHorizontal: { flex: 1 },
  payerSubText: { fontSize: 11, color: '#6B7280', marginTop: 0 },
  payerNoteRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  noteButtonInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingVertical: 2,
    paddingHorizontal: 12,
    minHeight: 18,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  noteButtonInlineText: { fontSize: 13, color: '#8E8E93', flex: 1 },
  scheduleBtn: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  carEmoji: { fontSize: 18 },
  rideTypeName: { fontSize: 15, fontWeight: '600', color: '#111' },
    rideTypeTagline: { fontSize: 12, color: '#666', marginTop: 2, marginBottom: 4 },
  passengerCount: { fontSize: 11, color: '#8E8E93', marginLeft: 4 },
  unavailableText: { fontSize: 11, color: '#FF8C34' },
  // Availability label styles
  availableText: { fontSize: 11, fontWeight: '600' },
  available: { color: '#2E7D32' },
  unavailable: { color: '#FF8C34' },
  priceText: { fontSize: 15, fontWeight: '600', color: '#000' },
  priceEtaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceEtaText: { fontSize: 12, color: '#6b7280' },
  disabledText: { color: '#42425bff' },
  strikePrice: { fontSize: 11, color: '#6b7280', textDecorationLine: 'line-through', marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0F0F0', borderRadius: 16, marginHorizontal: 4 },
  chipText: { fontSize: 13, fontWeight: '600', color: '#333' },

  // Modal styles
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
});
