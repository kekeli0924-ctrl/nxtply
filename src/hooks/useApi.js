import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = '/api';

function notifyError(message) {
  window.dispatchEvent(new CustomEvent('api-error', { detail: message }));
}

async function apiFetch(path, options = {}) {
  // In dev mode, include role so backend knows which user to use
  const role = window.__COMPOSED_ROLE__ || 'player';
  const separator = path.includes('?') ? '&' : '?';
  const url = `${API_BASE}${path}${separator}_role=${role}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', 'X-Dev-Role': role },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Drop-in replacement for useLocalStorage for array-based collections.
 * Returns [items, setItems] with the same interface.
 *
 * setItems supports:
 *   - Direct value: setItems(newArray)
 *   - Functional update: setItems(prev => newArray)
 *
 * Automatically detects create/update/delete and fires API calls.
 */
export function useApiCollection(endpoint, initialValue = []) {
  const [items, setItemsInternal] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);
  const prevRef = useRef(initialValue);

  // Fetch on mount
  useEffect(() => {
    let cancelled = false;
    apiFetch(endpoint)
      .then(data => {
        if (!cancelled) {
          const arr = Array.isArray(data) ? data : [];
          setItemsInternal(arr);
          prevRef.current = arr;
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          notifyError(`Failed to load data`);
          setLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [endpoint]);

  const setItems = useCallback((updater) => {
    const prev = prevRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    prevRef.current = next;
    setItemsInternal(next);
    // Sync diff to API in background (outside state updater to avoid StrictMode double-fire)
    syncDiff(endpoint, prev, next);
  }, [endpoint]);

  return [items, setItems, loaded];
}

/**
 * Drop-in replacement for useLocalStorage for singleton objects (settings, personalRecords).
 */
export function useApiSingleton(endpoint, initialValue) {
  const [value, setValueInternal] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);
  const prevRef = useRef(initialValue);

  useEffect(() => {
    let cancelled = false;
    apiFetch(endpoint)
      .then(data => {
        if (!cancelled) {
          const val = data ?? initialValue;
          setValueInternal(val);
          prevRef.current = val;
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          notifyError(`Failed to load data`);
          setLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [endpoint]);

  const setValue = useCallback((updater) => {
    const prev = prevRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    prevRef.current = next;
    setValueInternal(next);
    // PUT to API in background (outside state updater to avoid StrictMode double-fire)
    apiFetch(endpoint, { method: 'PUT', body: next })
      .catch((err) => notifyError(err.message));
  }, [endpoint]);

  return [value, setValue, loaded];
}

/**
 * For simple string arrays (customDrills) — POST to add, DELETE to remove.
 */
export function useApiStringList(endpoint, initialValue = []) {
  const [items, setItemsInternal] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);
  const prevRef = useRef(initialValue);

  useEffect(() => {
    let cancelled = false;
    apiFetch(endpoint)
      .then(data => {
        if (!cancelled) {
          const arr = Array.isArray(data) ? data : [];
          setItemsInternal(arr);
          prevRef.current = arr;
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          notifyError(`Failed to load data`);
          setLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [endpoint]);

  const setItems = useCallback((updater) => {
    const prev = prevRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    prevRef.current = next;
    setItemsInternal(next);
    // Sync to API (outside state updater to avoid StrictMode double-fire)
    const added = next.filter(x => !prev.includes(x));
    const removed = prev.filter(x => !next.includes(x));
    for (const name of added) {
      apiFetch(endpoint, { method: 'POST', body: { name } })
        .catch((err) => notifyError(err.message));
    }
    for (const name of removed) {
      apiFetch(`${endpoint}/${encodeURIComponent(name)}`, { method: 'DELETE' })
        .catch((err) => notifyError(err.message));
    }
  }, [endpoint]);

  return [items, setItems, loaded];
}

// Detect create/update/delete between old and new arrays and fire API calls
function syncDiff(endpoint, prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return;

  const prevMap = new Map(prev.map(item => [item.id, item]));
  const nextMap = new Map(next.map(item => [item.id, item]));

  // Deleted items
  for (const [id] of prevMap) {
    if (!nextMap.has(id)) {
      apiFetch(`${endpoint}/${id}`, { method: 'DELETE' })
        .catch((err) => notifyError(err.message));
    }
  }

  // Created or updated items
  for (const [id, item] of nextMap) {
    if (!prevMap.has(id)) {
      // New item
      apiFetch(endpoint, { method: 'POST', body: item })
        .catch((err) => notifyError(err.message));
    } else if (JSON.stringify(prevMap.get(id)) !== JSON.stringify(item)) {
      // Updated item
      apiFetch(`${endpoint}/${id}`, { method: 'PUT', body: item })
        .catch((err) => notifyError(err.message));
    }
  }
}
