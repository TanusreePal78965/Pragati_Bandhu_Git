// ─── LEGACY: Express backend client (no longer used) ──────────────────────────
// Replaced by direct Supabase client calls in mobile/src/lib/supabase.ts
// Kept for reference. Do not import this file.
//
// import axios from "axios";
// import { getAuthToken } from "../utils/storage";
//
// const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000";
//
// const apiClient = axios.create({
//   baseURL: API_BASE,
//   timeout: 10000,
//   headers: { "Content-Type": "application/json" },
// });
//
// apiClient.interceptors.request.use(
//   async (config) => {
//     const token = await getAuthToken();
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error),
// );
//
// export default apiClient;
