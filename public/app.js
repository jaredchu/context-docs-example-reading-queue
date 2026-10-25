// Reading Queue browser code. Talks to the JSON API in src/worker.js.
// All user-supplied text is rendered with textContent, never as HTML.

const MAX_TITLE_BYTES = 300;
const MAX_URL_BYTES = 2048;

const state = { items: [], filter: 'all', limit: 20 };

const form = document.getElementById('add-form');
const urlInput = document.getElementById('url');
const titleInput = document.getElementById('title');
const addButton = document.getElementById('add-button');
const formError = document.getElementById('form-error');
const queueHeading = document.getElementById('queue-heading');
const usage = document.getElementById('usage');
const listError = document.getElementById('list-error');
const loading = document.getElementById('loading');
const list = document.getElementById('items');
const filterEmpty = document.getElementById('filter-empty');
const empty = document.getElementById('empty');
const statusRegion = document.getElementById('status');
const exportButton = document.getElementById('export-button');
const filterButtons = document.querySelectorAll('.filter');

// ---- API -------------------------------------------------------------------

async function api(method, path, body) {
  const init = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.');
  }
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error?.message || `Request failed (${response.status}).`, data?.error?.field);
  }
  return data;
}

class ApiError extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

// ---- Rendering -------------------------------------------------------------

function isVisible(item) {
  if (state.filter === 'unread') return !item.read;
  if (state.filter === 'read') return item.read;
  return true;
}

function render() {
  const visible = state.items.filter(isVisible);
  list.replaceChildren(...visible.map(renderItem));

  const readCount = state.items.filter((item) => item.read).length;
  const counts = { all: state.items.length, unread: state.items.length - readCount, read: readCount };
  for (const button of filterButtons) {
    const filter = button.dataset.filter;
    button.setAttribute('aria-pressed', String(filter === state.filter));
    button.querySelector('.count').textContent = String(counts[filter]);
  }

  usage.textContent = `${state.items.length} of ${state.limit} links used`;
  empty.hidden = state.items.length > 0;
  filterEmpty.hidden = state.items.length === 0 || visible.length > 0;
  filterEmpty.textContent = state.filter === 'read' ? 'No read links yet.' : 'No unread links. Nice work!';
}

function renderItem(item) {
  const li = document.createElement('li');
  li.className = item.read ? 'item is-read' : 'item';
  li.dataset.id = item.id;

  const text = document.createElement('div');
  text.className = 'item-text';

  const link = document.createElement('a');
  link.className = 'item-title';
  link.textContent = item.title;
  link.href = isHttpUrl(item.url) ? item.url : '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const meta = document.createElement('p');
  meta.className = 'item-meta';
  meta.textContent = `${hostOf(item.url)} · ${item.read ? 'Read' : 'Unread'} · expires ${formatTime(item.expiresAt)}`;

  text.append(link, meta);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toggle';
  toggle.textContent = item.read ? 'Mark unread' : 'Mark read';
  toggle.setAttribute('aria-label', `${toggle.textContent}: ${item.title}`);
  toggle.addEventListener('click', () => setRead(item, !item.read, toggle));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete';
  remove.textContent = 'Delete';
  remove.setAttribute('aria-label', `Delete: ${item.title}`);
  remove.addEventListener('click', () => deleteItem(item, remove));

  actions.append(toggle, remove);
  li.append(text, actions);
  return li;
}

// ---- Actions ---------------------------------------------------------------

async function loadItems() {
  try {
    const data = await api('GET', '/api/items');
    state.items = data.items;
    state.limit = data.limit;
    render();
  } catch (error) {
    showError(listError, error.message);
  } finally {
    loading.hidden = true;
  }
}

async function addItem(event) {
  event.preventDefault();
  clearFormError();

  const url = urlInput.value.trim();
  const title = titleInput.value.trim();
  const problem = checkForm(url, title);
  if (problem) {
    showFormError(problem.message, problem.field);
    return;
  }

  addButton.disabled = true;
  try {
    const { item } = await api('POST', '/api/items', { url, title });
    state.items.unshift(item);
    render();
    form.reset();
    urlInput.focus();
    announce(`Added “${item.title}”.`);
  } catch (error) {
    showFormError(error.message, error.field);
  } finally {
    addButton.disabled = false;
  }
}

