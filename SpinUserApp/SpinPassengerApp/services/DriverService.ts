
import { CarType, Coordinate, Driver, DriverLocationUpdate } from '../types/Driver';
import socket, { ensureSocketConnected } from './socket/client';

export interface FetchNearbyDriversParams {
  userLocation: Coordinate;
  radiusKm?: number;
}

interface OnlineDriverData {
  uid: string;
  lat: number;
  lng: number;
  bearing?: number;
  speed?: number;
  category?: string[];
  activeCategories?: string[];
}

export class DriverService {
  private static readonly DEFAULT_RADIUS_KM = 20;
  private static readonly CONVERSION_CACHE_TTL_MS = 2000; // 2-second cache for driver conversions

  private static onlineDrivers: OnlineDriverData[] = [];
  private static driversUpdateCallback: ((drivers: Driver[]) => void) | null = null;
  private static passengerId: string | null = null; // stable during app session
  private static passengerOnlineRegistered = false;

  // 🔄 PHASE 5A: Conversion cache to avoid redundant Driver object creation
  private static driverConversionCache: Map<string, { drivers: Driver[]; timestamp: number }> = new Map();
  private static lastCacheKey: string | null = null;

  /**
   * Initialize WebSocket connection and listen for online drivers
   * @param callback - Callback function to handle driver updates
   */
  static initializeDriverTracking(callback?: (drivers: Driver[]) => void): void {
    console.log('🚗 [DriverService] initializeDriverTracking() called');
    this.driversUpdateCallback = callback || null;

    // Ensure socket is connected (async but non-blocking)
    console.log('   1️⃣ Ensuring socket is connected...');
    ensureSocketConnected()
      .then(() => {
        console.log('      ✅ Socket ready, ensuring passenger is online');
        this.ensurePassengerOnline();
        this.requestOnlineDrivers();
      })
      .catch((err) => {
        console.error('      ❌ Socket connection error:', err);
        this.requestOnlineDrivers(); // Try anyway
      });

    // Setup listeners for driver updates
    console.log('   2️⃣ Setting up driver listeners...');

    // Avoid duplicate listeners
    socket.off('onlineDrivers');
    socket.off('driverDelta');

    // Listen for online drivers updates (legacy - full list)
    socket.on('onlineDrivers', (driversData: OnlineDriverData[]) => {
      console.log('📡 [onlineDrivers] Received online drivers update:', driversData.length, 'drivers');

      // Debug: Log categories
      const categoryCounts = new Map<string, number>();
      driversData.forEach(d => {
        const cats = (d.activeCategories && d.activeCategories.length > 0) ? d.activeCategories : (d.category || ['spin']);
        (cats || []).forEach((cat: string) => {
          categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
        });
      });
      console.log('   Categories breakdown:', Object.fromEntries(categoryCounts));

      this.onlineDrivers = driversData;

      if (this.driversUpdateCallback) {
        const convertedDrivers = this.convertOnlineDriversToDrivers(driversData);
        console.log(`   ✅ Converted to ${convertedDrivers.length} driver entries`);
        this.driversUpdateCallback(convertedDrivers);
      }
    });

    // Nytt: Listen for delta updates (added/removed/updated drivers)
    socket.on('driverDelta', (delta: { added: OnlineDriverData[]; removed: OnlineDriverData[]; updated: OnlineDriverData[] }) => {
      console.log(`📡 [driverDelta] RECEIVED: +${delta.added?.length || 0}, -${delta.removed?.length || 0}, ~${delta.updated?.length || 0}`);

      // Uppdatera lokal lista med delta
      // Ta bort removed
      const removedIds = new Set(delta.removed.map(d => d.uid));
      this.onlineDrivers = this.onlineDrivers.filter(d => !removedIds.has(d.uid));

      // Lägg till/uppdatera added och updated
      const existingIds = new Set(this.onlineDrivers.map(d => d.uid));
      delta.added.forEach(d => {
        if (!existingIds.has(d.uid)) {
          this.onlineDrivers.push(d);
          console.log(`  ✅ Added driver: ${d.uid}`);
        }
      });

      // Uppdatera existing drivers med Object.assign för optimal performance
      delta.updated.forEach(d => {
        const existing = this.onlineDrivers.find(x => x.uid === d.uid);
        if (existing) {
          Object.assign(existing, d);
          console.log(`  🔄 Updated driver: ${d.uid}`);
        }
      });

      // 🔄 PHASE 5A: Invalidate conversion cache since data changed
      this.driverConversionCache.clear();
      this.lastCacheKey = null;

      console.log(`  📊 Total drivers after delta: ${this.onlineDrivers.length}`);

      if (this.driversUpdateCallback) {
        const convertedDrivers = this.convertOnlineDriversToDrivers(this.onlineDrivers);
        this.driversUpdateCallback(convertedDrivers);
      }
    });

    // Retry if no drivers after 4 seconds
    setTimeout(() => {
      if (this.onlineDrivers.length === 0 && socket?.connected) {
        console.warn('⏱️ [DriverService] No drivers received after 4s, retrying...');
        socket.emit('getOnlineDrivers');
      }
    }, 4000);
  }

