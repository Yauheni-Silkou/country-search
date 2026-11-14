export type ClassifiedError =
  | { kind: 'abort' }
  | { kind: 'timeout'; message: string }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'network'; message: string };

export function classifySearchError(error: unknown): ClassifiedError {
  void error;
  throw new Error('Not implemented');
}
