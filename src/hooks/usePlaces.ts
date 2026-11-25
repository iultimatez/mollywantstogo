import { useCallback, useEffect, useState } from 'react';
import mollyPlacesData from '../data/mollyPlaces.json';
import { Place } from '../types';

const STORAGE_KEY = 'molly-wants-to-go:places:v9';
const DELETED_IDS_KEY = 'molly-wants-to-go:deleted:v9';
const PREV_STORAGE_KEYS = [
  'molly-wants-to-go:places:v8',
  'molly-wants-to-go:places:v7',
  'molly-wants-to-go:places:v6',
  'molly-wants-to-go:places:v5',
];

const DEFAULT_PLACES: Place[] = mollyPlacesData as Place[];

function isCustomPlaceId(id: string): boolean {
  return id.startsWith('place-');
}

function loadDeletedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDeletedIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage quota errors
  }
}

function hydrateFromDefaults(stored: Place[], deletedIds: Set<string>): Place[] {
  const storedById = new Map(stored.map((item) => [item.id, item]));
  const storedByUrl = new Map<string, Place>();
  for (const item of stored) {
    if (isCustomPlaceId(item.id)) continue;
    for (const url of item.instagramUrls ?? []) {
      if (!storedByUrl.has(url)) storedByUrl.set(url, item);
    }
  }
  const customPlaces = stored.filter((item) => isCustomPlaceId(item.id));

  const mergedDefaults: Place[] = [];
  for (const fresh of DEFAULT_PLACES) {
    if (deletedIds.has(fresh.id)) continue;
    const existing =
      storedById.get(fresh.id) ??
      (fresh.instagramUrls ?? []).map((u) => storedByUrl.get(u)).find(Boolean);
    if (!existing) {
      // Newly added place from updated collection markdown
      mergedDefaults.push(fresh);
      continue;
    }
    const existingReels = existing.reels ?? [];
    const freshReels = fresh.reels ?? [];
    mergedDefaults.push({
      ...fresh,
      ...existing,
      id: fresh.id,
      // Always pull in fresher collection metadata & newly geocoded pins
      sourceNumbers: fresh.sourceNumbers,
      postedAt: fresh.postedAt ?? existing.postedAt,
      savedAt: fresh.savedAt ?? existing.savedAt,
      reels: freshReels.length >= existingReels.length ? freshReels : existingReels,
      instagramUrls:
        (fresh.instagramUrls?.length ?? 0) >= (existing.instagramUrls?.length ?? 0)
          ? fresh.instagramUrls
          : existing.instagramUrls,
      savedCount: Math.max(fresh.savedCount ?? 1, existing.savedCount ?? 1),
      lat: existing.lat ?? fresh.lat,
      lng: existing.lng ?? fresh.lng,
      locationPrecision:
        existing.lat !== null && existing.lat !== undefined
          ? existing.locationPrecision
          : fresh.locationPrecision,
    });
  }

  return [...customPlaces, ...mergedDefaults];
}

function loadInitialPlaces(): Place[] {
  try {
    const deletedIds = loadDeletedIds();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return hydrateFromDefaults(parsed as Place[], deletedIds);
      }
    }
    // Migrate visited flags & custom places from prior versions (matching by URL or name since IDs became stable hashes)
    for (const prevKey of PREV_STORAGE_KEYS) {
      const prevRaw = window.localStorage.getItem(prevKey);
      if (!prevRaw) continue;
      const prev = JSON.parse(prevRaw);
      if (Array.isArray(prev)) {
        const visitedById = new Map<string, boolean>();
        const visitedByUrl = new Map<string, boolean>();
        const visitedByName = new Map<string, boolean>();
        const customPlaces: Place[] = [];
        for (const item of prev as Place[]) {
          const isVisited = Boolean(item.visited);
          visitedById.set(item.id, isVisited);
          visitedByName.set(item.name, isVisited);
          for (const url of item.instagramUrls ?? []) {
            if (isVisited) visitedByUrl.set(url, true);
          }
          if (isCustomPlaceId(item.id)) {
            customPlaces.push(item);
          }
        }
        const mergedDefaults = DEFAULT_PLACES.map((p) => ({
          ...p,
          visited:
            visitedById.get(p.id) ??
            ((p.instagramUrls ?? []).some((u) => visitedByUrl.get(u)) ||
              visitedByName.get(p.name) ||
              p.visited),
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
    if (!isCustomPlaceId(id)) {
      const deleted = loadDeletedIds();
      deleted.add(id);
      saveDeletedIds(deleted);
    }
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
    saveDeletedIds(new Set());
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
