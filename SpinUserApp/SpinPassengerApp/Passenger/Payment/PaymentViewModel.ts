/**
 * PaymentViewModel.ts
 * Handles Stripe payment operations via backend
 */

// Use localhost for Android emulator (10.0.2.2 maps to host machine)
const BACKEND_URL = 'http://10.0.2.2:4242';

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

export interface SetupIntentResponse {
  clientSecret: string;
  ephemeralKey: string;
  customerId: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

class PaymentViewModel {
  /**
   * Create or get existing Stripe customer
   */
  async createOrGetCustomer(userId: string, email: string): Promise<string | null> {
    try {
      console.log(`📡 [PaymentViewModel] Creating customer for ${userId}`);
      
      const response = await fetch(`${BACKEND_URL}/create-or-get-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firebaseUid: userId,
          email,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error:', response.status, errorText);
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [PaymentViewModel] Customer created:', data.customerId);
      return data.customerId;
    } catch (error) {
      console.error('❌ [PaymentViewModel] Error creating customer:', error);
      return null;
    }
  }

  /**
   * Create SetupIntent to save payment method without charging
   */
  async createSetupIntent(customerId: string): Promise<SetupIntentResponse | null> {
    try {
      console.log(`📡 [PaymentViewModel] Creating SetupIntent for ${customerId}`);
      
      const response = await fetch(`${BACKEND_URL}/create-setup-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error:', response.status, errorText);
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [PaymentViewModel] SetupIntent created');
      return {
        clientSecret: data.clientSecret,
        ephemeralKey: data.ephemeralKey,
        customerId: data.customerId,
      };
    } catch (error) {
      console.error('❌ [PaymentViewModel] Error creating SetupIntent:', error);
      return null;
    }
  }

  /**
   * List saved payment methods (cards)
   */
  async listSavedCards(customerId: string): Promise<SavedCard[]> {
    try {
      console.log(`📡 [PaymentViewModel] Fetching saved cards for ${customerId}`);
      
      const response = await fetch(`${BACKEND_URL}/list-cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error:', response.status, errorText);
        return [];
      }

      const data = await response.json();
      console.log('✅ [PaymentViewModel] Found cards:', data.paymentMethods?.length || 0);
      
      return (data.paymentMethods || []).map((pm: any) => ({
        id: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
        isDefault: false,
      }));
    } catch (error) {
      console.error('❌ [PaymentViewModel] Error listing cards:', error);
      return [];
    }
  }

  /**
   * Create PaymentIntent for charging
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    customerId: string,
    paymentMethodId?: string
  ): Promise<PaymentIntentResponse | null> {
    try {
      console.log(`📡 [PaymentViewModel] Creating PaymentIntent: ${amount} ${currency}`);
      
      const response = await fetch(`${BACKEND_URL}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          currency,
          customerId,
          paymentMethodId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error:', response.status, errorText);
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [PaymentViewModel] PaymentIntent created');
      return {
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
      };
    } catch (error) {
      console.error('❌ [PaymentViewModel] Error creating PaymentIntent:', error);
      return null;
    }
  }

  /**
   * Charge a saved card
   */
  async chargeSavedCard(
    paymentMethodId: string,
    amount: number,
    currency: string,
    customerId: string
  ): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
    try {
      const paymentIntent = await this.createPaymentIntent(amount, currency, customerId, paymentMethodId);
      
      if (!paymentIntent) {
        return { success: false, error: 'Failed to create payment intent' };
      }

      return {
        success: true,
        paymentIntentId: paymentIntent.paymentIntentId,
      };
    } catch (error: any) {
      console.error('❌ [PaymentViewModel] Error charging card:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Capture a payment intent
   */
  async capturePaymentIntent(paymentIntentId: string): Promise<boolean> {
    try {
      console.log(`📡 [PaymentViewModel] Capturing payment: ${paymentIntentId}`);
      
      const response = await fetch(`${BACKEND_URL}/capture-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error:', response.status, errorText);
        return false;
      }

      console.log('✅ [PaymentViewModel] Payment captured');
      return true;
    } catch (error) {
      console.error('❌ [PaymentViewModel] Error capturing payment:', error);
      return false;
    }
  }

  /**
   * Cancel/release a payment intent
   */
  async releaseReservedPayment(paymentIntentId: string, reason?: string): Promise<boolean> {
    try {
      console.log(`📡 [PaymentViewModel] Canceling payment: ${paymentIntentId}`);
      
      const response = await fetch(`${BACKEND_URL}/cancel-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId,
          reason,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error:', response.status, errorText);
        return false;
      }

      console.log('✅ [PaymentViewModel] Payment canceled');
      return true;
    } catch (error) {
      console.error('❌ [PaymentViewModel] Error canceling payment:', error);
      return false;
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<boolean> {
    try {
      console.log(`📡 [PaymentViewModel] Refunding payment: ${paymentIntentId}`);
      
      const response = await fetch(`${BACKEND_URL}/refund-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId,
          amount: amount ? Math.round(amount * 100) : undefined,
          reason,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error:', response.status, errorText);
        return false;
      }

      console.log('✅ [PaymentViewModel] Payment refunded');
      return true;
    } catch (error) {
      console.error('❌ [PaymentViewModel] Error refunding payment:', error);
      return false;
    }
  }
}

export default new PaymentViewModel();
