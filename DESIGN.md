# Архитектурные решения и проектирование (DESIGN.md)

## 1. Механизм отмены устаревших запросов (`AbortController`)

### Как устроено решение в проекте

При живом поиске с автодополнением возникает классическая гонка запросов (race condition): ответ на более ранний и короткий запрос (например, `sp`) может прийти позже ответа на более поздний запрос (`spain`) и перезаписать актуальные данные на экране устаревшими.

В проекте эта проблема решается на уровне сетевого и управляющего слоёв через связку `AbortController` и `AbortSignal`:

1. **Немедленная отмена при каждом изменении ввода:** В `src/core/countrySearchController.ts` (функция `handleInput`) при каждом новом символе или очистке поля сразу вызывается `cancelActiveRequest()`, который выполняет `currentController.abort()`. Отмена происходит **до** запуска нового таймера `debounce`, а не в момент отправки следующего запроса.
2. **Одноразовые контроллеры:** Для каждого нового сетевого поиска в `executeSearch` создаётся новый экземпляр `new AbortController()`, так как уже прерванный `AbortSignal` остаётся в состоянии `aborted === true` навсегда.
3. **Композиция сигналов отмены и таймаута:** В `src/core/searchCountries.ts` (`searchCountries`) внешний сигнал отмены от ввода объединяется с таймером таймаута через `AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])`.
4. **Разделение отмены и реальных ошибок:** В `src/core/errorClassifier.ts` (`classifySearchError`) исключение `DOMException` с `name === 'AbortError'` классифицируется как `{ kind: 'abort' }` и тихо игнорируется контроллером (`src/core/countrySearchController.ts`), тогда как `DOMException` с `name === 'TimeoutError'`, ошибки `HttpError` и сетевые сбои `TypeError` переводят интерфейс в состояние `error` с кнопкой повтора.

### Почему выбран `AbortController`, а не булев флаг актуальности

Альтернативный подход с проверкой флага или счётчика (например, `if (requestId === latestRequestId) render(data)`) лишь **маскирует** проблему на уровне UI, но не решает её на уровне сети:

- **Экономия сетевого трафика и ресурсов браузера:** Флаг позволяет отменить отрисовку, но браузер продолжает скачивать тело устаревшего ответа, удерживать сетевой сокет и тратить процессорное время на парсинг ненужного JSON (`response.json()`). Вызов `AbortController.abort()` прерывает сам HTTP-запрос на уровне сетевого стека браузера (в DevTools Network такие запросы помечаются как `canceled`).
- **Детерминированный жизненный цикл:** Композиция через `AbortSignal.any` позволяет единым стандартным механизмом управлять и пользовательской отменой, и таймаутом запроса без дублирования флажков и ручных таймеров очистки.

---

## 2. Обоснование выбранной задержки `debounce` (300 мс)

В модуле `src/core/constants.ts` задана константа `DEBOUNCE_DELAY_MS = 300`, используемая в `src/core/debounce.ts` и `src/core/countrySearchController.ts`.

### Сравнение сценариев при разных значениях задержки:

- **Без `debounce` или слишком малая задержка (`0–50 мс`):**
  - Каждый символ при вводе слова из 6–8 букв инициирует отдельный HTTP-запрос и немедленную отмену предыдущего.
  - Это создаёт паразитную нагрузку на внешний API (`countries.dev`), вызывает постоянное мелькание индикатора загрузки в интерфейсе и расходует сетевые ресурсы впустую.
- **Слишком большая задержка (`1000+ мс`):**
  - После окончания набора текста пользователь вынужден ждать более секунды до появления индикатора загрузки и первых результатов.
  - Поиск перестаёт восприниматься как «живой», интерфейс кажется заторможенным и неотзывчивым.
- **Выбранное значение (`300 мс`):**
  - Соответствует естественной паузе между нажатиями клавиш при среднем темпе печати (около 200–300 знаков в минуту).
  - Пока пользователь непрерывно печатает слово, таймер сбрасывается без единого сетевого запроса; как только пользователь делает короткую паузу в конце слова или слога, запрос отправляется практически незаметно для восприятия, обеспечивая баланс между отзывчивостью UI и экономией запросов.

---

## 3. Анализ алгоритмической сложности (Big O)

### Маппинг ответа API — `mapCountryResponse` (`src/core/mapCountryResponse.ts`)

- **Временная сложность — $O(K)$ для одной страны и $O(N \cdot K)$ для массива из $N$ стран**, где $K$ — суммарное количество элементов во вложенных списках конкретной страны (`languages`, `currencies`, `borders`).
  - Внутри `mapCountryResponse` выполняются линейные проходы по массивам `languages` (`normalizeLanguages`), `currencies` (`normalizeCurrencies`) и поверхностное копирование `borders`.
  - При обработке всего ответа API (`data.map(mapCountryResponse)` в `src/core/searchCountries.ts`) каждая из $N$ стран обрабатывается ровно один раз.
- **Пространственная сложность — $O(N \cdot K)$:**
  - Функция является чистой и создаёт новый нормализованный объект `Country` и новые массивы строк для каждой страны без мутации исходного ответа.

### Кэш и дедупликация запросов — `createCachedCountrySearch` (`src/core/cachedCountrySearch.ts`)

