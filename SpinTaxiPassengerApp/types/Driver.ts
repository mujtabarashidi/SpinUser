export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Driver {
  id: string;
  name: string;
  phoneNumber: string;
  profileImageUrl?: string;
  rating: number;
  totalRides: number;
  isOnline: boolean;
  isAvailable: boolean;
  currentLocation: Coordinate;
  bearing?: number; // Direction the car is facing
  speed?: number;
  carInfo: Car;
  lastLocationUpdate: string; // ISO date string
}

export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  carType: CarType;
  maxPassengers: number;
}

export enum CarType {
  SpinGo = 'spingo',
  Spin = 'spin',
  komfort = 'komfort',
  Premium = 'premium',
  Van = 'xl',
  Eco = 'eco',
  Komfort = 'Komfort',
  Limousine = 'limousine',
}

export interface DriverAnnotation {
  driver: Driver;
  coordinate: Coordinate;
}

// For real-time updates
export interface DriverLocationUpdate {
  driverId: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  timestamp: string;
}