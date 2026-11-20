/**
 * ARES – dotazy na ekonomické subjekty (IČO, DIČ, adresa).
 */
var CityInfo = window.CityInfo || {};

CityInfo.Ares = (function() {
  "use strict";

  var H = null;

  function formatAdresa(sidlo) {
    if (!sidlo) return null;
    if (sidlo.textovaAdresa) return sidlo.textovaAdresa;
    var ulice = sidlo.nazevUlice || sidlo.nazevObce || "";
    var cd = sidlo.cisloDomovni != null ? sidlo.cisloDomovni : "";
    var co = sidlo.cisloOrientacni != null ? sidlo.cisloOrientacni : "";
    var col = sidlo.cisloOrientacniPismeno || "";
    var cislo = cd + (co ? "/" + co + col : "");
    var obec = sidlo.nazevObce || "";
    var psc = sidlo.psc || "";
    var line1 = (ulice + " " + cislo).trim();
    var line2 = (psc + " " + obec).trim();
    return [line1, line2].filter(Boolean).join(", ");
  }

  function lookupAres(kodObce, nazev) {
    H = CityInfo.Helpers;
    var body = JSON.stringify({
      sidlo: { kodObce: Number(kodObce) },
      pravniForma: ["801", "804"]
    });
    return H.withTimeout(fetch(CityInfo.Config.ARES_SEARCH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body
    }).then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }), 8000).then(function(data) {
      var list = (data && data.ekonomickeSubjekty) || [];
      if (!list.length) return null;
      var norm = function(s) { return H.stripDiacritics(String(s || "")).toLowerCase(); };
      var target = norm(nazev);
      var best = list.find(function(s) { return norm(s.obchodniJmeno).indexOf(target) !== -1; }) || list[0];
      return best;
    });
  }

  function init() {
    H = CityInfo.Helpers;
  }

  return {
    init: init,
    formatAdresa: formatAdresa,
    lookupAres: lookupAres
  };
})();
