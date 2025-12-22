/**
 * ReserveradViewModel.ts
 * 
 * Converted from Swift (ReserveradViewModel.swift + PrebookingManager.swift)
 * Manages passenger prebookings/scheduled rides with real-time Firestore sync.
 * 
 * Features:
 * - Real-time listener for passenger's scheduled trips
 * - Cancel booking with payment intent cancellation
 * - Filters only future bookings with valid statuses
 * - Supports both 'status' and 'state' fields for backwards compatibility
 */

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export type BookingStatus =
    | 'accepted'
    | 'confirm'
    | 'confirmed'
    | 'completed'
    | 'scheduled'
    | 'pending'
    | 'dispatching'
    | 'cancelled'
    | 'canceled'
    | 'nodriversfound'
    | string;

export interface Booking {
    id?: string;
    tripId?: string | null;
    userId: string;
    passengerName?: string;
    tripCost?: number;
    pickupLocation: string;
    dropOffLocation: string;
    rideType: string;
    date: Date; // scheduledPickupAt
    status: BookingStatus;
    driverNote?: string | null;
    driverId?: string | null;
    driverName?: string | null;
    driverPhoneNumber?: string | null;
    driverVehicle?: string | null;
    driverImageUrl?: string | null; // 📸 Driver profile image URL
    paymentIntentId?: string | null; // For payment cancellation
}

const allowedStatuses = new Set<string>([
    'scheduled',
    'pending',
    'dispatching',
    'confirm',
    'confirmed',
    'accepted',
]);

function normalizeStatus(data: any): string {
    const raw = String(data?.status ?? '').trim();
    const fallback = String(data?.state ?? '').trim();
    return (raw.length ? raw : fallback).toLowerCase();
}

function toJsDate(val: any): Date | null {
    try {
        if (val?.toDate) return val.toDate();
        if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000);
        if (typeof val === 'number') return new Date(val < 2_000_000_000 ? val * 1000 : val);
        if (typeof val === 'string') return new Date(val);
    } catch { }
    return null;
}

/**
 * Build a short vehicle summary from a map containing brand/model/registration/color
 * Matches Swift: buildVehicleSummary(from:)
 */
function buildVehicleSummary(map: Record<string, any>): string | null {
    const brand = String(map.brand ?? map.make ?? '').trim();
    const model = String(map.model ?? '').trim();
    const reg = String(map.registration ?? map.licensePlate ?? map.registrationNumber ?? '').trim().toUpperCase();
    const color = String(map.color ?? '').trim();

    const brandModel = [brand, model].filter(Boolean).join(' ').trim();
    const parts = [brandModel, reg, color].filter(s => s.length > 0);

    if (parts.length === 0) return null;
    return parts.join(' • ');
}

