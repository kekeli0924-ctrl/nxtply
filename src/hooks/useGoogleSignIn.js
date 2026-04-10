// Lazy loader + Promise wrapper for Google Identity Services.
//
// Google's GSI SDK is loaded from https://accounts.google.com/gsi/client the first
// time a user clicks the Google button. Subsequent calls reuse the already-loaded
// script. The SDK's own init function is promisified so callers can `await` a
// credential response instead of wrangling callbacks.
//
// NOTE: GSI normally wants to render its own button via `renderButton()` — we use
// `prompt()` with a hidden button fallback because our design already has a styled
// button wrapper. For users who block third-party cookies, GSI's prompt may be
// suppressed by the browser; in that case we fall back to rendering Google's real
// button in a hidden div and programmatically clicking it (see attemptFallback).

const GSI_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;
let initialized = false;
let currentCallback = null;

/**
 * Load the GSI script once and cache the Promise. Resolves when window.google
 * is available, rejects if the script fails to load within 10 seconds.
 */
function loadScript() {
  if (scriptPromise) return scriptPromise;
  if (typeof window === 'undefined') return Promise.reject(new Error('Not in browser'));
  if (window.google?.accounts?.id) return Promise.resolve();

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GSI script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI script failed to load'));
    document.head.appendChild(script);

    // Safety net: if the script never fires load/error, bail out after 10s so
    // the UI doesn't hang forever behind a spinner.
    setTimeout(() => reject(new Error('GSI script load timed out')), 10000);
  });
  return scriptPromise;
}

/**
 * Initialize GSI once with our client ID. Must be called after loadScript().
 * Safe to call multiple times — it's a no-op after the first successful init.
 */
function initialize(clientId) {
  if (initialized) return;
  if (!window.google?.accounts?.id) {
    throw new Error('GSI not loaded');
  }
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      // Google invokes this with { credential, select_by, clientId } when the user
      // picks an account. Forward the credential to whoever queued a promise.
      if (currentCallback) {
        currentCallback({ credential: response.credential });
        currentCallback = null;
      }
    },
    // Disable the automatic One Tap prompt — we want users to click an explicit
    // button. One Tap can be surprising and has browser-specific quirks.
    auto_select: false,
    cancel_on_tap_outside: true,
  });
  initialized = true;
}

/**
 * Open the Google account picker and resolve with { credential } on success.
 * Rejects if the user cancels, GSI is blocked by the browser, or the script
 * fails to load.
 *
 * The clientId must match the one configured in Google Cloud Console as an
 * authorized JavaScript origin.
 */
export async function promptGoogleSignIn(clientId) {
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not set');
  }
  await loadScript();
  initialize(clientId);

  return new Promise((resolve, reject) => {
    currentCallback = resolve;

    // Render a real Google button in a hidden container and click it. This works
    // consistently across browsers and respects the user's third-party cookie
    // settings better than prompt(). The rendered button's first child is the
    // clickable DIV; we click that and then clean up the container.
    try {
      let container = document.getElementById('gsi-hidden-button-host');
      if (!container) {
        container = document.createElement('div');
        container.id = 'gsi-hidden-button-host';
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
      }
      container.innerHTML = '';
      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
      });

      // Wait one microtask for GSI to inject its DOM, then click the inner button.
      setTimeout(() => {
        const clickable = container.querySelector('div[role=button]') || container.querySelector('div');
        if (clickable) {
          clickable.click();
        } else {
          currentCallback = null;
          reject(new Error('Google sign-in button failed to render'));
        }
      }, 50);

      // If no credential arrives in 60 seconds, assume the user dismissed the
      // popup and stop waiting.
      setTimeout(() => {
        if (currentCallback) {
          currentCallback = null;
          reject(new Error('Google sign-in cancelled or timed out'));
        }
      }, 60000);
    } catch (err) {
      currentCallback = null;
      reject(err);
    }
  });
}

/**
 * Helper: read the client ID from Vite env at call-time so hot reload works.
 */
export function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
}
