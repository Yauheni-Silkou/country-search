import {
  createCountrySearchController,
  type SearchState,
} from '../core/countrySearchController.js';
import type { Country } from '../core/mapCountryResponse.js';
import { createSearchHistoryManager } from '../core/searchHistory.js';
import { openCountryModal } from './countryModal.js';
import { clearContainer, createElement } from './domHelpers.js';

function createCardFlagMedia(country: Country): HTMLElement {
  if (country.flagUrl !== '') {
    return createElement('img', {
      className: 'country-card__flag',
      attrs: {
        src: country.flagUrl,
        alt: country.flagAlt,
        loading: 'lazy',
      },
    });
  }

  return createElement('div', {
    className: 'country-card__flag-placeholder',
    text: 'No flag',
    attrs: { role: 'img', 'aria-label': country.flagAlt },
  });
}

function createCountryCard(country: Country, onSelect: (country: Country) => void): HTMLElement {
  const card = createElement(
    'article',
    {
      className: 'country-card',
      attrs: {
        tabindex: '0',
        role: 'button',
        'aria-label': `View details for ${country.name}`,
      },
    },
    createElement('div', { className: 'country-card__media' }, createCardFlagMedia(country)),
    createElement(
      'div',
      { className: 'country-card__body' },
      createElement('h2', { className: 'country-card__title', text: country.name }),
      createElement(
        'ul',
        { className: 'country-card__meta' },
        createElement(
          'li',
          { className: 'country-card__meta-item' },
          createElement('span', { className: 'country-card__label', text: 'Capital: ' }),
          createElement('span', { text: country.capital })
        ),
        createElement(
          'li',
          { className: 'country-card__meta-item' },
          createElement('span', { className: 'country-card__label', text: 'Region: ' }),
          createElement('span', { text: country.region })
        ),
        createElement(
          'li',
          { className: 'country-card__meta-item' },
          createElement('span', { className: 'country-card__label', text: 'Population: ' }),
          createElement('span', { text: country.population.toLocaleString('en-US') })
        )
      )
    )
  );

  card.addEventListener('click', () => onSelect(country));
  card.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(country);
    }
  });

  return card;
}

function renderIdleState(): HTMLElement {
  return createElement(
    'div',
    { className: 'state-card state-card--idle' },
    createElement('div', {
      className: 'state-card__icon',
      text: '🌍',
      attrs: { 'aria-hidden': 'true' },
    }),
    createElement('h2', { className: 'state-card__title', text: 'Start searching' }),
    createElement('p', {
      className: 'state-card__text',
      text: 'Enter a country name to explore its details, e.g., Spain, Japan, or Germany.',
    })
  );
}

function renderLoadingState(): HTMLElement {
  return createElement(
    'div',
    {
      className: 'state-card state-card--loading',
      attrs: { role: 'status', 'aria-live': 'polite' },
    },
    createElement('div', { className: 'spinner', attrs: { 'aria-hidden': 'true' } }),
    createElement('p', { className: 'state-card__text', text: 'Loading countries...' })
  );
}

function renderEmptyState(query: string): HTMLElement {
  return createElement(
    'div',
    { className: 'state-card state-card--empty', attrs: { role: 'status' } },
    createElement('div', {
      className: 'state-card__icon',
      text: '🔍',
      attrs: { 'aria-hidden': 'true' },
    }),
    createElement('h2', { className: 'state-card__title', text: 'No countries found' }),
    createElement('p', {
      className: 'state-card__text',
      text: `No matches found for "${query}". Try a different search term.`,
    })
  );
}

function renderErrorState(message: string, onRetry: () => void): HTMLElement {
  const retryButton = createElement('button', {
    className: 'btn btn--retry',
    text: 'Retry',
    attrs: { type: 'button' },
  });
  retryButton.addEventListener('click', onRetry);

  return createElement(
    'div',
    { className: 'state-card state-card--error', attrs: { role: 'alert' } },
    createElement('h2', { className: 'state-card__title', text: 'Request failed' }),
    createElement('p', { className: 'state-card__text', text: message }),
    retryButton
  );
}

export function renderApp(root: HTMLElement = document.body): void {
  const historyManager = createSearchHistoryManager(window.localStorage);

  const searchInput = createElement('input', {
    className: 'search-box__input',
    attrs: {
      id: 'country-search-input',
      type: 'search',
      placeholder: 'Search for a country (e.g., France, Brazil)...',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });

  const historyContainer = createElement('div', {
    className: 'history-bar',
    attrs: { 'aria-label': 'Recent searches' },
  });

  const header = createElement(
    'header',
    { className: 'app-header' },
    createElement(
      'div',
      { className: 'app-header__inner' },
      createElement(
        'div',
        { className: 'app-header__brand' },
        createElement('h1', { className: 'app-header__title', text: 'Country Search' }),
        createElement('p', {
          className: 'app-header__subtitle',
          text: 'Explore countries around the world',
        })
      ),
      createElement(
        'div',
        { className: 'search-box' },
        createElement('label', {
          className: 'visually-hidden',
          text: 'Country name',
          attrs: { for: 'country-search-input' },
        }),
        searchInput
      ),
      historyContainer
    )
  );

  const mainContent = createElement('main', { className: 'app-main' });
  const appShell = createElement('div', { className: 'app-shell' }, header, mainContent);

  clearContainer(root);
  root.append(appShell);

  const renderHistoryChips = (): void => {
    clearContainer(historyContainer);
    const items = historyManager.getHistory();

    if (items.length === 0) {
      historyContainer.hidden = true;
      return;
    }

    historyContainer.hidden = false;
    historyContainer.append(
      createElement('span', { className: 'history-bar__label', text: 'Recent:' })
    );

    for (const item of items) {
      const chip = createElement('button', {
        className: 'history-chip',
        text: item,
        attrs: { type: 'button' },
      });

      chip.addEventListener('click', () => {
        searchInput.value = item;
        historyManager.addQuery(item);
        renderHistoryChips();
        controller.handleInput(item);
      });

      historyContainer.append(chip);
    }
  };

  const handleStateChange = (state: SearchState): void => {
    clearContainer(mainContent);

    switch (state.status) {
      case 'idle':
        mainContent.append(renderIdleState());
        break;

      case 'loading':
        mainContent.append(renderLoadingState());
        break;

      case 'empty':
        mainContent.append(renderEmptyState(state.query));
        break;

      case 'error':
        mainContent.append(
          renderErrorState(state.message, () => {
            controller.retry();
          })
        );
        break;

      case 'success': {
        historyManager.addQuery(state.query);
        renderHistoryChips();

        const grid = createElement('section', {
          className: 'countries-grid',
          attrs: { 'aria-label': 'Search results' },
        });

        for (const country of state.countries) {
          grid.append(
            createCountryCard(country, (selectedCountry) => {
              historyManager.addQuery(state.query);
              renderHistoryChips();
              openCountryModal(selectedCountry);
            })
          );
        }

        mainContent.append(grid);
        break;
      }
    }
  };

  const controller = createCountrySearchController(handleStateChange);

  searchInput.addEventListener('input', () => {
    controller.handleInput(searchInput.value);
  });

  renderHistoryChips();
  handleStateChange({ status: 'idle', query: '' });
}
