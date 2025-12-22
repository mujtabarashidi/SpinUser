export interface ScheduledRide {
    id?: string;
    passengerName: string;
    pickupLocation: string;
    dropOffLocation: string;
    status: string;
    rideType?: string;
    driverId?: string;
    driverName?: string;
    driverVehicle?: string;
    tripId?: string;
    date?: Date;
    tripCost?: number;
    customPrice?: number;
    distanceMeters?: number;
    paymentMethod?: string;
    passengerPhoneNumber?: string;
    driverPhoneNumber?: string;
    scheduledPickupAt?: Date;
}

export interface ScheduledRideData {
    id?: string;
    passengerName?: string;
    passengerPhoneNumber?: string;
    pickupLocation?: string;
    pickupLocationAddress?: string;
    pickupLocationName?: string;
    dropOffLocation?: string;
    dropoffLocationAddress?: string;
    destination?: string;
    status?: string;
    state?: string;
    rideType?: string;
    selectedRideType?: string;
    driverId?: string;
    driverUid?: string;
    driverName?: string;
    driverPhoneNumber?: string;
    driverVehicle?: string;
    tripId?: string;
    date?: any; // Firestore Timestamp
    scheduledPickupAt?: any; // Firestore Timestamp
    tripCost?: number;
    customPrice?: number;
    distanceMeters?: number;
    paymentMethod?: string;
}

export const normalizeCategory = (category: string): string => {
    const lower = category.toLowerCase().trim();

    // Normalisera olika varianter till standardformat
    const categoryMap: { [key: string]: string } = {
        'spin': 'spin',
        'spinbil': 'spin',
        'spin bil': 'spin',
        'komfort': 'komfort',
        'premium': 'premium',
        'van': 'van',
        'minibuss': 'van',
        'eco': 'eco',
        'miljö': 'eco',
    };

    return categoryMap[lower] || lower;
};

export const parseScheduledRide = (docId: string, data: ScheduledRideData): ScheduledRide | null => {
    // Check for scheduledPickupAt timestamp
    const scheduledTs = data.scheduledPickupAt;
    if (!scheduledTs) return null;

    const pickupTime = scheduledTs.toDate ? scheduledTs.toDate() : new Date(scheduledTs);
    const now = new Date();

    // Filter out past rides
    if (pickupTime < now) return null;

    // Status normalization
    const rawStatus = data.status?.trim().toLowerCase() || '';
    const fallbackState = data.state?.trim().toLowerCase() || '';
    const status = rawStatus || fallbackState || 'scheduled';

    // Only include allowed statuses
    const allowedStatuses = ['scheduled', 'pending', 'dispatching', 'confirm', 'confirmed', 'accepted'];
    if (!allowedStatuses.includes(status)) return null;

    // Parse locations
    const pickupLocation =
        data.pickupLocationAddress ||
        data.pickupLocationName ||
        data.pickupLocation ||
        '-';

    const dropOffLocation =
        data.dropoffLocationAddress ||
        data.dropOffLocation ||
        data.destination ||
        '-';

    return {
        id: docId,
        passengerName: data.passengerName || 'Okänd passagerare',
        pickupLocation,
        dropOffLocation,
        status,
        rideType: data.selectedRideType || data.rideType,
        driverId: data.driverUid || data.driverId,
        driverName: data.driverName,
        driverVehicle: data.driverVehicle,
        tripId: data.tripId || docId,
        date: pickupTime,
        scheduledPickupAt: pickupTime,
        tripCost: data.tripCost,
        customPrice: data.customPrice,
        distanceMeters: data.distanceMeters,
        paymentMethod: data.paymentMethod,
        passengerPhoneNumber: data.passengerPhoneNumber,
        driverPhoneNumber: data.driverPhoneNumber,
    };
};

export const getEffectivePrice = (ride: ScheduledRide): number | undefined => {
    return ride.customPrice ?? ride.tripCost;
};

export const getStableId = (ride: ScheduledRide): string => {
    if (ride.tripId) return ride.tripId;
    if (ride.id) return ride.id;
    const ts = ride.date ? Math.floor(ride.date.getTime() / 1000) : 0;
    return `${ride.passengerName}|${ride.pickupLocation}|${ride.dropOffLocation}|${ts}`;
};

export const getNormalizedCategory = (ride: ScheduledRide): string | null => {
    if (!ride.rideType) return null;
    return normalizeCategory(ride.rideType);
};
