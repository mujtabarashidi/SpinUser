import Geocoder from 'react-native-geocoding';

// IMPORTANT: Restrict this key in Google Cloud Console. Prefer moving web-service calls to a backend.
let GOOGLE_API_KEY = 'AIzaSyC25ES_6JPSeywcHLMvFL9z7Sc7X2SNqiU';
let geocoderInitialized = false;
function ensureGeocoder() {
  if (!geocoderInitialized) {
    try { Geocoder.init(GOOGLE_API_KEY, { language: 'sv' }); geocoderInitialized = true; } catch { }
  }
}

export function setGoogleApiKey(key: string) {
  if (typeof key === 'string' && key.trim().length > 10) {
    GOOGLE_API_KEY = key.trim();
    geocoderInitialized = false;
    ensureGeocoder();
  }
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  formatted_address: string;
  coordinates: Coordinate;
  title?: string;
  subtitle?: string;
}

// Rate limiting for geocoding requests
let lastGeocodeTime: Date | null = null;
const GEOCODE_THROTTLE_MS = 1000; // 1 second throttle

export class GeocodingService {
  // --- session + cache + abort management ---
  private static autocompleteSessionToken: string | null = null;
  private static autocompleteLastUsedAt = 0;
  private static lastSearchController: AbortController | null = null;
  private static cache = new Map<string, { at: number; results: LocationResult[] }>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private static readonly SEARCH_TIMEOUT_MS = 8000;
  private static readonly MAX_RESULTS = 6;

  private static getSessionToken(): string {
    const now = Date.now();
    if (!this.autocompleteSessionToken || (now - this.autocompleteLastUsedAt) > 180_000) {
      this.autocompleteSessionToken = `${now}-${Math.random().toString(36).slice(2)}`;
    }
    this.autocompleteLastUsedAt = now;
    return this.autocompleteSessionToken;
  }

  private static abortOngoingSearch() {
    try { this.lastSearchController?.abort(); } catch { }
    this.lastSearchController = null;
  }

  private static putCache(key: string, results: LocationResult[]) {
    this.cache.set(key, { at: Date.now(), results });
    if (this.cache.size > 30) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  private static getCache(key: string): LocationResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if ((Date.now() - entry.at) > this.CACHE_TTL_MS) { this.cache.delete(key); return null; }
    return entry.results;
  }

