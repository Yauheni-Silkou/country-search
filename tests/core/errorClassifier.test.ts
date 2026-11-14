import { describe, expect, it } from 'vitest';
import { classifySearchError } from '../../src/core/errorClassifier.js';
import { HttpError } from '../../src/core/searchCountries.js';

const HTTP_STATUS_SERVER_ERROR = 500;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

describe('classifySearchError', () => {
  it('classifies DOMException with name "AbortError" as user abort without error message', () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');

    const result = classifySearchError(abortError);

    expect(result).toEqual({ kind: 'abort' });
  });

  it('classifies DOMException with name "TimeoutError" separately from AbortError', () => {
    const timeoutError = new DOMException(
      'The operation was aborted due to timeout',
      'TimeoutError'
    );

    const result = classifySearchError(timeoutError);

    expect(result).toEqual({
      kind: 'timeout',
      message: expect.any(String),
    });
    if (result.kind === 'timeout') {
      expect(result.message.trim().length).toBeGreaterThan(0);
    }
  });

  it('classifies HttpError instances preserving status code and non-empty message', () => {
    const serverError = new HttpError(HTTP_STATUS_SERVER_ERROR);
    const unavailableError = new HttpError(HTTP_STATUS_SERVICE_UNAVAILABLE, 'Service Unavailable');

    const firstResult = classifySearchError(serverError);
    const secondResult = classifySearchError(unavailableError);

    expect(firstResult).toEqual({
      kind: 'http',
      status: HTTP_STATUS_SERVER_ERROR,
      message: expect.any(String),
    });
    if (firstResult.kind === 'http') {
      expect(firstResult.message.trim().length).toBeGreaterThan(0);
    }

    expect(secondResult).toEqual({
      kind: 'http',
      status: HTTP_STATUS_SERVICE_UNAVAILABLE,
      message: expect.any(String),
    });
    if (secondResult.kind === 'http') {
      expect(secondResult.message.trim().length).toBeGreaterThan(0);
    }
  });

  it('classifies TypeError network failures, generic Error, and unknown thrown values as network errors', () => {
    const fetchTypeError = new TypeError('Failed to fetch');
    const genericError = new Error('Unexpected failure');
    const primitiveError = 'boom';

    for (const input of [fetchTypeError, genericError, primitiveError]) {
      const result = classifySearchError(input);

      expect(result).toEqual({
        kind: 'network',
        message: expect.any(String),
      });
      if (result.kind === 'network') {
        expect(result.message.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
