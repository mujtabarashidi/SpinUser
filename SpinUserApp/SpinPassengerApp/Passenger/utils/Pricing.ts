// Pricing.ts — mirrors Swift RideType pricing logic
// 
// ⚠️ VIKTIGT SÄKERHETSNOTERING:
// Detta är ENDAST för att visa ESTIMAT i UI INNAN bokning.
// Det faktiska priset som används för betalning beräknas ALLTID på servern.
// Manipulering av detta värde påverkar INTE det belopp som debiteras.
// 
// Servern ignorerar alla priser som skickas från klienten och beräknar själv
// baserat på: rideType, distanceInMeters, och ev. customPrice.
//

export type RideTypeKey = 'Spin Go' | 'Spin' | 'Komfort' | 'XL' | 'Premium' | 'Limousine';

export const baseFare: Record<RideTypeKey, number> = {
    'Spin Go': 90,
    Spin: 100,
    Komfort: 180,
    XL: 220,
    Premium: 250,
    Limousine: 400,
};

export const multiplierPerKm: Record<RideTypeKey, number> = {
    'Spin Go': 8,
    Spin: 11,
    Komfort: 15,
    XL: 19,
    Premium: 28,
    Limousine: 56,
};

export const passengerCount: Record<RideTypeKey, number> = {
    'Spin Go': 4,
    Spin: 4,
    Komfort: 4,
    XL: 6,
    Premium: 4,
    Limousine: 8,
};

export const tagline: Record<RideTypeKey, string> = {
    'Spin Go': 'Enklare resor till lägsta pris',
    Spin: 'Snabba resor till bra pris',
    Komfort: 'Nyare bilar med extra benutrymme',
    XL: 'Perfekt när ni är många',
    Premium: 'Lyxig komfort',
    Limousine: 'Exklusivt med högsta service',
};

/**
 * Compute price in SEK mirroring Swift:
 * price = baseFare[type] + (distanceInKilometers * multiplier)
 * Then increase by 10% (same as iOS)
 * Result rounded to nearest whole number.
 * If customPrice provided, return rounded customPrice.
 * 
 * ⚠️ DETTA ÄR ENDAST ETT ESTIMAT FÖR UI/UX
 * Det faktiska priset beräknas på servern vid betalning.
 */
export function computePrice(type: RideTypeKey, distanceInMeters: number, customPrice?: number): number {
    if (typeof customPrice === 'number' && isFinite(customPrice)) {
        return Math.round(customPrice);
    }
    const km = Math.max(0, (distanceInMeters || 0) / 1000);
    const mult = multiplierPerKm[type];
    const base = baseFare[type];
    const price = km * mult + base;
    // Höj priset med 10% (matchar iOS)
    const increasedPrice = price * 1.10;
    return Math.round(increasedPrice);
}

/**
 * Returnerar tillgängliga kategorier baserat på stad
 * Göteborg, Malmö, Uppsala: SpinGo, Spin, Komfort, XL
 * Stockholm: Spin, Komfort, XL, Premium, Limousine
 * Andra städer: Alla kategorier
 */
export function availableCategories(city?: string | null): RideTypeKey[] {
    if (!city) {
        // Om ingen stad anges, returnera alla kategorier
        return ['Spin Go', 'Spin', 'Komfort', 'XL', 'Premium', 'Limousine'];
    }

    const cityLower = city.toLowerCase();

    if (cityLower.includes('göteborg') || cityLower.includes('malmö') || cityLower.includes('uppsala')) {
        // Göteborg, Malmö och Uppsala: Spin Go, Spin, Komfort, XL
        return ['Spin Go', 'Spin', 'Komfort', 'XL'];
    } else if (cityLower.includes('stockholm')) {
        // Stockholm: Alla utom SpinGo
        return ['Spin', 'Komfort', 'XL', 'Premium', 'Limousine'];
    } else {
        // Andra städer: Alla kategorier
        return ['Spin Go', 'Spin', 'Komfort', 'XL', 'Premium', 'Limousine'];
    }
}
