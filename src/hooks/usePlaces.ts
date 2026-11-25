import { useCallback, useEffect, useState } from 'react';
import mollyPlacesData from '../data/mollyPlaces.json';
import { Place } from '../types';

const STORAGE_KEY = 'molly-wants-to-go:places:v7';
const PREV_STORAGE_KEYS = [
  'molly-wants-to-go:places:v6',
  'molly-wants-to-go:places:v5',
];

const DEFAULT_PLACES: Place[] = mollyPlacesData as Place[];
const DEFAULT_BY_ID = new Map(DEFAULT_PLACES.map((p) => [p.id, p]));

function hydrateFromDefaults(stored: Place[]): Place[] {
  return stored.map((item) => {
    const fresh = DEFAULT_BY_ID.get(item.id);
    if (!fresh) return item;
    return {
      ...fresh,
      ...item,
      // Always backfill newly imported collection fields when missing
      postedAt: item.postedAt ?? fresh.postedAt,
      savedAt: item.savedAt ?? fresh.savedAt,
      reels: item.reels && item.reels.length > 0 ? item.reels : fresh.reels,
    };
  });
}

function loadInitialPlaces(): Place[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return hydrateFromDefaults(parsed as Place[]);
      }
    }
    // Migrate visited flags & custom places from prior versions while pulling in new date metadata
    for (const prevKey of PREV_STORAGE_KEYS) {
      const prevRaw = window.localStorage.getItem(prevKey);
      if (!prevRaw) continue;
      const prev = JSON.parse(prevRaw);
      if (Array.isArray(prev)) {
        const visitedById = new Map<string, boolean>();
        const customPlaces: Place[] = [];
        for (const item of prev as Place[]) {
          visitedById.set(item.id, Boolean(item.visited));
          if (!item.id.startsWith('molly-')) {
            customPlaces.push(item);
          }
        }
        const mergedDefaults = DEFAULT_PLACES.map((p) => ({
          ...p,
          visited: visitedById.get(p.id) ?? p.visited,
        }));
        return [...customPlaces, ...mergedDefaults];
      }
    }
    return DEFAULT_PLACES;
  } catch {
    return DEFAULT_PLACES;
  }
}

export type PlaceDraft = Omit<Place, 'id' | 'createdAt'>;

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>(loadInitialPlaces);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
    } catch {
      // Ignore storage quota errors
    }
  }, [places]);

  const addPlace = useCallback((draft: PlaceDraft): Place => {
    const newPlace: Place = {
      ...draft,
      id: `place-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setPlaces((prev) => [newPlace, ...prev]);
    return newPlace;
  }, []);

  const updatePlace = useCallback((id: string, updates: Partial<PlaceDraft>) => {
    setPlaces((prev) =>
      prev.map((place) => (place.id === id ? { ...place, ...updates } : place))
    );
  }, []);

  const deletePlace = useCallback((id: string) => {
    setPlaces((prev) => prev.filter((place) => place.id !== id));
  }, []);

  const toggleVisited = useCallback((id: string) => {
    setPlaces((prev) =>
      prev.map((place) =>
        place.id === id ? { ...place, visited: !place.visited } : place
      )
    );
  }, []);

  const resetToDefaults = useCallback(() => {
    setPlaces(DEFAULT_PLACES);
  }, []);

  return {
    places,
    addPlace,
    updatePlace,
    deletePlace,
    toggleVisited,
    resetToDefaults,
  };
}
