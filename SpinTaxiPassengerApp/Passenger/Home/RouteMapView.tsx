import React from 'react';
import MapView, { Polyline } from 'react-native-maps';
import { StyleSheet } from 'react-native';

type LatLng = {
  latitude: number;
  longitude: number;
};

interface RouteMapViewProps {
  from: LatLng;
  to: LatLng;
}

export default function RouteMapView({ from, to }: RouteMapViewProps) {
  // You would calculate the route and render a Polyline here
  return (
    <MapView style={styles.map}>
      {/* <Polyline coordinates={[from, to]} strokeColor="blue" strokeWidth={4} /> */}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
