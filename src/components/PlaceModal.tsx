import { FormEvent, useEffect, useState } from 'react';
import { ChevronDown, Crosshair, Search, Trash2, X } from 'lucide-react';
import { PlaceDraft } from '../hooks/usePlaces';
import {
  CATEGORY_LIST,
  Place,
  PlaceCategory,
  PlaceRegion,
  REGION_LIST,
} from '../types';

interface PlaceModalProps {
  isOpen: boolean;
  editingPlace: Place | null;
  pickedCoords: { lat: number; lng: number } | null;
  onClose: () => void;
  onSave: (draft: PlaceDraft, existingId?: string) => void;
  onDelete?: (id: string) => void;
  onRequestPickOnMap: () => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    state?: string;
  };
}

export function PlaceModal({
  isOpen,
  editingPlace,
  pickedCoords,
  onClose,
  onSave,
  onDelete,
  onRequestPickOnMap,
}: PlaceModalProps) {
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [region, setRegion] = useState<PlaceRegion>('taipei');
  const [category, setCategory] = useState<PlaceCategory>('dining');
  const [note, setNote] = useState('');
  const [lat, setLat] = useState('25.0418');
  const [lng, setLng] = useState('121.5435');
  const [visited, setVisited] = useState(false);

  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState<NominatimResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setGeoResults([]);
    setGeoMessage('');
    setGeoQuery('');

    if (editingPlace) {
      setName(editingPlace.name);
      setNeighborhood(editingPlace.address || editingPlace.neighborhood);
      setRegion(editingPlace.region === 'other' ? 'taipei' : editingPlace.region);
      setCategory(editingPlace.category);
      setNote(editingPlace.note);
      setLat(editingPlace.lat !== null ? String(editingPlace.lat) : '');
      setLng(editingPlace.lng !== null ? String(editingPlace.lng) : '');
      setVisited(editingPlace.visited);
    } else if (!pickedCoords) {
      setName('');
      setNeighborhood('');
      setRegion('taipei');
      setCategory('dining');
      setNote('');
      setLat('25.0418');
      setLng('121.5435');
      setVisited(false);
    }
  }, [isOpen, editingPlace]);

  useEffect(() => {
    if (pickedCoords) {
      setLat(String(pickedCoords.lat));
      setLng(String(pickedCoords.lng));
    }
  }, [pickedCoords]);

  if (!isOpen) return null;

  const handleGeoSearch = async () => {
    const trimmed = geoQuery.trim();
    if (!trimmed) return;
    setGeoLoading(true);
    setGeoMessage('');
    setGeoResults([]);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=4&q=${encodeURIComponent(
          trimmed
        )}`
      );
      if (!res.ok) throw new Error('Search failed');
      const data = (await res.json()) as NominatimResult[];
      if (data.length === 0) {
        setGeoMessage('No matching locations found. Try picking a pin on the map.');
      } else {
        setGeoResults(data);
      }
    } catch {
      setGeoMessage(
        'Location lookup unavailable right now. You can pick directly on the map or enter coordinates.'
      );
    } finally {
      setGeoLoading(false);
    }
  };

  const applyGeoResult = (item: NominatimResult) => {
    const primary = item.display_name.split(',')[0]?.trim() || '';
    if (!name.trim()) setName(primary);
    setNeighborhood(item.display_name);
    setLat(Number(item.lat).toFixed(5));
    setLng(Number(item.lon).toFixed(5));
    setGeoResults([]);
    setGeoMessage('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const hasCoords = lat.trim() !== '' && lng.trim() !== '';
    const parsedLat = hasCoords ? Number(lat) : null;
    const parsedLng = hasCoords ? Number(lng) : null;

    if (!trimmedName) {
      setError('Please enter a place name.');
      return;
    }
    if (
      hasCoords &&
      (parsedLat === null ||
        parsedLng === null ||
        Number.isNaN(parsedLat) ||
        Number.isNaN(parsedLng) ||
        parsedLat < -90 ||
        parsedLat > 90 ||
        parsedLng < -180 ||
        parsedLng > 180)
    ) {
      setError('Please provide valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }

    const regionMeta =
      REGION_LIST.find((r) => r.id === region) ?? REGION_LIST[0];

    onSave(
      {
        name: trimmedName,
        neighborhood: neighborhood.trim() || regionMeta.label,
        city: regionMeta.label,
        address: neighborhood.trim() || undefined,
        region,
        regionLabel: regionMeta.label,
        category,
        note: note.trim(),
        lat: parsedLat,
        lng: parsedLng,
        locationPrecision: hasCoords ? 'exact' : 'none',
        visited,
        savedCount: editingPlace?.savedCount ?? 1,
        sourceNumbers: editingPlace?.sourceNumbers,
        instagramUrls: editingPlace?.instagramUrls,
        googleMapsUrl: editingPlace?.googleMapsUrl,
      },
      editingPlace?.id
    );
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-modal-title"
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="place-modal-title">
            {editingPlace ? 'Edit Saved Place' : 'Save a New Place'}
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="geo-lookup">Find location (optional)</label>
            <div className="geo-search-box">
              <input
                id="geo-lookup"
                type="text"
                value={geoQuery}
                onChange={(e) => setGeoQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGeoSearch();
                  }
                }}
                placeholder="Search an address or landmark..."
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleGeoSearch}
                disabled={geoLoading}
              >
                <Search size={14} />
                {geoLoading ? '...' : 'Find'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onRequestPickOnMap}
                title="Drop a pin directly on the map"
              >
                <Crosshair size={14} />
                Pick on map
              </button>
            </div>
            {geoMessage && <span className="form-hint">{geoMessage}</span>}
            {geoResults.length > 0 && (
              <div className="geo-results">
                {geoResults.map((item) => (
                  <button
                    key={item.place_id}
                    type="button"
                    className="geo-result-btn"
                    onClick={() => applyGeoResult(item)}
                  >
                    {item.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="place-name">Place name *</label>
            <input
              id="place-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 四平街番茄牛肉麵"
              required
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="place-neighborhood">Address / Location</label>
              <input
                id="place-neighborhood"
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="e.g. 臺北市大安區..."
              />
            </div>
            <div className="field">
              <label htmlFor="place-region">Region</label>
              <div className="field-select-wrap">
                <select
                  id="place-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as PlaceRegion)}
                >
                  {REGION_LIST.map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="field-select-icon"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div className="field">
            <label>Category</label>
            <div className="category-selector">
              {CATEGORY_LIST.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`cat-option ${category === cat.id ? 'active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  <span
                    className="pill-dot"
                    style={{ background: cat.color }}
                  />
                  {cat.shortLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="place-note">Notes</label>
            <textarea
              id="place-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Highlights, prices, hours, or why you want to go..."
            />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="place-lat">Latitude</label>
              <input
                id="place-lat"
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="place-lng">Longitude</label>
              <input
                id="place-lng"
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-footer">
            {editingPlace && onDelete && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(editingPlace.id)}
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}
            <div className="modal-footer-right">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingPlace ? 'Save changes' : 'Save place'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
