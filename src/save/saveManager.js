const SAVE_KEY = "grand_resto_save";
const SAVE_VERSION = 2;

export function saveGame(state) {
  try {
    const data = JSON.stringify({ version: SAVE_VERSION, state });
    localStorage.setItem(SAVE_KEY, data);
    return true;
  } catch (e) {
    console.error("Save failed:", e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) {
      console.warn("Save version mismatch, ignoring");
      return null;
    }
    return data.state;
  } catch (e) {
    console.error("Load failed:", e);
    return null;
  }
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}
