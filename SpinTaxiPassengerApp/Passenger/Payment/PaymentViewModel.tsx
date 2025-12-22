/**
 * PaymentViewModel.tsx
 * 
 * Hanterar Stripe-betalningar inkl. kort och Google Pay
 * Matchar iOS PaymentViewModel.swift funktionalitet
 */

import { useStripe } from '@stripe/stripe-react-native';
import { useCallback, useState } from 'react';

// Backend URL - ändra till din Stripe backend
const STRIPE_BACKEND_URL = 'https://stripe-backend-production-fb6e.up.railway.app';

export interface SavedCard {
    id: string; // Stripe payment method id
    last4: string;
    brand: string; // "visa", "mastercard", etc.
    expiryMonth: number; // 1-12
    expiryYear: number; // e.g. 2025
}

export interface PaymentIntentResult {
    success: boolean;
    paymentIntentId?: string;
    error?: string;
}

export interface SetupIntentResult {
    clientSecret: string;
    ephemeralKey: string;
}

class PaymentViewModel {
    /**
     * Skapa eller hämta Stripe-kund
     */
    static async createOrGetCustomer(firebaseUid: string, email: string): Promise<string | null> {
        try {
            console.log('📡 Anropar Stripe backend:', `${STRIPE_BACKEND_URL}/create-or-get-customer`);
            console.log('   Firebase UID:', firebaseUid);
            console.log('   Email:', email);

            const response = await fetch(`${STRIPE_BACKEND_URL}/create-or-get-customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firebaseUid: firebaseUid,  // Backend förväntar 'firebaseUid', inte 'firebaseUserId'
                    email,
                }),
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Backend-fel:', errorText);
                throw new Error(`Backend returnerade fel: ${response.status}`);
            }

            const data = await response.json();
            console.log('📡 Response data:', data);

            if (data.customerId) {
                console.log('✅ Stripe Customer ID:', data.customerId);
                return data.customerId;
            }

            console.error('❌ Kunde inte hämta customerId från response:', data);
            return null;
        } catch (error: any) {
            console.error('❌ Fel vid skapande av Stripe-kund:', error);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            return null;
        }
    }

    /**
     * Skapa PaymentIntent för betalning
     */
    static async createPaymentIntent(
        amount: number,
        customerId: string,
        tripId?: string
    ): Promise<PaymentIntentResult> {
        try {
            const body: any = {
                amount: Math.round(amount * 100), // Konvertera till öre/cent
                customerId,
            };

            if (tripId) {
                body.tripId = tripId;
            }

            const response = await fetch(`${STRIPE_BACKEND_URL}/create-payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (data.clientSecret) {
                return {
                    success: true,
                    paymentIntentId: data.paymentIntentId,
                };
            }

            return {
                success: false,
                error: data.error || 'Kunde inte skapa PaymentIntent',
            };
        } catch (error: any) {
            console.error('❌ Fel vid skapande av PaymentIntent:', error);
            return {
                success: false,
                error: error.message || 'Nätverksfel',
            };
        }
    }

    /**
     * Skapa SetupIntent för att spara kort
     */
    static async createSetupIntent(customerId: string): Promise<SetupIntentResult | null> {
        try {
            console.log('📡 Anropar create-setup-intent med customerId:', customerId);

            const response = await fetch(`${STRIPE_BACKEND_URL}/create-setup-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId }),
            });

            console.log('📡 SetupIntent Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Backend-fel vid SetupIntent:', errorText);
                throw new Error(`Backend returnerade fel: ${response.status}`);
            }

            const data = await response.json();
            console.log('📡 SetupIntent Response data:', data);

            if (data.clientSecret && data.ephemeralKey) {
                console.log('✅ SetupIntent skapad framgångsrikt');
                return {
                    clientSecret: data.clientSecret,
                    ephemeralKey: data.ephemeralKey,
                };
            }

            console.error('❌ Kunde inte skapa SetupIntent - saknar clientSecret eller ephemeralKey:', data);
            return null;
        } catch (error: any) {
            console.error('❌ Fel vid skapande av SetupIntent:', error);
            console.error('   Error message:', error.message);
            return null;
        }
    }

    /**
     * Lista sparade kort för kund
     */
    static async listSavedCards(customerId: string): Promise<SavedCard[]> {
        try {
            const response = await fetch(`${STRIPE_BACKEND_URL}/list-cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId }),
            });
            if (!response.ok) {
                // Undvik RedBox: använd warn istället för error när vi bara degraderar funktionalitet
                console.warn('⚠️ Kunde inte hämta sparade kort – backend svarade inte OK:', response.status);
                return [];
            }

