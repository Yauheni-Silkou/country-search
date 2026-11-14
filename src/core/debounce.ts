export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): (...args: Args) => void {
  void fn;
  void delay;
  throw new Error('Not implemented');
}
