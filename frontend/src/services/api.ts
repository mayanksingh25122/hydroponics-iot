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
  // Required for the browser to send/receive the backend's httpOnly
  // verda_session cookie on cross-origin requests (frontend and backend
  // run on different ports/origins even in local dev). Backend CORS
  // already sets allow_credentials=True with an explicit origin list
  // (never "*") to match — see backend/app/main.py.
  withCredentials: true,
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

/**
 * Error text for a background poll (e.g. command-status tracking), as
 * opposed to a user-initiated request. When the backend actually
 * responded (401, 404, ...) its own message is trustworthy and
 * specific, so it's shown as-is via getApiErrorMessage — same as any
 * other request. When there was no response at all (network drop,
 * timeout), the raw axios/browser message ("Network Error") is not
 * fit for a background status line, so it's replaced with one honest,
 * generic sentence instead.
 */
export function describePollError(error: unknown): string {
  if (axios.isAxiosError(error) && error.response) {
    return getApiErrorMessage(error);
  }
  return "Command status is temporarily unavailable.";
}
