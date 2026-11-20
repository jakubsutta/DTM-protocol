/**
 * Kontakty – web obce z RISY (ÚÚR), e-mail/telefon best-effort z RIS.gov.cz.
 */
var CityInfo = window.CityInfo || {};

CityInfo.Contacts = (function() {
  "use strict";

  var H = null;

  function lookupWebObce(kod) {
    var url = CityInfo.Config.RISY_WEBY_OBCI + "/query?" + H.qs({
      where: "KOD_OBEC=" + encodeURIComponent(kod),
      outFields: "WWW",
      f: "json"
    });
    return H.withTimeout(H.fetchJson(url), 6000).then(function(data) {
      var f = data.features && data.features[0];
      var www = f && f.attributes && f.attributes.WWW;
      return www ? String(www).trim() : null;
    }).catch(function() { return null; });
  }

  function init() {
    H = CityInfo.Helpers;
  }

  return {
    init: init,
    lookupWebObce: lookupWebObce
  };
})();
