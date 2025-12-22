import { Coordinate } from './GeocodingService';

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

// Google API key (same as in GeocodingService)
const GOOGLE_API_KEY = 'AIzaSyC25ES_6JPSeywcHLMvFL9z7Sc7X2SNqiU';

export class RouteService {
  /**
   * Fetch route from Google Directions API
   */
  static async getRoute(from: Coordinate, to: Coordinate): Promise<RoutePoint[]> {
    try {
      console.log('🗺️ Fetching route from Google Directions API');
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&mode=driving&key=${GOOGLE_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      // Check for API errors
      if (data.status === 'REQUEST_DENIED' || data.error_message) {
        console.warn('❌ Google Directions API error:', data.error_message || data.status);
        // Return a simple straight line as fallback
        return this.createStraightLineRoute(from, to);
      }
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        if (route.overview_polyline && route.overview_polyline.points) {
          console.log('✅ Route successfully fetched from Google');
          return this.decodePolyline(route.overview_polyline.points);
        }
      }
      
      console.log('⚠️ No route data, creating straight line fallback');
      return this.createStraightLineRoute(from, to);
    } catch (error) {
      console.error('❌ Route fetch error, using straight line fallback:', error);
      return this.createStraightLineRoute(from, to);
    }
  }

  /**
   * Create a simple straight line route as fallback
   */
  private static createStraightLineRoute(from: Coordinate, to: Coordinate): RoutePoint[] {
    console.log('📏 Creating straight line route fallback');
    return [
      { latitude: from.latitude, longitude: from.longitude },
      { latitude: to.latitude, longitude: to.longitude }
    ];
  }

  /**
   * Decode Google polyline string to coordinates
   */
  private static decodePolyline(encoded: string): RoutePoint[] {
    const points: RoutePoint[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  /**
   * Calculate distance between two coordinates in kilometers
   */
  static calculateDistance(from: Coordinate, to: Coordinate): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);
    const lat1 = this.toRadians(from.latitude);
    const lat2 = this.toRadians(to.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
