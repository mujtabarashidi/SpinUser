import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import { RouteService } from '../../utils/RouteService';
import DriverMarker from '../Components/DriverMarker';
import { HomeContext } from '../context/HomeContext';

type Coordinate = { latitude: number; longitude: number };

export type SpinMapViewProps = {
  mapState: string;
  userLocation?: Coordinate | null;
};





export default function SpinMapView({ mapState, userLocation }: SpinMapViewProps) {
  const mapRef = useRef<MapView | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const homeContext = useContext(HomeContext);
  const {
    pickupCoordinate,
    destinationCoordinate,
    routePoints,
    isRouteLoading,
    setIsRouteLoading,
    setRoutePoints,
    nearbyDrivers,
    currentDriverLocation,
    trip,
  } = homeContext;

  const lastCenteredLocation = useRef<Coordinate | null>(null);
  const hasInitiallyAnimated = useRef(false);

  // Centera kartan på användarens position när den är tillgänglig
  useEffect(() => {
    if (!userLocation || !mapRef.current) {
      return;
    }

    // Första gången eller när användaren är i HomeView
    if (mapState === 'HomeView' || !hasInitiallyAnimated.current) {
      const last = lastCenteredLocation.current;
      const hasMoved =
        !last ||
        Math.abs(last.latitude - userLocation.latitude) > 0.0001 ||
        Math.abs(last.longitude - userLocation.longitude) > 0.0001;

      if (hasMoved || !hasInitiallyAnimated.current) {
        const region: Region = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

        mapRef.current.animateToRegion(region, 500);
        lastCenteredLocation.current = userLocation;
        hasInitiallyAnimated.current = true;
        console.log('📍 Kartan centrerad på användarens position:', userLocation);
      }
    }
  }, [userLocation, mapState]);

  // Fetch route when both pickup and destination are set
  useEffect(() => {
    const fetchRoute = async () => {
      if (pickupCoordinate && destinationCoordinate) {
        setIsRouteLoading(true);
        try {
          const route = await RouteService.getRoute(pickupCoordinate, destinationCoordinate);
          setRoutePoints(route);

          // Fit map to show the entire route
          if (route.length > 0 && mapRef.current) {
            const coordinates = route.map(point => ({
              latitude: point.latitude,
              longitude: point.longitude,
            }));

            try {
              mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
              });
            } catch (error) {
              console.warn('Failed to fit map to coordinates:', error);
            }
          }
        } catch (error) {
          console.error('Failed to fetch route:', error);
        } finally {
          setIsRouteLoading(false);
        }
      } else {
        // Clear route if either coordinate is missing
        setRoutePoints([]);
      }
    };

    fetchRoute();
  }, [pickupCoordinate, destinationCoordinate, setIsRouteLoading, setRoutePoints]);

  // Default to Stockholm if no user location is provided
  const initialRegion: Region = userLocation
    ? {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }
    : {
      latitude: 59.3293, // Stockholm
      longitude: 18.0686,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };

  const mapPadding = Platform.select({
    android: {
      top: 0,
      left: 0,
      right: 0,
      bottom: mapState === 'HomeView' ? 200 : 100,
    },
    default: { top: 0, left: 0, right: 50, bottom: 150 },
  });

  const assignedDriverCoordinate = useMemo(() => {
    if (currentDriverLocation) {
      return currentDriverLocation;
    }
    if (trip && trip.driverLocation) {
      const lat =
        trip.driverLocation.latitude ??
        trip.driverLocation.lat ??
        trip.driverLocation._latitude;
      const lng =
        trip.driverLocation.longitude ??
        trip.driverLocation.lng ??
        trip.driverLocation._longitude;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return { latitude: lat, longitude: lng };
      }
    }
    return null;
  }, [currentDriverLocation, trip]);

  // Avoid duplicate markers: filter out the assigned driver from nearby list.
  const assignedDriverId = useMemo(() => {
    return String(
      trip?.driverUid ??
      trip?.driverId ??
      trip?.driver?.id ??
      ''
    );
  }, [trip?.driverUid, trip?.driverId, trip?.driver?.id]);

  const distanceMeters = (a: Coordinate, b: Coordinate) => {
    const R = 6371e3;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const aVal = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  };

  const nearbyDriversFiltered = useMemo(() => {
    const list = Array.isArray(nearbyDrivers) ? nearbyDrivers : [];
    return list.filter(d => {
      // Prefer filtering by id when we know which driver is assigned
      if (assignedDriverId && String(d.id) === assignedDriverId) return false;
      // Also filter by proximity to assigned driver's coordinate to avoid duplicates
      if (assignedDriverCoordinate) {
        try {
          const driverLoc = d.currentLocation || d.location;
          if (driverLoc) {
            const dist = distanceMeters(driverLoc, assignedDriverCoordinate);
            if (dist < 15) return false; // within 15 meters, likely the same car
          }
        } catch { }
      }
      return true;
    });
  }, [nearbyDrivers, assignedDriverId, assignedDriverCoordinate]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    if (mapState !== 'tripAccepted') {
      return;
    }
    const points: Coordinate[] = [];
    if (assignedDriverCoordinate) points.push(assignedDriverCoordinate);
    if (pickupCoordinate) points.push(pickupCoordinate);
    if (destinationCoordinate) points.push(destinationCoordinate);
    if (points.length < 2) {
      return;
    }

    try {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 80, right: 80, bottom: 120, left: 80 },
        animated: true,
      });
    } catch (error) {
      console.warn('Failed to fit map to trip coordinates:', error);
    }
  }, [assignedDriverCoordinate, pickupCoordinate, destinationCoordinate, mapState]);

  return (
    <View style={styles.container}>
      <MapView
        ref={(ref) => {
          if (ref) {
            mapRef.current = ref;
          }
        }}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation={true}
        showsMyLocationButton={false}
        followsUserLocation={mapState === 'HomeView' && !pickupCoordinate && !destinationCoordinate && !assignedDriverCoordinate}
        // Guard map padding until map is fully ready to avoid null native refs
        mapPadding={isMapReady ? mapPadding as any : undefined}
        initialRegion={initialRegion}
        onMapReady={() => {
          console.log('🗺️ Map is ready');
          setIsMapReady(true);
          // Centera på användarens position när kartan är klar
          if (userLocation && mapRef.current) {
            const region: Region = {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            };
            setTimeout(() => {
              mapRef.current?.animateToRegion(region, 500);
            }, 100);
          }
        }}
      >
        {/* Pickup marker */}
        {pickupCoordinate && (
          <Marker
            coordinate={pickupCoordinate}
            title="Upphämtningsplats"
            pinColor="green"
          />
        )}

        {/* Destination marker */}
        {destinationCoordinate && (
          <Marker
            coordinate={destinationCoordinate}
            title="Destination"
            pinColor="red"
          />
        )}

        {/* Route polyline */}
        {routePoints.length > 0 && (
          <Polyline
            coordinates={routePoints.map(point => ({
              latitude: point.latitude,
              longitude: point.longitude,
            }))}
            strokeColor="#0A84FF"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
            geodesic
          />
        )}

        {assignedDriverCoordinate && (
          <Marker
            coordinate={assignedDriverCoordinate}
            title="Din förare"
            description={trip?.driverName}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <DriverMarker
              size={46}
              color="#1E88E5"
              bearing={
                (currentDriverLocation as any)?.bearing ??
                (typeof trip?.driverLocation?.bearing === 'number' ? trip.driverLocation.bearing : 0)
              }
              highlight
            />
          </Marker>
        )}

        {/* Driver markers (deduped) */}
        {nearbyDriversFiltered.map((driver) => {
          const driverCoord = driver.currentLocation || driver.location || { latitude: 0, longitude: 0 };
          return (
            <Marker
              key={driver.id}
              coordinate={driverCoord}
              // Intentionally no title/description to avoid default callout for generic drivers
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <DriverMarker size={38} color="#0A84FF" bearing={driver.bearing ?? 0} />
            </Marker>
          );
        })}
      </MapView>

      {/* Loading indicator */}
      {isRouteLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
        </View>
      )}

      {/* Custom GPS Button - Positioned in bottom right */}
      <TouchableOpacity
        style={styles.gpsButton}
        onPress={() => {
          if (userLocation && mapRef.current) {
            const region: Region = {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            };
            mapRef.current.animateToRegion(region, 500);
          }
        }}
      >
        <Icon name="locate" size={24} color="#1976D2" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    padding: 10,
  },
  gpsButton: {
    position: 'absolute',
    top: 58,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  driverMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverIconContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  carIcon: {
    fontSize: 20,
    textAlign: 'center',
  },
});
