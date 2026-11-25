import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const rawArgs = process.argv.slice(2);
const NO_GEOCODE = rawArgs.includes('--no-geocode');
const positionalArgs = rawArgs.filter((a) => !a.startsWith('--'));
const INPUT_MD =
  positionalArgs[0] ||
  path.resolve('src/data/mollys-want-to-go-collection.md');
const OUTPUT_JSON = path.resolve('src/data/mollyPlaces.json');
const CACHE_JSON = path.resolve('scripts/geocode-cache.json');

const ARCGIS_URL =
  'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const md = fs.readFileSync(INPUT_MD, 'utf8');
const detailSection = md.slice(md.indexOf('## 詳細內容'));
const blocks = detailSection.split(/\n### /).slice(1);

function shortHash(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 10);
}

function extractField(lines, prefix) {
  const line = lines.find((l) => l.startsWith(`- ${prefix}`));
  if (!line) return '';
  const colonIdx = line.indexOf('：');
  return colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
}

function extractLink(val) {
  const m = val.match(/\((https?:\/\/[^)]+)\)/);
  return m ? m[1] : '';
}

function extractIgShortcode(url) {
  const m = (url || '').match(
    /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i
  );
  return m ? m[1] : '';
}

function extractIsoDate(val) {
  const m = (val || '').match(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?/);
  return m ? m[0] : '';
}

function normalizeText(s) {
  return (s || '')
    .replace(/臺/g, '台')
    .replace(/[·・.。\s\-—–_()（）/｜|「」『』,，:：;；!！?？]/g, '')
    .toLowerCase();
}

function extractCoreName(name) {
  return name
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(
      /\s*[—–-]\s*(海膽|螃蟹|雲丹|king crab|uni |couple|本館|旗艦店|中山店|永康店|安和本店|華山店|市民總店|吉林總店|重慶南店|春日店|台北永康店|台中博館店|永吉店|弘大店|明洞總店).*/i,
      ''
    )
    .replace(
      /\s*(本館|旗艦店|中山店|台北永康店|安和本店|吉林總店|中山|Sushi Ichi|Sushi Ritsu|Hashiyama Sukiyaki|Ichi Sushi|Ilmi Ganjang Gejang|Zen-in Sukiyaki)$/i,
      ''
    )
    .trim();
}

