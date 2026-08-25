import axios, { type AxiosInstance } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL;
if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_URL is not set. Configure it in the environment before starting the app."
  );
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

export function getApiUrl(path: string): string {
  return api.getUri({ url: path });
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? error.message;
  }

  return error instanceof Error ? error.message : "Unable to reach device.";
}
