/**
 * API Configuration
 * 
 * The API base URL is determined by:
 * 1. Runtime config from window.__RUNTIME_CONFIG__ (set by index.html loading config.json)
 * 2. Fallback: same hostname as frontend on port 8000
 * 
 * To change the server IP without rebuilding:
 * - Edit public/config.json and update apiBaseUrl
 */

// Get API base URL - checks runtime config or uses smart fallback
function getApiBaseUrl() {
  // Check for runtime config (loaded by index.html)
  if (window.__RUNTIME_CONFIG__?.apiBaseUrl) {
    return window.__RUNTIME_CONFIG__.apiBaseUrl;
  }
  // Fallback: same host, port 8000
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

// Export the base URL (computed once when module loads, but getter ensures freshness)
export const API_BASE = getApiBaseUrl();

// Endpoint-specific URLs
export const API_URL = API_BASE + '/api';
export const API_MEDICATION = API_BASE + '/api/medication';
export const API_VAP = API_BASE + '/api/vap';
export const API_CLABSI = API_BASE + '/api/clabsi';
export const API_CAUTI = API_BASE + '/api/cauti';

export default {
  API_BASE,
  API_URL,
  API_MEDICATION,
  API_VAP,
  API_CLABSI,
  API_CAUTI,
  getApiBaseUrl
};