function mapDocToBooking(doc: FirebaseFirestoreTypes.DocumentSnapshot): Booking | null {
    const data: any = doc.data();
    if (!data) return null;

    const passengerUid = String(data.passengerUid ?? '');
    if (!passengerUid) return null;

    const scheduledDate = toJsDate(data.scheduledPickupAt);
    if (!scheduledDate) return null;
    if (scheduledDate.getTime() < Date.now()) return null; // only future bookings

    const status = normalizeStatus(data);
    if (!allowedStatuses.has(status)) return null;

    const pickupAddr = String(data.pickupLocationAddress ?? data.pickupAddress ?? '-');
    const dropoffAddr = String(data.dropoffLocationAddress ?? data.dropOffLocation ?? '-');
    const rideType = String(data.selectedRideType ?? data.rideType ?? 'Spin');
    const passengerName = data.passengerName ? String(data.passengerName) : undefined;
    const driverNote = data.driverNote ? String(data.driverNote) : undefined;
    const driverId = data.driverUid ?? data.driverId ?? null;
    const driverName = data.driverName ?? null;
    const driverPhoneNumber = data.driverPhoneNumber ?? null;
    const driverImageUrl = data.driverImageUrl ?? null;
    const tripCost = typeof data.tripCost === 'number' ? data.tripCost
        : (typeof data.customPrice === 'number' ? data.customPrice : undefined);
    const paymentIntentId = data.paymentIntentId ?? data.stripePaymentIntentId ?? null;

    // 🚗 Extract vehicle info from multiple sources (matches Swift logic)
    let driverVehicle = data.driverVehicle ? String(data.driverVehicle) : null;

    // Try structured carDetails object first
    if (!driverVehicle && data.carDetails) {
        const summary = buildVehicleSummary(data.carDetails);
        if (summary) driverVehicle = summary;
    }

    // Try driverSnapshot with nested vehicle or direct keys
    if (!driverVehicle && data.driverSnapshot) {
        const snapshot = data.driverSnapshot;
        if (snapshot.vehicle) {
            const summary = buildVehicleSummary(snapshot.vehicle);
            if (summary) driverVehicle = summary;
        } else {
            const summary = buildVehicleSummary(snapshot);
            if (summary) driverVehicle = summary;
        }
    }

    // Try driverProfile as fallback
    if (!driverVehicle && data.driverProfile) {
        const summary = buildVehicleSummary(data.driverProfile);
        if (summary) driverVehicle = summary;
    }

    if (driverName) {
        console.log(`📱 Booking: driverName=${driverName}, vehicle=${driverVehicle}, phone=${driverPhoneNumber}, image=${driverImageUrl}`);
    }

    return {
        id: doc.id,
        tripId: String(data.tripId ?? doc.id),
        userId: passengerUid,
        passengerName,
        tripCost,
        pickupLocation: pickupAddr,
        dropOffLocation: dropoffAddr,
        rideType,
        date: scheduledDate,
        status,
        driverNote: driverNote ?? null,
        driverId: driverId ? String(driverId) : null,
        driverName: driverName ? String(driverName) : null,
        driverPhoneNumber: driverPhoneNumber ? String(driverPhoneNumber) : null,
        driverVehicle: driverVehicle,
        driverImageUrl: driverImageUrl ? String(driverImageUrl) : null,
        paymentIntentId: paymentIntentId ? String(paymentIntentId) : null,
    };
}

export default class ReserveradViewModel {
    private unsubscribe: (() => void) | null = null;
    private driverVehicleCache: Record<string, string> = {}; // Cache to avoid repeated driver profile reads

    /**
     * Subscribe to real-time booking updates for current user
     * Matches Swift: func fetchBookingsForPassenger(passengerUID:)
     */
    subscribe(onUpdate: (bookings: Booking[]) => void, onError?: (e: any) => void) {
        const uid = auth().currentUser?.uid;
        if (!uid) {
            onUpdate([]);
            return () => { };
        }

        // Clean previous subscription
        this.unsubscribe?.();

        // Query trips where passengerUid matches current user
        const ref = firestore().collection('trips').where('passengerUid', '==', uid);

        this.unsubscribe = ref.onSnapshot(
            snap => {
                try {
                    const list: Booking[] = [];
                    snap.forEach(d => {
                        const mapped = mapDocToBooking(d as any);
                        if (mapped && mapped.userId === uid) list.push(mapped);
                    });

                    // For any bookings missing driverVehicle but having a driverId, attempt to fetch driver profile
                    const missingVehiclePromises: Promise<void>[] = [];
                    for (const b of list) {
                        if (!b.driverVehicle && b.driverId) {
                            // If cached, apply immediately
                            if (this.driverVehicleCache[b.driverId]) {
                                b.driverVehicle = this.driverVehicleCache[b.driverId];
                            } else {
                                // Fetch asynchronously and re-trigger onUpdate when done
                                const promise = this.populateVehicleForBooking(b.driverId, b.id).then(() => {
                                    // After fetching, re-map and update
                                    const updated = list.map(booking => {
                                        if (booking.id === b.id && this.driverVehicleCache[b.driverId!]) {
                                            return { ...booking, driverVehicle: this.driverVehicleCache[b.driverId!] };
                                        }
                                        return booking;
                                    });
                                    onUpdate(updated.sort((a, b) => a.date.getTime() - b.date.getTime()));
                                });
                                missingVehiclePromises.push(promise);
                            }
                        }
                    }

                    // Sort ascending by date (earliest first)
                    list.sort((a, b) => a.date.getTime() - b.date.getTime());
                    onUpdate(list);

                    // Wait for all vehicle fetches to complete (they will trigger additional onUpdate calls)
                    if (missingVehiclePromises.length > 0) {
                        Promise.all(missingVehiclePromises).catch(err => {
                            console.warn('Some vehicle fetches failed:', err);
                        });
                    }
                } catch (e) {
                    onError?.(e);
                    onUpdate([]);
                }
            },
            err => {
                onError?.(err);
                onUpdate([]);
            }
        );

        return () => {
            this.unsubscribe?.();
            this.unsubscribe = null;
        };
    }

