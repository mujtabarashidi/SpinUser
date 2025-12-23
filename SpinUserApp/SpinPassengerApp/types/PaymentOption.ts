export enum PaymentMethodType {
  CARD = 'card',
  GOOGLE_PAY = 'google_pay',
  COMPANY = 'company',
  CASH = 'cash',
  NEW_CARD = 'new_card',
}

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  expiryMonth?: number; // for compatibility with view models
  expiryYear?: number;  // for compatibility with view models
  holderName?: string;
}

export interface PaymentOption {
  id: string;
  label: string;
  type: PaymentMethodType;
  savedCard?: SavedCard;
  displayName?: string;
  firestoreValue?: string;
  iconName?: string;
}

export const PaymentOptionFactory = {
  createCash(): PaymentOption {
    return { id: 'cash', label: 'Kontant', type: PaymentMethodType.CASH, displayName: 'Kontant', firestoreValue: 'Kontant' };
  },
  createGooglePay(): PaymentOption {
    return { id: 'google_pay', label: 'Google Pay', type: PaymentMethodType.GOOGLE_PAY, displayName: 'Google Pay', firestoreValue: 'Google Pay' };
  },
  createCompany(): PaymentOption {
    return { id: 'company', label: 'Företag', type: PaymentMethodType.COMPANY, displayName: 'Företag', firestoreValue: 'Företag' };
  },
  createSavedCard(card: SavedCard): PaymentOption {
    return {
      id: `card_${card.id}`,
      label: `${card.brand} •••• ${card.last4}`,
      type: PaymentMethodType.CARD,
      displayName: `${card.brand} •••• ${card.last4}`,
      firestoreValue: 'Kort',
      savedCard: card,
    };
  },
};
