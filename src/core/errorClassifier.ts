import { HttpError } from './searchCountries.js';

export type ClassifiedError =
  | { kind: 'abort' }
  | { kind: 'timeout'; message: string }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'network'; message: string };

const TIMEOUT_ERROR_MESSAGE =
  'Request timed out. The server took too long to respond. Please try again.';
const NETWORK_ERROR_MESSAGE = 'Network error. Please check your internet connection and try again.';

export function classifySearchError(error: unknown): ClassifiedError {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { kind: 'abort' };
  }

  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return {
      kind: 'timeout',
      message: TIMEOUT_ERROR_MESSAGE,
    };
  }

  if (error instanceof HttpError) {
    return {
      kind: 'http',
      status: error.status,
      message: error.message || `Server error (status ${error.status})`,
    };
  }

  return {
    kind: 'network',
    message: NETWORK_ERROR_MESSAGE,
  };
}
