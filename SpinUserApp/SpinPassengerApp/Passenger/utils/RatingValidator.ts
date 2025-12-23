/**
 * Rating validation utilities
 * Ensures ratings are always between 0-5 stars
 */

/**
 * Validate and clamp a single rating to 0-5 range
 * @param rating - The rating value to validate
 * @returns Validated rating clamped between 0 and 5
 */
export function validateRating(rating: number): number {
    const numRating = Number(rating);
    if (!Number.isFinite(numRating)) return 0;
    return Math.min(5, Math.max(0, numRating));
}

/**
 * Validate and clamp average rating in ratings object
 * @param ratingsObj - The ratings object with avg property
 * @returns Validated ratings object with clamped average
 */
export function validateRatingsObject(ratingsObj: any): any {
    if (!ratingsObj || typeof ratingsObj !== 'object') return ratingsObj;

    const validated = { ...ratingsObj };

    // Clamp average to 0-5
    if (typeof validated.avg === 'number') {
        validated.avg = validateRating(validated.avg);
    }

    // Ensure total doesn't exceed max possible (count * 5)
    const count = Number(validated.count) || 0;
    const maxTotal = count * 5;
    if (typeof validated.total === 'number') {
        validated.total = Math.min(validated.total, maxTotal);
    }

    // Recalculate average if needed
    if (count > 0 && typeof validated.total === 'number') {
        const recalculatedAvg = validated.total / count;
        validated.avg = validateRating(recalculatedAvg);
    }

    return validated;
}

/**
 * Clamp a rating value to valid range before storing
 * @param rating - The rating to clamp
 * @returns Clamped rating
 */
export function clampRating(rating: number): number {
    return validateRating(rating);
}

/**
 * Check if a rating is valid (between 1-5 for actual ratings, 0 for no rating)
 * @param rating - The rating to check
 * @returns true if rating is valid
 */
export function isValidRating(rating: any): boolean {
    const numRating = Number(rating);
    if (!Number.isFinite(numRating)) return false;
    return numRating >= 0 && numRating <= 5;
}
