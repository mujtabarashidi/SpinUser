
// RideRequestManager.ts - Android only

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { EmitterSubscription, NativeEventEmitter, NativeModules } from 'react-native';
// TODO: Update the import path below if SocketIOManager is located elsewhere in your project.
// TODO: Update the import path below to the correct location of SocketIOManager in your project.
// import { SocketIOManager } from '../../services/SocketIOManager'; // adjust path if needed
let SocketIOManager: any;
try {
  SocketIOManager = require('../../services/SocketIOManager').SocketIOManager;
} catch {
  console.warn('⚠️ SocketIOManager module not found. Please check the import path.');
  SocketIOManager = {};
}
// TODO: Update the import path below if PassengerLocationService is located elsewhere in your project.
import { PassengerLocationService } from '../../services/PassengerLocationService'; // adjust path if needed

// ----- Types -----
export type PaymentOption = 'cash' | 'card';

export interface RideType {
  description: string; // e.g., "Komfort", "Budget", "Premium"
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface SpinLocation {
  title: string;
  coordinate: LatLng;
}

export interface SpinUser {
  uid: string;
  fullname: string;
  phoneNumber?: string;
  driverPhoneNumber?: string;
  stripeCustomerId?: string;
  coordinate: { latitude: number; longitude: number };
  pickupAddress?: string;
  activeCategories?: string[];
}

export interface TripDoc {
  id: string;
  tripId: string;
  paymentIntentId?: string;
  [k: string]: any;
}

// Methods your existing HomeViewModel (or equivalent) should implement.
// These are already present in your app—this interface documents what we call here.
export interface HomeViewModel {
  currentUser?: SpinUser | null;

  // selection & state
  selectedSpinLocation?: SpinLocation | null;
  selectedPickupLocation?: SpinLocation | null;
  pickupCoordinate?: LatLng | null;
  pickupQueryFragment: string;
  userLocation?: LatLng | null;
  currentLocation: string;
  availableRideCategories: string[];
  selectedRideType?: RideType | null;
  driverNote?: string | null;
  pickupLocationCoordinate?: LatLng | null;

  // trip state
  trip?: TripDoc | null;
  drivers?: SpinUser[];
  customRidePrice?: number | null;

  // functions (already in your app)
  computeRidePrice(forType: RideType): number;
  requestTrip(args: {
    selectedPaymentOption?: PaymentOption | null;
    paymentIntentId?: string | null;
    customPrice?: number | null;
  }): void;

  fetchTrip(withID: string, completion: (trip: TripDoc | null) => void): void;

  fetchOnlineDrivers(completion: (drivers: SpinUser[]) => void): void;

