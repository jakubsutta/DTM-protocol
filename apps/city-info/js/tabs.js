/**
 * Přepínání záložek (Podle názvu / Na mapě).
 */
var CityInfo = window.CityInfo || {};

CityInfo.Tabs = (function() {
  "use strict";

  function init() {
    var tabs = document.querySelectorAll(".tab");
    tabs.forEach(function(tab) {
      tab.addEventListener("click", function() {
        tabs.forEach(function(t) { t.classList.remove("active"); });
        tab.classList.add("active");
        document.querySelectorAll(".search-mode").forEach(function(m) { m.classList.remove("active"); });
        document.getElementById("mode-" + tab.dataset.mode).classList.add("active");
        if (tab.dataset.mode === "map" && CityInfo.Map && CityInfo.Map.instance) {
          setTimeout(function() { CityInfo.Map.instance.invalidateSize(); }, 50);
        }
      });
    });
  }

  return { init: init };
})();
