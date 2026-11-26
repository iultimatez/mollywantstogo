import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Calendar,
  Check,
  ExternalLink,
  Flame,
  Instagram,
  MapPin,
  Maximize2,
  Pencil,
  X,
} from 'lucide-react';
import { CATEGORIES, Place, PlaceCategory, PlaceRegion } from '../types';

interface MapViewProps {
  places: Place[];
  activeRegion: PlaceRegion | 'all';
  regionTrigger: number;
  selectedPlaceId: string | null;
  hoveredPlaceId: string | null;
  focusTrigger: number;
  isPickingLocation: boolean;
  onSelectPin: (placeId: string) => void;
  onHoverPin: (placeId: string | null) => void;
  onClearSelection: () => void;
  onToggleVisited?: (id: string) => void;
  onEditPlace?: (place: Place) => void;
  onPickCoordinates: (lat: number, lng: number) => void;
  onCancelPick: () => void;
  onCategoryClick?: (category: PlaceCategory) => void;
}

function createPinIcon(
  color: string,
  isSelected: boolean,
  isHovered: boolean,
  visited: boolean,
  savedCount?: number
): L.DivIcon {
  const showCount = !visited && savedCount && savedCount > 1;
  const innerContent = visited
    ? `<path d="M13 17.2l2.8 2.8 5.4-5.8" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
    : showCount
    ? `<text x="17" y="20.2" text-anchor="middle" fill="${color}" font-size="10.5" font-weight="800" font-family="Raleway, Helvetica, sans-serif">${savedCount}</text>`
    : `<circle cx="17" cy="17" r="4.4" fill="${color}"/>`;

  const html = `
    <div class="pin-marker ${isSelected ? 'selected' : ''} ${
    isHovered ? 'hovered' : ''
  }">
      <span class="pin-pulse" style="background:${color};"></span>
      <svg class="pin-svg" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M17 1.5C8.44 1.5 1.5 8.44 1.5 17C1.5 27.6 14.5 38.6 16.36 40.12C16.73 40.42 17.27 40.42 17.64 40.12C19.5 38.6 32.5 27.6 32.5 17C32.5 8.44 25.56 1.5 17 1.5Z" fill="${color}" stroke="#FFFFFF" stroke-width="2.4"/>
        <circle cx="17" cy="17" r="7.8" fill="#FFFFFF"/>
        ${innerContent}
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'custom-pin-wrapper',
    html,
    iconSize: [34, 42],
    iconAnchor: [17, 41],
    tooltipAnchor: [0, -38],
  });
}