    /**
     * Fetch driver profile document and populate driverVehicle for the booking
     * Matches Swift: populateVehicleForBooking(driverId:bookingId:)
     */
    private async populateVehicleForBooking(driverId: string, bookingId?: string): Promise<void> {
        try {
            const snap = await firestore().collection('drivers').doc(driverId).get();
            if (!snap.exists) return;

            const data = snap.data();
            if (!data) return;

            // Try to extract car details using buildVehicleSummary helper
            let vehicleSummary: string | null = null;

            // Try carDetails first
            if (data.carDetails) {
                vehicleSummary = buildVehicleSummary(data.carDetails);
            }

            // Fall back to top-level fields
            if (!vehicleSummary) {
                const map = {
                    brand: data.brand,
                    model: data.model,
                    registration: data.registration,
                    color: data.color,
                    year: data.year,
                };
                vehicleSummary = buildVehicleSummary(map);
            }

            if (vehicleSummary) {
                // Cache the result
                this.driverVehicleCache[driverId] = vehicleSummary;
                console.log(`✅ Cached vehicle for driver ${driverId}: ${vehicleSummary}`);
                // Note: This updates cache but doesn't mutate the booking in-place.
                // The next snapshot will pick up the cached value.
            }
        } catch (error) {
            console.warn(`Failed to fetch driver profile ${driverId}:`, error);
        }
    }

    /**
     * Cancel a booking/scheduled ride
     * Matches Swift: func cancelBooking(for tripId:)
     * 
     * Steps:
     * 1. Cancel payment intent if exists
     * 2. Update trip status to 'cancelled'
     * 3. Clear driver assignments (matches Swift logic)
     * 4. Delete Reservations shadow document
     * 5. Delete trip after 5 seconds (matches Swift behavior)
     */
    async cancelBooking(booking: Booking): Promise<boolean> {
        try {
            const tripId = booking.id || booking.tripId;
            if (!tripId) return false;

            // Step 1: Cancel payment intent if exists (matches Swift fetchPaymentIntentIdForTrip + cancelPrebookedTrip)
            if (booking.paymentIntentId) {
                try {
                    await this.cancelPaymentIntent(booking.paymentIntentId, tripId);
                    console.log('✅ Betalning avbruten');
                } catch (paymentError) {
                    console.warn('Failed to cancel payment intent:', paymentError);
                    // Continue anyway - trip is cancelled
                }
            } else {
                // Try to find paymentIntentId from trip document or related stray docs
                const pid = await this.fetchPaymentIntentIdForTrip(tripId);
                if (pid) {
                    try {
                        await this.cancelPaymentIntent(pid, tripId);
                        console.log('✅ Betalning avbruten (from trip lookup)');
                    } catch (paymentError) {
                        console.warn('Failed to cancel payment intent:', paymentError);
                    }
                }
            }

            // Step 2: Update trip document (matches Swift payload structure)
            const payload: any = {
                status: 'cancelled',
                state: 'cancelled',
                cancelledBy: 'passenger',
                cancelledAt: firestore.FieldValue.serverTimestamp(),
                cancellationReason: 'Passenger cancelled',
            };

            // Step 3: Clear driver-related assignments (matches Swift logic)
            payload['driverUid'] = firestore.FieldValue.delete();
            payload['driverId'] = firestore.FieldValue.delete();
            payload['driverName'] = firestore.FieldValue.delete();
            payload['driverVehicle'] = firestore.FieldValue.delete();
            payload['driverPhoneNumber'] = firestore.FieldValue.delete();
            payload['driverImageUrl'] = firestore.FieldValue.delete();
            payload['pendingDriverId'] = firestore.FieldValue.delete();
            payload['dispatchingMethod'] = firestore.FieldValue.delete();
            payload['pendingDriverTimeoutMs'] = firestore.FieldValue.delete();

            await firestore().collection('trips').doc(String(tripId)).update(payload);

            // Step 4: Cleanup Reservations shadow doc (matches Swift)
            try {
                await firestore().collection('Reservations').doc(String(tripId)).delete();
            } catch {
                // Ignore if doesn't exist
            }

            // Step 5: Radera trippen efter 5 sekunder (matches Swift behavior)
            setTimeout(async () => {
                try {
                    await firestore().collection('trips').doc(String(tripId)).delete();
                    console.log('✅ Trip raderad efter avbokning av passagerare');
                } catch (error) {
                    console.error('❌ Kunde inte radera trip:', error);
                }
            }, 5000);

            console.log('✅ Förbokning markerad som avbokad (doc kvar): ' + tripId);
            return true;
        } catch (e) {
            console.error('cancelBooking error:', e);
            return false;
        }
    }

