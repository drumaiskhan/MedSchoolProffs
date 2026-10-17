// When the server answers a request with 403 + code MEMBERSHIP_REQUIRED (the student is not
// activated, or their plan / trial has expired) the current page shows an
// "Activate your account to load data" card instead of an error or empty lists.
// The lock belongs to the page it happened on and clears on navigation.
import { useSyncExternalStore } from 'react';

export const MEMBERSHIP_LOCK_MESSAGE = 'Activate your account to load data.';

let currentLocation = '';
let lockedLocation: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called by the shell whenever the route changes; leaving a page drops its lock. */
export function setLockLocation(location: string) {
  if (location === currentLocation) return;
  currentLocation = location;
  // Silent on purpose (called during render): the snapshot is already false for the new location.
  lockedLocation = null;
}
/** Called by the API client on a MEMBERSHIP_REQUIRED response. */
export function markMembershipLocked() {
  if (lockedLocation === currentLocation) return;
  lockedLocation = currentLocation;
  emit();
}
export function clearMembershipLock() { if (lockedLocation !== null) { lockedLocation = null; emit(); } }
export function useMembershipLocked(location: string): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => lockedLocation !== null && lockedLocation === location,
    () => false,
  );
}
