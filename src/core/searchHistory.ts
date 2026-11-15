export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SearchHistoryManager {
  getHistory(): string[];
  addQuery(rawQuery: string): string[];
  clearHistory(): void;
}

export function createSearchHistoryManager(
  storage: KeyValueStorage,
  maxItems?: number,
  storageKey?: string
): SearchHistoryManager {
  void storage;
  void maxItems;
  void storageKey;
  throw new Error('Not implemented');
}
