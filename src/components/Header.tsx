import { List, Map as MapIcon, MapPin, Plus } from 'lucide-react';
import { ViewMode } from '../types';

interface HeaderProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  totalCount: number;
  pinnedCount: number;
  wantCount?: number;
  onAddClick?: () => void;
}

export function Header({
  mode,
  onModeChange,
  totalCount,
  pinnedCount,
  wantCount,
  onAddClick,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <MapPin size={19} strokeWidth={2.3} />
        </div>
        <div className="brand-text">
          <h1 className="brand-title">Molly&apos;s Collection</h1>
          <span className="brand-subtitle">
            {wantCount !== undefined ? `${wantCount} to explore · ` : ''}
            {pinnedCount} pinned · {totalCount} saved
          </span>
        </div>
      </div>

      <nav className="mode-switcher" role="tablist" aria-label="View mode">
        <a
          href="/list"
          role="tab"
          aria-selected={mode === 'list'}
          className={`mode-btn ${mode === 'list' ? 'active' : ''}`}
          onClick={(e) => {
            if (
              e.button === 0 &&
              !e.metaKey &&
              !e.ctrlKey &&
              !e.shiftKey &&
              !e.altKey
            ) {
              e.preventDefault();
              onModeChange('list');
            }
          }}
        >
          <span className="nav-icon-circle" aria-hidden="true">
            <List size={14} strokeWidth={2.2} />
          </span>
          <span>List</span>
        </a>
        <a
          href="/map"
          role="tab"
          aria-selected={mode === 'map'}
          className={`mode-btn ${mode === 'map' ? 'active' : ''}`}
          onClick={(e) => {
            if (
              e.button === 0 &&
              !e.metaKey &&
              !e.ctrlKey &&
              !e.shiftKey &&
              !e.altKey
            ) {
              e.preventDefault();
              onModeChange('map');
            }
          }}
        >
          <span className="nav-icon-circle" aria-hidden="true">
            <MapIcon size={14} strokeWidth={2.2} />
          </span>
          <span>Map</span>
        </a>
      </nav>

      {onAddClick && (
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary header-add-btn"
            onClick={onAddClick}
            aria-label="Add place"
            title="Add place"
          >
            <Plus size={16} strokeWidth={2.4} />
            <span className="btn-label">Add place</span>
          </button>
        </div>
      )}
    </header>
  );
}
