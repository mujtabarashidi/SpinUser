/**
 * RideRequestHandler.tsx
 * 
 * Hanterar bokningar och betalningar - matchar iOS RideRequestManager.swift
 * 
 * Flöde:
 * 1. Kontant → Skapa trip direkt
 * 2. Kort/Google Pay → Reservera betalning → Skapa trip med paymentIntentId → Sök förare
 * 3. Förbokningar → Skapa trip med status 'awaiting_payment' → Betala → Uppdatera till 'scheduled'
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Alert } from 'react-native';
import PaymentViewModel from './PaymentViewModel';
import type { SavedCard } from './PaymentViewModel';
import type { PaymentOption } from '../../types/PaymentOption';

const BACKEND_URL = 'https://stripe-backend-production-fb6e.up.railway.app';

export interface RideType {
  id: string;
  name: string;
  description: string;
  carType: string;
  passengerCount: number;
  basePrice: number;
  isAvailable: boolean;
}

export interface TripData {
  tripId: string;
  passengerUid: string;
  passengerName: string;
  passengerPhoneNumber: string;
  pickupLocationAddress: string;
  pickupLocationName: string;
  pickupLocation: {
    latitude: number;
    longitude: number;
  };
  dropoffLocationAddress: string;
  dropoffLocationName: string;
  dropoffLocation: {
    latitude: number;
    longitude: number;
  };
  tripCost: number;
  customPrice?: number;
  rideType: string;
  selectedRideType: string;
  status: string;
  state: string;
  paymentMethod: string;
  driverNote?: string;
  scheduledPickupAt?: Date;
  paymentIntentId?: string;
  stripeCustomerId?: string;
}

class RideRequestHandler {
  private static instance: RideRequestHandler;

  private constructor() {}

  static getInstance(): RideRequestHandler {
    if (!RideRequestHandler.instance) {
      RideRequestHandler.instance = new RideRequestHandler();
    }
    return RideRequestHandler.instance;
  }

  /**
   * Huvudfunktion för att hantera bokningar - matchar Swift handleRideRequest
   */
  async handleRideRequest(
    selectedPaymentOption: PaymentOption,
    selectedRideType: RideType,
    driverNote: string | null,
    customPrice: number | null,
    tripData: TripData,
    scheduledDate?: Date
  ): Promise<{ success: boolean; tripId?: string; paymentIntentId?: string; error?: string }> {
    console.log('🚗 RideRequestHandler: Starting request');
    console.log('  Payment:', selectedPaymentOption.type);
    console.log('  Ride:', selectedRideType.name);
    console.log('  Scheduled:', !!scheduledDate);

    // Om förbokad resa
    if (scheduledDate) {
      return this.scheduleRide(
        scheduledDate,
        selectedPaymentOption,
        selectedRideType,
        driverNote,
        customPrice,
        tripData
      );
    }

    // Direkt bokning
    switch (selectedPaymentOption.type) {
      case 'cash':
        return this.handleCashBooking(selectedRideType, driverNote, customPrice, tripData);
      
      case 'card':
        if (!selectedPaymentOption.savedCard) {
          return { success: false, error: 'Inget kort valt' };
        }
        return this.handleSavedCardBooking(
          selectedPaymentOption.savedCard,
          selectedRideType,
          driverNote,
          customPrice,
          tripData
        );
      
      default:
        return { success: false, error: 'Betalmetod stöds inte än' };
    }
  }

  /**
   * Kontant bokning - skapa trip direkt
   */
  private async handleCashBooking(
    selectedRideType: RideType,
    driverNote: string | null,
    customPrice: number | null,
    tripData: TripData
  ): Promise<{ success: boolean; tripId?: string; error?: string }> {
    try {
      console.log('💵 Kontant bokning - skapar trip direkt');

      const tripPayload = {
        ...tripData,
        paymentMethod: 'Kontant',
        status: 'requested',
        state: 'requested',
        createdAt: firestore.FieldValue.serverTimestamp(),
        driverNote: driverNote || '',
      };

      await firestore().collection('trips').doc(tripData.tripId).set(tripPayload);
      
      console.log('✅ Trip skapad för kontant:', tripData.tripId);
      
      return {
        success: true,
        tripId: tripData.tripId,
      };
    } catch (error: any) {
      console.error('❌ Kontant bokning misslyckades:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sparat kort bokning - reservera först, sedan skapa trip
   */
  private async handleSavedCardBooking(
    savedCard: SavedCard,
    selectedRideType: RideType,
    driverNote: string | null,
    customPrice: number | null,
    tripData: TripData
  ): Promise<{ success: boolean; tripId?: string; paymentIntentId?: string; error?: string }> {
    try {
      console.log('💳 Kortbetalning - reserverar pengar först');

      const user = auth().currentUser;
      if (!user || !user.email) {
        return { success: false, error: 'Ingen inloggad användare' };
      }

      // 1. Hämta Stripe customer ID
      const customerId = await PaymentViewModel.createOrGetCustomer(user.uid, user.email);
      if (!customerId) {
        return { success: false, error: 'Kunde inte skapa Stripe-kund' };
      }

      const effectivePrice = customPrice || selectedRideType.basePrice;

      // 2. Reservera betalning (CHARGE men capture=false)
      const paymentResult = await PaymentViewModel.chargeSavedCard(
        customerId,
        savedCard.id,
        effectivePrice,
        tripData.tripId
      );

      if (!paymentResult.success || !paymentResult.paymentIntentId) {
        return {
          success: false,
          error: paymentResult.error || 'Kortbetalning misslyckades',
        };
      }

      console.log('✅ Betalning reserverad:', paymentResult.paymentIntentId);

      // 3. Skapa trip MED paymentIntentId
      const tripPayload = {
        ...tripData,
        paymentMethod: `Kort •••${savedCard.last4}`,
        paymentIntentId: paymentResult.paymentIntentId,
        status: 'requested',
        state: 'requested',
        createdAt: firestore.FieldValue.serverTimestamp(),
        driverNote: driverNote || '',
        stripeCustomerId: customerId,
      };

      await firestore().collection('trips').doc(tripData.tripId).set(tripPayload);

      console.log('✅ Trip skapad med paymentIntentId');

      return {
        success: true,
        tripId: tripData.tripId,
        paymentIntentId: paymentResult.paymentIntentId,
      };
    } catch (error: any) {
      console.error('❌ Kortbetalning misslyckades:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Förboka resa - matchar Swift scheduleRide
   */
  private async scheduleRide(
    scheduledDate: Date,
    selectedPaymentOption: PaymentOption,
    selectedRideType: RideType,
    driverNote: string | null,
    customPrice: number | null,
    tripData: TripData
  ): Promise<{ success: boolean; tripId?: string; paymentIntentId?: string; error?: string }> {
    try {
      console.log('🕐 Förbokning - skapar trip först');

      const effectivePrice = customPrice || selectedRideType.basePrice;

      // Kontant förbokning - skapa direkt med status 'scheduled'
      if (selectedPaymentOption.type === 'cash') {
        const tripPayload = {
          ...tripData,
          paymentMethod: 'Kontant',
          status: 'scheduled',
          state: 'requested',
          scheduledPickupAt: firestore.Timestamp.fromDate(scheduledDate),
          createdAt: firestore.FieldValue.serverTimestamp(),
          driverNote: driverNote || '',
          tripCost: effectivePrice,
        };

        await firestore().collection('trips').doc(tripData.tripId).set(tripPayload);
        
        console.log('✅ Kontant förbokning skapad');
        
        return {
          success: true,
          tripId: tripData.tripId,
        };
      }

      // Kort/Google Pay förbokning - skapa med 'awaiting_payment', betala, uppdatera
      const awaitingPayload = {
        ...tripData,
        status: 'awaiting_payment',
        state: 'requested',
        scheduledPickupAt: firestore.Timestamp.fromDate(scheduledDate),
        createdAt: firestore.FieldValue.serverTimestamp(),
        driverNote: driverNote || '',
        tripCost: effectivePrice,
      };

      await firestore().collection('trips').doc(tripData.tripId).set(awaitingPayload);
      
      console.log('✅ Trip skapad med status "awaiting_payment"');

      // Processar betalning
      const paymentResult = await this.handleScheduledPayment(
        selectedPaymentOption,
        selectedRideType,
        tripData.tripId,
        effectivePrice
      );

      if (!paymentResult.success) {
        // Betalning misslyckades - radera trip
        console.log('❌ Betalning misslyckades - raderar trip');
        try {
          await firestore().collection('trips').doc(tripData.tripId).delete();
        } catch {
          // Om radering misslyckas, markera som payment_failed
          await firestore().collection('trips').doc(tripData.tripId).update({
            status: 'payment_failed',
            paymentErrorAt: firestore.FieldValue.serverTimestamp(),
          });
        }
        return paymentResult;
      }

      // Uppdatera till 'scheduled' efter lyckad betalning
      await firestore().collection('trips').doc(tripData.tripId).update({
        status: 'scheduled',
        paymentIntentId: paymentResult.paymentIntentId,
      });

      console.log('✅ Förbokning uppdaterad till "scheduled"');

      return {
        success: true,
        tripId: tripData.tripId,
        paymentIntentId: paymentResult.paymentIntentId,
      };
    } catch (error: any) {
      console.error('❌ Förbokning misslyckades:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Hantera betalning för förbokningar
   */
  private async handleScheduledPayment(
    selectedPaymentOption: PaymentOption,
    selectedRideType: RideType,
    tripId: string,
    price: number
  ): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
    const user = auth().currentUser;
    if (!user || !user.email) {
      return { success: false, error: 'Ingen inloggad användare' };
    }

    const customerId = await PaymentViewModel.createOrGetCustomer(user.uid, user.email);
    if (!customerId) {
      return { success: false, error: 'Kunde inte skapa Stripe-kund' };
    }

    switch (selectedPaymentOption.type) {
      case 'card':
        if (!selectedPaymentOption.savedCard) {
          return { success: false, error: 'Inget kort valt' };
        }
        return this.chargeSavedCardForPrebooking(
          customerId,
          selectedPaymentOption.savedCard.id,
          price,
          tripId
        );
      
      default:
        return { success: false, error: 'Betalmetod stöds inte för förbokningar' };
    }
  }

  /**
   * Debitera kort för förbokning
   */
  private async chargeSavedCardForPrebooking(
    customerId: string,
    paymentMethodId: string,
    amount: number,
    tripId: string
  ): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
    try {
      const response = await fetch(`${BACKEND_URL}/charge-saved-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          paymentMethodId,
          amount: Math.round(amount * 100), // Konvertera till öre
          tripId,
        }),
      });

      const data = await response.json();

      if (data.success && data.paymentIntentId) {
        console.log('✅ Kortbetalning för förbokning lyckades');
        return {
          success: true,
          paymentIntentId: data.paymentIntentId,
        };
      }

      const errorMsg = data.error || 'Okänt fel';
      console.error('❌ charge-saved-card fel:', errorMsg);
      
      return {
        success: false,
        error: errorMsg,
      };
    } catch (error: any) {
      console.error('❌ Nätverksfel vid kortbetalning:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Avboka förbokad resa - matchar Swift cancelPrebookedTrip
   */
  async cancelPrebookedTrip(
    tripId: string,
    paymentIntentId?: string
  ): Promise<boolean> {
    try {
      console.log('🛑 Avbokar förbokning:', tripId);

      // Hämta trip för att verifiera att det är en förbokning
      const tripDoc = await firestore().collection('trips').doc(tripId).get();
      
      if (!tripDoc.exists) {
        console.log('❌ Trip finns inte');
        return false;
      }

      const data = tripDoc.data();
      const status = (data?.status || '').toLowerCase();
      const scheduledAt = data?.scheduledPickupAt;
      const isPrebook = status === 'scheduled' || status === 'awaiting_payment' || !!scheduledAt;

      if (!isPrebook) {
        console.log('🟡 Inte en förbokning - hoppar över');
        return false;
      }

      // Markera som cancelled
      await firestore().collection('trips').doc(tripId).update({
        status: 'cancelled',
        cancelledBy: 'passenger',
        cancellationReason: 'Passenger cancelled',
        cancelledAt: firestore.FieldValue.serverTimestamp(),
      });

      console.log('✅ Trip markerad som cancelled');

      // Avbryt Stripe-reservation om den finns
      if (paymentIntentId) {
        await this.cancelPaymentIntent(paymentIntentId, tripId);
      }

      // Schemalägg radering efter 25 sekunder
      setTimeout(async () => {
        try {
          const updatedDoc = await firestore().collection('trips').doc(tripId).get();
          const updatedData = updatedDoc.data();
          
          if (
            updatedData?.status === 'cancelled' &&
            updatedData?.cancelledBy === 'passenger' &&
            updatedData?.scheduledPickupAt
          ) {
            await firestore().collection('trips').doc(tripId).delete();
            console.log('✅ Trip raderad efter avbokning');
          }
        } catch (error) {
          console.error('❌ Kunde inte radera trip:', error);
        }
      }, 25000);

      return true;
    } catch (error) {
      console.error('❌ Avbokning misslyckades:', error);
      return false;
    }
  }

  /**
   * Avbryt PaymentIntent (release reservation)
   */
  private async cancelPaymentIntent(paymentIntentId: string, tripId: string): Promise<void> {
    try {
      const response = await fetch(`${BACKEND_URL}/cancel-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId,
          tripId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ PaymentIntent cancelled');
      } else {
        console.error('❌ Kunde inte avbryta PaymentIntent:', data.error);
      }
    } catch (error) {
      console.error('❌ Nätverksfel vid cancel-payment-intent:', error);
    }
  }
}

export default RideRequestHandler;
