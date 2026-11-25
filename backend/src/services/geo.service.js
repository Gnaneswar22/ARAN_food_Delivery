/**
 * Address search + reverse geocoding behind our own API (keys never reach the browser).
 * Providers: "nominatim" (OpenStreetMap, free, ~1 req/s fair-use limit: fine for launch, switch for scale)
 *            "google"    (Geocoding API; set GOOGLE_MAPS_API_KEY and GEO_PROVIDER=google)
 */
const { ApiError, logger } = require('../utils');

const provider = () => (process.env.GEO_PROVIDER || (process.env.GOOGLE_MAPS_API_KEY ? 'google' : 'nominatim')).toLowerCase();
const NOMINATIM = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org';
const UA = `ARAN.co/1.0 (${process.env.GEO_CONTACT || 'support@aran.co'})`;

const cache = new Map(); // key -> { at, value }
const TTL = 24 * 3600e3;
const remember = (k, v) => { cache.set(k, { at: Date.now(), value: v }); if (cache.size > 500) cache.delete(cache.keys().next().value); return v; };
const recall = (k) => { const e = cache.get(k); return e && Date.now() - e.at < TTL ? e.value : null; };

let chain = Promise.resolve(); // serialises upstream calls to respect Nominatim's 1 request/second policy
const throttled = (fn) => { const run = chain.then(fn); chain = run.then(() => new Promise((r) => setTimeout(r, 1100)), () => new Promise((r) => setTimeout(r, 1100))); return run; };

const fromNominatim = (r) => {
  const a = r.address || {};
  const line1 = [a.house_number, a.road || a.pedestrian || a.neighbourhood, a.suburb].filter(Boolean).join(', ');
  return { label: r.display_name, line1: line1 || r.name || r.display_name.split(',')[0], city: a.city || a.town || a.village || a.county || a.state_district || '', pincode: (a.postcode || '').replace(/\D/g, '').slice(0, 6), lat: Number(r.lat), lng: Number(r.lon) };
};
const fromGoogle = (r) => {
  const c = (t) => r.address_components?.find((x) => x.types.includes(t))?.long_name || '';
  return { label: r.formatted_address, line1: [c('street_number'), c('route'), c('sublocality')].filter(Boolean).join(', ') || r.formatted_address.split(',')[0], city: c('locality') || c('administrative_area_level_2'), pincode: c('postal_code'), lat: r.geometry.location.lat, lng: r.geometry.location.lng };
};

async function getJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`geocoder HTTP ${res.status}`);
  return res.json();
}

async function search(q) {
  const key = `s:${q.toLowerCase()}`;
  const hit = recall(key);
  if (hit) return hit;
  try {
    if (provider() === 'google') {
      const j = await getJson(`https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams({ address: q, components: 'country:IN', key: process.env.GOOGLE_MAPS_API_KEY })}`);
      return remember(key, (j.results || []).slice(0, 5).map(fromGoogle));
    }
    const j = await throttled(() => getJson(`${NOMINATIM}/search?${new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', countrycodes: 'in', limit: '5' })}`, { 'User-Agent': UA, 'Accept-Language': 'en' }));
    return remember(key, j.map(fromNominatim));
  } catch (e) { logger.error('geo search failed', { error: e.message }); throw new ApiError(502, 'Address search is unavailable right now. Please type your address.'); }
}

async function reverse(lat, lng) {
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = recall(key);
  if (hit) return hit;
  try {
    if (provider() === 'google') {
      const j = await getJson(`https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams({ latlng: `${lat},${lng}`, key: process.env.GOOGLE_MAPS_API_KEY })}`);
      return remember(key, j.results?.[0] ? fromGoogle(j.results[0]) : { lat, lng });
    }
    const j = await throttled(() => getJson(`${NOMINATIM}/reverse?${new URLSearchParams({ lat, lon: lng, format: 'jsonv2', addressdetails: '1' })}`, { 'User-Agent': UA, 'Accept-Language': 'en' }));
    return remember(key, j.address ? fromNominatim(j) : { lat, lng });
  } catch (e) { logger.error('geo reverse failed', { error: e.message }); throw new ApiError(502, 'Could not look up this location. Please type your address.'); }
}

module.exports = { search, reverse };