- **Поиск и запись в кэш (`cache: Map<string, Country[]>`) — $O(1)$ в среднем по времени:**
  - Ключ нормализуется (`query.trim().toLowerCase()`), после чего проверка `cache.get(key)` и сохранение `cache.set(key, ...)` выполняются за константное время хеш-таблицы (в отличие от линейного поиска $O(M)$ при хранении кэша в массиве).
  - При чтении и записи выполняется копирование ссылки верхнего уровня `[...countries]` за $O(N)$, где $N$ — число найденных стран по данному запросу (защита кэша от внешней мутации).
- **Дедупликация одновременных запросов (`inFlight: Map<string, InFlightEntry>`) — $O(1)$ по времени:**
  - Поиск активного запроса `inFlight.get(key)`, регистрация и удаление выполняются за $O(1)$.
  - Каждый вызывающий оборачивается в индивидуальную подписку на свой `AbortSignal` со счётчиком `subscribers`: отмена одного подписчика выполняется за $O(1)$ и отклоняет только его промис, прерывая общий сетевой запрос лишь при `subscribers <= 0`.
- **Пространственная сложность кэша — $O(U \cdot N)$**, где $U$ — количество уникальных нормализованных поисковых запросов в сессии.

### История последних запросов — `createSearchHistoryManager` (`src/core/searchHistory.ts`)

- **Временная сложность `addQuery` и `getHistory` — $O(H)$**, где $H \le 10$ ограничено константой `MAX_SEARCH_HISTORY_ITEMS = 10`.
  - Так как размер истории жёстко ограничен небольшой константой ($H \le 10$), фильтрация дубликатов (`filter`) и сериализация в JSON выполняются за константное с практической точки зрения время $O(1)$.

---

## 4. Принципы чистого кода и их применение

1. **Принцип единственной ответственности (SRP — Single Responsibility Principle):**
   - **Изоляция `Core` от `UI`:** Вся бизнес-логика вынесена в директорию `src/core/` и не зависит от `window`, `document` и DOM-элементов (что проверяется правилом `no-restricted-globals` в `eslint.config.js` и покрывается юнит-тестами в среде Node/Vitest).
   - **Разделение модулей:**
     - `src/core/debounce.ts` (`debounce`) отвечает исключительно за отложенный вызов и сброс таймера.
     - `src/core/mapCountryResponse.ts` (`mapCountryResponse`, `normalizeName`, `normalizeLanguages`, `normalizeCurrencies`) отвечает только за нормализацию сырых данных API.
     - `src/core/searchCountries.ts` (`searchCountries`, `HttpError`) отвечает только за выполнение HTTP-запроса, обработку статуса `404` и проверку `response.ok`.
     - `src/core/errorClassifier.ts` (`classifySearchError`) отвечает только за разделение ошибок (`AbortError`, `TimeoutError`, `HttpError`, сетевые сбои).
     - `src/ui/domHelpers.ts`, `src/ui/countryModal.ts`, `src/ui/renderApp.ts` отвечают исключительно за декларативное построение и обновление DOM.

2. **Принцип не повторяйся (DRY) и устранение «магических чисел/строк»:**
   - Все базовые URL, пути эндпоинтов, таймауты, задержки и ключи хранилища вынесены в единый источник истины — `src/core/constants.ts` (`API_BASE_URL`, `SEARCH_BY_NAME_PATH`, `DEBOUNCE_DELAY_MS`, `REQUEST_TIMEOUT_MS`, `HTTP_STATUS_NOT_FOUND`, `SEARCH_HISTORY_STORAGE_KEY`, `MAX_SEARCH_HISTORY_ITEMS`, `buildCountrySearchUrl`).
   - Повторяющееся создание DOM-узлов и установка атрибутов инкапсулированы в хелперах `createElement` и `clearContainer` (`src/ui/domHelpers.ts`).

3. **Принцип инверсии зависимостей (DIP) и внедрение зависимостей (Dependency Injection):**
   - `createSearchHistoryManager` (`src/core/searchHistory.ts`) зависит от минимальной абстракции `KeyValueStorage`, а не от браузерного `window.localStorage` напрямую — в продакшене (`src/ui/renderApp.ts`) передаётся `window.localStorage`, а в тестах (`tests/core/searchHistory.test.ts`) — лёгкий in-memory объект на базе `Map`.
   - `createCachedCountrySearch` (`src/core/cachedCountrySearch.ts`) принимает `fetcher: CountryFetcher = searchCountries`, а `createCountrySearchController` (`src/core/countrySearchController.ts`) принимает `cachedSearch: CachedCountrySearch = createCachedCountrySearch()`, что позволяет подменять зависимости в тестах без глобальных хаков.

4. **Иммутабельность и чистые функции:**
   - `mapCountryResponse` (`src/core/mapCountryResponse.ts`) не мутирует входной объект ответа API и копирует вложенные массивы (`[...raw.borders]`).
   - `createCachedCountrySearch` (`src/core/cachedCountrySearch.ts`) сохраняет и отдаёт копии массивов (`[...countries]`), исключая случайную модификацию закэшированных данных извне.
   - `createSearchHistoryManager` (`src/core/searchHistory.ts`) обновляет историю через иммутабельные операции `.filter()` и spread-оператор `[trimmed, ...filtered]`.

5. **Безопасная работа с DOM (Defense against XSS):**
   - Во всём UI-слое (`src/ui/domHelpers.ts`, `src/ui/renderApp.ts`, `src/ui/countryModal.ts`) полностью исключено использование `innerHTML` и `insertAdjacentHTML`; все пользовательские строки и данные API вставляются исключительно через `textContent` и `setAttribute`.
