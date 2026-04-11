import axios from "axios";
import { getAuthToken } from "../utils/storage";

// Android emulator: 10.0.2.2 resolves to host machine localhost (where backend runs).
// Physical device or production: set EXPO_PUBLIC_API_URL in .env.local to the Railway URL or ngrok tunnel.
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000";

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Attach stored JWT to every request automatically
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export default apiClient;
