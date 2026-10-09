// Lokalda backend :8000 da; serverda esa nginx /api ni backendga yo'naltiradi (nisbiy manzil).
window.API_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:8000/api"
  : "/api";
window.POLL_INTERVAL_MS = 10000;
