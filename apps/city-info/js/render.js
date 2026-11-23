/**
 * Renderování výsledků – administrativní hierarchie, ARES data, kontakty.
 */
var CityInfo = window.CityInfo || {};

CityInfo.Render = (function() {
  "use strict";

  var H = null;
  var LAYER = null;
  var resultPanel = null;

  function fieldHtml(label, value, opts) {
    opts = opts || {};
    var cls = "field" + (opts.full ? " full" : "");
    var val = value;
    if (!val) {
      val = '<span class="value muted">' + (opts.pendingText || "nezjištěno") + '</span>';
      return '<div class="' + cls + '"><div class="label">' + H.esc(label) + '</div><div class="value">' + val + '</div></div>';
    }
    var copyBtn = '';
    if (opts.copyText) {
      copyBtn = '<button type="button" class="copy-field-btn" data-copy="' + H.esc(opts.copyText) + '" title="Kopírovat"><svg><use href="#icon-copy"/></svg></button>';
    }
    return '<div class="' + cls + '"><div class="label">' + H.esc(label) + '</div><div class="value-container"><div class="value">' + val + '</div>' + copyBtn + '</div></div>';
  }

  function byKod(layer, kod) {
    if (kod === undefined || kod === null) return Promise.resolve(null);
    return H.ruianQuery(layer, { where: "kod=" + encodeURIComponent(kod) })
      .then(function(d) { return (d.features && d.features[0] && d.features[0].attributes) || null; })
      .catch(function() { return null; });
  }

  function resolveHierarchy(obec) {
    return Promise.all([
      byKod(LAYER.POU, obec.pou),
      byKod(LAYER.OKRES, obec.okres)
    ]).then(function(res) {
      var pou = res[0], okres = res[1];
      return Promise.all([
        pou && pou.orp != null ? byKod(LAYER.ORP, pou.orp) : Promise.resolve(null),
        okres && okres.vusc != null ? byKod(LAYER.KRAJ, okres.vusc) : Promise.resolve(null)
      ]).then(function(res2) {
        return { pou: pou, okres: okres, orp: res2[0], kraj: res2[1] };
      });
    });
  }

  function showObec(obec, geometry) {
    if (geometry) {
      CityInfo.Map.drawOutline(geometry);
      CityInfo.Map.fitBounds(geometry);
    }

    resultPanel.style.display = "block";
    resultPanel.innerHTML =
      '<div class="result-title">' +
        '<div class="result-title-inner" id="resultTitleInner">' +
          '<h2>' + H.esc(obec.nazev) + '</h2>' +
          '<span class="badge">kód RÚIAN ' + H.esc(obec.kod) + '</span>' +
        '</div>' +
        '<button type="button" class="close-btn" id="closeResultBtn" title="Zavřít výsledek">Vymazat</button>' +
      '</div>' +
      '<div class="grid" id="grid-admin">' +
        fieldHtml("ORP", '<span class="spinner"></span>Načítám…') +
        fieldHtml("POU", '<span class="spinner"></span>Načítám…') +
        fieldHtml("Okres", '<span class="spinner"></span>Načítám…') +
        fieldHtml("Kraj", '<span class="spinner"></span>Načítám…') +
      '</div>' +
      '<div class="grid grid-2col" id="grid-ares" style="margin-top:6px;">' +
        fieldHtml("Adresa (sídlo)", '<span class="spinner"></span>Dotazuji ARES…', { full: true }) +
        fieldHtml("IČO", '<span class="spinner"></span>') +
        fieldHtml("DIČ", '<span class="spinner"></span>') +
      '</div>' +
      '<div class="grid grid-2col" id="grid-contact" style="margin-top:6px;">' +
        fieldHtml("E-mail", null, { pendingText: "viz RIS.gov.cz" }) +
        fieldHtml("Telefon", null, { pendingText: "viz RIS.gov.cz" }) +
        fieldHtml("Web obce", null, { pendingText: "viz RIS.gov.cz" }) +
      '</div>' +
      '<div class="sources" id="sources"></div>' +
      '<div class="note">Data: RÚIAN (ČÚZK) + ARES + RISY (ÚÚR). E-mail/tel best-effort z RIS.gov.cz.</div>';

    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // hierarchy
    resolveHierarchy(obec).then(function(h) {
      var g = document.getElementById("grid-admin");
      g.innerHTML =
        fieldHtml("ORP", h.orp ? H.esc(h.orp.nazev) : null, { copyText: h.orp ? h.orp.nazev : null }) +
        fieldHtml("POU", h.pou ? H.esc(h.pou.nazev) : null, { copyText: h.pou ? h.pou.nazev : null }) +
        fieldHtml("Okres", h.okres ? H.esc(h.okres.nazev) : null, { copyText: h.okres ? h.okres.nazev : null }) +
        fieldHtml("Kraj", h.kraj ? H.esc(h.kraj.nazev) : null, { copyText: h.kraj ? h.kraj.nazev : null });
    });

    // ARES
    var risUrl = "https://ris.gov.cz/cs/vyhledavace/uzemi/" + obec.kod + "-" + H.risSlug(obec.nazev);
    var aresSearchUrl = "https://ares.gov.cz/ekonomicke-subjekty?obchodniJmeno=" + encodeURIComponent(obec.nazev);

    CityInfo.Ares.lookupAres(obec.kod, obec.nazev).then(function(subj) {
      var g = document.getElementById("grid-ares");
      if (!subj) {
        g.innerHTML =
          fieldHtml("Adresa (sídlo)", '<a href="' + aresSearchUrl + '" target="_blank" rel="noopener">Vyhledat na ARES →</a>', { full: true, pendingText: "nenalezeno" }) +
          fieldHtml("IČO", null) +
          fieldHtml("DIČ", null);
        return;
      }
      var adresa = CityInfo.Ares.formatAdresa(subj.sidlo);
      g.innerHTML =
        fieldHtml("Adresa (sídlo)", H.esc(adresa), { full: true, copyText: adresa }) +
        fieldHtml("IČO", subj.ico ? '<a href="https://ares.gov.cz/ekonomicke-subjekty?ico=' + H.esc(subj.ico) + '" target="_blank" rel="noopener">' + H.esc(subj.ico) + '</a>' : null, { copyText: subj.ico }) +
        fieldHtml("DIČ", subj.dic ? H.esc(subj.dic) : null, { pendingText: "není plátce DPH / neuvedeno", copyText: subj.dic });
    }).catch(function() {
      var g = document.getElementById("grid-ares");
      g.innerHTML =
        fieldHtml("Adresa (sídlo)", '<a href="' + aresSearchUrl + '" target="_blank" rel="noopener">Vyhledat ručně na ARES →</a>', { full: true, pendingText: "automatický dotaz selhal" }) +
        fieldHtml("IČO", null) +
        fieldHtml("DIČ", null);
    });

    // Kontakty
    var risUrl = "https://ris.gov.cz/cs/vyhledavace/uzemi/" + obec.kod + "-" + H.risSlug(obec.nazev);
    var gContact = document.getElementById("grid-contact");

    // Zrušeno stahování E-mailu a Telefonu z RIS.gov.cz kvůli agresivní CORS/bot ochraně
    // Web obce (RISY) se stáhne a rovnou překreslí celou sekci kontaktů
    CityInfo.Contacts.lookupWebObce(obec.kod).then(function(web) {
      gContact.innerHTML =
        fieldHtml("E-mail", null, { pendingText: "viz RIS.gov.cz" }) +
        fieldHtml("Telefon", null, { pendingText: "viz RIS.gov.cz" }) +
        fieldHtml("Web obce", web ? '<a href="' + H.esc(H.normalizeUrl(web)) + '" target="_blank" rel="noopener">' + H.esc(web) + '</a>' : null, { pendingText: "viz RIS.gov.cz", copyText: web }) +
        '<div class="field"></div>';
    });

    var extIcon = '<svg style="width:11px;height:11px;flex-shrink:0;" class="chip-icon"><use href="#icon-external"/></svg>';
    document.getElementById("sources").innerHTML =
      '<a href="' + risUrl + '" target="_blank" rel="noopener">' + extIcon + 'RIS.gov.cz</a>' +
      '<a href="' + aresSearchUrl + '" target="_blank" rel="noopener">' + extIcon + 'ARES</a>' +
      '<a href="https://vdp.cuzk.cz/vdp/ruian/obce/' + obec.kod + '" target="_blank" rel="noopener">' + extIcon + 'RÚIAN (VDP)</a>' +
      '<a href="https://egis.uur.cz/arcgis/rest/services/RISY/weby_obci/MapServer/0/query?where=KOD_OBEC%3D' + obec.kod + '&outFields=*&f=html" target="_blank" rel="noopener">' + extIcon + 'RISY (ÚÚR)</a>';

    // Wikidata info (Logo obce + Starosta)
    if (typeof H.fetchWikidataInfo === "function") {
      H.fetchWikidataInfo(obec.nazev).then(function(data) {
        // Vždy vytvoříme img element
        var inner = document.getElementById("resultTitleInner");
        if (inner) {
          var img = document.createElement("img");
          // Zkusíme Wikidata logo, jinak fallback na VDP
          img.src = data.logoUrl ? data.logoUrl : "https://vdp.cuzk.cz/vdp/ruian/obce/" + obec.kod + "/znak";
          img.alt = "Znak obce";
          img.className = "city-logo";
          // Pokud ani VDP obrázek nemá (vrátí 404/chybu), skryjeme ho
          img.onerror = function() {
            this.style.display = "none";
          };
          inner.insertBefore(img, inner.firstChild);
        }
        
        // Zkusíme najít prázdné políčko v kontaktech a nahradit ho starostou
        var gContact = document.getElementById("grid-contact");
        if (gContact) {
          var emptyFields = gContact.querySelectorAll('.field:empty');
          var target = emptyFields.length > 0 ? emptyFields[emptyFields.length - 1] : null;
          var html = fieldHtml("Starosta", data.mayorName ? H.esc(data.mayorName) : null, { pendingText: "nezjištěno", copyText: data.mayorName });
          
          if (target) {
            target.outerHTML = html;
          } else {
            gContact.insertAdjacentHTML('beforeend', html);
          }
        }
      });
    }

    document.getElementById("closeResultBtn").addEventListener("click", function() {
      resultPanel.style.display = "none";
      if (CityInfo.Map && typeof CityInfo.Map.clear === "function") {
        CityInfo.Map.clear();
      }
    });
  }

  function init() {
    H = CityInfo.Helpers;
    LAYER = CityInfo.Config.LAYER;
    resultPanel = document.getElementById("resultPanel");

    // Copy to clipboard delegation
    resultPanel.addEventListener("click", function(e) {
      var btn = e.target.closest(".copy-field-btn");
      if (!btn) return;
      var text = btn.getAttribute("data-copy");
      if (text) {
        H.copyToClipboard(text).then(function() {
          var icon = btn.innerHTML;
          btn.innerHTML = '<svg><use href="#icon-check"/></svg>';
          btn.classList.add("copied");
          setTimeout(function() {
            btn.innerHTML = icon;
            btn.classList.remove("copied");
          }, 1500);
        }).catch(function() {
          console.error("Copy failed");
        });
      }
    });
  }

  return {
    init: init,
    showObec: showObec
  };
})();
