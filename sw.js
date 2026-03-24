const CACHE_NAME = "grand-resto-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/main.js",
  "./src/engine/gameState.js",
  "./src/engine/sim.js",
  "./src/render/ui.js",
  "./src/render/chart.js",
  "./src/render/effects.js",
  "./src/render/floorView.js",
  "./src/render/titleScreen.js",
  "./src/save/saveManager.js",
  "./src/systems/staffManager.js",
  "./src/systems/menuManager.js",
  "./src/systems/eventManager.js",
  "./src/systems/shiftManager.js",
  "./src/systems/skillManager.js",
  "./src/systems/compatibilityManager.js",
  "./src/systems/mentorManager.js",
  "./src/systems/turnoverManager.js",
  "./src/systems/rivalManager.js",
  "./src/systems/recipeManager.js",
  "./src/systems/prestigeManager.js",
  "./src/systems/achievementManager.js",
  "./src/systems/seasonManager.js",
  "./src/systems/formatManager.js",
  "./src/systems/tutorialManager.js",
  "./src/systems/endingManager.js",
  "./src/systems/townManager.js",
  "./src/systems/relocationManager.js",
  "./src/systems/furniture-data.js",
  "./src/systems/furniture.js",
  "./src/render/floor-editor.js",
  "./src/systems/marketing.js",
  "./src/systems/cleaning.js",
  "./src/systems/preparation.js",
  "./src/systems/equipment.js",
  "./src/systems/reservation.js",
  "./src/systems/customerDB.js",
  "./src/systems/accounting.js",
  "./src/data/config.json",
  "./src/data/menus.json",
  "./src/data/staff-templates.json",
  "./src/data/events.json",
  "./src/data/upgrades.json",
  "./src/data/customers.json",
  "./src/data/skills.json",
  "./src/data/rivals.json",
  "./src/data/recipes.json",
  "./src/data/achievements.json",
  "./src/data/seasons.json",
  "./src/data/formats.json",
  "./src/data/towns.json",
  "./src/data/help.json",
  "./src/data/locations.json",
  "./src/data/marketing.json",
  "./src/data/cleaning.json",
  "./src/data/ingredients.json",
  "./src/data/equipment.json",
  "./src/data/themes.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      // Network first for JSON data (may be updated), cache first for JS/HTML
      if (e.request.url.endsWith(".json")) {
        return fetch(e.request)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
            return res;
          })
          .catch(() => cached);
      }
      return cached || fetch(e.request);
    })
  );
});
