/**
 * Hlavní entry point – inicializace všech modulů.
 */
(function() {
  "use strict";

  // Inicializace modulů v správném pořadí (závislosti první)
  CityInfo.Ares.init();
  CityInfo.Contacts.init();
  CityInfo.Render.init();
  CityInfo.Search.init();
  CityInfo.Map.init();
})();