export function MapView({
  places,
  activeRegion,
  regionTrigger,
  selectedPlaceId,
  hoveredPlaceId,
  focusTrigger,
  isPickingLocation,
  onSelectPin,
  onHoverPin,
  onClearSelection,
  onToggleVisited,
  onEditPlace,
  onPickCoordinates,
  onCancelPick,
  onCategoryClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const hasFittedInitialRef = useRef(false);

  const onSelectPinRef = useRef(onSelectPin);
  onSelectPinRef.current = onSelectPin;
  const onHoverPinRef = useRef(onHoverPin);
  onHoverPinRef.current = onHoverPin;
  const onPickCoordsRef = useRef(onPickCoordinates);
  onPickCoordsRef.current = onPickCoordinates;
  const isPickingRef = useRef(isPickingLocation);
  isPickingRef.current = isPickingLocation;

  const pinnedPlaces = useMemo(
    () => places.filter((p) => p.lat !== null && p.lng !== null),
    [places]
  );

  const selectedPlace =
    pinnedPlaces.find((p) => p.id === selectedPlaceId) ?? null;

  const selectedPlaceReels = selectedPlace
    ? selectedPlace.reels && selectedPlace.reels.length > 0
      ? selectedPlace.reels
      : (selectedPlace.instagramUrls || []).map((url) => ({
          url,
          postedAt: undefined,
        }))
    : [];

  const hasDetailActions = Boolean(
    onToggleVisited || onEditPlace || selectedPlaceReels.length > 0
  );

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [25.042, 121.545],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isPickingRef.current) {
        onPickCoordsRef.current(
          Number(e.latlng.lat.toFixed(5)),
          Number(e.latlng.lng.toFixed(5))
        );
      }
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      hasFittedInitialRef.current = false;
    };
  }, []);

  // Sync markers whenever places, selection, or hover changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(pinnedPlaces.map((p) => p.id));

    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    pinnedPlaces.forEach((place) => {
      const lat = place.lat as number;
      const lng = place.lng as number;
      const cat = CATEGORIES[place.category];
      const isSelected = place.id === selectedPlaceId;
      const isHovered = place.id === hoveredPlaceId;
      const icon = createPinIcon(
        cat.color,
        isSelected,
        isHovered,
        Boolean(onToggleVisited) && place.visited,
        place.savedCount
      );
      const zIndexOffset = isSelected
        ? 1000
        : isHovered
        ? 500
        : (place.savedCount || 1) * 10;

      const tooltipText =
        place.savedCount && place.savedCount > 1
          ? `${place.name} (${place.savedCount}×)`
          : place.name;

      const existing = markersRef.current.get(place.id);
      if (existing) {
        existing.setLatLng([lat, lng]);
        existing.setIcon(icon);
        existing.setZIndexOffset(zIndexOffset);
        existing.setTooltipContent(tooltipText);
      } else {
        const marker = L.marker([lat, lng], {
          icon,
          zIndexOffset,
          title: place.name,
        }).addTo(map);

        marker.bindTooltip(tooltipText, {
          direction: 'top',
          className: 'place-pin-tooltip',
          opacity: 1,
        });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (isPickingRef.current) return;
          onSelectPinRef.current(place.id);
        });

        marker.on('mouseover', () => {
          onHoverPinRef.current(place.id);
        });

        marker.on('mouseout', () => {
          onHoverPinRef.current(null);
        });

        markersRef.current.set(place.id, marker);
      }
    });

    // Smart initial framing: frame Taipei cluster if in "all" mode so streets & pins are crisp immediately
    if (!hasFittedInitialRef.current && pinnedPlaces.length > 0) {
      hasFittedInitialRef.current = true;
      if (!selectedPlaceId) {
        const taipeiSpots = pinnedPlaces.filter((p) => p.region === 'taipei');
        const target =
          activeRegion === 'all' && taipeiSpots.length >= 5
            ? taipeiSpots
            : pinnedPlaces;
        const bounds = L.latLngBounds(
          target.map((p) => [p.lat as number, p.lng as number])
        );
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
      }
    }
  }, [pinnedPlaces, selectedPlaceId, hoveredPlaceId, activeRegion]);

  // Refit map smoothly whenever user explicitly switches region
  useEffect(() => {
    if (regionTrigger === 0) return;
    const map = mapRef.current;
    if (!map || pinnedPlaces.length === 0) return;

    if (pinnedPlaces.length === 1) {
      map.flyTo(
        [pinnedPlaces[0].lat as number, pinnedPlaces[0].lng as number],
        pinnedPlaces[0].locationPrecision === 'area' ? 12 : 16,
        { duration: 0.75 }
      );
      return;
    }

    const bounds = L.latLngBounds(
      pinnedPlaces.map((p) => [p.lat as number, p.lng as number])
    );
    map.flyToBounds(bounds, {
      padding: [56, 56],
      maxZoom: 14,
      duration: 0.75,
    });
  }, [regionTrigger]);

  // Smoothly fly/zoom to the selected place whenever selectedPlaceId or focusTrigger changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlaceId) return;

    const place = pinnedPlaces.find((p) => p.id === selectedPlaceId);
    if (!place || place.lat === null || place.lng === null) return;

    const preferredZoom = place.locationPrecision === 'area' ? 13 : 16;
    const targetZoom = Math.max(map.getZoom(), preferredZoom);
    map.flyTo([place.lat, place.lng], Math.min(targetZoom, 17), {
      duration: 0.8,
      easeLinearity: 0.25,
    });
  }, [selectedPlaceId, focusTrigger, pinnedPlaces]);

  const handleFitAll = () => {
    const map = mapRef.current;
    if (!map || pinnedPlaces.length === 0) return;

    onClearSelection();

    if (pinnedPlaces.length === 1) {
      map.flyTo(
        [pinnedPlaces[0].lat as number, pinnedPlaces[0].lng as number],
        15,
        { duration: 0.65 }
      );
      return;
    }

    const bounds = L.latLngBounds(
      pinnedPlaces.map((p) => [p.lat as number, p.lng as number])
    );
    map.flyToBounds(bounds, {
      padding: [56, 56],
      maxZoom: 14,
      duration: 0.75,
    });
  };

  return (
    <div className="map-pane" aria-label="Interactive map of saved places">
      <div
        ref={containerRef}
        className={`leaflet-host ${isPickingLocation ? 'pick-mode' : ''}`}
      />

      {isPickingLocation && (
        <div className="pick-banner" role="status">
          <MapPin size={16} />
          <span>Click anywhere on the map to drop your pin</span>
          <button type="button" onClick={onCancelPick}>
            Cancel
          </button>
        </div>
      )}

      <div className="map-top-controls">
        <button
          type="button"
          className="map-float-btn"
          onClick={handleFitAll}
          disabled={pinnedPlaces.length === 0}
          title="Zoom out to show all visible pins"
        >
          <Maximize2 size={15} />
          Show all pins ({pinnedPlaces.length})
        </button>
      </div>

      {selectedPlace && !isPickingLocation && (
        <aside className="map-detail-card" aria-label={selectedPlace.name}>
          <div className="detail-card-header">
            <div className="detail-card-header-top">
              <div className="detail-card-heading">
                <div className="card-badges" style={{ marginBottom: 6 }}>
                  {onCategoryClick ? (
                    <button
                      type="button"
                      className="category-badge category-badge-btn"
                      style={
                        {
                          '--cat-color':
                            CATEGORIES[selectedPlace.category].color,
                          '--cat-bg': CATEGORIES[selectedPlace.category].softBg,
                          '--cat-border':
                            CATEGORIES[selectedPlace.category].borderColor,
                        } as React.CSSProperties
                      }
                      title={`Filter by ${CATEGORIES[selectedPlace.category].label}`}
                      aria-label={`Filter by ${CATEGORIES[selectedPlace.category].label}`}
                      onClick={() => onCategoryClick(selectedPlace.category)}
                    >
                      {CATEGORIES[selectedPlace.category].shortLabel}
                    </button>
                  ) : (
                    <span
                      className="category-badge"
                      style={
                        {
                          '--cat-color':
                            CATEGORIES[selectedPlace.category].color,
                          '--cat-bg': CATEGORIES[selectedPlace.category].softBg,
                          '--cat-border':
                            CATEGORIES[selectedPlace.category].borderColor,
                        } as React.CSSProperties
                      }
                    >
                      {CATEGORIES[selectedPlace.category].shortLabel}
                    </span>
                  )}
                  {selectedPlace.savedCount && selectedPlace.savedCount > 1 && (
                    <span className="saved-count-badge">
                      <Flame size={11} />
                      Saved {selectedPlace.savedCount}×
                    </span>
                  )}
                  {selectedPlace.locationPrecision === 'area' && (
                    <span className="unpinned-badge">Approx. area</span>
                  )}
                  {onToggleVisited && selectedPlace.visited && (
                    <span className="visited-badge">
                      <Check size={11} strokeWidth={2.6} />
                      Visited
                    </span>
                  )}
                </div>
                <h3 className="detail-card-title">{selectedPlace.name}</h3>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={onClearSelection}
                aria-label="Close place preview"
              >
                <X size={16} />
              </button>
            </div>

            <a
              className="place-location detail-location-link"
              href={
                selectedPlace.googleMapsUrl ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${selectedPlace.name} ${selectedPlace.lat},${selectedPlace.lng}`
                )}`
              }
              target="_blank"
              rel="noreferrer"
              title="Open in Google Maps"
            >
              <MapPin size={12} aria-hidden="true" />
              <span className="detail-location-text">
                {selectedPlace.address && !/^—/.test(selectedPlace.address)
                  ? selectedPlace.address
                  : selectedPlace.neighborhood}
              </span>
              <ExternalLink
                size={10}
                className="detail-location-ext"
                aria-hidden="true"
              />
            </a>

            {(selectedPlace.postedAt || selectedPlace.savedAt) && (
              <div className="detail-dates-row">
                {selectedPlace.postedAt && (
                  <span className="detail-date-item">
                    <Calendar size={10} aria-hidden="true" />
                    <span>Posted {selectedPlace.postedAt}</span>
                  </span>
                )}
                {selectedPlace.postedAt && selectedPlace.savedAt && (
                  <span className="detail-date-sep" aria-hidden="true">
                    ·
                  </span>
                )}
                {selectedPlace.savedAt && (
                  <span className="detail-date-item">
                    <span>Saved {selectedPlace.savedAt}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {selectedPlace.note && (
            <div className="detail-note-scroll">
              {selectedPlace.note.split('\n\n').map((para, idx) => (
                <p key={idx} className="place-note">
                  {para}
                </p>
              ))}
            </div>
          )}

          {hasDetailActions && (
            <div className="detail-card-actions">
              {onToggleVisited && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onToggleVisited(selectedPlace.id)}
                >
                  <Check size={14} />
                  {selectedPlace.visited ? 'Visited' : 'Mark visited'}
                </button>
              )}

              {onEditPlace && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onEditPlace(selectedPlace)}
                >
                  <Pencil size={13} />
                  Edit
                </button>
              )}

              {selectedPlaceReels.map((reel, idx, arr) => (
                <a
                  key={reel.url}
                  className="external-link ig-link"
                  href={reel.url}
                  target="_blank"
                  rel="noreferrer"
                  title={
                    reel.postedAt
                      ? `Instagram Reel posted ${reel.postedAt}`
                      : 'Open Instagram Reel'
                  }
                  aria-label={
                    arr.length > 1
                      ? `Instagram Reel ${idx + 1}${reel.postedAt ? ` (${reel.postedAt})` : ''}`
                      : 'Open Instagram Reel'
                  }
                >
                  <Instagram size={12} aria-hidden="true" />
                  {arr.length > 1
                    ? reel.postedAt
                      ? reel.postedAt.slice(0, 7)
                      : `${idx + 1}`
                    : 'IG Reel'}
                </a>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
