import { useEffect, useId, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  CATEGORY_LIST,
  DEFAULT_SORT_OPTION,
  PlaceCategory,
  PlaceRegion,
  REGION_LIST,
  SortOption,
  StatusFilter,
} from '../types';

const SMALL_SCREEN_QUERY = '(max-width: 820px), (max-height: 580px)';

function getIsSmallScreen(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(SMALL_SCREEN_QUERY).matches;
}

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeRegion: PlaceRegion | 'all';
  onRegionChange: (region: PlaceRegion | 'all') => void;
  regionCounts: Record<string, number>;
  activeCategory: PlaceCategory | 'all';
  onCategoryChange: (cat: PlaceCategory | 'all') => void;
  statusFilter: StatusFilter;
  onStatusFilterChange?: (status: StatusFilter) => void;
  resultCount: number;
  totalCount: number;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  compact?: boolean;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  activeRegion,
  onRegionChange,
  regionCounts,
  activeCategory,
  onCategoryChange,
  statusFilter,
  onStatusFilterChange,
  resultCount,
  totalCount,
  sortOption,
  onSortChange,
  compact = false,
}: FilterBarProps) {
  const panelId = useId();
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(getIsSmallScreen);
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia(SMALL_SCREEN_QUERY);
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsSmallScreen(e.matches);
      if (e.matches) {
        setIsFiltersOpen(false);
      }
    };

    handleChange(mq);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    }
    mq.addListener(handleChange);
    return () => mq.removeListener(handleChange);
  }, []);

  const activeFilterCount =
    (activeRegion !== 'all' ? 1 : 0) +
    (activeCategory !== 'all' ? 1 : 0) +
    (onStatusFilterChange && statusFilter !== 'all' ? 1 : 0) +
    (sortOption !== DEFAULT_SORT_OPTION ? 1 : 0);

  const showFilterPanel = !isSmallScreen || isFiltersOpen;

  const handleResetFilters = () => {
    onRegionChange('all');
    onCategoryChange('all');
    onStatusFilterChange?.('all');
    onSortChange(DEFAULT_SORT_OPTION);
  };

  const sortSelect = (
    <div className="sort-select-wrap">
      <select
        id={isSmallScreen ? `${panelId}-sort` : undefined}
        className="sort-select"
        value={sortOption}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        aria-label="Sort places"
      >
        <option value="newest">Newest post</option>
        <option value="oldest">Oldest post</option>
        <option value="collection">Collection order</option>
        <option value="mostSaved">Most saved</option>
        <option value="name">Name (A–Z)</option>
        <option value="category">Category</option>
      </select>
      <ChevronDown size={14} className="sort-select-icon" aria-hidden="true" />
    </div>
  );

  return (
    <>
      <div className="search-row">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search places, districts, dishes..."
            aria-label="Search saved places"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {isSmallScreen ? (
          <button
            type="button"
            className={`filter-toggle-btn ${
              isFiltersOpen || activeFilterCount > 0 ? 'active' : ''
            }`}
            onClick={() => setIsFiltersOpen((prev) => !prev)}
            aria-expanded={isFiltersOpen}
            aria-controls={panelId}
            aria-label={isFiltersOpen ? 'Hide filters' : 'Show filters'}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span className="filter-toggle-label">Filters</span>
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
            {isFiltersOpen ? (
              <ChevronUp size={14} aria-hidden="true" />
            ) : (
              <ChevronDown size={14} aria-hidden="true" />
            )}
          </button>
        ) : (
          sortSelect
        )}
      </div>

      {isSmallScreen && !isFiltersOpen && activeFilterCount > 0 && (
        <div className="collapsed-filter-summary">
          <span>
            Showing <strong>{resultCount}</strong> of {totalCount}
          </span>
          <button
            type="button"
            className="filter-reset-link"
            onClick={handleResetFilters}
          >
            Reset filters
          </button>
        </div>
      )}

      {showFilterPanel && (
        <div
          id={panelId}
          className={`filter-panel ${isSmallScreen ? 'is-collapsible' : ''}`}
        >
          {isSmallScreen && (
            <div className="mobile-sort-row">
              <label
                className="mobile-sort-label"
                htmlFor={`${panelId}-sort`}
              >
                Sort by
              </label>
              {sortSelect}
            </div>
          )}

          <div
            className="filter-pills region-pills"
            role="group"
            aria-label="Filter by region"
          >
            <button
              type="button"
              className={`pill region-pill ${
                activeRegion === 'all' ? 'active' : ''
              }`}
              onClick={() => onRegionChange('all')}
            >
              All regions
            </button>
            {REGION_LIST.filter((r) => (regionCounts[r.id] || 0) > 0).map(
              (reg) => (
                <button
                  key={reg.id}
                  type="button"
                  className={`pill region-pill ${
                    activeRegion === reg.id ? 'active' : ''
                  }`}
                  onClick={() => onRegionChange(reg.id)}
                >
                  {reg.label}
                  <span className="pill-count">{regionCounts[reg.id]}</span>
                </button>
              )
            )}
          </div>

          <div
            className="filter-pills"
            role="group"
            aria-label="Filter by category"
          >
            <button
              type="button"
              className={`pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => onCategoryChange('all')}
            >
              All types
            </button>
            {CATEGORY_LIST.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`pill ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => onCategoryChange(cat.id)}
              >
                <span
                  className="pill-dot"
                  style={{
                    background: activeCategory === cat.id ? '#fff' : cat.color,
                  }}
                />
                {compact || isSmallScreen ? cat.shortLabel : cat.label}
              </button>
            ))}
          </div>

          <div className="filter-meta-row">
            <span>
              Showing <strong>{resultCount}</strong> of {totalCount}
            </span>

            {((isSmallScreen && activeFilterCount > 0) ||
              onStatusFilterChange) && (
              <div className="filter-meta-actions">
                {isSmallScreen && activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="filter-reset-link"
                    onClick={handleResetFilters}
                  >
                    Reset
                  </button>
                )}
                {onStatusFilterChange && (
                  <div
                    className="status-tabs"
                    role="group"
                    aria-label="Visit status"
                  >
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'want', label: 'Want to go' },
                        { id: 'visited', label: 'Visited' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`status-tab ${
                          statusFilter === tab.id ? 'active' : ''
                        }`}
                        onClick={() => onStatusFilterChange(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
