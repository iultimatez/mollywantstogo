import { useEffect, useMemo, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { ListView } from './components/ListView';
import { MapView } from './components/MapView';
import { PlaceCard } from './components/PlaceCard';
import { PlaceModal } from './components/PlaceModal';
import { PlaceDraft, usePlaces } from './hooks/usePlaces';
import { usePwaInstall } from './hooks/usePwaInstall';
import {
  DEFAULT_SORT_OPTION,
  Place,
  PlaceCategory,
  PlaceRegion,
  SortOption,
  StatusFilter,
  ViewMode,
} from './types';

const ENABLE_WRITE_FEATURES = false;
const THEME_STORAGE_KEY = 'molly-wants-to-go:theme:v1';

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

function readRouteFromLocation(): {
  mode: ViewMode;
  placeId: string | null;
} {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const mode: ViewMode = path === '/list' ? 'list' : 'map';
  const params = new URLSearchParams(window.location.search);
  const placeId = mode === 'map' ? params.get('place') : null;
  return { mode, placeId };
}

function buildRouteUrl(mode: ViewMode, placeId?: string | null): string {
  if (mode === 'list') return '/list';
  if (placeId) {
    return `/map?place=${encodeURIComponent(placeId)}`;
  }
  return '/map';
}

export function App() {
  const {
    places,
    addPlace,
    updatePlace,
    deletePlace,
    toggleVisited,
    resetToDefaults,
  } = usePlaces(ENABLE_WRITE_FEATURES);

  const { canInstall, promptInstall } = usePwaInstall();

  const initialRoute = useMemo(() => readRouteFromLocation(), []);
  const [mode, setMode] = useState<ViewMode>(initialRoute.mode);

  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);
  const [themeOverride, setThemeOverride] = useState<Theme | null>(
    readStoredTheme
  );
  const resolvedTheme: Theme = themeOverride ?? systemTheme;

  // Follow OS/browser color scheme live whenever no manual override is active
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mq.matches ? 'dark' : 'light');

    const handleChange = (e: MediaQueryListEvent) =>
      setSystemTheme(e.matches ? 'dark' : 'light');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    }
    mq.addListener(handleChange);
    return () => mq.removeListener(handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        'content',
        resolvedTheme === 'dark' ? '#1f2022' : '#ffffff'
      );
    }
  }, [resolvedTheme]);

  const handleToggleTheme = () => {
    const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    const nextOverride = nextTheme === systemTheme ? null : nextTheme;
    setThemeOverride(nextOverride);
    try {
      if (nextOverride) {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextOverride);
      } else {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRegion, setActiveRegion] = useState<PlaceRegion | 'all'>('all');
  const [regionTrigger, setRegionTrigger] = useState(0);
  const [activeCategory, setActiveCategory] = useState<PlaceCategory | 'all'>(
    'all'
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>(DEFAULT_SORT_OPTION);

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    initialRoute.placeId
  );
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(
    initialRoute.placeId ? 1 : 0
  );
  const [flashPlaceId, setFlashPlaceId] = useState<string | null>(null);

  // Normalize root "/" (or unknown paths) to "/map" without adding extra history entry
  useEffect(() => {
    const normalized = buildRouteUrl(mode, mode === 'map' ? selectedPlaceId : null);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== normalized) {
      window.history.replaceState(null, '', normalized);
    }
    if (initialRoute.mode === 'map' && initialRoute.placeId) {
      window.setTimeout(() => {
        const cardEl = cardRefs.current.get(initialRoute.placeId!);
        cardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 160);
    }
  }, []);

  // Sync browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const next = readRouteFromLocation();
      setMode(next.mode);
      setSelectedPlaceId(next.placeId);
      if (next.placeId) {
        setFocusTrigger((n) => n + 1);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToMode = (nextMode: ViewMode, nextPlaceId?: string | null) => {
    const resolvedPlaceId =
      nextMode === 'map'
        ? nextPlaceId !== undefined
          ? nextPlaceId
          : selectedPlaceId
        : null;
    const targetUrl = buildRouteUrl(nextMode, resolvedPlaceId);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
    setMode(nextMode);
  };

  const syncSelectedUrl = (placeId: string | null) => {
    if (mode !== 'map') return;
    const targetUrl = buildRouteUrl('map', placeId);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetUrl) {
      window.history.replaceState(null, '', targetUrl);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const pinnedTotalCount = useMemo(
    () => places.filter((p) => p.lat !== null && p.lng !== null).length,
    [places]
  );

  const wantCount = useMemo(
    () => places.filter((p) => !p.visited).length,
    [places]
  );

  // Region counts for the current mode (pinned in map mode, all in list mode)
  const regionCounts = useMemo(() => {
    const base =
      mode === 'map'
        ? places.filter((p) => p.lat !== null && p.lng !== null)
        : places;
    const counts: Record<string, number> = {};
    base.forEach((p) => {
      counts[p.region] = (counts[p.region] || 0) + 1;
    });
    return counts;
  }, [places, mode]);

  const filteredPlaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = places.filter((place) => {
      if (mode === 'map' && (place.lat === null || place.lng === null)) {
        return false;
      }
      if (activeRegion !== 'all' && place.region !== activeRegion) {
        return false;
      }
      if (activeCategory !== 'all' && place.category !== activeCategory) {
        return false;
      }
      if (ENABLE_WRITE_FEATURES) {
        if (statusFilter === 'want' && place.visited) return false;
        if (statusFilter === 'visited' && !place.visited) return false;
      }
      if (query) {
        const haystack =
          `${place.name} ${place.neighborhood} ${place.address || ''} ${place.regionLabel} ${place.rawCategory || ''} ${place.note}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const getChronoDate = (place: Place) =>
      place.postedAt || place.createdAt.slice(0, 10);

    const sorted = [...filtered];
    if (sortOption === 'newest') {
      sorted.sort(
        (a, b) =>
          getChronoDate(b).localeCompare(getChronoDate(a)) ||
          (a.sourceNumbers?.[0] ?? 9999) - (b.sourceNumbers?.[0] ?? 9999) ||
          b.createdAt.localeCompare(a.createdAt)
      );
    } else if (sortOption === 'oldest') {
      sorted.sort(
        (a, b) =>
          getChronoDate(a).localeCompare(getChronoDate(b)) ||
          (a.sourceNumbers?.[0] ?? 9999) - (b.sourceNumbers?.[0] ?? 9999) ||
          a.createdAt.localeCompare(b.createdAt)
      );
    } else if (sortOption === 'mostSaved') {
      sorted.sort(
        (a, b) =>
          (b.savedCount || 1) - (a.savedCount || 1) ||
          (a.sourceNumbers?.[0] ?? 9999) - (b.sourceNumbers?.[0] ?? 9999)
      );
    } else if (sortOption === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    } else if (sortOption === 'category') {
      sorted.sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.name.localeCompare(b.name, 'zh-Hant')
      );
    } else {
      sorted.sort(
        (a, b) =>
          (a.sourceNumbers?.[0] ?? 0) - (b.sourceNumbers?.[0] ?? 0)
      );
    }
    return sorted;
  }, [
    places,
    mode,
    searchQuery,
    activeRegion,
    activeCategory,
    statusFilter,
    sortOption,
  ]);

  // Clear flash animation shortly after triggering
  useEffect(() => {
    if (!flashPlaceId) return;
    const timer = window.setTimeout(() => setFlashPlaceId(null), 950);
    return () => window.clearTimeout(timer);
  }, [flashPlaceId]);

  // Clear selection if selected place is filtered out
  useEffect(() => {
    if (
      selectedPlaceId &&
      !filteredPlaces.some((p) => p.id === selectedPlaceId)
    ) {
      setSelectedPlaceId(null);
    }
  }, [filteredPlaces, selectedPlaceId]);

  const handleRegionChange = (region: PlaceRegion | 'all') => {
    setActiveRegion(region);
    setSelectedPlaceId(null);
    syncSelectedUrl(null);
    setRegionTrigger((n) => n + 1);
  };

  // List item clicked in Map Mode -> zoom map to pin
  const handleSelectFromList = (place: Place) => {
    setSelectedPlaceId(place.id);
    syncSelectedUrl(place.id);
    setFocusTrigger((n) => n + 1);
  };

  // Pin clicked on Map -> select + zoom + scroll list to matching item
  const handleSelectFromMap = (placeId: string) => {
    setSelectedPlaceId(placeId);
    syncSelectedUrl(placeId);
    setFocusTrigger((n) => n + 1);
    setFlashPlaceId(placeId);

    const cardEl = cardRefs.current.get(placeId);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Place clicked in List Mode -> switch to Map Mode & zoom right to that pin
  const handleOpenOnMap = (place: Place) => {
    navigateToMode('map', place.id);
    setSelectedPlaceId(place.id);
    setFocusTrigger((n) => n + 1);
    setFlashPlaceId(place.id);

    window.setTimeout(() => {
      const cardEl = cardRefs.current.get(place.id);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  const handleOpenAddModal = () => {
    setEditingPlace(null);
    setPickedCoords(null);
    setIsPickingLocation(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (place: Place) => {
    setEditingPlace(place);
    setPickedCoords(null);
    setIsPickingLocation(false);
    setIsModalOpen(true);
  };

  const handleRequestPickOnMap = () => {
    setIsModalOpen(false);
    navigateToMode('map');
    setIsPickingLocation(true);
  };

  const handlePickCoordinates = (lat: number, lng: number) => {
    setPickedCoords({ lat, lng });
    setIsPickingLocation(false);
    setIsModalOpen(true);
  };

  const handleSavePlace = (draft: PlaceDraft, existingId?: string) => {
    if (existingId) {
      updatePlace(existingId, draft);
      setSelectedPlaceId(existingId);
      setFocusTrigger((n) => n + 1);
    } else {
      const created = addPlace(draft);
      setSelectedPlaceId(created.id);
      setFocusTrigger((n) => n + 1);
    }
    setIsModalOpen(false);
    setEditingPlace(null);
    setPickedCoords(null);
  };

  const handleDeletePlace = (id: string) => {
    deletePlace(id);
    if (selectedPlaceId === id) {
      setSelectedPlaceId(null);
    }
    setIsModalOpen(false);
    setEditingPlace(null);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setActiveRegion('all');
    setActiveCategory('all');
    setStatusFilter('all');
    setRegionTrigger((n) => n + 1);
  };

  return (
    <div className="app-shell">
      <div className="standalone-top-bar" aria-hidden="true" />
      <Header
        mode={mode}
        onModeChange={(nextMode) => navigateToMode(nextMode)}
        totalCount={places.length}
        pinnedCount={pinnedTotalCount}
        wantCount={ENABLE_WRITE_FEATURES ? wantCount : undefined}
        theme={resolvedTheme}
        onToggleTheme={handleToggleTheme}
        onInstallClick={canInstall ? promptInstall : undefined}
        onAddClick={ENABLE_WRITE_FEATURES ? handleOpenAddModal : undefined}
      />

      <main className="app-main">
        {mode === 'list' ? (
          <ListView
            places={filteredPlaces}
            totalCount={places.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeRegion={activeRegion}
            onRegionChange={handleRegionChange}
            regionCounts={regionCounts}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            statusFilter={statusFilter}
            onStatusFilterChange={
              ENABLE_WRITE_FEATURES ? setStatusFilter : undefined
            }
            sortOption={sortOption}
            onSortChange={setSortOption}
            onOpenOnMap={handleOpenOnMap}
            onToggleVisited={ENABLE_WRITE_FEATURES ? toggleVisited : undefined}
            onEdit={ENABLE_WRITE_FEATURES ? handleOpenEditModal : undefined}
            onClearFilters={handleClearFilters}
            onResetDefaults={
              ENABLE_WRITE_FEATURES ? resetToDefaults : undefined
            }
          />
        ) : (
          <div className="map-mode-layout">
            <aside className="map-sidebar" aria-label="Saved places list">
              <div className="sidebar-controls">
                <FilterBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  activeRegion={activeRegion}
                  onRegionChange={handleRegionChange}
                  regionCounts={regionCounts}
                  activeCategory={activeCategory}
                  onCategoryChange={setActiveCategory}
                  statusFilter={statusFilter}
                  onStatusFilterChange={
                    ENABLE_WRITE_FEATURES ? setStatusFilter : undefined
                  }
                  resultCount={filteredPlaces.length}
                  totalCount={pinnedTotalCount}
                  sortOption={sortOption}
                  onSortChange={setSortOption}
                  compact
                />
              </div>

              <div className="sidebar-list">
                {filteredPlaces.length === 0 ? (
                  <div className="empty-state">
                    <Compass size={28} strokeWidth={1.6} />
                    <h3>No saved places shown</h3>
                    <p>
                      Adjust your search, region, or category filters to see
                      more places.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleClearFilters}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  filteredPlaces.map((place) => (
                    <PlaceCard
                      key={place.id}
                      ref={(el) => {
                        if (el) {
                          cardRefs.current.set(place.id, el);
                        } else {
                          cardRefs.current.delete(place.id);
                        }
                      }}
                      place={place}
                      variant="sidebar"
                      isSelected={place.id === selectedPlaceId}
                      isHovered={place.id === hoveredPlaceId}
                      flashHighlight={place.id === flashPlaceId}
                      onSelect={handleSelectFromList}
                      onHover={setHoveredPlaceId}
                      onToggleVisited={
                        ENABLE_WRITE_FEATURES ? toggleVisited : undefined
                      }
                      onEdit={
                        ENABLE_WRITE_FEATURES ? handleOpenEditModal : undefined
                      }
                      onCategoryClick={setActiveCategory}
                    />
                  ))
                )}
              </div>
            </aside>

            <MapView
              places={filteredPlaces}
              activeRegion={activeRegion}
              regionTrigger={regionTrigger}
              selectedPlaceId={selectedPlaceId}
              hoveredPlaceId={hoveredPlaceId}
              focusTrigger={focusTrigger}
              isPickingLocation={
                ENABLE_WRITE_FEATURES ? isPickingLocation : false
              }
              onSelectPin={handleSelectFromMap}
              onHoverPin={setHoveredPlaceId}
              onClearSelection={() => {
                setSelectedPlaceId(null);
                syncSelectedUrl(null);
              }}
              onToggleVisited={
                ENABLE_WRITE_FEATURES ? toggleVisited : undefined
              }
              onEditPlace={
                ENABLE_WRITE_FEATURES ? handleOpenEditModal : undefined
              }
              onPickCoordinates={handlePickCoordinates}
              onCancelPick={() => setIsPickingLocation(false)}
              onCategoryClick={setActiveCategory}
            />
          </div>
        )}
      </main>

      {ENABLE_WRITE_FEATURES && (
        <PlaceModal
          isOpen={isModalOpen}
          editingPlace={editingPlace}
          pickedCoords={pickedCoords}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPlace(null);
            setPickedCoords(null);
          }}
          onSave={handleSavePlace}
          onDelete={handleDeletePlace}
          onRequestPickOnMap={handleRequestPickOnMap}
        />
      )}
    </div>
  );
}

export default App;
