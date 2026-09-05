"use client";

/**
 * Clickable AKUMA wordmark that performs a full application reset.
 *
 * Clicking the logo is the app's "get me out of here" escape hatch: it drops
 * every scrap of client-side state and reloads the app from the root menu.
 *
 * What gets cleared:
 *  - all of sessionStorage — this holds the active negotiation/chat context
 *    (`conversation_MERCHANT` / `conversation_BUYER`, written by
 *    components/agent-console.tsx) and any cached buyer/cart state
 *  - localStorage, EXCEPT the `theme` key. `theme` is written by next-themes
 *    (components/providers.tsx) and is a durable UI preference, not app state —
 *    flipping someone back to dark mode is a bug, not a reset.
 *  - all in-memory React state and the Next.js client router cache, which is
 *    what the hard navigation below achieves.
 *
 * The session cookie is deliberately NOT cleared: this is a state reset, not a
 * sign-out. `/` renders the landing screen without bouncing signed-in users
 * away, so the user lands on the starting menu either way.
 */

const PRESERVED_LOCAL_STORAGE_KEYS = new Set(["theme"]);

export function resetAkumaState(destination = "/") {
  // Storage access throws in some privacy modes, and a reset that crashes is
  // worse than a reset that only half-succeeds — so never let it stop the
  // navigation below.
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error("[AKUMA Reset] Could not clear sessionStorage:", error);
  }

  try {
    for (const key of Object.keys(localStorage)) {
      if (!PRESERVED_LOCAL_STORAGE_KEYS.has(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error("[AKUMA Reset] Could not clear localStorage:", error);
  }

  // A hard navigation rather than router.push: this tears down the React tree
  // and the router cache, which a client-side transition would preserve.
  window.location.assign(destination);
}

export function BrandReset({
  className = "brand",
  destination = "/",
}: {
  className?: string;
  destination?: string;
}) {
  return (
    // Kept as a real anchor with a real href so middle-click, "open in new tab"
    // and keyboard activation all behave; the handler takes over plain clicks.
    <a
      href={destination}
      className={className}
      title="Reset AKUMA and return to the start"
      onClick={(event) => {
        // Let the browser handle modified clicks (new tab/window) natively.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        resetAkumaState(destination);
      }}
    >
      <span className="brand-mark">A</span>
      <span>AKUMA</span>
    </a>
  );
}