            const data = await response.json();

            if (data.paymentMethods && Array.isArray(data.paymentMethods)) {
                const cards: SavedCard[] = data.paymentMethods.map((pm: any) => ({
                    id: pm.id,
                    last4: pm.card.last4,
                    brand: pm.card.brand,
                    expiryMonth: pm.card.exp_month,
                    expiryYear: pm.card.exp_year,
                }));

                console.log(`📋 Hämtade ${cards.length} sparade kort`);
                return cards;
            }

            return [];
        } catch (error) {
            // Nätverksfel är inte fatala här – logga som varning för att undvika RedBox
            console.warn('⚠️ Nätverksfel vid hämtning av sparade kort (återgår till tom lista):', error);
            return [];
        }
    }

    /**
     * Debitera sparat kort (RESERVERAR pengar - capture senare!)
     */
    static async chargeSavedCard(
        customerId: string,
        paymentMethodId: string,
        amount: number,
        tripId?: string
    ): Promise<PaymentIntentResult> {
        try {
            const body: any = {
                customerId,
                paymentMethodId,
                amount: Math.round(amount * 100), // Konvertera till öre/cent
            };

            if (tripId) {
                body.tripId = tripId;
                console.log(`💳 Debiterar sparat kort - belopp: ${amount} kr, tripId: ${tripId}`);
            } else {
                console.log(`💳 Validerar kort - belopp: ${amount} kr`);
            }

            const response = await fetch(`${STRIPE_BACKEND_URL}/charge-saved-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (data.success && data.paymentIntentId) {
                console.log('✅ Kort debiterat/validerat:', data.paymentIntentId);
                return {
                    success: true,
                    paymentIntentId: data.paymentIntentId,
                };
            }

            return {
                success: false,
                error: data.error || 'Betalning misslyckades',
            };
        } catch (error: any) {
            console.error('❌ Fel vid kortbetalning:', error);
            return {
                success: false,
                error: error.message || 'Nätverksfel',
            };
        }
    }

    /**
     * Capture (debitera) en reserverad PaymentIntent
     */
    static async capturePaymentIntent(
        paymentIntentId: string,
        amountToCapture: number
    ): Promise<boolean> {
        try {
            console.log(`💳 Debiterar PaymentIntent: ${paymentIntentId}, belopp: ${amountToCapture}`);

            const response = await fetch(`${STRIPE_BACKEND_URL}/capture-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentIntentId,
                    amountToCapture: Math.round(amountToCapture * 100),
                }),
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ PaymentIntent captured');
                return true;
            }

            console.error('❌ Capture misslyckades:', data.error);
            return false;
        } catch (error) {
            console.error('❌ Fel vid capture:', error);
            return false;
        }
    }

    /**
     * Återbetala en betalning
     */
    static async refundPayment(
        paymentIntentId: string,
        amount?: number,
        reason: string = 'requested_by_customer'
    ): Promise<{ success: boolean; refundId?: string }> {
        try {
            const body: any = {
                paymentIntentId,
                reason,
            };

            if (amount) {
                body.amount = Math.round(amount * 100);
            }

            const response = await fetch(`${STRIPE_BACKEND_URL}/refund-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Refund lyckades:', data.refundId);
                return {
                    success: true,
                    refundId: data.refundId,
                };
            }

            console.error('❌ Refund misslyckades:', data.error);
            return { success: false };
        } catch (error) {
            console.error('❌ Fel vid refund:', error);
            return { success: false };
        }
    }

    /**
     * Reservera betalning (two-phase: reserve → capture/cancel)
     */
    static async reservePayment(
        customerId: string,
        paymentMethodId: string,
        amount: number,
        tripId: string
    ): Promise<PaymentIntentResult> {
        try {
            console.log(`🔒 Reserverar ${amount} kr för trip ${tripId}`);

            const response = await fetch(`${STRIPE_BACKEND_URL}/reserve-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId,
                    paymentMethodId,
                    amount: Math.round(amount * 100),
                    tripId,
                }),
            });

            const data = await response.json();

            if (data.success && data.paymentIntentId) {
                console.log('✅ Betalning reserverad:', data.paymentIntentId);
                return {
                    success: true,
                    paymentIntentId: data.paymentIntentId,
                };
            }

            return {
                success: false,
                error: data.error || 'Kunde inte reservera betalning',
            };
        } catch (error: any) {
            console.error('❌ Fel vid reservation:', error);
            return {
                success: false,
                error: error.message || 'Nätverksfel',
            };
        }
    }

    /**
     * Släpp reserverad betalning (cancel)
     */
    static async releaseReservedPayment(
        paymentIntentId: string,
        reason: string = 'no_drivers_found'
    ): Promise<boolean> {
        try {
            console.log(`🔓 Släpper reserverad betalning: ${paymentIntentId}`);

            const response = await fetch(`${STRIPE_BACKEND_URL}/release-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentIntentId,
                    reason,
                }),
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Reservation släppt');
                return true;
            }

            console.error('❌ Kunde inte släppa reservation:', data.error);
            return false;
        } catch (error) {
            console.error('❌ Fel vid release:', error);
            return false;
        }
    }
}

/**
 * Hook för att använda Stripe PaymentSheet
 */
export function usePaymentSheet() {
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const [loading, setLoading] = useState(false);

    const initializePaymentSheet = useCallback(async (
        clientSecret: string,
        customerId: string,
        ephemeralKey?: string
    ) => {
        setLoading(true);

        try {
            const { error } = await initPaymentSheet({
                merchantDisplayName: 'SpinTaxi',
                paymentIntentClientSecret: clientSecret,
                customerId,
                customerEphemeralKeySecret: ephemeralKey,
                allowsDelayedPaymentMethods: true,
                googlePay: {
                    merchantCountryCode: 'SE',
                    testEnv: __DEV__,
                    currencyCode: 'SEK',
                },
                returnURL: 'spintaxi://payment-return',
            });

            if (error) {
                console.error('❌ Fel vid initiering av PaymentSheet:', error);
                return false;
            }

            console.log('✅ PaymentSheet initierad');
            return true;
        } catch (error) {
            console.error('❌ Fel vid PaymentSheet init:', error);
            return false;
        } finally {
            setLoading(false);
        }
    }, [initPaymentSheet]);

    const openPaymentSheet = useCallback(async () => {
        const { error } = await presentPaymentSheet();

        if (error) {
            console.error('❌ PaymentSheet fel:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ Betalning lyckades!');
        return { success: true };
    }, [presentPaymentSheet]);

    return {
        initializePaymentSheet,
        openPaymentSheet,
        loading,
    };
}

/**
 * Hook för att hantera Google Pay (via PaymentSheet)
 * Google Pay inkluderas automatiskt i PaymentSheet om tillgängligt
 */
export function useGooglePaySetup() {
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const [isAvailable, setIsAvailable] = useState(false);

    const checkAvailability = useCallback(async () => {
        // Google Pay kommer att inkluderas automatiskt i PaymentSheet
        // om det är tillgängligt på enheten
        setIsAvailable(true);
        return true;
    }, []);

    return {
        checkAvailability,
        isAvailable,
    };
}

export default PaymentViewModel;
