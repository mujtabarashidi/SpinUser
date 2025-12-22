import auth from '@react-native-firebase/auth';
import PaymentViewModel, { SavedCard as StripeCard } from '../Passenger/Payment/PaymentViewModel';
import type { PaymentOption } from '../types/PaymentOption';
import { PaymentMethodType } from '../types/PaymentOption';

interface PaymentRequest {
    merchantName: string;
    amount: string;
    currencyCode: string;
    countryCode: string;
    tripId?: string;
}

interface PaymentResult {
    success: boolean;
    token?: string;
    paymentIntentId?: string;
    error?: string;
}

class PaymentManager {
    private static instance: PaymentManager;
    private isGooglePayAvailable: boolean = false;
    private stripeCustomerId: string | null = null;

    private constructor() {
        this.checkPaymentAvailability();
    }

    static getInstance(): PaymentManager {
        if (!PaymentManager.instance) {
            PaymentManager.instance = new PaymentManager();
        }
        return PaymentManager.instance;
    }

    private async checkPaymentAvailability() {
        // Google Pay - Android only
        this.isGooglePayAvailable = true;

        // Hämta/skapa Stripe-kund
        await this.ensureStripeCustomer();
    }

    /**
     * Skapa eller hämta Stripe-kund för inloggad användare
     */
    private async ensureStripeCustomer(): Promise<string | null> {
        if (this.stripeCustomerId) {
            return this.stripeCustomerId;
        }

        const user = auth().currentUser;
        if (!user || !user.email) {
            console.warn('⚠️ Ingen inloggad användare');
            return null;
        }

        this.stripeCustomerId = await PaymentViewModel.createOrGetCustomer(
            user.uid,
            user.email
        );

        return this.stripeCustomerId;
    }

    /**
     * Hämta tillgängliga betalningsalternativ inkl. sparade kort
     */
    async getAvailablePaymentOptions(): Promise<PaymentOption[]> {
        const options: PaymentOption[] = [];

        // Hämta sparade kort från Stripe
        const customerId = await this.ensureStripeCustomer();
        if (customerId) {
            const savedCards = await PaymentViewModel.listSavedCards(customerId);
            savedCards.forEach(card => {
                options.push(this.createSavedCardOption(card));
            });
        }

        // Google Pay (Android via Stripe)
        if (this.isGooglePayAvailable) {
            options.push(this.createGooglePayOption());
        }

        // Kontant
        options.push(this.createCashOption());

        return options;
    }

    /**
     * Processar betalning baserat på vald metod
     */
    async processPayment(
        paymentOption: PaymentOption,
        request: PaymentRequest
    ): Promise<PaymentResult> {
        try {
            const amount = parseFloat(request.amount);

            switch (paymentOption.type) {
                case PaymentMethodType.CARD:
                    return await this.processCardPayment(paymentOption, amount, request.tripId);

                case PaymentMethodType.GOOGLE_PAY:
                    return await this.processGooglePay(amount, request.tripId);

                case PaymentMethodType.COMPANY:
                    // Företagsbetalning/fakturering – ingen direkt debitering här
                    return { success: true };

                case PaymentMethodType.CASH:
                    return { success: true }; // Kontant kräver ingen processing

                default:
                    return { success: false, error: 'Okänd betalningstyp' };
            }
        } catch (error: any) {
            console.error('❌ Betalningsfel:', error);
            return { success: false, error: error.message || 'Betalning misslyckades' };
        }
    }

    /**
     * Debitera sparat kort via Stripe (RESERVERAR pengar)
     */
    private async processCardPayment(
        paymentOption: PaymentOption,
        amount: number,
        tripId?: string
    ): Promise<PaymentResult> {
        const customerId = await this.ensureStripeCustomer();

        if (!customerId) {
            return { success: false, error: 'Ingen Stripe-kund hittades' };
        }

        if (!paymentOption.savedCard) {
            return { success: false, error: 'Inget kort valt' };
        }

        const result = await PaymentViewModel.chargeSavedCard(
            customerId,
            paymentOption.savedCard.id,
            amount,
            tripId
        );

        if (result.success && result.paymentIntentId) {
            return {
                success: true,
                paymentIntentId: result.paymentIntentId,
                token: result.paymentIntentId,
            };
        }

        return {
            success: false,
            error: result.error || 'Kortbetalning misslyckades',
        };
    }

    /**
     * Google Pay via Stripe PaymentSheet
     */
    private async processGooglePay(amount: number, tripId?: string): Promise<PaymentResult> {
        const customerId = await this.ensureStripeCustomer();

        if (!customerId) {
            return { success: false, error: 'Ingen Stripe-kund hittades' };
        }

        // Skapa PaymentIntent
        const result = await PaymentViewModel.createPaymentIntent(
            amount,
            customerId,
            tripId
        );

        if (result.success && result.paymentIntentId) {
            return {
                success: true,
                paymentIntentId: result.paymentIntentId,
                token: result.paymentIntentId,
            };
        }

        return {
            success: false,
            error: result.error || 'Google Pay misslyckades',
        };
    }

    /**
     * Capture (debitera) en reserverad betalning
     */
    async capturePayment(
        paymentIntentId: string,
        amountToCapture: number
    ): Promise<boolean> {
        return await PaymentViewModel.capturePaymentIntent(
            paymentIntentId,
            amountToCapture
        );
    }

    /**
     * Släpp reserverad betalning (cancel)
     */
    async releasePayment(
        paymentIntentId: string,
        reason: string = 'no_drivers_found'
    ): Promise<boolean> {
        return await PaymentViewModel.releaseReservedPayment(paymentIntentId, reason);
    }

    /**
     * Återbetala en betalning
     */
    async refundPayment(
        paymentIntentId: string,
        amount?: number,
        reason: string = 'requested_by_customer'
    ): Promise<{ success: boolean; refundId?: string }> {
        return await PaymentViewModel.refundPayment(paymentIntentId, amount, reason);
    }

    private createGooglePayOption(): PaymentOption {
        return {
            id: 'googlePay',
            type: PaymentMethodType.GOOGLE_PAY,
            displayName: 'Google Pay',
            iconName: 'google',
            firestoreValue: 'Google Pay'
        };
    }

    private createCashOption(): PaymentOption {
        return {
            id: 'cash',
            type: PaymentMethodType.CASH,
            displayName: 'Kontant',
            iconName: 'money-bill',
            firestoreValue: 'Kontant'
        };
    }

    private createSavedCardOption(savedCard: StripeCard): PaymentOption {
        return {
            id: `card_${savedCard.id}`,
            type: PaymentMethodType.CARD,
            displayName: `•••${savedCard.last4}`,
            iconName: 'credit-card',
            savedCard: {
                id: savedCard.id,
                last4: savedCard.last4,
                brand: savedCard.brand,
                expiryMonth: savedCard.expiryMonth,
                expiryYear: savedCard.expiryYear,
            },
            firestoreValue: `Kort •••${savedCard.last4}`
        };
    }

    // Validera betalningsdata
    validatePaymentRequest(request: PaymentRequest): boolean {
        return !!(
            request.merchantName &&
            request.amount &&
            parseFloat(request.amount) > 0 &&
            request.currencyCode &&
            request.countryCode
        );
    }

    // Formatera belopp för visning
    formatAmount(amount: string, currencyCode: string = 'SEK'): string {
        const num = parseFloat(amount);
        if (currencyCode === 'SEK') {
            return `${num.toFixed(0)} kr`;
        }
        return `${num.toFixed(2)} ${currencyCode}`;
    }
}

export default PaymentManager;
export type { PaymentRequest, PaymentResult };
