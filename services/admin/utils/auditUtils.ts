/**
 * Audit Utilities
 * Handles user identification and IP address tracking for audit logs.
 */

import { getAuth } from 'firebase/auth';

// ============================================================================
// User Identification
// ============================================================================

const USER_EMAIL_CACHE_KEY = 'hhr_audit_user_email_cache';

/**
 * Get current user email with robust fallbacks
 * Priority: auth.email → cached email → displayName → uid → anonymous
 */
export const getCurrentUserEmail = (): string => {
    try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (user?.email) {
            localStorage.setItem(USER_EMAIL_CACHE_KEY, user.email);
            return user.email;
        }

        const cached = localStorage.getItem(USER_EMAIL_CACHE_KEY);
        if (cached) return cached;

        if (user?.displayName) return user.displayName;
        if (user?.uid) return user.uid;

        return 'anonymous_user';
    } catch (e) {
        console.warn('[Audit] Error getting user info:', e);
        return 'system_context';
    }
};

/**
 * Get user display name if available
 */
export const getCurrentUserDisplayName = (): string | undefined => {
    try {
        return getAuth().currentUser?.displayName || undefined;
    } catch (e) {
        return undefined;
    }
};

/**
 * Get Firebase UID
 */
export const getCurrentUserUid = (): string | undefined => {
    try {
        return getAuth().currentUser?.uid || undefined;
    } catch (e) {
        return undefined;
    }
};

// ============================================================================
// IP Address Tracking
// ============================================================================

const IP_CACHE_KEY = 'hhr_audit_user_ip';
let ipFetchInProgress = false;

/**
 * Get user's IP address (cached in session)
 * Non-blocking - returns cached value or undefined
 */
export const getCachedIpAddress = (): string | undefined => {
    return sessionStorage.getItem(IP_CACHE_KEY) || undefined;
};

/**
 * Fetch and cache user's IP address (call once at login)
 */
export const fetchAndCacheIpAddress = async (): Promise<string | undefined> => {
    if (ipFetchInProgress) return undefined;

    const cached = getCachedIpAddress();
    if (cached) return cached;

    ipFetchInProgress = true;
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        if (data.ip) {
            sessionStorage.setItem(IP_CACHE_KEY, data.ip);
            return data.ip;
        }
    } catch (e) {
        console.warn('[Audit] Failed to fetch IP:', e);
    } finally {
        ipFetchInProgress = false;
    }
    return undefined;
};
