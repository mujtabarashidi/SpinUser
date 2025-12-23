

/**
 * PassengerLocationService.ts (React Native)
 * Android-only location service for passenger tracking
 *
 * Features:
 * - startUpdatingLocation(): begins continuous watch with high accuracy
 * - stopUpdatingLocation(): stops watch
 * - requestCurrentLocationOnce(): one-shot fetch (no persistent watch)
 * - userLocation: latest LatLng
 * - subscribe(cb): listen to location changes (Observer pattern)
 *
 * Dependencies required:
 *   yarn add react-native-geolocation-service
 *
 * Android:
 *   - Ensure ACCESS_FINE_LOCATION permission in AndroidManifest
 *   - For Android 12+, also ACCESS_COARSE_LOCATION can be included
 */

import { PermissionsAndroid } from 'react-native';
import Geolocation, {
  GeoError,
  GeoPosition,
} from 'react-native-geolocation-service';

export type LatLng = { latitude: number; longitude: number };

type Subscriber = (coord: LatLng | null) => void;

// Geo-zoner: Lista över städer med radie
const geoZones: Array<{ name: string; coordinate: LatLng; radius: number }> = [
  { name: 'Stockholm', coordinate: { latitude: 59.3293, longitude: 18.0686 }, radius: 50000 },
  { name: 'Göteborg', coordinate: { latitude: 57.7089, longitude: 11.9746 }, radius: 40000 },
  { name: 'Malmö', coordinate: { latitude: 55.6050, longitude: 13.0038 }, radius: 40000 },
  { name: 'Uppsala', coordinate: { latitude: 59.8586, longitude: 17.6389 }, radius: 40000 },
];

/**
 * Beräkna avstånd mellan två koordinater i meter (Haversine formula)
 */
function distanceBetween(coord1: LatLng, coord2: LatLng): number {
  const R = 6371000; // Jordens radie i meter
  const lat1 = coord1.latitude * Math.PI / 180;
  const lat2 = coord2.latitude * Math.PI / 180;
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

class PassengerLocationServiceClass {
  private _userLocation: LatLng | null = null;
  private _watchId: number | null = null;
  private _isUpdating = false;
  private subscribers = new Set<Subscriber>();

  /** Den senaste kända användar-koordinaten */
  get userLocation(): LatLng | null {
    return this._userLocation;
  }

  /** Prenumerera på platsuppdateringar. Returnerar en unsubscribe-funktion. */
  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb);
    // emit current immediately
    cb(this._userLocation);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private emit() {
    for (const cb of this.subscribers) cb(this._userLocation);
  }

  /** Starta kontinuerliga uppdateringar */
  async startUpdatingLocation(): Promise<void> {
    if (this._isUpdating) return;
    const granted = await this.ensurePermission();
    if (!granted) {
      // Nekad eller begränsad — gör inget
      return;
    }

    this._isUpdating = true;

    // distanceFilter ~6 meter for Android
    this._watchId = Geolocation.watchPosition(
      (pos: GeoPosition) => {
        const { latitude, longitude } = pos.coords;
        // console.log(`[Passenger] ${latitude}, ${longitude}`);
        this._userLocation = { latitude, longitude };
        this.emit();
      },
      (err: GeoError) => {
        // console.warn('PassengerLocationService watch error:', err.code, err.message);
        // If permission revoked during runtime, stop updates
        if (err.code === 1 /* PERMISSION_DENIED */) {
          this.stopUpdatingLocation();
        }
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 6, // ~6 meter (Swift hade 6)
        interval: 3000, // Android update interval (ms)
        fastestInterval: 1500, // Android fastest interval
        // Android configuration
        forceRequestLocation: false,
        useSignificantChanges: false,
      }
    );
  }

  /** Stoppa uppdateringar */
  stopUpdatingLocation() {
    if (this._watchId !== null) {
      Geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
    this._isUpdating = false;
  }

  /** Enstaka platsförfrågan */
  async requestCurrentLocationOnce(): Promise<LatLng | null> {
    const granted = await this.ensurePermission();
    if (!granted) return null;

    return new Promise<LatLng | null>((resolve) => {
      Geolocation.getCurrentPosition(
        (pos: GeoPosition) => {
          const { latitude, longitude } = pos.coords;
          this._userLocation = { latitude, longitude };
          this.emit();
          resolve(this._userLocation);
        },
        (err: GeoError) => {
          // console.warn('PassengerLocationService getCurrentPosition error:', err.code, err.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
          forceRequestLocation: true,
        }
      );
    });
  }

  /** Begär platsbehörighet på respektive plattform */
  private async ensurePermission(): Promise<boolean> {
    // Android only - iOS support removed
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const has = await PermissionsAndroid.check(fine);
    if (has) return true;

    const res = await PermissionsAndroid.request(fine);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }

  /**
   * Hämta aktuell stad baserat på användarens position
   */
  getCurrentCity(location?: LatLng | null): string | null {
    const coord = location || this._userLocation;
    if (!coord) {
      console.log('[PassengerLocationService] getCurrentCity: No coordinate available');
      return null;
    }

    console.log(`[PassengerLocationService] getCurrentCity checking for: ${coord.latitude}, ${coord.longitude}`);

    for (const zone of geoZones) {
      const distance = distanceBetween(coord, zone.coordinate);
      console.log(`  Distance to ${zone.name}: ${Math.round(distance)}m (radius: ${zone.radius}m)`);
      if (distance <= zone.radius) {
        console.log(`  ✓ User is in ${zone.name}`);
        return zone.name;
      }
    }

    console.log('  ✗ User is outside all defined zones');
    return null;
  }
}

export const PassengerLocationService = new PassengerLocationServiceClass();
export default PassengerLocationService;