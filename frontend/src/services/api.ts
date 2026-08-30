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
  if (axios.isAxiosError<{ message?: string; detail?: string }>(error)) {
    // Two response shapes exist across this backend: most routers
    // return a custom {success, message} JSONResponse, but
    // app/api/v1/routes/auth.py raises FastAPI's own HTTPException,
    // which serializes as {detail}. Both are checked so a real,
    // specific backend message (e.g. "Invalid email or password") is
    // shown either way, rather than falling through to axios's own
    // generic "Request failed with status code 401".
    return error.response?.data?.message ?? error.response?.data?.detail ?? error.message;
  }

  return error instanceof Error ? error.message : "Unable to reach device.";
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registers a callback fired whenever any request through `api` gets
 * back a 401. Lets the auth store learn its session died mid-use
 * (expired/revoked elsewhere) without this module importing the store
 * — that would be circular (store -> authProvider -> this module).
 * Never navigates or mutates state itself; the caller decides what a
 * 401 means for it.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

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
