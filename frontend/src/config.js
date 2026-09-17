// API Configuration:
// - In production (Vercel): VITE_API_BASE_URL is set to the Render backend (e.g. https://getpyqjec.onrender.com)
// - In local LAN/mobile dev: VITE_HOST_IP is set to the local IP (e.g. 192.168.1.5)
// - Default local dev: falls back to http://localhost:8000

const envApiBase = import.meta.env.VITE_API_BASE_URL;
const hostIp = import.meta.env.VITE_HOST_IP;

export const API_BASE = (
  envApiBase || (hostIp ? `http://${hostIp}:8000` : "http://localhost:8000")
).replace(/\/+$/, "");
