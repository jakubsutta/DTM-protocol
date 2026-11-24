/**
 * Vyhledávání obce podle názvu + našeptávač.
 */
var CityInfo = window.CityInfo || {};

CityInfo.Search = (function() {
  "use strict";

  var H = null; // CityInfo.Helpers – set in init()
  var LAYER = null;

  var nameInput, suggestList, nameStatus;
  var hiIndex = -1;

  function clearSuggestions() {
    suggestList.innerHTML = "";
    suggestList.classList.remove("show");
    hiIndex = -1;
  }

  function highlight(items) {
    items.forEach(function(it, i) { it.classList.toggle("hi", i === hiIndex); });
    if (hiIndex >= 0) items[hiIndex].scrollIntoView({ block: "nearest" });
  }

  function runSuggest(text) {
    var t = text.trim();
    if (!t || t.length < 2) { clearSuggestions(); return; }
    H.setStatus(nameStatus, "");

    H.ruianQuery(LAYER.OBEC, {
      where: "UPPER(nazev) LIKE UPPER('" + H.sqlEscape(t) + "%')",
      outFields: "kod,nazev,okres",
      orderByFields: "nazev",
      resultRecordCount: 15
    }, 6000).then(function(data) {
      var feats = (data && data.features) || [];
      if (!feats.length) { clearSuggestions(); return; }
      var rows = feats.map(function(f) { return f.attributes; });
      var nameCounts = {};
      rows.forEach(function(r) { nameCounts[r.nazev] = (nameCounts[r.nazev] || 0) + 1; });
      var dupOkresy = rows.filter(function(r) { return nameCounts[r.nazev] > 1; })
        .map(function(r) { return r.okres; });

      function render(okresNames) {
        suggestList.innerHTML = rows.map(function(r) {
          var extra = (nameCounts[r.nazev] > 1 && okresNames && okresNames[r.okres])
            ? ' <span style="color:var(--muted);">— ' + H.esc(okresNames[r.okres]) + '</span>' : "";
          return '<div class="suggestion-item" data-kod="' + H.esc(r.kod) + '">' +
            '<span class="suggest-name">' + H.esc(r.nazev) + extra + '</span>' +
            '<span class="suggest-kod">' + H.esc(r.kod) + '</span>' +
            '</div>';
        }).join("");
        suggestList.classList.add("show");
      }

      if (dupOkresy.length) {
        var uniqueOkresy = dupOkresy.filter(function(v, i, a) { return a.indexOf(v) === i; });
        H.ruianQuery(LAYER.OKRES, {
          where: "kod IN (" + uniqueOkresy.join(",") + ")",
          outFields: "kod,nazev"
        }, 5000).then(function(od) {
          var map2 = {};
          (od.features || []).forEach(function(f) { map2[f.attributes.kod] = f.attributes.nazev; });
          render(map2);
        }).catch(function() { render(null); });
      } else {
        render(null);
      }
    }).catch(function() {
      clearSuggestions();
      H.setStatus(nameStatus, "Vyhledávání v RÚIAN momentálně neodpovídá — zkuste to prosím znovu.", true);
    });
  }

  function onSuggestionClick(e) {
    var item = e.target.closest(".suggestion-item");
    if (!item) return;
    var kod = item.dataset.kod;
    var nameEl = item.querySelector(".suggest-name") || item;
    nameInput.value = nameEl.textContent.replace(/\s*—.*$/, "").trim();
    clearSuggestions();
    H.setStatus(nameStatus, "Načítám údaje o obci…");
    H.ruianQuery(LAYER.OBEC, { where: "kod=" + encodeURIComponent(kod), returnGeometry: true, outSR: 4326 })
      .then(function(data) {
        var f = data.features && data.features[0];
        if (!f) { H.setStatus(nameStatus, "Obec se nepodařilo dohledat, zkuste vybrat znovu.", true); return; }
        H.setStatus(nameStatus, "");
        CityInfo.Render.showObec(f.attributes, f.geometry);
      })
      .catch(function() {
        H.setStatus(nameStatus, "Nepodařilo se načíst údaje z RÚIAN. Zkuste to znovu.", true);
      });
  }

  function init() {
    H = CityInfo.Helpers;
    LAYER = CityInfo.Config.LAYER;

    nameInput = document.getElementById("nameInput");
    suggestList = document.getElementById("suggestList");
    nameStatus = document.getElementById("nameStatus");
    var clearSearchBtn = document.getElementById("clearSearchBtn");

    function toggleClearBtn() {
      clearSearchBtn.style.display = nameInput.value ? "flex" : "none";
    }

    nameInput.addEventListener("input", H.debounce(function() {
      toggleClearBtn();
      runSuggest(nameInput.value);
    }, 300));

    clearSearchBtn.addEventListener("click", function() {
      nameInput.value = "";
      toggleClearBtn();
      clearSuggestions();
      nameInput.focus();
    });

    nameInput.addEventListener("keydown", function(e) {
      var items = suggestList.querySelectorAll(".suggestion-item");
      if (!items.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); hiIndex = Math.min(hiIndex + 1, items.length - 1); highlight(items); }
      else if (e.key === "ArrowUp") { e.preventDefault(); hiIndex = Math.max(hiIndex - 1, 0); highlight(items); }
      else if (e.key === "Enter") { e.preventDefault(); if (hiIndex >= 0) items[hiIndex].click(); }
      else if (e.key === "Escape") { clearSuggestions(); }
    });

    suggestList.addEventListener("click", onSuggestionClick);

    document.addEventListener("click", function(e) {
      if (!e.target.closest(".search-box")) clearSuggestions();
    });
  }

  return { init: init };
})();
