import { Compass, RotateCcw } from 'lucide-react';
import {
  Place,
  PlaceCategory,
  PlaceRegion,
  SortOption,
  StatusFilter,
} from '../types';
import { FilterBar } from './FilterBar';
import { PlaceCard } from './PlaceCard';

interface ListViewProps {
  places: Place[];
  totalCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeRegion: PlaceRegion | 'all';
  onRegionChange: (region: PlaceRegion | 'all') => void;
  regionCounts: Record<string, number>;
  activeCategory: PlaceCategory | 'all';
  onCategoryChange: (cat: PlaceCategory | 'all') => void;
  statusFilter: StatusFilter;
  onStatusFilterChange?: (status: StatusFilter) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  onOpenOnMap: (place: Place) => void;
  onToggleVisited?: (id: string) => void;
  onEdit?: (place: Place) => void;
  onClearFilters: () => void;
  onResetDefaults?: () => void;
}

export function ListView({
  places,
  totalCount,
  searchQuery,
  onSearchChange,
  activeRegion,
  onRegionChange,
  regionCounts,
  activeCategory,
  onCategoryChange,
  statusFilter,
  onStatusFilterChange,
  sortOption,
  onSortChange,
  onOpenOnMap,
  onToggleVisited,
  onEdit,
  onClearFilters,
  onResetDefaults,
}: ListViewProps) {
  const hasFilters =
    searchQuery.trim() !== '' ||
    activeRegion !== 'all' ||
    activeCategory !== 'all' ||
    (Boolean(onStatusFilterChange) && statusFilter !== 'all');

  return (
    <section className="list-mode-container" aria-label="Saved places list">
      <div className="list-mode-inner">
        <div className="list-hero">
          <div>
            <h2>Molly&apos;s Collection</h2>
          </div>
          {totalCount === 0 && onResetDefaults && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onResetDefaults}
            >
              <RotateCcw size={14} />
              Restore collection
            </button>
          )}
        </div>

        <div className="list-toolbar">
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            activeRegion={activeRegion}
            onRegionChange={onRegionChange}
            regionCounts={regionCounts}
            activeCategory={activeCategory}
            onCategoryChange={onCategoryChange}
            statusFilter={statusFilter}
            onStatusFilterChange={onStatusFilterChange}
            resultCount={places.length}
            totalCount={totalCount}
            sortOption={sortOption}
            onSortChange={onSortChange}
          />
        </div>

        {places.length === 0 ? (
          <div className="empty-state">
            <Compass size={32} strokeWidth={1.6} />
            <h3>No places match</h3>
            <p>
              {hasFilters
                ? 'Try clearing your search, region, or category filter.'
                : onEdit
                ? 'Start adding spots you want to visit.'
                : 'No saved places available.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="places-grid">
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                variant="grid"
                onSelect={
                  place.lat !== null && place.lng !== null
                    ? onOpenOnMap
                    : onEdit
                }
                onToggleVisited={onToggleVisited}
                onEdit={onEdit}
                onCategoryClick={onCategoryChange}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
