/**
 * GeoIP shim — re-exports canonical implementation from @urlfy/geoip.
 * All GeoIP logic lives in packages/geoip to avoid duplication with apps/api.
 */
export {
  type GeoLocation,
  getGeoIPReader,
  getWeeklySalt,
  lookupGeoIP
} from '@urlfy/geoip';