  private static async fetchWithTimeout(url: string, controller: AbortController, timeoutMs = GeocodingService.SEARCH_TIMEOUT_MS, init?: RequestInit) {
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, ...(init || {}) });
      return res;
    } finally { clearTimeout(timeout); }
  }

  /**
   * Format Google address_components into a Swedish concise exact address
   * Example: route=Kungsgatan, street_number=34, postal_code=111 35, locality=Stockholm
   * => "Kungsgatan 34, 111 35 Stockholm"
   */
  static formatGoogleComponents(components: any[]): string | null {
    if (!Array.isArray(components)) return null;
    const pick = (type: string) => components.find(c => Array.isArray(c.types) && c.types.includes(type))?.long_name || '';
    const route = pick('route');
    const streetNumber = pick('street_number');
    // Extra candidates when a street name is missing
    const premise = pick('premise') || pick('establishment') || pick('point_of_interest');
    const sublocality = pick('sublocality') || pick('neighborhood');
    const postalCode = pick('postal_code');
    const locality = pick('locality') || pick('postal_town') || pick('administrative_area_level_3') || pick('administrative_area_level_2');
    // Prefer a proper street name; if missing, use premise/POI name.
    let street = [route, streetNumber].filter(Boolean).join(' ').trim();
    if (!route && premise) {
      // e.g., a mall, building or POI near the coordinates
      street = [premise, locality || sublocality].filter(Boolean).join(', ').trim();
    }
    // If what we built is only a short number like "16", consider it invalid so that
    // callers can fallback to Google's formatted_address instead.
    if (/^\d{1,3}$/.test(street)) {
      street = '';
    }
    const cityPart = [postalCode, locality].filter(Boolean).join(' ').trim();
    const parts = [street, cityPart].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }

  /** Prefer Google reverse geocoding for exact Swedish addresses */
  private static async reverseWithGoogle(coordinate: Coordinate): Promise<string | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinate.latitude},${coordinate.longitude}&key=${GOOGLE_API_KEY}&language=sv&result_type=street_address|premise|establishment`;
      const controller = new AbortController();
      const res = await this.fetchWithTimeout(url, controller, 7000);
      const data = await res.json();
      if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
        const r = data.results[0];
        const formatted = this.formatGoogleComponents(r.address_components) || r.formatted_address;
        if (typeof formatted === 'string' && /sverige|sweden/i.test(r.formatted_address || formatted)) {
          return formatted;
        }
        return formatted || null;
      }
    } catch (e) {
      console.warn('Google reverse geocoding failed, will fallback to OSM:', e);
    }
    return null;
  }

  static async geocodeAddressString(address: string): Promise<Coordinate | null> {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      console.warn('⚠️ Address is empty or invalid');
      return null;
    }

    const now = new Date();
    if (lastGeocodeTime && now.getTime() - lastGeocodeTime.getTime() < GEOCODE_THROTTLE_MS) {
      console.log('⏸️ Geocoding throttled – try again later');
      return null;
    }
    lastGeocodeTime = now;

    try {
      ensureGeocoder();
      const response = await Geocoder.from(trimmedAddress);
      const location = response.results[0]?.geometry?.location;
      if (location) {
        return { latitude: location.lat, longitude: location.lng };
      } else {
        console.warn(`❌ No location found for address: ${trimmedAddress}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Geocoding error:', error);
      return null;
    }
  }

  static async reverseGeocode(coordinate: Coordinate): Promise<string | null> {
    const isInSweden =
      coordinate.latitude >= 55 && coordinate.latitude <= 69 &&
      coordinate.longitude >= 10.5 && coordinate.longitude <= 24.5;

    const googleFormatted = await this.reverseWithGoogle(coordinate);
    if (googleFormatted) return googleFormatted;

    try {
      console.log('🔄 Reverse geocoding with OSM (fallback):', coordinate);
      // Helper to attempt OSM with varying zooms
      const tryOsm = async (zoom: number) => {
        const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${coordinate.latitude}&lon=${coordinate.longitude}&format=json&accept-language=sv${isInSweden ? '&countrycodes=se' : ''}&addressdetails=1&zoom=${zoom}`;
        const controller = new AbortController();
        const headers = { 'User-Agent': 'SpinTaxiApp/1.0 (support@spintaxi.se)' } as any;
        const resp = await this.fetchWithTimeout(osmUrl, controller, 8000, { headers });
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data) return null;
        if (data.display_name) return String(data.display_name);
        const addr = data.address;
        if (addr && typeof addr === 'object') {
          const road = addr.road || addr.pedestrian || addr.cycleway || addr.footway || addr.path || addr.residential || '';
          const houseNo = addr.house_number || '';
          const postcode = addr.postcode || '';
          const city = addr.city || addr.town || addr.village || addr.locality || addr.suburb || addr.municipality || addr.county || '';
          const street = [road, houseNo].filter(Boolean).join(' ').trim();
          const cityPart = [postcode, city].filter(Boolean).join(' ').trim();
          const parts = [street, cityPart].filter(Boolean);
          if (parts.length) return parts.join(', ');
          if (city) return city; // last resort from OSM address
        }
        return null;
      };

      for (const z of [18, 17, 16, 15, 14, 13]) {
        const val = await tryOsm(z);
        if (val) return val;
      }
    } catch (error) {
      console.warn('❌ OSM reverse geocoding failed:', error);
    }
    // Return formatted coordinates as fallback instead of generic text
    return `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
  }

  /**
   * Fast, robust search using Google Places Autocomplete + Details with session token,
   * abortable requests, caching, Swedish bias and OSM fallback.
   */
  static async searchLocations(
    query: string,
    options?: { userLocation?: Coordinate; radiusMeters?: number }
  ): Promise<LocationResult[]> {
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const loc = options?.userLocation;
    const radius = Math.max(500, Math.min(options?.radiusMeters ?? 25_000, 50_000));
    const cacheKey = `${q}|${loc?.latitude?.toFixed(2) || ''},${loc?.longitude?.toFixed(2) || ''}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    this.abortOngoingSearch();
    const controller = new AbortController();
    this.lastSearchController = controller;

    const token = this.getSessionToken();
    const bias = loc ? `&locationbias=circle:${radius}@${loc.latitude},${loc.longitude}` : '';
    const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&language=sv&components=country:SE&sessiontoken=${encodeURIComponent(token)}${bias}&key=${GOOGLE_API_KEY}`;

    try {
      const acRes = await this.fetchWithTimeout(autocompleteUrl, controller);
      const ac = await acRes.json();
      if (ac.status !== 'OK' || !Array.isArray(ac.predictions) || ac.predictions.length === 0) {
        throw new Error(`Places autocomplete status: ${ac.status}`);
      }

      const top = ac.predictions.slice(0, this.MAX_RESULTS);
      const detailPromises = top.map((p: any) => {
        const fields = 'formatted_address,geometry/location,name,address_components';
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=${fields}&language=sv&sessiontoken=${encodeURIComponent(token)}&key=${GOOGLE_API_KEY}`;
        const c = new AbortController();
        return this.fetchWithTimeout(url, c).then(r => r.json()).then(d => ({ p, d })).catch(() => ({ p, d: null }));
      });
      const detailed = await Promise.all(detailPromises);

      const results: LocationResult[] = detailed
        .map(({ p, d }: any) => {
          const name = p?.structured_formatting?.main_text || d?.result?.name || p?.description || '';
          const subtitle = p?.structured_formatting?.secondary_text || '';
          const addr = this.formatGoogleComponents(d?.result?.address_components) || d?.result?.formatted_address || p?.description;
          const lat = d?.result?.geometry?.location?.lat;
          const lng = d?.result?.geometry?.location?.lng;
          if (typeof lat === 'number' && typeof lng === 'number' && addr) {
            return {
              formatted_address: addr,
              coordinates: { latitude: lat, longitude: lng },
              title: name,
              subtitle,
            } as LocationResult;
          }
          return null;
        })
        .filter(Boolean) as LocationResult[];

      if (results.length > 0) {
        this.putCache(cacheKey, results);
        return results;
      }
      throw new Error('No detailed results');
    } catch (e) {
      console.warn('Google Places search failed, falling back to OSM:', (e as Error)?.message);
      const osmResults = await this.searchWithOSM(q, 'se');
      if (osmResults.length > 0) {
        this.putCache(cacheKey, osmResults);
        return osmResults;
      }
      return [];
    }
  }

  static async searchWithOSM(query: string, country: string = 'se'): Promise<LocationResult[]> {
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=${country}&accept-language=sv`;
      const controller = new AbortController();
      const nominatimResponse = await this.fetchWithTimeout(nominatimUrl, controller, 7000);
      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json();
        if (nominatimData && nominatimData.length > 0) {
          return nominatimData.map((item: any) => ({
            formatted_address: item.display_name,
            coordinates: {
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon)
            }
          }));
        }
      }
    } catch (error) {
      console.warn('❌ OSM Nominatim error:', error);
    }
    return [];
  }

  static async fallbackSearchLocations(query: string): Promise<LocationResult[]> {
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=se`;
      const controller = new AbortController();
      const nominatimResponse = await this.fetchWithTimeout(nominatimUrl, controller, 7000);
      const nominatimData = await nominatimResponse.json();
      if (Array.isArray(nominatimData) && nominatimData.length > 0) {
        return nominatimData.map((item: any) => ({
          formatted_address: item.display_name,
          coordinates: {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon)
          }
        }));
      }
    } catch (error) {
      console.error('❌ Fallback geocoding error:', error);
    }
    return [];
  }
}