  /**
   * Request online drivers from server
   */
  private static requestOnlineDrivers(): void {
    console.log('   3️⃣ Requesting online drivers...');

    if (socket?.connected) {
      console.log('      📤 Socket ready, emitting getOnlineDrivers');
      socket.emit('getOnlineDrivers');
    } else {
      console.log('      ⏳ Socket not ready, will retry when connected');
      // Socket will emit when ready
    }
  }

  /**
   * Ensure passenger is online and registered with the server
   */
  private static ensurePassengerOnline(explicitPassengerId?: string) {
    // Generate a stable id for the current session if not provided
    if (!this.passengerId) {
      this.passengerId = explicitPassengerId || `pass_${Math.random().toString(36).slice(2, 10)}`;
      console.log(`🆔 [DriverService] Generated passengerId: ${this.passengerId}`);
    } else if (explicitPassengerId && explicitPassengerId !== this.passengerId) {
      this.passengerId = explicitPassengerId;
      this.passengerOnlineRegistered = false; // force re-register with new id
    }

    // If socket is connected and we haven't registered yet, emit passengerOnline
    if (socket && socket.connected && !this.passengerOnlineRegistered) {
      console.log(`📡 [DriverService] Emitting passengerOnline: ${this.passengerId}`);
      socket.emit('passengerOnline', { passengerId: this.passengerId });
      this.passengerOnlineRegistered = true;
    }

    // If socket connects later, register then
    if (socket) {
      socket.off('connect', DriverService.onSocketConnectRegisterPassenger);
      socket.on('connect', () => DriverService.onSocketConnectRegisterPassenger());
    }
  }

  private static onSocketConnectRegisterPassenger() {
    if (!this.passengerId) this.passengerId = `pass_${Math.random().toString(36).slice(2, 10)}`;
    if (!this.passengerOnlineRegistered) {
      console.log(`🔗 [Socket reconnect] Emitting passengerOnline with id: ${this.passengerId}`);
      socket.emit('passengerOnline', { passengerId: this.passengerId });
      this.passengerOnlineRegistered = true;
    }
  }

