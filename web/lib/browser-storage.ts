// Storage is optional; private browsers and full quotas must not stop a game.
function browserStore(kind: "sessionStorage" | "localStorage") {
  const fallback = new Map<string, string | null>();
  return {
    getItem(key: string): string | null {
      if (fallback.has(key)) return fallback.get(key) ?? null;
      try { return window[kind].getItem(key); } catch { return null; }
    },
    setItem(key: string, value: string) {
      try { window[kind].setItem(key, value); fallback.delete(key); }
      catch { fallback.set(key, value); }
    },
    removeItem(key: string) {
      try { window[kind].removeItem(key); fallback.delete(key); }
      catch { fallback.set(key, null); }
    },
  };
}

export const sessionStore = browserStore("sessionStorage");
export const localStore = browserStore("localStorage");
