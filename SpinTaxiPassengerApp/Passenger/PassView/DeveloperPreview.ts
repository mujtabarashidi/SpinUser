/**
 * DeveloperPreview.ts
 * Converted from Swift DeveloperPreview for React Native
 * Created: 17 September 2025
 */

import { Driver, CarType, Coordinate } from '../../types/Driver';

// Types for Trip and User (based on Swift version)
export interface Trip {
  id?: string;
  passengerUid: string;
  driverUid: string;
  passengerName: string;
  driverName: string;
  driverImageUrl: string;
  phoneNumber: string;
  driverPhoneNumber: string;
  carDetails: CarDetails;
  driverLocation: Coordinate;
  pickupLocationAddress: string;
  dropoffLocationAddress: string;
  pickupLocation: Coordinate;
  dropoffLocation: Coordinate;
  tripCost: number;
  distanceToPassenger: number;
  travelTimeToPassenger: number;
  travelTimeTopickupLocation: number;
  distanceTodropoffLocation: number;
  travelTimeTodropoffLocation: number;
  estimatedArrivalTime: number;
  state: TripState;
  selectedRideType: string;
  stripeCustomerId: string;
  status: string;
}

export interface CarDetails {
  brand: string;
  model: string;
  registration: string;
  color: string;
}

export enum TripState {
  REQUESTED = 'requested',
  ACCEPTED = 'accepted',
  DRIVER_ARRIVED = 'driverArrived',
  IN_PROGRESS = 'inProgress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface User {
  fullname: string;
  email: string;
  uid: string;
  phoneNumber: string;
  coordinate: Coordinate;
  accountType: AccountType;
  stripeCustomerId: string;
  pickupAddress: string;
  pickupLocation: Coordinate;
}

export enum AccountType {
  PASSENGER = 'passenger',
  DRIVER = 'driver'
}

class DeveloperPreview {
  private static _shared: DeveloperPreview;

  static get shared(): DeveloperPreview {
    if (!DeveloperPreview._shared) {
      DeveloperPreview._shared = new DeveloperPreview();
    }
    return DeveloperPreview._shared;
  }

  readonly mockTrip: Trip = {
    passengerUid: this.generateUUID(),
    driverUid: this.generateUUID(),
    passengerName: "Adam",
    driverName: "Jan Svensson",
    driverImageUrl: "",
    phoneNumber: "+46701234567",
    driverPhoneNumber: "+46701112233",
    carDetails: {
      brand: "Mercedes-Benz",
      model: "E-Class",
      registration: "MAD 28A",
      color: "Svart"
    },
    driverLocation: { latitude: 59.3325, longitude: 18.0494 },
    pickupLocationAddress: "Vasagatan 1, 111 20 Stockholm",
    dropoffLocationAddress: "Solna Torg 13",
    pickupLocation: { latitude: 59.3325, longitude: 18.0494 },
    dropoffLocation: { latitude: 59.5325, longitude: 18.5494 },
    tripCost: 112.0,
    distanceToPassenger: 10,
    travelTimeToPassenger: 24,
    travelTimeTopickupLocation: 5,
    distanceTodropoffLocation: 8,
    travelTimeTodropoffLocation: 14,
    estimatedArrivalTime: 15,
    state: TripState.REQUESTED,
    selectedRideType: "Premium",
    stripeCustomerId: "aba123",
    status: "Active"
  };

  readonly mockUser: User = {
    fullname: "Adam Svenis",
    email: "Adam@gmail.com",
    uid: this.generateUUID(),
    phoneNumber: "+46701234567",
    coordinate: { latitude: 59.382, longitude: 18.0434 },
    accountType: AccountType.PASSENGER,
    stripeCustomerId: "cus_test_123",
    pickupAddress: "Mall of Scandinavia, Solna",
    pickupLocation: { latitude: 59.3700, longitude: 18.0050 }
  };

  // Utility method to generate UUID (simplified version)
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Additional mock data for extended testing
  readonly mockDriversExtended: Driver[] = [
    {
      id: 'driver-premium-1',
      name: this.mockTrip.driverName,
      phoneNumber: this.mockTrip.driverPhoneNumber,
      rating: 4.9,
      totalRides: 456,
      isOnline: true,
      isAvailable: true,
      currentLocation: this.mockTrip.driverLocation,
      bearing: 180,
      speed: 0,
      carInfo: {
        id: 'car-premium-1',
        make: this.mockTrip.carDetails.brand,
        model: this.mockTrip.carDetails.model,
        year: 2023,
        color: this.mockTrip.carDetails.color,
        licensePlate: this.mockTrip.carDetails.registration,
        carType: CarType.Premium,
        maxPassengers: 4
      },
      lastLocationUpdate: new Date().toISOString()
    },
    {
      id: 'driver-standard-1',
      name: 'Erik Lindqvist',
      phoneNumber: '+46701234568',
      rating: 4.7,
      totalRides: 234,
      isOnline: true,
      isAvailable: true,
      currentLocation: { latitude: 59.3293, longitude: 18.0686 },
      bearing: 90,
      speed: 15,
      carInfo: {
        id: 'car-standard-1',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        color: 'Vit',
        licensePlate: 'ABC 123',
        carType: CarType.Spin,
        maxPassengers: 4
      },
      lastLocationUpdate: new Date().toISOString()
    }
  ];
}

// Export singleton instance
export const dev = DeveloperPreview.shared;

// Export class for direct access if needed
export default DeveloperPreview;