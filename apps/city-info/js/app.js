/**
 * Hlavní entry point – inicializace všech modulů.
 *
 * Každý modul se inicializuje zvlášť: když se některý skript nenačte (výpadek sítě,
 * chyba v modulu), ostatní části aplikace dál fungují a v konzoli je jasné, co chybí.
 */
(function() {
  "use strict";

  // Pořadí = závislosti první
  var ORDER = ["Ares", "Contacts", "Render", "Search", "Map"];

  ORDER.forEach(function(name) {
    var mod = window.CityInfo && window.CityInfo[name];
    if (!mod || typeof mod.init !== "function") {
      console.error("City-Info: modul " + name + " se nenačetl (js/" + name.toLowerCase() + ".js).");
      return;
    }
    try {
      mod.init();
    } catch (e) {
      console.error("City-Info: inicializace modulu " + name + " selhala.", e);
    }
  });
})();
