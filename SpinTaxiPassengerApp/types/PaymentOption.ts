// PaymentOption.ts - TypeScript conversion from SwiftUI PaymentOption
// Konverterad från Swift enum till TypeScript interface

export interface SavedCard {
    id: string;
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
    holderName?: string;
}

export enum PaymentMethodType {
    GOOGLE_PAY = 'googlePay',
    CASH = 'cash',
    CARD = 'card',
    NEW_CARD = 'newCard',
    COMPANY = 'company'
}

export interface PaymentOption {
    id: string;
    type: PaymentMethodType;
    displayName: string;
    iconName: string;
    savedCard?: SavedCard;
    firestoreValue: string;
}

export class PaymentOptionFactory {
    static createGooglePay(): PaymentOption {
        return {
            id: 'googlePay',
            type: PaymentMethodType.GOOGLE_PAY,
            displayName: 'Google Pay',
            iconName: 'google',
            firestoreValue: 'Google Pay'
        };
    }

    static createCash(): PaymentOption {
        return {
            id: 'cash',
            type: PaymentMethodType.CASH,
            displayName: 'Kontant',
            iconName: 'money-bill',
            firestoreValue: 'Kontant'
        };
    }

    static createSavedCard(savedCard: SavedCard): PaymentOption {
        return {
            id: `card_${savedCard.id}`,
            type: PaymentMethodType.CARD,
            displayName: `•••${savedCard.last4}`,
            iconName: 'credit-card',
            savedCard,
            firestoreValue: `Kort •••${savedCard.last4}`
        };
    }

    static createNewCard(): PaymentOption {
        return {
            id: 'newCard',
            type: PaymentMethodType.NEW_CARD,
            displayName: 'Lägg till nytt kort',
            iconName: 'plus-circle',
            firestoreValue: 'Kort'
        };
    }

    static createCompany(): PaymentOption {
        return {
            id: 'company',
            type: PaymentMethodType.COMPANY,
            displayName: 'Företag',
            iconName: 'briefcase',
            firestoreValue: 'Företag'
        };
    }

    // Standardalternativ baserat på plattform
    static getDefaultOptions(): PaymentOption[] {
        const options = [
            PaymentOptionFactory.createCash()
        ];

        // Android only - Google Pay available
        options.unshift(PaymentOptionFactory.createGooglePay());

        // Add Company (invoicing) as payment option
        options.push(PaymentOptionFactory.createCompany());

        return options;
    }
}