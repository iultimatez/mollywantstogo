import fs from 'node:fs';
import path from 'node:path';

const positionalArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const INPUT_MD =
  positionalArgs[0] ||
  '/Users/thomas/Downloads/mollys-want-to-go-collection (1).md';
const OUTPUT_JSON = path.resolve('src/data/mollyPlaces.json');
const CACHE_JSON = path.resolve('scripts/geocode-cache.json');

const md = fs.readFileSync(INPUT_MD, 'utf8');
const detailSection = md.slice(md.indexOf('## 詳細內容'));
const blocks = detailSection.split(/\n### /).slice(1);

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
  return `single:${item.num}`;
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

  return {
    id: `molly-${primary.num}`,
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

// Load geocode cache
const cache = fs.existsSync(CACHE_JSON)
  ? JSON.parse(fs.readFileSync(CACHE_JSON, 'utf8'))
  : {};

// Verified manual overrides for addresses that needed disambiguation
const MANUAL_OVERRIDES = {
  'molly-84': {
    region: 'south_tw',
    regionLabel: '台南・南部 South TW',
    name: '橋山.鵲邸壽喜燒 (台南) & 橋山壽喜燒',
  },
  'molly-89': { lat: 35.0968, lng: 129.0315, locationPrecision: 'exact' },
  'molly-189': { lat: 25.0135, lng: 121.2149, locationPrecision: 'area' },
  'molly-201': { lat: 24.9839, lng: 121.5094, locationPrecision: 'exact' },
  'molly-107': { lat: 37.5621, lng: 126.9854, locationPrecision: 'exact' },
  'molly-207': { lat: 37.56228, lng: 126.98558, locationPrecision: 'exact' },
  'molly-28': { lat: 37.787, lng: 20.8999, locationPrecision: 'area' },
  'molly-33': { lat: 30.0444, lng: 31.2357, locationPrecision: 'area' },
  'molly-179': { lat: 6.0005, lng: 116.0125, locationPrecision: 'area' },
  'molly-243': { lat: 25.6065, lng: 100.2676, locationPrecision: 'area' },
};

const coordCounts = new Map();
const finalPlaces = mergedPlaces.map((p) => {
  const geo = cache[p.id];
  let lat = geo ? geo.lat : null;
  let lng = geo ? geo.lng : null;
  let locationPrecision = geo ? geo.precision : 'none';

  const override = MANUAL_OVERRIDES[p.id];
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
  `Wrote ${finalPlaces.length} places to ${OUTPUT_JSON} (${finalPlaces.filter((p) => p.lat !== null).length} pinned, ${withPosted} with post date, ${withSaved} with saved date).`
);
