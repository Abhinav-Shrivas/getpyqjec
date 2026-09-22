// API Configuration:
// - In production (Vercel): VITE_API_BASE_URL is set to the Render backend (e.g. https://getpyqjec.onrender.com)
// - In local LAN/mobile dev: VITE_HOST_IP is set to the local IP (e.g. 192.168.1.5)
// - Default local dev: falls back to http://localhost:8000

const envApiBase = import.meta.env.VITE_API_BASE_URL;
const hostIp = import.meta.env.VITE_HOST_IP;

function getApiBase() {
  if (envApiBase) {
    return envApiBase;
  }
  if (hostIp) {
    // If hostIp is already a full URL (e.g. https://getpyqjec.onrender.com)
    if (hostIp.startsWith("http://") || hostIp.startsWith("https://")) {
      return hostIp;
    }
    // If hostIp is just a LAN IP or hostname (e.g. 192.168.1.5)
    return `http://${hostIp}:8000`;
  }
  return "http://localhost:8000";
}

export const API_BASE = getApiBase().replace(/\/+$/, "");
