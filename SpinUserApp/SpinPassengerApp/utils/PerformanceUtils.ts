/**
 * Performance utilities for React Native
 * Debounce, throttle, and other optimization helpers
 */

/**
 * Debounce a function - waits specified time before calling
 * Useful for reducing API calls during rapid user interactions
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function (...args: Parameters<T>) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Throttle a function - calls at most once every wait milliseconds
 * Useful for scroll, resize, and location events
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    let previous = 0;

    return function (...args: Parameters<T>) {
        const now = Date.now();
        const remaining = wait - (now - previous);

        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            func(...args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                previous = Date.now();
                timeout = null;
                func(...args);
            }, remaining);
        }
    };
}

/**
 * Request animation frame debounce for smooth animations
 */
export function rafDebounce<T extends (...args: any[]) => any>(func: T) {
    let rafId: number | null = null;

    return function (...args: Parameters<T>) {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
            func(...args);
            rafId = null;
        });
    };
}

/**
 * Memoize expensive calculations
 */
export function memoize<T extends (...args: any[]) => any>(func: T): T {
    const cache = new Map();

    return ((...args: Parameters<T>) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = func(...args);
        cache.set(key, result);
        // Limit cache size
        if (cache.size > 100) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }
        return result;
    }) as T;
}

/**
 * Check if value changed significantly from previous
 */
export function hasSignificantChange<T>(
    current: T,
    previous: T | null,
    threshold: number = 0.01
): boolean {
    if (!previous) return true;

    if (typeof current === 'number' && typeof previous === 'number') {
        const percentChange = Math.abs(current - previous) / previous;
        return percentChange > threshold;
    }

    return current !== previous;
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
    func: () => Promise<T>,
    maxAttempts: number = 3,
    initialDelayMs: number = 1000,
    maxDelayMs: number = 30000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await func();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxAttempts) {
                break;
            }

            // Exponential backoff with jitter
            const delay = Math.min(
                initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
                maxDelayMs
            );

            console.warn(
                `⚠️ Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`,
                error
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('Failed after max attempts');
}

/**
 * Memory-efficient request deduplication
 */
export class RequestDeduplicator {
    private pending = new Map<string, Promise<any>>();

    async deduplicateRequest<T>(
        key: string,
        request: () => Promise<T>
    ): Promise<T> {
        // Return existing promise if request already in flight
        if (this.pending.has(key)) {
            return this.pending.get(key);
        }

        // Create and store new promise
        const promise = request()
            .then((result) => {
                this.pending.delete(key);
                return result;
            })
            .catch((error) => {
                this.pending.delete(key);
                throw error;
            });

        this.pending.set(key, promise);
        return promise;
    }

    clear(): void {
        this.pending.clear();
    }
}

/**
 * Request rate limiter (token bucket algorithm)
 */
export class RateLimiter {
    private tokens: number;
    private lastRefillTime: number;
    private refillRate: number; // tokens per second
    private maxTokens: number;

    constructor(tokensPerSecond: number = 10, maxTokens: number = 100) {
        this.refillRate = tokensPerSecond;
        this.maxTokens = maxTokens;
        this.tokens = maxTokens;
        this.lastRefillTime = Date.now();
    }

    async allowRequest(): Promise<boolean> {
        this.refillTokens();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }

        // Wait for token to be available
        const timeUntilTokenAvailable =
            (1 - this.tokens) / this.refillRate / 1000;
        await new Promise((resolve) =>
            setTimeout(resolve, timeUntilTokenAvailable)
        );

        this.refillTokens();
        this.tokens -= 1;
        return true;
    }

    private refillTokens(): void {
        const now = Date.now();
        const timePassed = (now - this.lastRefillTime) / 1000; // Convert to seconds
        const tokensToAdd = timePassed * this.refillRate;

        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefillTime = now;
    }
}

/**
 * Cancel all pending promises
 */
export class CancellablePromise<T> {
    private promise: Promise<T>;
    private isCancelled = false;

    constructor(executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void) {
        this.promise = new Promise((resolve, reject) => {
            executor(
                (value) => !this.isCancelled && resolve(value),
                (reason) => !this.isCancelled && reject(reason)
            );
        });
    }

    cancel(): void {
        this.isCancelled = true;
    }

    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        return this.promise.then(onfulfilled, onrejected);
    }

    catch<TResult = never>(
        onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
    ): Promise<T | TResult> {
        return this.promise.catch(onrejected);
    }
}
