import { forwardRef } from 'react';
import {
  Calendar,
  Check,
  ExternalLink,
  Flame,
  Instagram,
  MapPin,
  Pencil,
} from 'lucide-react';
import { CATEGORIES, Place, PlaceCategory } from '../types';

function formatShortDate(isoDate?: string): string {
  if (!isoDate) return '';
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthIdx = Number(m[2]) - 1;
  return `${months[monthIdx] || m[2]} ${Number(m[3])}, ${m[1]}`;
}

interface PlaceCardProps {
  place: Place;
  isSelected?: boolean;
  isHovered?: boolean;
  flashHighlight?: boolean;
  variant: 'sidebar' | 'grid';
  onSelect?: (place: Place) => void;
  onHover?: (id: string | null) => void;
  onToggleVisited?: (id: string) => void;
  onEdit?: (place: Place) => void;
  onCategoryClick?: (category: PlaceCategory) => void;
}

export const PlaceCard = forwardRef<HTMLDivElement, PlaceCardProps>(
  function PlaceCard(
    {
      place,
      isSelected = false,
      isHovered = false,
      flashHighlight = false,
      variant,
      onSelect,
      onHover,
      onToggleVisited,
      onEdit,
      onCategoryClick,
    },
    ref
  ) {
    const cat = CATEGORIES[place.category];
    const hasPin = place.lat !== null && place.lng !== null;
    const primaryIg = place.instagramUrls?.[0];
    const hasActions = Boolean(primaryIg || onToggleVisited || onEdit);
    const isInteractive = Boolean(onSelect);
    const locationLabel = `${place.neighborhood}${
      place.regionLabel &&
      !place.neighborhood.includes(place.regionLabel.split(' ')[0])
        ? ` · ${place.regionLabel}`
        : ''
    }`;
    const googleMapsHref =
      place.googleMapsUrl ||
      (hasPin
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${place.name} ${place.lat},${place.lng}`
          )}`
        : null);

    return (
      <div
        ref={ref}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        data-place-id={place.id}
        className={`place-card ${!isInteractive ? 'is-static' : ''} ${
          isSelected ? 'selected' : ''
        } ${isHovered && !isSelected ? 'hovered' : ''} ${
          flashHighlight ? 'flash-ring' : ''
        }`}
        onClick={onSelect ? () => onSelect(place) : undefined}
        onKeyDown={
          onSelect
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(place);
                }
              }
            : undefined
        }
        onMouseEnter={() => onHover?.(place.id)}
        onMouseLeave={() => onHover?.(null)}
      >
        <div>
          <div className="place-card-top">
            <div className="place-card-heading">
              <div className="place-name-row">
                <span
                  className="place-index-dot"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />
                <h3 className="place-name">{place.name}</h3>
              </div>
              <div className="place-header-meta">
                {googleMapsHref ? (
                  <a
                    className="place-location detail-location-link"
                    href={googleMapsHref}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in Google Maps"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <MapPin size={12} aria-hidden="true" />
                    <span className="detail-location-text">{locationLabel}</span>
                    <ExternalLink
                      size={10}
                      className="detail-location-ext"
                      aria-hidden="true"
                    />
                  </a>
                ) : (
                  <div className="place-location">
                    <MapPin size={12} aria-hidden="true" />
                    <span>{locationLabel}</span>
                  </div>
                )}
                {place.savedAt && (
                  <span
                    className="date-badge"
                    title={`Saved: ${place.savedAt}${
                      place.postedAt ? ` · Post published: ${place.postedAt}` : ''
                    }`}
                  >
                    <Calendar size={10} />
                    {formatShortDate(place.savedAt)}
                  </span>
                )}
              </div>
            </div>

            {hasActions && (
              <div
                className="card-actions"
                onClick={(e) => e.stopPropagation()}
              >
                {primaryIg && (
                  <a
                    href={primaryIg}
                    target="_blank"
                    rel="noreferrer"
                    className="icon-btn"
                    title="Open saved Instagram Reel"
                    aria-label={`Open Instagram Reel for ${place.name}`}
                  >
                    <Instagram size={14} />
                  </a>
                )}
                {onToggleVisited && (
                  <button
                    type="button"
                    className={`icon-btn ${place.visited ? 'visited' : ''}`}
                    title={
                      place.visited ? 'Mark as want to go' : 'Mark as visited'
                    }
                    aria-label={
                      place.visited
                        ? `Mark ${place.name} as want to go`
                        : `Mark ${place.name} as visited`
                    }
                    onClick={() => onToggleVisited(place.id)}
                  >
                    <Check size={15} strokeWidth={2.5} />
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    className="icon-btn"
                    title="Edit place"
                    aria-label={`Edit ${place.name}`}
                    onClick={() => onEdit(place)}
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {place.note && (
            <p
              className={`place-note ${
                variant === 'sidebar' ? 'note-clamp-2' : 'note-clamp-4'
              }`}
              style={{ marginTop: 8 }}
            >
              {place.note}
            </p>
          )}
        </div>

        <div className="place-card-footer">
          <div className="card-badges">
            {onCategoryClick ? (
              <button
                type="button"
                className="category-badge category-badge-btn"
                style={
                  {
                    '--cat-color': cat.color,
                    '--cat-bg': cat.softBg,
                    '--cat-border': cat.borderColor,
                  } as React.CSSProperties
                }
                title={`Filter by ${cat.label}`}
                aria-label={`Filter by ${cat.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCategoryClick(place.category);
                }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {cat.shortLabel}
              </button>
            ) : (
              <span
                className="category-badge"
                style={
                  {
                    '--cat-color': cat.color,
                    '--cat-bg': cat.softBg,
                    '--cat-border': cat.borderColor,
                  } as React.CSSProperties
                }
              >
                {cat.shortLabel}
              </span>
            )}
            {place.savedCount && place.savedCount > 1 && (
              <span
                className="saved-count-badge"
                title={`Saved across ${place.savedCount} Instagram posts`}
              >
                <Flame size={11} />
                Saved {place.savedCount}×
              </span>
            )}
            {onToggleVisited && place.visited && (
              <span className="visited-badge">
                <Check size={11} strokeWidth={2.6} />
                Visited
              </span>
            )}
            {!hasPin && (
              <span className="unpinned-badge">No map pin</span>
            )}
          </div>
        </div>
      </div>
    );
  }
);
