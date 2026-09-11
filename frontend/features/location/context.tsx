import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '../auth/hooks';
import { apiClient } from '../../lib/api-client';

interface LocationSharingContextType {
  isSharing: boolean;
  starting: boolean;
  error: string | null;
  toggleSharing: (next: boolean) => Promise<void>;
}

const LocationSharingContext = createContext<LocationSharingContextType | undefined>(undefined);

// How often (and after how much movement) the seller's device pushes a
// fresh position to the server while sharing is on. Balanced accuracy plus
// an 8s/25m floor keeps this well within normal foreground GPS battery use —
// there's no background tracking, so this only runs while the app is open.
const UPDATE_INTERVAL_MS = 8000;
const UPDATE_DISTANCE_M = 25;

export function LocationSharingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isSharing, setIsSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Reflect whatever the server already has for this account (e.g. the
  // toggle was left on from a previous session) without re-requesting
  // permission or starting a watch on its own — the seller opts back in.
  useEffect(() => {
    setIsSharing(!!user?.is_sharing_location);
  }, [user?.id]);

  useEffect(() => () => { watchRef.current?.remove(); }, []);

  const pushLocation = async (coords: { latitude: number; longitude: number }, sharing: boolean) => {
    lastCoordsRef.current = coords;
    await apiClient.patch('/profile/location', {
      latitude: coords.latitude, longitude: coords.longitude, is_sharing_location: sharing,
    });
  };

  const startSharing = async () => {
    setError(null);
    setStarting(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setError('location.permissionDenied');
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      await pushLocation(current.coords, true);
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: UPDATE_INTERVAL_MS, distanceInterval: UPDATE_DISTANCE_M },
        (loc) => { void pushLocation(loc.coords, true).catch(() => undefined); }
      );
      setIsSharing(true);
    } catch {
      setError('location.startFailed');
    } finally {
      setStarting(false);
    }
  };

  const stopSharing = async () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setIsSharing(false);
    setError(null);
    const coords = lastCoordsRef.current;
    if (!coords) return;
    try {
      await pushLocation(coords, false);
    } catch {
      // Best-effort — the server-side staleness window hides a stale pin
      // even if this particular "turn off" never reaches it.
    }
  };

  const toggleSharing = async (next: boolean) => {
    if (next) await startSharing(); else await stopSharing();
  };

  return (
    <LocationSharingContext.Provider value={{ isSharing, starting, error, toggleSharing }}>
      {children}
    </LocationSharingContext.Provider>
  );
}

export function useLocationSharing() {
  const context = useContext(LocationSharingContext);
  if (!context) throw new Error('useLocationSharing must be used within a LocationSharingProvider');
  return context;
}
