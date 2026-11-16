export interface ElementOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
}

export type ChildNodeInput = HTMLElement | Text | string | null | undefined | false;

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: ElementOptions,
  ...children: ChildNodeInput[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (options?.className) {
    element.className = options.className;
  }

  if (options?.text !== undefined) {
    element.textContent = options.text;
  }

  if (options?.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      element.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) {
      element.append(child);
    }
  }

  return element;
}

export function clearContainer(container: HTMLElement): void {
  container.replaceChildren();
}
