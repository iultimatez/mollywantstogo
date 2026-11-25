export type PlaceCategory =
  | 'omakase'
  | 'hotpot'
  | 'dining'
  | 'cafe'
  | 'travel'
  | 'lifestyle';

export type PlaceRegion =
  | 'taipei'
  | 'taichung'
  | 'south_tw'
  | 'other_tw'
  | 'japan'
  | 'korea'
  | 'global'
  | 'other';

export type ViewMode = 'map' | 'list';

export type StatusFilter = 'all' | 'want' | 'visited';

export type SortOption =
  | 'newest'
  | 'oldest'
  | 'collection'
  | 'mostSaved'
  | 'name'
  | 'category';

export const DEFAULT_SORT_OPTION: SortOption = 'newest';

export interface SavedReel {
  url: string;
  postedAt?: string;
  savedAt?: string;
}

export interface Place {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  address?: string;
  region: PlaceRegion;
  regionLabel: string;
  category: PlaceCategory;
  rawCategory?: string;
  note: string;
  lat: number | null;
  lng: number | null;
  locationPrecision?: 'exact' | 'area' | 'none';
  visited: boolean;
  savedCount?: number;
  sourceNumbers?: number[];
  savedAt?: string;
  postedAt?: string;
  reels?: SavedReel[];
  instagramUrls?: string[];
  googleMapsUrl?: string;
  createdAt: string;
}

export interface CategoryMeta {
  id: PlaceCategory;
  label: string;
  shortLabel: string;
  color: string;
  softBg: string;
  borderColor: string;
}

export const CATEGORIES: Record<PlaceCategory, CategoryMeta> = {
  omakase: {
    id: 'omakase',
    label: '無菜單・壽司',
    shortLabel: '壽司・無菜單',
    color: '#3A6B8C',
    softBg: '#F1F6F9',
    borderColor: '#C9DCE8',
  },
  hotpot: {
    id: 'hotpot',
    label: '火鍋・燒肉・鐵板燒',
    shortLabel: '鍋物・燒肉',
    color: '#C85A4A',
    softBg: '#FBF3F2',
    borderColor: '#E9C9C4',
  },
  dining: {
    id: 'dining',
    label: '餐廳・美食',
    shortLabel: '餐廳・美食',
    color: '#B07B32',
    softBg: '#FAF6EE',
    borderColor: '#E6D6BC',
  },
  cafe: {
    id: 'cafe',
    label: '咖啡・甜點',
    shortLabel: '咖啡・甜點',
    color: '#9C516C',
    softBg: '#FAF2F5',
    borderColor: '#E4C7D2',
  },
  travel: {
    id: 'travel',
    label: '旅遊・景點',
    shortLabel: '旅遊・景點',
    color: '#2EBAAE',
    softBg: '#EEF9F8',
    borderColor: '#BBE6E2',
  },
  lifestyle: {
    id: 'lifestyle',
    label: '體驗・選物・美容',
    shortLabel: '體驗・生活',
    color: '#6C5C8E',
    softBg: '#F5F3F9',
    borderColor: '#D6CFE5',
  },
};

export const CATEGORY_LIST: CategoryMeta[] = Object.values(CATEGORIES);

export interface RegionMeta {
  id: PlaceRegion;
  label: string;
}

export const REGION_LIST: RegionMeta[] = [
  { id: 'taipei', label: '台北 Taipei' },
  { id: 'taichung', label: '台中 Taichung' },
  { id: 'other_tw', label: '桃園・新竹' },
  { id: 'south_tw', label: '台南・南部' },
  { id: 'japan', label: '日本 Japan' },
  { id: 'korea', label: '韓國 Korea' },
  { id: 'global', label: '海外 Global' },
];
