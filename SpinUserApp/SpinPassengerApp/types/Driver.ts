export type Coordinate = { latitude: number; longitude: number };

export enum CarType {
  Spin = 'Spin',
  Komfort = 'Komfort',
  Premium = 'Premium',
  XL = 'XL',
  Van = 'Van',
  Limousine = 'Limousine',
  SpinGo = 'SpinGo',
}

export interface DriverLocationUpdate {
  driverId: string;
  location?: Coordinate;
  latitude?: number;
  longitude?: number;
  bearing?: number;
  speed?: number;
  heading?: number;
  speedKmh?: number;
}

export interface Driver {
  id: string;
  name: string;
  rating?: number;
  carType: CarType;
  carModel?: string;
  carPlate?: string;
  location?: Coordinate;
  phoneNumber?: string;
  currentLocation?: Coordinate;
  carInfo?: {
    carType: CarType;
    carModel?: string;
    carPlate?: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    licensePlate?: string;
    maxPassengers?: number;
  };
  bearing?: number;
  totalRides?: number;
  isOnline?: boolean;
  isAvailable?: boolean;
  speed?: number;
  lastLocationUpdate?: string;
}