function extractTwAddressKey(location) {
  if (!location) return '';
  const cleaned = location
    .replace(/臺/g, '台')
    .replace(/^\d{3,5}\s*(台灣|Taiwan)?\s*/i, '')
    .replace(
      /[一二三四五六七八九十\u4e00-\u9fff]{1,4}里(?=[一二三四五六七八九十\u4e00-\u9fff]+(路|街|大道))/g,
      ''
    );
  const m = cleaned.match(
    /(台北市|新北市|桃園市|台中市|台南市|高雄市|新竹市|新竹縣|宜蘭縣|彰化縣|嘉義市|花蓮縣)([^；;，,（(\s]+)/
  );
  if (!m) return '';
  return (m[1] + m[2]).replace(/\d+樓|\d+F|B\d|一樓|後棟/gi, '').trim();
}

// Parse all entries
const rawItems = blocks.map((b) => {
  const lines = b.trim().split('\n');
  const headMatch = lines[0].match(/^(\d+)\.\s*(.+)$/);
  const num = headMatch ? Number(headMatch[1]) : 0;
  const name = headMatch ? headMatch[2].trim() : lines[0].trim();
  const rawCategory = extractField(lines, '類別');
  const location = extractField(lines, '地點');
  const savedAt = extractIsoDate(extractField(lines, '加入日期'));
  const postedAt = extractIsoDate(extractField(lines, '貼文發布日期'));
  const highlights = extractField(lines, '重點');
  const igUrl = extractLink(extractField(lines, 'Instagram'));
  const gmUrl = extractLink(extractField(lines, 'Google Maps'));
  let gmQuery = '';
  if (gmUrl && gmUrl.includes('query=')) {
    try {
      gmQuery = decodeURIComponent(gmUrl.split('query=')[1]).replace(/\+/g, ' ');
    } catch {
      gmQuery = '';
    }
  }
  return {
    num,
    name,
    rawCategory,
    location,
    savedAt,
    postedAt,
    highlights,
    igUrl,
    gmUrl,
    gmQuery,
  };
});

// Explicit canonical name aliases for cross-language / typo duplicates
const VENUE_ALIASES = [
  { key: 'ilmi-ganjang-gejang', test: (i) => /一味醬蟹|일미간장게장|Ilmi Ganjang Gejang/i.test(i.name) },
  { key: 'sushi-ogi', test: (i) => /鮨荻/.test(i.name) },
  { key: 'xin-sushi', test: (i) => /忻鮨壽司/.test(i.name) },
  { key: 'er-ben-song', test: (i) => /二本松涮涮屋/.test(i.name) },
  { key: 'sushi-ichi', test: (i) => /鮨一\s*(Ichi|壽司|$)/i.test(i.name) && !/鮨一田/.test(i.name) },
  { key: 'gion-zenin', test: (i) => /(祇園.*禪院|禪院.*祇園)/.test(i.name) },
  { key: 'haecheonobu', test: (i) => /Haecheonobu|海天漁夫|해천어부/i.test(i.name) },
  { key: 'koichiro', test: (i) => /亘一郎|Koichiro/i.test(i.name) },
  { key: 'sushi-ritsu', test: (i) => /鮨処律|Sushi Ritsu/i.test(i.name) },
  { key: 'shell-oyster', test: (i) => /She'?ll Oyster/i.test(i.name) },
  { key: 'hashiyama-taipei', test: (i) => /橋山/.test(i.name) && !/two branches/i.test(i.name) && /瑞安街/.test(i.location) },
  { key: 'xiang-ba-lao', test: (i) => /湘八老/.test(i.name) },
  { key: 'ji-xian-guo-wu', test: (i) => /極蜆鍋物/.test(i.name) },
  { key: 'ji-he-wagyu', test: (i) => /極鶴和牛鍋物/.test(i.name) },
  { key: 'wu-he-jilin', test: (i) => /武鶴和牛火鍋.*吉林/.test(i.name) },
  { key: 'qing-jiao', test: (i) => /青嬌膠原麵館/.test(i.name) },
  { key: 'uoharu', test: (i) => /魚春\s*UOHARU/i.test(i.name) },
  { key: 'chu-hai-yongkang', test: (i) => /初海和牛鐵板燒/.test(i.name) },
  { key: 'shui-sen', test: (i) => /水森水產/.test(i.name) },
  { key: 'the-chun-zhongshan', test: (i) => /THE[·\s]?春\s*Fusion/i.test(i.name) },
  { key: 'huang-cheng-si', test: (i) => /皇城司/.test(i.name) },
  { key: 'ikki-hamayaki', test: (i) => /一氣水產/.test(i.name) },
  { key: 'yu-teppanyaki', test: (i) => /^毓鐵板燒/.test(i.name) },
  { key: 'jin-cai-zhen', test: (i) => /金彩真/.test(i.name) },
  { key: 'matsusaka-anhe', test: (i) => /松阪亭別邸/.test(i.name) },
  { key: 'cafe-marche', test: (i) => /咖啡瑪榭/.test(i.name) },
  { key: 'takeda-curry', test: (i) => /武田咖哩食堂/.test(i.name) },
  { key: 'hong-mi-zhou', test: (i) => /紅米砂鍋粥/.test(i.name) },
];

// Stable merge key independent of item numbering (immune to prepending new posts)
function getMergeKey(item) {
  for (const alias of VENUE_ALIASES) {
    if (alias.test(item)) return `alias:${alias.key}`;
  }
  const addr = extractTwAddressKey(item.location);
  const core = normalizeText(extractCoreName(item.name));
  if (addr && core.length >= 2) {
    return `addr:${addr}::${core.slice(0, 6)}`;
  }
  if (item.gmQuery) {
    return `gm:${normalizeText(item.gmQuery)}`;
  }
  const igCode = extractIgShortcode(item.igUrl);
  if (igCode) {
    return `ig:${igCode}`;
  }
  return `name:${normalizeText(item.name).slice(0, 32)}`;
}

function classifyCategory(rawCat, name, highlights) {
  if (/涮涮|火鍋|鍋物|壽喜燒|燒肉|鐵板燒/.test(name)) {
    return 'hotpot';
  }
  const text = `${rawCat} ${name} ${highlights}`;
  if (
    /無菜單|壽司|鮨|割烹|生魚片|刺身|omakase|sushi|海鮮丼|手捲/i.test(text) &&
    !/咖啡|麵包|甜/.test(rawCat)
  ) {
    return 'omakase';
  }
  if (
    /火鍋|涮涮|壽喜燒|燒肉|烤肉|鐵板燒|燒烤|鍋物|teppanyaki|yakiniku|sukiyaki/i.test(
      text
    )
  ) {
    return 'hotpot';
  }
  if (
    /咖啡|甜點|麵包|可頌|茶|仙草|bakery|cafe|coffee|甜/i.test(rawCat) ||
    /咖啡廳|甜點|cafe/i.test(name)
  ) {
    return 'cafe';
  }
  if (
    /旅遊|景點|住宿|行程|飯店|民宿|遊船|市集|自然|風景|小島|廟宇/i.test(
      rawCat
    )
  ) {
    return 'travel';
  }
  if (
    /美容|美妝|SPA|商店|體驗|珠寶|選物|藥妝|展覽|心靈|迷因|電影|藝術|對談|零食/i.test(
      rawCat
    )
  ) {
    return 'lifestyle';
  }
  return 'dining';
}

function classifyRegion(location, name, gmQuery) {
  const text = `${location} ${name} ${gmQuery}`;
  if (
    /台北|臺北|新北|板橋|永和|中和|三重|淡水|新莊|林口|萬華|大安區|中山區|信義區|松山區|中正區|大同區|文山區|士林|內湖|Taipei/i.test(
      text
    )
  ) {
    return { region: 'taipei', regionLabel: '台北 Taipei' };
  }
  if (/台中|臺中|Taichung/i.test(text)) {
    return { region: 'taichung', regionLabel: '台中 Taichung' };
  }
  if (/台南|臺南|高雄|嘉義|屏東|Tainan|Kaohsiung/i.test(text)) {
    return { region: 'south_tw', regionLabel: '台南・南部 South TW' };
  }
  if (
    /桃園|新竹|竹北|中壢|龜山|蘆竹|彰化|宜蘭|花蓮|Taoyuan|Hsinchu/i.test(text)
  ) {
    return { region: 'other_tw', regionLabel: '桃園・新竹・其他台灣' };
  }
  if (
    /東京|大阪|京都|奈良|北海道|日本|銀座|表參道|青山|北新地|飯田橋|人形町|築地|伊勢|Tokyo|Osaka|Kyoto|Japan/i.test(
      text
    )
  ) {
    return { region: 'japan', regionLabel: '日本 Japan' };
  }
  if (
    /首爾|釜山|大邱|韓國|弘大|明洞|江南|서울|대구|부산|Seoul|Busan|Daegu|Korea/i.test(
      text
    )
  ) {
    return { region: 'korea', regionLabel: '韓國 Korea' };
  }
  if (
    /紐約|美國|挪威|法國|巴黎|希臘|蒙特內哥羅|埃及|菲律賓|馬來西亞|深圳|廣州|大連|雲南|中國|New York|Norway|Paris|Greece|Montenegro|Philippines|Malaysia|Balakong|Cheras/i.test(
      text
    )
  ) {
    return { region: 'global', regionLabel: '海外其他 Global' };
  }
  return { region: 'other', regionLabel: '未標註地區 Unspecified' };
}

function extractDisplayLocation(location) {
  if (!location || /^—|^貼文|^原文|^帖子/.test(location)) {
    return { neighborhood: '地點未詳', city: '' };
  }
  const clean = location
    .replace(/（僅提及[^）]*）/g, '')
    .replace(/（貼文[^）]*）/g, '')
    .replace(/（原文[^）]*）/g, '')
    .replace(/（未提供[^）]*）/g, '')
    .replace(/（未提及[^）]*）/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = clean
    .split(/[；;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    neighborhood: parts[0] || clean,
    city: parts[1] || '',
  };
}

// Stable manual overrides (matched by venue name/address rather than item number)
const MANUAL_OVERRIDES = [
  {
    test: (p) => /橋山/.test(p.name) && /台南/.test(p.address),
    override: {
      region: 'south_tw',
      regionLabel: '台南・南部 South TW',
      name: '橋山.鵲邸壽喜燒 (台南) & 橋山壽喜燒',
    },
  },
  {
    test: (p) => /新東亞水産物|Shin Dong-A/i.test(p.name),
    override: { lat: 35.0968, lng: 129.0315, locationPrecision: 'exact' },
  },
  {
    test: (p) => /Shock燒肉/i.test(p.name),
    override: { lat: 25.0135, lng: 121.2149, locationPrecision: 'area' },
  },
  {
    test: (p) => /中和緬甸街|華新街/.test(`${p.name} ${p.address}`),
    override: { lat: 24.9839, lng: 121.5094, locationPrecision: 'exact' },
  },
  {
    test: (p) => /水剌醬蟹|Sura Ganjang/i.test(p.name),
    override: { lat: 37.5621, lng: 126.9854, locationPrecision: 'exact' },
  },
  {
    test: (p) => /一片里脊|Ilpyeon Deungsim/i.test(p.name),
    override: { lat: 37.56228, lng: 126.98558, locationPrecision: 'exact' },
  },
  {
    test: (p) => /Zakynthos|札金索斯/i.test(`${p.name} ${p.address}`),
    override: { lat: 37.787, lng: 20.8999, locationPrecision: 'area' },
  },
  {
    test: (p) =>
      /Egypt|埃及/i.test(`${p.name} ${p.address}`) &&
      /行程|itinerary/i.test(`${p.name} ${p.rawCategory}`),
    override: { lat: 30.0444, lng: 31.2357, locationPrecision: 'area' },
  },
  {
    test: (p) => /亞庇/.test(`${p.name} ${p.address}`),
    override: { lat: 6.0005, lng: 116.0125, locationPrecision: 'area' },
  },
  {
    test: (p) => /雲南/.test(`${p.name} ${p.address}`),
    override: { lat: 25.6065, lng: 100.2676, locationPrecision: 'area' },
  },
];

function getManualOverride(place) {
  for (const entry of MANUAL_OVERRIDES) {
    if (entry.test(place)) return entry.override;
  }
  return undefined;
}

// --- Geocoding helpers (ArcGIS primary + Nominatim fallback) ---

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanAddressForGeocode(addr) {
  if (!addr) return '';
  let s = addr
    .split(/[；;]/)[0]
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^\d{3,5}\s*(?=[臺台])/, '')
    .replace(/^〒\d{3}-\d{4}\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip trailing floor info that sometimes confuses geocoders
  s = s.replace(/\s*(\d+\s*[樓層F]|B\d+|一樓|二樓|三樓|後棟)$/i, '').trim();
  return s;
}

function shouldAttemptGeocode(place) {
  if (place.isNonPlace) return false;
  const addr = (place.address || '').trim();
  const hasGm = Boolean(place.googleMapsUrl && place.gmQuery);
  if (!addr && !hasGm) return false;
  if (/^—|^貼文未提及|^貼文中未提及|^帖子中未提及|^原文未說明|^未提及/.test(addr) && !hasGm) {
    return false;
  }
  if (/未提供具體|未提及確切|確切站點如下|僅來自標籤；未提及地址/.test(addr) && !hasGm) {
    return false;
  }
  return true;
}

function buildGeocodeQueries(place) {
  const queries = [];
  const pushUnique = (q) => {
    const trimmed = (q || '').trim();
    if (trimmed.length >= 2 && !queries.includes(trimmed)) {
      queries.push(trimmed);
    }
  };

  const cleanedAddr = cleanAddressForGeocode(place.address);
  if (cleanedAddr && !/^—|^貼文|^帖子|^原文|^未提及/.test(cleanedAddr)) {
    pushUnique(cleanedAddr);
  }

  if (place.gmQuery) {
    // Often formatted as "Venue Name, Street Address" -> try street address part first, then full query
    const commaIdx = place.gmQuery.indexOf(',');
    if (commaIdx > 0) {
      const afterComma = cleanAddressForGeocode(place.gmQuery.slice(commaIdx + 1));
      if (afterComma.length >= 4) pushUnique(afterComma);
    }
    pushUnique(place.gmQuery);
  }

  return queries;
}

function expectedCountriesForRegion(region) {
  if (['taipei', 'taichung', 'south_tw', 'other_tw'].includes(region)) {
    return { arcgis: ['TWN'], nominatim: ['tw'] };
  }
  if (region === 'japan') return { arcgis: ['JPN'], nominatim: ['jp'] };
  if (region === 'korea') return { arcgis: ['KOR'], nominatim: ['kr'] };
  return null;
}

const EXACT_ADDR_TYPES = new Set([
  'PointAddress',
  'Subaddress',
  'StreetAddress',
  'StreetAddressExt',
  'StreetInt',
  'POI',
  'BuildingName',
]);

async function geocodeWithArcGIS(query, region) {
  const params = new URLSearchParams({
    f: 'json',
    singleLine: query,
    maxLocations: '3',
    outFields: 'Match_addr,Addr_type,Country',
  });
  const res = await fetch(`${ARCGIS_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const expected = expectedCountriesForRegion(region);

  for (const c of candidates) {
    if (!c?.location || typeof c.location.y !== 'number' || typeof c.location.x !== 'number') {
      continue;
    }
    if ((c.score ?? 0) < 75) continue;
    const country = c.attributes?.Country;
    if (expected && country && !expected.arcgis.includes(country)) {
      continue;
    }
    const addrType = c.attributes?.Addr_type || '';
    const hasStreetNum = /[號号]|\b\d{1,4}\b/.test(query);
    const precision =
      EXACT_ADDR_TYPES.has(addrType) || (c.score >= 90 && hasStreetNum)
        ? 'exact'
        : 'area';
    return {
      lat: Number(c.location.y.toFixed(6)),
      lng: Number(c.location.x.toFixed(6)),
      score: Number((c.score ?? 0).toFixed(2)),
      matched: c.attributes?.Match_addr || c.address || '',
      source: 'arcgis',
      precision,
      queryUsed: query,
    };
  }
  return null;
}

let lastNominatimAt = 0;
async function geocodeWithNominatim(query, region) {
  const wait = Math.max(0, 1100 - (Date.now() - lastNominatimAt));
  if (wait > 0) await sleep(wait);
  lastNominatimAt = Date.now();

  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: '2',
    q: query,
  });
  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'molly-wants-to-go-builder/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) return null;
  const expected = expectedCountriesForRegion(region);

  for (const r of results) {
    const cc = r.address?.country_code?.toLowerCase();
    if (expected && cc && !expected.nominatim.includes(cc)) {
      continue;
    }
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const hasStreetNum = /[號号]|\b\d{1,4}\b/.test(query);
    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      score: 85,
      matched: r.display_name || '',
      source: 'nominatim',
      precision: hasStreetNum ? 'exact' : 'area',
      queryUsed: query,
    };
  }
  return null;
}

async function geocodePlace(place) {
  const queries = buildGeocodeQueries(place);
  for (const q of queries) {
    try {
      const hit = await geocodeWithArcGIS(q, place.region);
      if (hit) return hit;
    } catch (err) {
      console.warn(`ArcGIS geocode failed for "${place.name}" (${q}): ${err.message}`);
    }
  }
  for (const q of queries) {
    try {
      const hit = await geocodeWithNominatim(q, place.region);
      if (hit) return hit;
    } catch (err) {
      console.warn(`Nominatim geocode failed for "${place.name}" (${q}): ${err.message}`);
    }
  }
  return null;
}

// Merge duplicates
const mergedMap = new Map();
for (const item of rawItems) {
  const key = getMergeKey(item);
  if (!mergedMap.has(key)) {
    mergedMap.set(key, { key, items: [item] });
  } else {
    mergedMap.get(key).items.push(item);
  }
}

const mergedPlaces = Array.from(mergedMap.values()).map(({ key, items }) => {
  const primary =
    items.find(
      (i) => i.gmUrl && /[號号]|Chome|gil|丁目|dong|Rd|Street/i.test(i.location)
    ) ||
    items.find((i) => i.gmUrl) ||
    items[0];

  const cleanName =
    items
      .map((i) => i.name)
      .sort((a, b) => {
        const aInf = /inferred|推測/.test(a) ? 1 : 0;
        const bInf = /inferred|推測/.test(b) ? 1 : 0;
        if (aInf !== bInf) return aInf - bInf;
        return a.length - b.length;
      })[0] || primary.name;

  const uniqueNotes = [];
  for (const it of items) {
    if (it.highlights && !uniqueNotes.includes(it.highlights)) {
      uniqueNotes.push(it.highlights);
    }
  }

  const reels = [];
  const seenUrls = new Set();
  for (const it of items) {
    if (it.igUrl && !seenUrls.has(it.igUrl)) {
      seenUrls.add(it.igUrl);
      reels.push({
        url: it.igUrl,
        postedAt: it.postedAt ? it.postedAt.slice(0, 10) : undefined,
        savedAt: it.savedAt || undefined,
      });
    }
  }

  // Latest saved date and latest post date across merged items
  const savedDates = items
    .map((i) => i.savedAt)
    .filter(Boolean)
    .sort()
    .reverse();
  const postDates = items
    .map((i) => i.postedAt)
    .filter(Boolean)
    .sort()
    .reverse();

  const { region, regionLabel } = classifyRegion(
    primary.location,
    cleanName,
    primary.gmQuery
  );
  const category = classifyCategory(
    primary.rawCategory,
    cleanName,
    uniqueNotes.join(' ')
  );
  const { neighborhood, city } = extractDisplayLocation(primary.location);

  const isNonPlace =
    /非地點|迷因|電影評論|繪畫短片|美食對談|零食/.test(primary.rawCategory) ||
    /^—（非地點）/.test(primary.location) ||
    (!primary.gmUrl &&
      /^(貼文|原文|帖子|未提及|—)/.test(primary.location) &&
      region === 'other');

  const igEntries = items
    .map((it) => ({
      code: extractIgShortcode(it.igUrl),
      postedAt: it.postedAt ? it.postedAt.slice(0, 10) : '9999-99-99',
    }))
    .filter((e) => e.code);
  igEntries.sort(
    (a, b) => a.postedAt.localeCompare(b.postedAt) || a.code.localeCompare(b.code)
  );
  const igIds = Array.from(new Set(igEntries.map((e) => e.code)));
  const baseId = igIds[0] || `noig-${shortHash(key)}`;

  return {
    id: baseId,
    igIds,
    mergeKey: key,
    sourceNumbers: items.map((i) => i.num).sort((a, b) => a - b),
    savedCount: items.length,
    name: cleanName,
    rawCategory: primary.rawCategory,
    category,
    region,
    regionLabel,
    address: primary.location,
    neighborhood,
    city,
    note: uniqueNotes.join('\n\n'),
    savedAt: savedDates[0] || undefined,
    postedAt: postDates[0] ? postDates[0].slice(0, 10) : undefined,
    reels,
    instagramUrls: reels.map((r) => r.url),
    googleMapsUrl: primary.gmUrl || undefined,
    gmQuery: primary.gmQuery,
    isNonPlace,
  };
});

// Disambiguate rare cases where two distinct places share the exact same IG shortcode
const placesByBaseId = new Map();
for (const p of mergedPlaces) {
  if (!placesByBaseId.has(p.id)) placesByBaseId.set(p.id, []);
  placesByBaseId.get(p.id).push(p);
}
for (const [baseId, group] of placesByBaseId.entries()) {
  if (group.length <= 1) continue;
  group.sort((a, b) => a.mergeKey.localeCompare(b.mergeKey));
  for (let i = 1; i < group.length; i++) {
    group[i].id = `${baseId}-${shortHash(group[i].mergeKey).slice(0, 4)}`;
  }
}

async function main() {
  // Load geocode cache keyed by IG ID (also migrates prior mergeKey-keyed cache entries)
  const rawCache = fs.existsSync(CACHE_JSON)
    ? JSON.parse(fs.readFileSync(CACHE_JSON, 'utf8'))
    : {};

  const cache = {};
  let cacheDirty = false;
  const activeIds = new Set(mergedPlaces.map((p) => p.id));

  // Keep existing IG-ID-keyed entries (not old mergeKey or molly-N formats)
  const isLegacyKey = (k) =>
    /^(molly-\d+|alias:|addr:|gm:|ig:|name:)/.test(k);
  for (const [k, v] of Object.entries(rawCache)) {
    if (!isLegacyKey(k)) {
      cache[k] = v;
    } else {
      cacheDirty = true;
    }
  }

  // Migrate or resolve cached coordinates onto each place's canonical IG ID
  for (const p of mergedPlaces) {
    if (cache[p.id]) continue;
    // Check if any alternate IG ID in this merged place already has a cache entry
    const altIgHit = p.igIds.find((code) => cache[code] && !activeIds.has(code));
    if (altIgHit) {
      cache[p.id] = cache[altIgHit];
      cacheDirty = true;
      continue;
    }
    if (rawCache[p.mergeKey]) {
      cache[p.id] = rawCache[p.mergeKey];
      cacheDirty = true;
    }
  }

  // Geocode any cache misses (e.g., newly added places pushed by Meta Muse)
  let newlyGeocoded = 0;
  if (!NO_GEOCODE) {
    const misses = mergedPlaces.filter((p) => {
      const override = getManualOverride(p);
      if (override?.lat !== undefined && override?.lng !== undefined) return false;
      if (cache[p.id]) return false;
      return shouldAttemptGeocode(p);
    });

    if (misses.length > 0) {
      console.log(`Geocoding ${misses.length} new place(s) via ArcGIS/Nominatim...`);
      for (const p of misses) {
        const result = await geocodePlace(p);
        if (result) {
          cache[p.id] = result;
          cacheDirty = true;
          newlyGeocoded++;
          console.log(
            `  ✓ ${p.name} -> (${result.lat}, ${result.lng}) [${result.source}, ${result.precision}]`
          );
        } else {
          console.log(`  – ${p.name}: no geocode match`);
        }
        await sleep(100);
      }
    }
  }

  if (cacheDirty) {
    fs.writeFileSync(CACHE_JSON, JSON.stringify(cache, null, 2) + '\n');
  }

  const coordCounts = new Map();
  const finalPlaces = mergedPlaces.map((p) => {
    const geo = cache[p.id];
    let lat = geo ? geo.lat : null;
    let lng = geo ? geo.lng : null;
    let locationPrecision = geo ? geo.precision : 'none';

    const override = getManualOverride(p);
    if (override?.lat !== undefined && override?.lng !== undefined) {
      lat = override.lat;
      lng = override.lng;
      locationPrecision = override.locationPrecision || 'exact';
    }

    if (lat !== null && lng !== null) {
      const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const count = coordCounts.get(coordKey) || 0;
      if (count > 0) {
        const angle = count * 2.39996;
        const radius = 0.00022 * Math.ceil(count / 4);
        lat = Number((lat + Math.cos(angle) * radius).toFixed(6));
        lng = Number((lng + Math.sin(angle) * radius).toFixed(6));
      }
      coordCounts.set(coordKey, count + 1);
    }

    return {
      id: p.id,
      name: override?.name || p.name,
      neighborhood: p.neighborhood,
      city: p.city || override?.regionLabel || p.regionLabel,
      address: p.address,
      region: override?.region || p.region,
      regionLabel: override?.regionLabel || p.regionLabel,
      category: p.category,
      rawCategory: p.rawCategory,
      note: p.note,
      lat,
      lng,
      locationPrecision,
      visited: false,
      savedCount: p.savedCount,
      sourceNumbers: p.sourceNumbers,
      savedAt: p.savedAt,
      postedAt: p.postedAt,
      reels: p.reels,
      instagramUrls: p.instagramUrls,
      googleMapsUrl: p.googleMapsUrl,
      createdAt: p.postedAt
        ? new Date(`${p.postedAt}T00:00:00Z`).toISOString()
        : new Date(Date.UTC(2026, 10, 23) - p.sourceNumbers[0] * 3600 * 1000).toISOString(),
    };
  });

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(finalPlaces, null, 2));
  const withPosted = finalPlaces.filter((p) => p.postedAt).length;
  const withSaved = finalPlaces.filter((p) => p.savedAt).length;
  console.log(
    `Wrote ${finalPlaces.length} places to ${OUTPUT_JSON} (${finalPlaces.filter((p) => p.lat !== null).length} pinned, ${newlyGeocoded} newly geocoded, ${withPosted} with post date, ${withSaved} with saved date).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