    /**
     * Fetch PaymentIntentId for trip even if it's in a separate/stray document
     * Matches Swift: fetchPaymentIntentIdForTrip(_:completion:)
     */
    private async fetchPaymentIntentIdForTrip(tripId: string): Promise<string | null> {
        try {
            // 1) Try primary document first (docId == tripId)
            const primarySnap = await firestore().collection('trips').doc(tripId).get();
            const primaryPid = primarySnap.data()?.paymentIntentId;
            if (primaryPid) return String(primaryPid);

            // 2) Look for stray document referencing tripId
            const querySnap = await firestore()
                .collection('trips')
                .where('tripId', '==', tripId)
                .limit(1)
                .get();

            if (!querySnap.empty) {
                const pid = querySnap.docs[0].data()?.paymentIntentId;
                if (pid) return String(pid);
            }

            // 3) Try via 'id' field as fallback
            const querySnap2 = await firestore()
                .collection('trips')
                .where('id', '==', tripId)
                .limit(1)
                .get();

            if (!querySnap2.empty) {
                const pid = querySnap2.docs[0].data()?.paymentIntentId;
                if (pid) return String(pid);
            }

            return null;
        } catch (error) {
            console.warn('fetchPaymentIntentIdForTrip error:', error);
            return null;
        }
    }

    /**
     * Cancel payment intent via backend or cloud function
     * Matches Swift: RideRequestManager.shared.cancelPrebookedTrip(tripId:paymentIntentId:)
     */
    private async cancelPaymentIntent(paymentIntentId: string, tripId?: string): Promise<void> {
        try {
            // Option 1: Call Stripe backend endpoint directly
            const STRIPE_BACKEND_URL = 'https://stripe-backend-production-fb6e.up.railway.app';
            const response = await fetch(`${STRIPE_BACKEND_URL}/cancel-payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentIntentId,
                    tripId,
                }),
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to cancel payment intent');
            }

            console.log('✅ Payment intent cancelled via backend');
        } catch (error) {
            console.error('cancelPaymentIntent error:', error);
            throw error;
        }
    }

    /**
     * Clean up listeners
     */
    dispose() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}

// Types shim for DocumentSnapshot without importing deep types globally
// This avoids version-specific type issues across RN Firebase versions.
declare namespace FirebaseFirestoreTypes {
    interface DocumentSnapshot {
        id: string;
        data(): any;
    }
}
