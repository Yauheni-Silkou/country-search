import type { Country } from '../core/mapCountryResponse.js';
import { createElement } from './domHelpers.js';

let activeModalCleanup: (() => void) | null = null;

function createFlagMedia(country: Country): HTMLElement {
  if (country.flagUrl !== '') {
    return createElement('img', {
      className: 'modal__flag',
      attrs: {
        src: country.flagUrl,
        alt: country.flagAlt,
      },
    });
  }

  return createElement('div', {
    className: 'modal__flag-placeholder',
    text: 'No flag',
    attrs: { role: 'img', 'aria-label': country.flagAlt },
  });
}

function createDetailRow(label: string, value: string): HTMLElement {
  return createElement(
    'div',
    { className: 'modal__fact' },
    createElement('dt', { className: 'modal__fact-label', text: label }),
    createElement('dd', { className: 'modal__fact-value', text: value })
  );
}

function createBordersSection(borders: readonly string[]): HTMLElement {
  const container = createElement(
    'div',
    { className: 'modal__borders' },
    createElement('h3', { className: 'modal__section-title', text: 'Border Countries' })
  );

  if (borders.length === 0) {
    container.append(
      createElement('p', {
        className: 'modal__muted-text',
        text: 'No land borders',
      })
    );
    return container;
  }

  const badgesList = createElement('div', { className: 'modal__badges' });
  for (const code of borders) {
    badgesList.append(
      createElement('span', {
        className: 'badge',
        text: code,
      })
    );
  }

  container.append(badgesList);
  return container;
}

export function openCountryModal(country: Country): void {
  if (activeModalCleanup !== null) {
    activeModalCleanup();
  }

  const previousActiveElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = createElement('div', {
    className: 'modal-overlay',
    attrs: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'country-modal-title',
    },
  });

  const closeButton = createElement('button', {
    className: 'modal__close',
    text: '✕',
    attrs: {
      type: 'button',
      'aria-label': 'Close modal',
    },
  });

  const header = createElement(
    'header',
    { className: 'modal__header' },
    createElement(
      'div',
      { className: 'modal__title-group' },
      createElement('h2', {
        className: 'modal__title',
        text: country.name,
        attrs: { id: 'country-modal-title' },
      })
    ),
    closeButton
  );

  const descriptionBlock = country.description
    ? createElement('p', {
        className: 'modal__description',
        text: country.description,
      })
    : null;

  const languagesText = country.languages.length > 0 ? country.languages.join(', ') : 'N/A';

  const currenciesText = country.currencies.length > 0 ? country.currencies.join(', ') : 'N/A';

  const factsGrid = createElement(
    'dl',
    { className: 'modal__facts-grid' },
    createDetailRow('Capital', country.capital),
    createDetailRow('Region', country.region),
    createDetailRow('Population', country.population.toLocaleString('en-US')),
    createDetailRow('Area', `${country.area.toLocaleString('en-US')} km²`),
    createDetailRow('Languages', languagesText),
    createDetailRow('Currencies', currenciesText)
  );

  const dialog = createElement(
    'article',
    { className: 'modal' },
    header,
    createElement(
      'div',
      { className: 'modal__body' },
      createElement('div', { className: 'modal__media' }, createFlagMedia(country)),
      createElement(
        'div',
        { className: 'modal__content' },
        descriptionBlock,
        factsGrid,
        createBordersSection(country.borders)
      )
    )
  );

  overlay.append(dialog);

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cleanupAndClose();
    }
  };

  const cleanupAndClose = (): void => {
    document.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
    document.body.style.overflow = '';
    if (activeModalCleanup === cleanupAndClose) {
      activeModalCleanup = null;
    }
    if (previousActiveElement !== null) {
      previousActiveElement.focus();
    }
  };

  activeModalCleanup = cleanupAndClose;

  closeButton.addEventListener('click', cleanupAndClose);
  overlay.addEventListener('click', (event: MouseEvent) => {
    if (event.target === overlay) {
      cleanupAndClose();
    }
  });
  document.addEventListener('keydown', handleKeyDown);

  document.body.style.overflow = 'hidden';
  document.body.append(overlay);
  closeButton.focus();
}