  // mutable setters (optional depending on your state lib)
  setTrip?(t: TripDoc | null): void;
  setDrivers?(d: SpinUser[]): void;
  setSelectedRideType?(rt: RideType): void;
  setDriverNote?(note?: string | null): void;
  setPickupLocationCoordinate?(c: LatLng): void;
}

// ----- Small Event helper for showTripLoadingView -----
const EVT = new NativeEventEmitter(NativeModules.RideRequestManagerModule ?? {});
const SHOW_EVT = 'RideRequestManager.showTripLoadingView';

let _showTripLoadingView = false;
export function getShowTripLoadingView() {
  return _showTripLoadingView;
}
export function subscribeShowTripLoadingView(cb: (v: boolean) => void): EmitterSubscription {
  // Emit immediately
  cb(_showTripLoadingView);
  return EVT.addListener(SHOW_EVT, cb);
}
function setShowTripLoadingView(v: boolean) {
  _showTripLoadingView = v;
  EVT.emit(SHOW_EVT, v);
}

// ----- Utilities -----
function log(msg: string) {
  if (__DEV__) console.log(`🚗 RideRequestManager: ${msg}`);
}

function toGeoPoint(coord: LatLng) {
  return new firestore.GeoPoint(coord.latitude, coord.longitude);
}

function serverTimestamp() {
  return firestore.FieldValue.serverTimestamp();
}

function metersBetween(a: LatLng, b: LatLng) {
  // Haversine-ish via simple formula (sufficient here)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Map PaymentOption to firestore string
function paymentOptionToFirestoreValue(opt?: PaymentOption | null) {
  switch (opt) {
    case 'cash':
      return 'cash';
    case 'card':
      return 'card';
    default:
      return 'cash';
  }
}

// ----- Constants -----
const DEFAULT_NEARBY_RADIUS_KM = 5;

// ----- Manager (Singleton style) -----
class RideRequestManagerClass {
  private db = firestore();

  // Public read-only via getter; subscribe using subscribeShowTripLoadingView
  get showTripLoadingView() {
    return getShowTripLoadingView();
  }

  // API parity: handleRideRequest
  async handleRideRequest(params: {
    selectedPaymentOption?: PaymentOption | null;
    selectedRideType: RideType;
    driverNote?: string | null;
    customPrice?: number | null;
    homeViewModel: HomeViewModel;
    completion?: (ok: boolean) => void;
  }) {
    const {
      selectedPaymentOption,
      selectedRideType,
      driverNote,
      customPrice,
      homeViewModel,
      completion,
    } = params;

    if (!selectedPaymentOption) {
      completion?.(false);
      return;
    }

    switch (selectedPaymentOption) {
      case 'cash':
      case 'card': {
        setShowTripLoadingView(true);
        await this.confirmTripAndSearchDrivers({
          selectedPaymentOption,
          selectedRideType,
          driverNote: driverNote ?? undefined,
          customPrice: customPrice ?? undefined,
          homeViewModel,
          completion,
        });
        break;
      }
      default: {
        completion?.(false);
        break;
      }
    }
  }

  // API parity: scheduleRide
  async scheduleRide(params: {
    scheduledDate: Date;
    selectedPaymentOption?: PaymentOption | null;
    selectedRideType: RideType;
    driverNote?: string | null;
    customPrice?: number | null;
    homeViewModel: HomeViewModel;
    completion?: (ok: boolean) => void;
  }) {
    const {
      scheduledDate,
      selectedPaymentOption,
      selectedRideType,
      driverNote,
      customPrice,
      homeViewModel,
      completion,
    } = params;

    const user = homeViewModel.currentUser;
    if (!user) {
      log('❌ scheduleRide: saknar inloggad användare');
      completion?.(false);
      return;
    }

    const dropOffLocation = homeViewModel.selectedSpinLocation;
    if (!dropOffLocation) {
      log('❌ scheduleRide: saknar destination');
      completion?.(false);
      return;
    }

    const ride = selectedRideType;
    const effectivePrice = (customPrice ?? homeViewModel.computeRidePrice(ride)) || 0;
    const pickupInfo = this.resolvePickupInfo(homeViewModel, user);

    const dropOffCoordinate = dropOffLocation.coordinate;
    const paymentMethod = paymentOptionToFirestoreValue(selectedPaymentOption);

    const tripId = `trip_${Date.now()}`;
    const pickupGeoPoint = toGeoPoint(pickupInfo.coordinate);
    const dropoffGeoPoint = toGeoPoint(dropOffCoordinate);

    const payload: any = {
      tripId,
      id: tripId,
      passengerUid: user.uid,
      passengerName: user.fullname,
      passengerPhoneNumber: user.phoneNumber || user.driverPhoneNumber || '',
      pickupLocationAddress: pickupInfo.address,
      pickupLocationName: homeViewModel.selectedPickupLocation?.title ?? pickupInfo.address,
      pickupLocation: pickupGeoPoint,
      dropoffLocationAddress: dropOffLocation.title,
      dropoffLocationName: dropOffLocation.title,
      dropoffLocation: dropoffGeoPoint,
      passengerLocation: pickupGeoPoint,
      driverLocation: pickupGeoPoint,
      tripCost: effectivePrice,
      customPrice: customPrice ?? null,
      rideType: ride.description,
      selectedRideType: ride.description,
      status: 'scheduled',
      state: 'requested',
      paymentMethod,
      scheduledPickupAt: firestore.Timestamp.fromDate(scheduledDate),
      createdAt: serverTimestamp(),
      driverUid: '',
      driverId: '',
      driverName: '',
      driverImageUrl: '',
      driverPhoneNumber: '',
      stripeCustomerId: user.stripeCustomerId ?? '',
      ratingStatus: 'pending',
    };

    if (driverNote && driverNote.trim().length > 0) {
      payload['driverNote'] = driverNote.trim();
    }

    try {
      await this.db.collection('trips').doc(tripId).set(payload);
      log(`✅ Förbokning skapad i trips: ${tripId}`);
      completion?.(true);
    } catch (e: any) {
      log(`❌ scheduleRide misslyckades: ${e?.message ?? e}`);
      completion?.(false);
    }
  }

  // Cash and Card flows only (iOS Apple Pay support removed)

  private async sendTripToNearestDriver(params: {
    tripId: string;
    homeViewModel: HomeViewModel;
    selectedRideType: RideType;
    driverNote?: string;
    completion?: (ok: boolean) => void;
  }) {
    const { tripId, homeViewModel, selectedRideType, driverNote, completion } = params;

    // Re-fetch trip then proceed
    await new Promise<void>((resolve) => {
      homeViewModel.fetchTrip(tripId, (trip) => {
        if (!trip) {
          log('❌ Kunde inte hämta trip efter paymentIntentId-sparande');
          completion?.(false);
          resolve();
          return;
        }
        if (homeViewModel.setTrip) homeViewModel.setTrip(trip);
        else (homeViewModel as any).trip = trip;

        if (!trip.paymentIntentId || trip.paymentIntentId.length === 0) {
          log('❌ Ingen paymentIntentId i trip när skapaTrip ska skickas');
          completion?.(false);
          resolve();
          return;
        }

        this.fetchAvailableDriversAndRequestTrip({
          rideType: selectedRideType,
          driverNote,
          homeViewModel,
          completion,
        }).finally(resolve);
      });
    });
  }

  private async fetchStripeCustomerId(firebaseUid: string): Promise<string | null> {
    try {
      const url = 'https://stripe-backend-production-fb6e.up.railway.app/create-or-get-customer';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseUid }),
      });
      const json = (await res.json()) as any;
      return json?.customerId ?? null;
    } catch {
      return null;
    }
  }

  // ----- Cash (or non-ApplePay) flow -----
  private async confirmTripAndSearchDrivers(params: {
    selectedPaymentOption?: PaymentOption | null;
    selectedRideType: RideType;
    driverNote?: string;
    customPrice?: number | null;
    homeViewModel: HomeViewModel;
    completion?: (ok: boolean) => void;
  }) {
    const { selectedPaymentOption, selectedRideType, driverNote, customPrice, homeViewModel, completion } = params;

    log('✅ Betalningsmetod bekräftad');

    // small visual pause
    await new Promise((r) => setTimeout(r, 300));

    homeViewModel.customRidePrice = customPrice ?? null;
    homeViewModel.requestTrip({
      selectedPaymentOption: selectedPaymentOption ?? null,
      paymentIntentId: null,
      customPrice: homeViewModel.customRidePrice ?? null,
    });

    const effectivePrice = (customPrice ?? homeViewModel.computeRidePrice(selectedRideType)) || 0;

    const tripId = await this.waitForTripId(homeViewModel, 10, 200);
    if (tripId) {
      try {
        await this.db.collection('trips').doc(tripId).update({
          tripCost: effectivePrice,
        });
      } catch (e: any) {
        log(`⚠️ Kunde inte uppdatera tripCost: ${e?.message ?? e}`);
      }
    } else {
      log('❌ Inget tripId tillgängligt för att uppdatera tripCost');
    }

    await this.fetchAvailableDriversAndRequestTrip({
      rideType: selectedRideType,
      driverNote,
      homeViewModel,
      completion,
    });
  }

  // ----- Fetch drivers, push trip request -----
  private async fetchAvailableDriversAndRequestTrip(params: {
    rideType: RideType;
    driverNote?: string;
    homeViewModel: HomeViewModel;
    completion?: (ok: boolean) => void;
  }) {
    const { rideType, driverNote, homeViewModel, completion } = params;

    PassengerLocationService.requestCurrentLocationOnce?.();

    const user = auth().currentUser;
    if (!user) {
      log('⚠️ Kunde inte hitta aktuell användare');
      completion?.(false);
      setShowTripLoadingView(false);
      return;
    }

    const category = rideType.description;

    if (PassengerLocationService.userLocation) {
      const live = PassengerLocationService.userLocation as LatLng;
      log(`📍 Hämtade aktuell plats: ${live.latitude}, ${live.longitude}`);
      SocketIOManager.sendPassengerLocation?.(live);
      log('📡 Skickade passagerarens plats till Socket.IO');
      if (homeViewModel.setPickupLocationCoordinate) homeViewModel.setPickupLocationCoordinate(live);
      else (homeViewModel as any).pickupLocationCoordinate = live;
    }

    // First ensure category is available
    if (!homeViewModel.availableRideCategories?.some((c) => c.localeCompare(category, undefined, { sensitivity: 'accent' }) === 0)) {
      log(`❌ Kategorin ${category} är inte tillgänglig i activeCategories`);
      completion?.(false);
      setShowTripLoadingView(false);
      return;
    }

    // Try server-ack query first (category + pickup + radius)
    try {
      const pickup =
        homeViewModel.pickupLocationCoordinate ??
        (PassengerLocationService.userLocation as LatLng | undefined);
      if (pickup?.latitude && pickup?.longitude) {
        const ackDrivers = await fetchOnlineDriversNearby({
          category,
          pickup,
          radiusKm: DEFAULT_NEARBY_RADIUS_KM,
        });
        if (Array.isArray(ackDrivers) && ackDrivers.length > 0) {
          const filtered = (ackDrivers ?? []).filter((d: any) =>
            (d.activeCategories ?? []).some(
              (c: string) => c?.localeCompare(category, undefined, { sensitivity: 'accent' }) === 0
            )
          );
          if (homeViewModel.setDrivers) homeViewModel.setDrivers(filtered);
          else (homeViewModel as any).drivers = filtered;

          if (homeViewModel.setSelectedRideType) homeViewModel.setSelectedRideType(rideType);
          else (homeViewModel as any).selectedRideType = rideType;

          if (homeViewModel.setDriverNote) homeViewModel.setDriverNote(driverNote ?? null);
          else (homeViewModel as any).driverNote = driverNote ?? null;

          completion?.(true);
          setShowTripLoadingView(false);
          return; // success via ack, skip VM fallback
        }
      }
    } catch (e) {
      log(`⚠️ Ack-baserad förarhämtning misslyckades: ${String((e as any)?.message || e)}`);
    }

    // Load online drivers (through your Socket layer or VM)
    await new Promise<void>((resolve) => {
      homeViewModel.fetchOnlineDrivers((drivers) => {
        const filtered = (drivers ?? []).filter((d) =>
          (d.activeCategories ?? []).some((c) => c?.localeCompare(category, undefined, { sensitivity: 'accent' }) === 0)
        );

        log(`✅ ${filtered.length} förare hittades online för kategori: ${category}`);

        if (homeViewModel.setDrivers) homeViewModel.setDrivers(filtered);
        else (homeViewModel as any).drivers = filtered;

        if (homeViewModel.setSelectedRideType) homeViewModel.setSelectedRideType(rideType);
        else (homeViewModel as any).selectedRideType = rideType;

        if (homeViewModel.setDriverNote) homeViewModel.setDriverNote(driverNote ?? null);
        else (homeViewModel as any).driverNote = driverNote ?? null;

        completion?.(true);
        resolve();
      });
    });

    setShowTripLoadingView(false);
  }

  // ----- Helpers -----
  private resolvePickupInfo(homeViewModel: HomeViewModel, fallbackUser: SpinUser): { coordinate: LatLng; address: string } {
    const selected = homeViewModel.selectedPickupLocation;
    if (selected) return { coordinate: selected.coordinate, address: selected.title };

    const manualCoordinate = homeViewModel.pickupCoordinate;
    const manualQuery = (homeViewModel.pickupQueryFragment ?? '').trim();
    if (manualCoordinate && manualQuery.length > 0) {
      return { coordinate: manualCoordinate, address: manualQuery };
    }

    const userCoordinate = homeViewModel.userLocation;
    if (userCoordinate) {
      const currentAddress = (homeViewModel.currentLocation ?? '').trim();
      return { coordinate: userCoordinate, address: currentAddress.length ? currentAddress : 'Okänd adress' };
    }

    const fallbackCoordinate = {
      latitude: fallbackUser.coordinate.latitude,
      longitude: fallbackUser.coordinate.longitude,
    };
    const fallbackAddress = (fallbackUser.pickupAddress ?? homeViewModel.currentLocation ?? '').trim();

    return { coordinate: fallbackCoordinate, address: fallbackAddress.length ? fallbackAddress : 'Okänd adress' };
  }

  private async waitForTripId(homeViewModel: HomeViewModel, attempts: number, delayMs: number): Promise<string | null> {
    for (let i = 0; i < attempts; i++) {
      const id = homeViewModel.trip?.id;
      if (id && id.length > 0) return id;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  }
}

