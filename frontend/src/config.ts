// API base URL — empty string for same-origin (dev proxy), full URL for Railway
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Derived URLs
export const API_URL = `${API_BASE_URL}/api`;
export const HUB_URL = `${API_BASE_URL}/hubs/telemetry`;
