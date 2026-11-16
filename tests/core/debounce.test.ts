import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../../src/core/debounce.js';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not invoke fn before the delay has elapsed', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(299);

    expect(fn).toHaveBeenCalledTimes(0);
  });

  it('invokes fn exactly once after the delay has elapsed', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(299);
    expect(fn).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on consecutive calls and forwards only the last arguments', () => {
    const fn = vi.fn<(query: string) => void>();
    const debounced = debounce(fn, 300);

    debounced('s');
    vi.advanceTimersByTime(100);

    debounced('sp');
    vi.advanceTimersByTime(100);

    debounced('spain');
    vi.advanceTimersByTime(299);
    expect(fn).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('spain');
  });

  it('keeps timers independent across multiple debounced instances', () => {
    const firstFn = vi.fn<(value: string) => void>();
    const secondFn = vi.fn<(value: string) => void>();

    const firstDebounced = debounce(firstFn, 200);
    const secondDebounced = debounce(secondFn, 400);

    firstDebounced('first');
    secondDebounced('second');

    vi.advanceTimersByTime(200);
    expect(firstFn).toHaveBeenCalledTimes(1);
    expect(firstFn).toHaveBeenCalledWith('first');
    expect(secondFn).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(200);
    expect(secondFn).toHaveBeenCalledTimes(1);
    expect(secondFn).toHaveBeenCalledWith('second');
  });
});