  /**
 * Fetch nearby drivers from real-time WebSocket data
 * @param params - Parameters for fetching nearby drivers
 * @returns Promise<Driver[]> - Array of nearby drivers
 */
  static async fetchNearbyDrivers(params: FetchNearbyDriversParams): Promise<Driver[]> {
    const { userLocation, radiusKm = this.DEFAULT_RADIUS_KM } = params;

    try {
      // Make sure passenger is online and joined to their room
      this.ensurePassengerOnline();

      // Nytt: Deklarera intresse för geo-cell på servern
      // Detta gör att servern skickar optimerad delta för denna region
      console.log(`📍 [DriverService] Declaring interest: passengerId=${this.passengerId}, lat=${userLocation.latitude}, lng=${userLocation.longitude}, radius=${radiusKm}km`);
      socket.emit('passengerDeclareInterest', {
        passengerId: this.passengerId,
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        radiusKm,
      });

      // Vänta en moment för delta-update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Filter online drivers by distance (client-side backup)
      const nearbyOnlineDrivers = this.onlineDrivers.filter(driver => {
        const distance = this.calculateDistance(userLocation, {
          latitude: driver.lat,
          longitude: driver.lng
        });
        return distance <= radiusKm;
      });

      console.log(`🚗 Found ${nearbyOnlineDrivers.length} nearby drivers within ${radiusKm}km`);

      // Convert online driver data to Driver objects
      const drivers = this.convertOnlineDriversToDrivers(nearbyOnlineDrivers, userLocation);

      // REMOVED: Mock driver fallback - nu skickas bara verkliga förare från servern
      if (drivers.length === 0) {
        console.warn('⚠️ No online drivers found in this region');
      }

      return drivers;
    } catch (error) {
      console.error('Error fetching nearby drivers:', error);
      return []; // Returnera tom lista istället för mock-fallback
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param point1 - First coordinate
   * @param point2 - Second coordinate
   * @returns Distance in kilometers
   */
  private static calculateDistance(point1: Coordinate, point2: Coordinate): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) * Math.cos(this.toRadians(point2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert online driver data from WebSocket to Driver objects
   * Only shows real drivers from the server, no hardcoded test data
   * 🔄 PHASE 5A: Includes conversion cache (2s TTL) to avoid redundant object creation
   * 🔄 IMPORTANT: If a driver is certified for multiple categories, create separate Driver entries for each
   * @param onlineDrivers - Array of online driver data from WebSocket
   * @param userLocation - User's location for distance calculation
   * @returns Array of Driver objects
   */
  private static convertOnlineDriversToDrivers(
    onlineDrivers: OnlineDriverData[],
    userLocation?: Coordinate
  ): Driver[] {
    // 🔄 PHASE 5A: Check cache validity
    const now = Date.now();
    const cacheKey = `${onlineDrivers.length}-${onlineDrivers
      .map(d => (d?.uid ?? `${d?.lat ?? 'x'},${d?.lng ?? 'x'}`))
      .join(',')}`;

    const cached = this.driverConversionCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.CONVERSION_CACHE_TTL_MS) {
      console.log(`✅ Using cached driver conversion (${this.driverConversionCache.size} cache entries)`);
      return cached.drivers;
    }

    const allDrivers: Array<{ driver: Driver; distance?: number }> = [];

    // Convert each online driver, potentially creating multiple entries if they have multiple categories
    onlineDrivers.forEach((driverData) => {
      // Guard: require coordinates
      if (typeof driverData?.lat !== 'number' || typeof driverData?.lng !== 'number') {
        return; // skip invalid entries
      }
      // Get all categories this driver is certified for
      const sourceCats = (driverData.activeCategories && driverData.activeCategories.length > 0
        ? driverData.activeCategories
        : (driverData.category || [])) as string[];
      const allCategories = Array.isArray(sourceCats) ? [...sourceCats] : [];

      if (allCategories.length === 0) {
        // No categories - default to Spin
        allCategories.push('spin');
      }

      // Create one Driver entry per category
      allCategories.forEach(category => {
        const carType = this.getCarTypeFromCategory(category);
        const uidSafe = driverData.uid ?? `${driverData.lat},${driverData.lng}`;
        const uidShort = String(uidSafe).slice(-4);

        const driver: Driver = {
          id: `${uidSafe}-${carType}`, // Unique ID per category, even if uid missing
          name: `Förare ${uidShort}`,
          phoneNumber: '',
          rating: 4.8,
          totalRides: 0,
          isOnline: true,
          isAvailable: true,
          currentLocation: { latitude: driverData.lat, longitude: driverData.lng },
          bearing: typeof driverData.bearing === 'number' ? driverData.bearing : undefined,
          speed: typeof driverData.speed === 'number' ? driverData.speed : undefined,
          carType,
          carInfo: {
            make: 'N/A',
            model: 'N/A',
            year: new Date().getFullYear(),
            color: 'N/A',
            licensePlate: 'N/A',
            carType,
            maxPassengers: carType === CarType.Van ? 6 : 4,
          },
          lastLocationUpdate: new Date().toISOString(),
        };

        const driverLoc = driver.currentLocation || driver.location;
        const distance = userLocation && driverLoc
          ? this.calculateDistance(userLocation, driverLoc)
          : undefined;

        allDrivers.push({ driver, distance });
      });
    });

    const sorted = allDrivers
      .sort((a, b) => {
        if (a.distance == null && b.distance == null) return 0;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      })
      .map(x => x.driver);

    console.log(`📊 Converted ${onlineDrivers.length} drivers to ${sorted.length} driver entries (multi-category support)`);

    // 🔄 PHASE 5A: Store in cache
    this.driverConversionCache.set(cacheKey, { drivers: sorted, timestamp: now });

    // Keep cache size reasonable (max 5 entries)
    if (this.driverConversionCache.size > 5) {
      const firstKey = this.driverConversionCache.keys().next().value;
      if (firstKey) {
        this.driverConversionCache.delete(firstKey);
      }
    }

    return sorted;
  }

  /**
   * 🔄 PHASE 5A: Map category string to CarType enum (improved helper)
   * @param category - Category string from server
   * @returns CarType enum value
   */
  private static getCarTypeFromCategory(category?: string): CarType {
    if (!category) return CarType.Spin; // Default

    const normalizedCategory = category.toLowerCase().trim();

    switch (normalizedCategory) {
      case 'spingo':
      case 'spin go':
        return CarType.SpinGo;
      case 'premium':
        return CarType.Premium;
      case 'xl':
        return CarType.Van;
      case 'komfort':
        return CarType.Komfort;
      case 'limousine':
        return CarType.Limousine;
      case 'spin':
      default:
        return CarType.Spin;
    }
  }

  /**
   * Map category string to CarType enum
   * @deprecated Use getCarTypeFromCategory instead
   * @param category - Category string from server
   * @returns CarType enum value
   */
  private static mapCategoryToCarType(category: string): CarType {
    return this.getCarTypeFromCategory(category);
  }

  /**
   * Generate realistic driver profile
   * @param driverId - Driver ID
   * @param carType - Car type
   * @param index - Index for variation
   * @returns Driver profile data
   */






  /**
   * Simple hash function for consistent driver assignment
   * @param str - String to hash
   * @returns Hash number
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Update driver location (for real-time updates)
   * @param update - Driver location update data
   */
  static async updateDriverLocation(update: DriverLocationUpdate): Promise<void> {
    try {
      // Update local driver data
      const driverIndex = this.onlineDrivers.findIndex(d => d.uid === update.driverId);
      if (driverIndex !== -1) {
        this.onlineDrivers[driverIndex] = {
          ...this.onlineDrivers[driverIndex],
          lat: update.latitude ?? 0,
          lng: update.longitude ?? 0,
          bearing: update.bearing,
          speed: update.speed,
        };
      }

      console.log('Driver location updated:', update);
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  }

  /**
   * Declare passenger interest to server for geolocation-based delta optimization
   * Like Swift's: socket.emit('passengerDeclareInterest', ...)
   * @param location - Passenger's location with radius
   */
  static declarePassengerInterest(location: { latitude: number; longitude: number; radiusKm?: number }): void {
    if (!socket) {
      console.warn('⚠️ [DriverService] Socket not initialized');
      return;
    }

    const radiusKm = location.radiusKm ?? this.DEFAULT_RADIUS_KM;

    const emitInterest = () => {
      console.log(`📍 [DriverService] Declaring passenger interest at (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}) radius=${radiusKm}km`);
      socket.emit('passengerDeclareInterest', {
        passengerId: this.passengerId || `pass_${Math.random().toString(36).slice(2, 10)}`,
        lat: location.latitude,
        lng: location.longitude,
        radiusKm,
      });
    };

    // If socket is ready, emit immediately
    if (socket.connected) {
      emitInterest();
    } else {
      console.log('📍 [DriverService] Socket not ready, waiting to declare interest...');
      // Wait for socket to connect
      const handleConnect = () => {
        console.log('📍 [DriverService] Socket connected, emitting interest declaration');
        emitInterest();
        socket?.off('connect', handleConnect);
      };

      // Wait max 1.5s then emit anyway
      const timeoutId = setTimeout(() => {
        console.log('📍 [DriverService] Socket not ready after 1.5s, emitting anyway');
        emitInterest();
        socket?.off('connect', handleConnect);
      }, 1500);

      socket?.once('connect', () => {
        clearTimeout(timeoutId);
        handleConnect();
      });
    }
  }  /**
   * Cleanup driver tracking
   */
  static cleanup(): void {
    if (socket) {
      socket.off('onlineDrivers');
      socket.off('driverDelta'); // 🔄 PHASE 5A: Also cleanup delta listener
    }
    this.onlineDrivers = [];
    this.driversUpdateCallback = null;
    this.driverConversionCache.clear(); // 🔄 PHASE 5A: Clear cache on cleanup
  }
}