// Singleton export
export const RideRequestManager = new RideRequestManagerClass();

// Android only - Apple Pay support removed
export const isApplePaySupported = false;

/**
 * Ack helper that tries the canonical event name first, then a legacy fallback.
 * Payload includes category, pickup (lat/lng) and radiusKm so server kan filtrera direkt.
 */
export async function fetchOnlineDriversNearby(params: {
  category: string;
  pickup: LatLng;
  radiusKm: number;
}): Promise<SpinUser[]> {
  const tryEmit = (eventName: string) =>
    new Promise<SpinUser[]>((resolve) => {
      SocketIOManager.emitWithAck?.(
        eventName,
        { category: params.category, pickup: params.pickup, radiusKm: params.radiusKm },
        5000,
        (data: any) => {
          if (Array.isArray(data)) resolve(data as SpinUser[]);
          else if (Array.isArray(data?.[0])) resolve(data[0] as SpinUser[]);
          else resolve([]);
        }
      );
    });

  // 1) Prefer canonical event
  let result = await tryEmit('get-online-drivers-by-category');
  if (result.length > 0) return result;

  // 2) Fallback to legacy event name if server uses it
  result = await tryEmit('get-online-drivers-by-active-category');
  return result;
}

/**
 * Backwards compatible alias if något i koden fortfarande kallar "forCategory".
 * This version ombeds dock att enbart returnera på category (utan pickup/radius filter från servern).
 */
export async function fetchOnlineDriversForCategory(category: string): Promise<SpinUser[]> {
  // Try without pickup/radius; server may default to a global list for category
  const primary = await new Promise<SpinUser[]>((resolve) => {
    SocketIOManager.emitWithAck?.(
      'get-online-drivers-by-category',
      { category },
      5000,
      (data: any) => {
        if (Array.isArray(data)) resolve(data as SpinUser[]);
        else if (Array.isArray(data?.[0])) resolve(data[0] as SpinUser[]);
        else resolve([]);
      }
    );
  });
  if (primary.length > 0) return primary;
  // Legacy fallback
  return new Promise<SpinUser[]>((resolve) => {
    SocketIOManager.emitWithAck?.(
      'get-online-drivers-by-active-category',
      { category },
      5000,
      (data: any) => {
        if (Array.isArray(data)) resolve(data as SpinUser[]);
        else if (Array.isArray(data?.[0])) resolve(data[0] as SpinUser[]);
        else resolve([]);
      }
    );
  });
}