async function setRead(item, read, button) {
  hideError(listError);
  button.disabled = true;
  try {
    const { item: updated } = await api('PATCH', `/api/items/${encodeURIComponent(item.id)}`, { read });
    const neighbour = nextFocusTarget(item.id);
    state.items = state.items.map((existing) => (existing.id === updated.id ? updated : existing));
    render();
    // Keep focus on the same item; if the filter hid it, move to a neighbour.
    focusItemButton(updated.id, 'toggle') || focusItemButton(neighbour, 'toggle') || queueHeading.focus();
    announce(`Marked “${updated.title}” as ${read ? 'read' : 'unread'}.`);
  } catch (error) {
    button.disabled = false;
    showError(listError, error.message);
  }
}

async function deleteItem(item, button) {
  hideError(listError);
  button.disabled = true;
  try {
    await api('DELETE', `/api/items/${encodeURIComponent(item.id)}`);
    const neighbour = nextFocusTarget(item.id);
    state.items = state.items.filter((existing) => existing.id !== item.id);
    render();
    focusItemButton(neighbour, 'delete') || queueHeading.focus();
    announce(`Deleted “${item.title}”.`);
  } catch (error) {
    button.disabled = false;
    showError(listError, error.message);
  }
}

async function exportQueue() {
  hideError(listError);
  exportButton.disabled = true;
  try {
    // Fetch the full current queue rather than exporting filtered or stale UI state.
    const data = await api('GET', '/api/export');
    if (data?.schema_version !== 1 || !Array.isArray(data.items)) {
      throw new ApiError('The export response was invalid. Please try again.');
    }
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'reading-queue.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    announce(`Exported ${data.items.length} links.`);
  } catch (error) {
    showError(listError, error.message);
  } finally {
    exportButton.disabled = false;
  }
}

exportButton.addEventListener('click', exportQueue);

function setFilter(filter) {
  state.filter = filter;
  render();
}

// Suggested links only fill in the form; nothing is saved until the user submits.
function useSample(button) {
  clearFormError();
  urlInput.value = button.dataset.url;
  titleInput.value = button.dataset.title;
  addButton.focus();
  announce('Suggestion filled in. Select “Add link” to save it.');
}

// ---- Helpers ---------------------------------------------------------------

function checkForm(url, title) {
  if (!url) return { field: 'url', message: 'Enter a link.' };
  if (byteLength(url) > MAX_URL_BYTES) return { field: 'url', message: `The link can be at most ${MAX_URL_BYTES} bytes.` };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  if (!parsed || !isHttpUrl(url)) {
    return { field: 'url', message: 'Enter a full link starting with http:// or https://.' };
  }
  if (parsed.username || parsed.password) {
    return { field: 'url', message: 'Links must not contain a username or password.' };
  }
  if (!title) return { field: 'title', message: 'Enter a title.' };
  if (byteLength(title) > MAX_TITLE_BYTES) {
    return { field: 'title', message: `The title can be at most ${MAX_TITLE_BYTES} bytes.` };
  }
  return null;
}

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function hostOf(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

function formatTime(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

// The ID of the visible item after (or else before) the given one.
function nextFocusTarget(id) {
  const visible = state.items.filter(isVisible);
  const index = visible.findIndex((item) => item.id === id);
  const neighbour = visible[index + 1] || visible[index - 1];
  return neighbour ? neighbour.id : null;
}

function focusItemButton(id, className) {
  if (!id) return false;
  const row = Array.from(list.children).find((li) => li.dataset.id === id);
  const button = row?.querySelector(`button.${className}`);
  if (!button) return false;
  button.focus();
  return true;
}

function showFormError(message, field) {
  showError(formError, message);
  const input = field === 'title' ? titleInput : field === 'url' ? urlInput : null;
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', input === urlInput ? 'url-hint form-error' : 'form-error');
    input.focus();
  } else {
    addButton.focus();
  }
}

function clearFormError() {
  hideError(formError);
  for (const input of [urlInput, titleInput]) input.removeAttribute('aria-invalid');
  urlInput.setAttribute('aria-describedby', 'url-hint');
  titleInput.removeAttribute('aria-describedby');
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function hideError(element) {
  element.hidden = true;
  element.textContent = '';
}

function announce(message) {
  statusRegion.textContent = message;
}

// ---- Start -----------------------------------------------------------------

form.addEventListener('submit', addItem);
for (const button of filterButtons) {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
}
for (const button of document.querySelectorAll('.sample')) {
  button.addEventListener('click', () => useSample(button));
}
loadItems();
