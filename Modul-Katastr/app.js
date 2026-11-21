/* ==========================================================================
   Modul Katastr – Technický a mapový portál pro Katastr nemovitostí (KN & RÚIAN)
   - Katastrální mapa ČÚZK (parcely, čísla, hranice, lomové body)
   - Budovy a stavební objekty (INSPIRE, RÚIAN, definiční body)
   - Územní a správní členění (KÚ, obce, městské části, okresy)
   - Adresní místa a uliční síť (RÚIAN)
   - Cenové údaje a bonita (BPEJ)
   - Nástroje: Basemap switcher, Měření výšky DMR 5G, Vyhledávání RÚIAN,
     Měření vzdálenosti a plochy s živými segmenty
   ========================================================================== */

(function () {
  "use strict";

  // Globální stav aplikace
  var state = {
    map: null,
    baseLayers: {},
    overlayLayers: {},
    activeSublayers: new Set(),
    activeSingleLayers: new Set(),
    layerOpacities: {},
    elevationMode: false,
    activeBasemap: "orto",
    elevationMarker: null,
    legendFilter: "active",
    currentTab: "layers"
  };

  // Definice EPSG:5514 (S-JTSK / Krovak East North) pro Proj4
  if (typeof proj4 !== "undefined") {
    proj4.defs(
      "EPSG:5514",
      "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs"
    );
  }

  // --------------------------------------------------------------------------
  // Inicializace mapy Leaflet
  // --------------------------------------------------------------------------
  function initMap() {
    // Výchozí pohled: Olomouc (Horní náměstí) na zoomu 16 (katastr plně aktivní a čitelný)
    var defaultCenter = [49.5938, 17.2509];
    var defaultZoom = 16;

    state.map = L.map("map", {
      center: defaultCenter,
      zoom: defaultZoom,
      minZoom: 7,
      maxZoom: 21,
      zoomControl: true,
      attributionControl: true
    });

    // Měřítko vlevo dole
    L.control.scale({
      position: "bottomleft",
      metric: true,
      imperial: false,
      maxWidth: 150
    }).addTo(state.map);

    // Číselný zoom ukazatel mezi tlačítky [+] a [-] v Leaflet zoom control
    initZoomDisplay();

    // Vlastní Basemap Control na pozici topleft pod zoom control
    initBasemapControl();

    // Vlastní Elevation Control (DMR 5G) pod Basemap control
    initElevationControl();

    // Vlastní vyhledávací panel (RÚIAN adresy, parcely, KÚ)
    initSearchControl();

    // Vlastní měření linie a plochy se živým zobrazením
    initMeasureControl();

    // Vlastní tlačítko legendy na mapě (otevírá záložku Legenda v panelu)
    initLegendControl();

    // Inicializace podkladových map
    initBaseLayers();

    // Inicializace překryvných vrstev Katastru nemovitostí a RÚIAN
    initOverlayLayers();

    // Napojení ovládacích prvků v postranním panelu
    setupSidebarControls();

    // Inicializace systému legendy (tlačítka u vrstev a správa záložky Legenda)
    initLegendSystem();

    // Výchozí zobrazení: Zapnout kompletní katastrální mapu
    toggleSingleLayer("kn_komplet", true);

    // Události mapy (zoom indikátor, status bar, kliknutí)
    setupMapEvents();
  }

  // --------------------------------------------------------------------------
  // Číselný zoom ukazatel mezi tlačítky [+] a [-] v Leaflet zoom control
  // --------------------------------------------------------------------------
  function initZoomDisplay() {
    var zoomIn = document.querySelector(".leaflet-control-zoom-in");
    var zoomOut = document.querySelector(".leaflet-control-zoom-out");
    if (zoomIn && zoomOut && !document.getElementById("zoom-level-display")) {
      var zoomDisp = document.createElement("div");
      zoomDisp.id = "zoom-level-display";
      zoomDisp.className = "leaflet-control-zoom-level";
      zoomDisp.setAttribute("title", "Aktuální úroveň přiblížení (zoom)");
      zoomDisp.textContent = state.map.getZoom();
      zoomIn.parentNode.insertBefore(zoomDisp, zoomOut);
    }
  }

  // 2. Basemap Control (výběr Ortofoto / ZTM / OSM)
  function initBasemapControl() {
    var BasemapControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control basemap-control");

        container.innerHTML =
          '<button type="button" id="btn-basemap-toggle" class="basemap-toggle-btn" title="Přepnout podkladovou mapu" aria-label="Podkladové mapy">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>' +
              '<line x1="8" y1="2" x2="8" y2="18"></line>' +
              '<line x1="16" y1="6" x2="16" y2="22"></line>' +
            '</svg>' +
          '</button>' +
          '<div id="basemap-popover" class="basemap-popover">' +
            '<div class="basemap-popover-header">' +
              '<span>Podkladová mapa</span>' +
              '<button type="button" id="btn-close-basemap" class="btn-close-popover" title="Zavřít">✕</button>' +
            '</div>' +
            '<div class="base-map-options">' +
              '<label class="base-map-item active" data-basemap="orto">' +
                '<input type="radio" name="basemap_radio" value="orto" checked>' +
                '<span class="base-map-label">Ortofotomapa (ČÚZK)</span>' +
              '</label>' +
              '<label class="base-map-item" data-basemap="ztm">' +
                '<input type="radio" name="basemap_radio" value="ztm">' +
                '<span class="base-map-label">Základní topografická (ZTM)</span>' +
              '</label>' +
              '<label class="base-map-item" data-basemap="osm">' +
                '<input type="radio" name="basemap_radio" value="osm">' +
                '<span class="base-map-label">OpenStreetMap (OSM)</span>' +
              '</label>' +
            '</div>' +
          '</div>';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
      }
    });

    state.map.addControl(new BasemapControl());

    var btnToggle = document.getElementById("btn-basemap-toggle");
    var popover = document.getElementById("basemap-popover");
    var btnClose = document.getElementById("btn-close-basemap");

    if (btnToggle && popover) {
      btnToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = popover.classList.toggle("is-open");
        btnToggle.classList.toggle("is-active", isOpen);

        if (isOpen && typeof toggleSearchFlyout === "function") {
          toggleSearchFlyout(false);
        }
        if (isOpen) {
          var measurePopover = document.getElementById("measure-popover");
          var btnMeasure = document.getElementById("btn-measure-toggle");
          if (measurePopover) measurePopover.classList.remove("is-open");
          if (btnMeasure && typeof measureState !== "undefined" && !measureState.mode) {
            btnMeasure.classList.remove("is-active");
          }
        }
      });

      if (btnClose) {
        btnClose.addEventListener("click", function (e) {
          e.stopPropagation();
          popover.classList.remove("is-open");
          btnToggle.classList.remove("is-active");
        });
      }

      document.addEventListener("click", function (e) {
        if (!popover.contains(e.target) && !btnToggle.contains(e.target)) {
          popover.classList.remove("is-open");
          btnToggle.classList.remove("is-active");
        }
      });
    }

    document.querySelectorAll(".base-map-item").forEach(function (item) {
      item.addEventListener("click", function () {
        var val = this.getAttribute("data-basemap");
        switchBasemap(val);
        document.querySelectorAll(".base-map-item").forEach(function (el) {
          el.classList.toggle("active", el.getAttribute("data-basemap") === val);
          var radio = el.querySelector("input[type='radio']");
          if (radio) radio.checked = el.getAttribute("data-basemap") === val;
        });
        if (popover) {
          popover.classList.remove("is-open");
          if (btnToggle) btnToggle.classList.remove("is-active");
        }
      });
    });
  }

  // 3. Elevation Control (měření výšky DMR 5G)
  function initElevationControl() {
    var ElevationControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control elevation-control");
        container.innerHTML =
          '<button type="button" id="btn-elevation-toggle" class="elevation-toggle-btn" title="Měření nadmořské výšky (DMR 5G ČÚZK)" aria-label="Měření výšky">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="m8 3 4 8 5-5 5 15H2L8 3z"></path>' +
            '</svg>' +
          '</button>';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
      }
    });

    state.map.addControl(new ElevationControl());

    var btnElevation = document.getElementById("btn-elevation-toggle");
    if (btnElevation) {
      btnElevation.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleElevationMode();
      });
    }
  }

  function toggleElevationMode(forceState) {
    state.elevationMode = forceState !== undefined ? forceState : !state.elevationMode;
    var btn = document.getElementById("btn-elevation-toggle");
    var mapEl = document.getElementById("map");
    var statusDot = document.getElementById("status-dot");
    var statusText = document.getElementById("map-status-text");

    if (state.elevationMode) {
      if (btn) btn.classList.add("is-active");
      if (mapEl) mapEl.classList.add("elevation-mode-active");
      if (statusDot) statusDot.className = "status-dot elevation-active";
      if (statusText) statusText.textContent = "Režim měření výšky (DMR 5G) aktivní – klikněte kamkoliv do mapy";

      if (typeof setMeasureMode === "function" && measureState.mode) {
        setMeasureMode(null);
      }
      var basePopover = document.getElementById("basemap-popover");
      var baseBtn = document.getElementById("btn-basemap-toggle");
      if (basePopover) basePopover.classList.remove("is-open");
      if (baseBtn) baseBtn.classList.remove("is-active");

      if (typeof toggleSearchFlyout === "function") {
        toggleSearchFlyout(false);
      }
    } else {
      if (btn) btn.classList.remove("is-active");
      if (mapEl) mapEl.classList.remove("elevation-mode-active");
      if (statusDot) statusDot.className = "status-dot";
      var z = state.map.getZoom();
      if (statusText) {
        statusText.textContent = z >= 14
          ? "Klikněte na parcelu v mapě pro zobrazení vlastností"
          : "Katastr neaktivní (přibližte na zoom 14+ pro dotazování)";
      }
    }
  }

  // 4. Vyhledávací panel RÚIAN (Adresy, Parcely, KÚ)
  function initSearchControl() {
    var SearchControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control search-control");

        container.innerHTML =
          '<button type="button" id="btn-search-toggle" class="search-toggle-btn" title="Hledat adresu, parcelu nebo KÚ (RÚIAN)" aria-label="Vyhledávání">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="11" cy="11" r="8"></circle>' +
              '<line x1="21" y1="21" x2="16.65" y2="16.65"></line>' +
            '</svg>' +
          '</button>' +
          '<div id="search-flyout" class="search-flyout">' +
            '<div class="search-flyout-header">' +
              '<div class="search-tabs">' +
                '<button type="button" class="search-tab-btn active" data-tab="adresa">Adresa</button>' +
                '<button type="button" class="search-tab-btn" data-tab="parcela">Parcela</button>' +
                '<button type="button" class="search-tab-btn" data-tab="ku">Kat. území</button>' +
              '</div>' +
              '<button type="button" id="btn-close-search" class="btn-close-popover" title="Zavřít">✕</button>' +
            '</div>' +
            '<div class="search-tab-content active" id="tab-adresa">' +
              '<div class="search-input-wrapper">' +
                '<input type="text" id="search-input-adresa" class="search-input" placeholder="Zadejte obec, ulici, č.p. ..." autocomplete="off">' +
                '<button type="button" id="btn-clear-search-adresa" class="btn-clear-input" title="Vymazat">✕</button>' +
              '</div>' +
              '<div id="search-results-adresa" class="search-results-list"></div>' +
            '</div>' +
            '<div class="search-tab-content" id="tab-parcela">' +
              '<div class="parcela-form">' +
                '<div class="form-row">' +
                  '<label for="parcela-input-ku">Katastrální území (název nebo kód):</label>' +
                  '<input type="text" id="parcela-input-ku" class="search-input" placeholder="např. Karlín nebo 727229" autocomplete="off">' +
                '</div>' +
                '<div class="form-row form-row-inline">' +
                  '<div style="flex:1;">' +
                    '<label for="parcela-input-kmen">Kmenové č.:</label>' +
                    '<input type="number" id="parcela-input-kmen" class="search-input" placeholder="např. 142" min="1">' +
                  '</div>' +
                  '<div style="flex:1;">' +
                    '<label for="parcela-input-poddel">Poddělení:</label>' +
                    '<input type="number" id="parcela-input-poddel" class="search-input" placeholder="např. 5" min="0">' +
                  '</div>' +
                '</div>' +
                '<div class="form-row">' +
                  '<label for="parcela-select-druh">Druh číslování:</label>' +
                  '<select id="parcela-select-druh" class="search-select">' +
                    '<option value="1">Pozemková parcela (PK/KN)</option>' +
                    '<option value="2">Stavební parcela (st.)</option>' +
                  '</select>' +
                '</div>' +
                '<button type="button" id="btn-submit-parcela" class="btn-search-submit">Vyhledat a zobrazit parcelu</button>' +
              '</div>' +
              '<div id="search-results-parcela" class="search-results-list"></div>' +
            '</div>' +
            '<div class="search-tab-content" id="tab-ku">' +
              '<div class="search-input-wrapper">' +
                '<input type="text" id="search-input-ku" class="search-input" placeholder="Název katastrálního území..." autocomplete="off">' +
                '<button type="button" id="btn-clear-search-ku" class="btn-clear-input" title="Vymazat">✕</button>' +
              '</div>' +
              '<div id="search-results-ku" class="search-results-list"></div>' +
            '</div>' +
          '</div>';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
      }
    });

    state.map.addControl(new SearchControl());

    var btnToggle = document.getElementById("btn-search-toggle");
    var flyout = document.getElementById("search-flyout");
    var btnClose = document.getElementById("btn-close-search");

    if (btnToggle && flyout) {
      btnToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = flyout.classList.toggle("is-open");
        btnToggle.classList.toggle("is-active", isOpen);

        if (isOpen) {
          var basePopover = document.getElementById("basemap-popover");
          var baseBtn = document.getElementById("btn-basemap-toggle");
          if (basePopover) basePopover.classList.remove("is-open");
          if (baseBtn) baseBtn.classList.remove("is-active");

          var measurePopover = document.getElementById("measure-popover");
          var btnMeasure = document.getElementById("btn-measure-toggle");
          if (measurePopover) measurePopover.classList.remove("is-open");
          if (btnMeasure && typeof measureState !== "undefined" && !measureState.mode) {
            btnMeasure.classList.remove("is-active");
          }

          var activeTab = flyout.querySelector(".search-tab-content.active");
          if (activeTab) {
            var input = activeTab.querySelector("input[type='text']");
            if (input) setTimeout(function () { input.focus(); }, 120);
          }
        }
      });

      if (btnClose) {
        btnClose.addEventListener("click", function (e) {
          e.stopPropagation();
          flyout.classList.remove("is-open");
          btnToggle.classList.remove("is-active");
        });
      }

      document.addEventListener("click", function (e) {
        if (!flyout.contains(e.target) && !btnToggle.contains(e.target)) {
          flyout.classList.remove("is-open");
          btnToggle.classList.remove("is-active");
        }
      });
    }

    // Přepínání tabů ve vyhledávání
    document.querySelectorAll(".search-tab-btn").forEach(function (tabBtn) {
      tabBtn.addEventListener("click", function () {
        var tabId = this.getAttribute("data-tab");
        document.querySelectorAll(".search-tab-btn").forEach(function (b) { b.classList.remove("active"); });
        document.querySelectorAll(".search-tab-content").forEach(function (c) { c.classList.remove("active"); });

        this.classList.add("active");
        var content = document.getElementById("tab-" + tabId);
        if (content) {
          content.classList.add("active");
          var input = content.querySelector("input[type='text']");
          if (input) setTimeout(function () { input.focus(); }, 60);
        }
      });
    });

    // Obsluha našeptávače adres (ČÚZK Geokodér / RÚIAN)
    setupAdresaAutocomplete();
    // Obsluha formuláře vyhledání parcely
    setupParcelaSearch();
    // Obsluha našeptávače Katastrálních území
    setupKuAutocomplete();
  }

  function toggleSearchFlyout(forceState) {
    var flyout = document.getElementById("search-flyout");
    var btn = document.getElementById("btn-search-toggle");
    if (!flyout || !btn) return;

    var isOpen = forceState !== undefined ? forceState : !flyout.classList.contains("is-open");
    if (isOpen) {
      flyout.classList.add("is-open");
      btn.classList.add("is-active");
    } else {
      flyout.classList.remove("is-open");
      btn.classList.remove("is-active");
    }
  }

  // Našeptávač adres
  function setupAdresaAutocomplete() {
    var input = document.getElementById("search-input-adresa");
    var btnClear = document.getElementById("btn-clear-search-adresa");
    var resultsEl = document.getElementById("search-results-adresa");
    if (!input || !resultsEl) return;

    var debounceTimer = null;

    input.addEventListener("input", function () {
      var q = input.value.trim();
      if (btnClear) btnClear.style.display = q.length > 0 ? "block" : "none";

      clearTimeout(debounceTimer);
      if (q.length < 3) {
        resultsEl.innerHTML = "";
        return;
      }

      debounceTimer = setTimeout(function () {
        fetchAdresaResults(q, resultsEl);
      }, 260);
    });

    if (btnClear) {
      btnClear.addEventListener("click", function () {
        input.value = "";
        btnClear.style.display = "none";
        resultsEl.innerHTML = "";
        input.focus();
      });
    }
  }

  function fetchAdresaResults(query, resultsEl) {
    resultsEl.innerHTML = '<div class="search-tip">Hledám adresu v registru RÚIAN...</div>';
    var url = "https://geoportal.cuzk.cz/geocoding/autoconf.aspx?query=" + encodeURIComponent(query);

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        renderAdresaResults(data, resultsEl);
      })
      .catch(function (err) {
        console.warn("Chyba vyhledání adresy:", err);
        resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Chyba při komunikaci s vyhledávačem ČÚZK.</div>';
      });
  }

  function renderAdresaResults(data, resultsEl) {
    var items = (data && data.results) ? data.results : [];
    if (items.length === 0) {
      resultsEl.innerHTML = '<div class="search-tip">Nebyly nalezeny žádné adresy odpovídající dotazu.</div>';
      return;
    }

    var html = "";
    items.slice(0, 10).forEach(function (it, idx) {
      html +=
        '<div class="search-result-item" data-idx="' + idx + '">' +
          '<div class="result-title">' + (it.label || it.name || "Adresa") + '</div>' +
          '<div class="result-subtitle">' + (it.type || "Adresní místo RÚIAN") + '</div>' +
        '</div>';
    });

    resultsEl.innerHTML = html;

    resultsEl.querySelectorAll(".search-result-item").forEach(function (el) {
      el.addEventListener("click", function () {
        var idx = parseInt(this.getAttribute("data-idx"), 10);
        var chosen = items[idx];
        if (chosen && chosen.x !== undefined && chosen.y !== undefined) {
          var latlng = jtskToWgs84(chosen.y, chosen.x);
          if (latlng) {
            state.map.setView(latlng, 18);
            L.popup({ minWidth: 240 })
              .setLatLng(latlng)
              .setContent(
                '<div style="padding:6px 4px;">' +
                  '<div style="font-weight:700; color:#c96262; font-size:12.5px; margin-bottom:4px;">' + (chosen.label || "Nalezená adresa") + '</div>' +
                  '<div style="font-size:11px; color:#64748b;">RÚIAN adresní místo</div>' +
                '</div>'
              )
              .openOn(state.map);
          }
        }
      });
    });
  }

  // Vyhledání parcely
  function setupParcelaSearch() {
    var btnSubmit = document.getElementById("btn-submit-parcela");
    if (!btnSubmit) return;

    btnSubmit.addEventListener("click", function () {
      executeParcelaSearch();
    });
  }

  async function executeParcelaSearch() {
    var kuInput = document.getElementById("parcela-input-ku");
    var kmenInput = document.getElementById("parcela-input-kmen");
    var poddelInput = document.getElementById("parcela-input-poddel");
    var druhSelect = document.getElementById("parcela-select-druh");
    var resultsEl = document.getElementById("search-results-parcela");

    if (!kuInput || !kmenInput || !resultsEl) return;

    var kuVal = kuInput.value.trim();
    var kmenVal = parseInt(kmenInput.value, 10);
    var poddelVal = poddelInput.value.trim() ? parseInt(poddelInput.value, 10) : 0;
    var druhVal = druhSelect ? parseInt(druhSelect.value, 10) : 0;

    if (!kuVal) {
      resultsEl.innerHTML = '<div class="search-tip" style="color:#c96262;">Zadejte název nebo kód katastrálního území.</div>';
      kuInput.focus();
      return;
    }
    if (isNaN(kmenVal) || kmenVal <= 0) {
      resultsEl.innerHTML = '<div class="search-tip" style="color:#c96262;">Zadejte platné kmenové číslo parcely.</div>';
      kmenInput.focus();
      return;
    }

    var fullLabel = (druhVal === 2 ? "st. " : "") + kmenVal + (poddelVal ? "/" + poddelVal : "");
    resultsEl.innerHTML = '<div class="search-tip">Hledám parcelu ' + fullLabel + ' v katastru nemovitostí...</div>';

    try {
      var kuKod = parseInt(kuVal, 10);
      if (isNaN(kuKod) || kuKod.toString().length < 5) {
        var kuRes = await fetch("https://geoportal.cuzk.cz/geocoding/autoconf.aspx?query=" + encodeURIComponent(kuVal) + "&type=ku");
        var kuData = await kuRes.json();
        if (kuData && kuData.results && kuData.results.length > 0) {
          kuKod = parseInt(kuData.results[0].id || kuData.results[0].kod, 10);
        }
      }

      var whereParts = ["kmenovecislo=" + kmenVal];
      if (poddelVal > 0) {
        whereParts.push("poddelenicisla=" + poddelVal);
      } else {
        whereParts.push("(poddelenicisla IS NULL OR poddelenicisla=0)");
      }
      if (druhVal > 0) {
        whereParts.push("druhcislovanikod=" + druhVal);
      }
      if (kuKod) {
        whereParts.push("katastralniuzemi=" + kuKod);
      }

      var whereClause = whereParts.join(" AND ");

      var url =
        "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/5/query?" +
        "where=" + encodeURIComponent(whereClause) +
        "&outFields=*&returnGeometry=true&f=geojson&outSR=4326";

      var parcelRes = await fetch(url);
      var parcelData = await parcelRes.json();

      if (parcelData && parcelData.features && parcelData.features.length > 0) {
        var feat = parcelData.features[0];
        if (kuKod) {
          var resolved = await resolveKuAndObec(kuKod);
          feat._kuNazev = resolved.kuNazev;
          feat._obecNazev = resolved.obecNazev;
        }
        displayFoundParcel(feat);
      } else {
        resultsEl.innerHTML =
          '<div class="search-tip" style="color:#c96262;">' +
            'Parcela ' + fullLabel + ' v KÚ ' + kuVal + ' nebyla v RÚIAN nalezena.' +
          '</div>';
      }
    } catch (err) {
      console.error("Chyba při vyhledávání parcely:", err);
      resultsEl.innerHTML = '<div class="search-tip" style="color:#c96262;">Chyba při komunikaci: ' + (err.message || err) + '</div>';
    }
  }

  function displayFoundParcel(feature) {
    if (!feature || !feature.geometry) return;
    feature._isParcel = true;

    highlightParcelGeometry(feature.geometry, true);

    var layer = L.geoJSON(feature);
    var bounds = layer.getBounds();
    state.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 19 });

    var center = bounds.getCenter();
    queryState.currentData = {
      latlng: center,
      features: [feature],
      index: 0
    };

    var popup = L.popup({ minWidth: 290, maxWidth: 360, autoPan: true })
      .setLatLng(center)
      .setContent(renderFeaturePopupContent(queryState.currentData))
      .openOn(state.map);

    queryState.popup = popup;
    attachPopupListeners(popup);

    var resultsEl = document.getElementById("search-results-parcela");
    if (resultsEl) {
      var props = feature.properties || {};
      var num = props.cisloparcely || (props.kmenovecislo + (props.poddelenicisla ? "/" + props.poddelenicisla : ""));
      resultsEl.innerHTML =
        '<div style="padding:8px 6px; font-size:11.5px; color:#16a34a; font-weight:600; display:flex; align-items:center; gap:6px;">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
          '<span>Parcela č. ' + num + ' byla nalezena a zobrazena na mapě.</span>' +
        '</div>';
    }
  }

  // Našeptávač Katastrálních území (KÚ)
  function setupKuAutocomplete() {
    var input = document.getElementById("search-input-ku");
    var btnClear = document.getElementById("btn-clear-search-ku");
    var resultsEl = document.getElementById("search-results-ku");
    if (!input || !resultsEl) return;

    var debounceTimer = null;

    input.addEventListener("input", function () {
      var q = input.value.trim();
      if (btnClear) btnClear.style.display = q.length > 0 ? "block" : "none";

      clearTimeout(debounceTimer);
      if (q.length < 2) {
        resultsEl.innerHTML = "";
        return;
      }

      debounceTimer = setTimeout(function () {
        fetchKuResults(q, resultsEl);
      }, 260);
    });

    if (btnClear) {
      btnClear.addEventListener("click", function () {
        input.value = "";
        btnClear.style.display = "none";
        resultsEl.innerHTML = "";
        input.focus();
      });
    }
  }

  function fetchKuResults(query, resultsEl) {
    resultsEl.innerHTML = '<div class="search-tip">Vyhledávám katastrální území...</div>';
    var url = "https://geoportal.cuzk.cz/geocoding/autoconf.aspx?query=" + encodeURIComponent(query) + "&type=ku";

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        renderKuResults(data, resultsEl);
      })
      .catch(function (err) {
        console.warn("Chyba vyhledání KÚ:", err);
        resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Chyba při komunikaci s ČÚZK.</div>';
      });
  }

  function renderKuResults(data, resultsEl) {
    var items = (data && data.results) ? data.results : [];
    if (items.length === 0) {
      resultsEl.innerHTML = '<div class="search-tip">Nebylo nalezeno žádné odpovídající katastrální území.</div>';
      return;
    }

    var html = "";
    items.slice(0, 10).forEach(function (it, idx) {
      html +=
        '<div class="search-result-item" data-idx="' + idx + '">' +
          '<div class="result-title">' + (it.label || it.name || "KÚ") + '</div>' +
          '<div class="result-subtitle">Kód KÚ: ' + (it.id || it.kod || "—") + '</div>' +
        '</div>';
    });

    resultsEl.innerHTML = html;

    resultsEl.querySelectorAll(".search-result-item").forEach(function (el) {
      el.addEventListener("click", function () {
        var idx = parseInt(this.getAttribute("data-idx"), 10);
        var chosen = items[idx];
        if (chosen && chosen.x !== undefined && chosen.y !== undefined) {
          var latlng = jtskToWgs84(chosen.y, chosen.x);
          if (latlng) {
            state.map.setView(latlng, 15);
            L.popup({ minWidth: 240 })
              .setLatLng(latlng)
              .setContent(
                '<div style="padding:6px 4px;">' +
                  '<div style="font-weight:700; color:#c96262; font-size:13px; margin-bottom:4px;">' + (chosen.label || "Katastrální území") + '</div>' +
                  '<div style="font-size:11px; color:#64748b;">Kód KÚ: <b>' + (chosen.id || chosen.kod || "—") + '</b></div>' +
                '</div>'
              )
              .openOn(state.map);
          }
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Měření vzdálenosti (linie) a plochy (polygon) se živým zobrazováním
  // --------------------------------------------------------------------------

  var measureState = {
    mode: null, // "line" | "area" | null
    points: [],
    markers: [],
    segmentTooltips: [],
    rubberline: null,
    rubberpolygon: null,
    liveTooltip: null,
    activeLayer: null
  };

  function initMeasureControl() {
    var MeasureControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control measure-control");

        container.innerHTML =
          '<button type="button" id="btn-measure-toggle" class="measure-toggle-btn" title="Měření vzdálenosti a plochy" aria-label="Měření">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M21.3 8.7 8.7 21.3c-1 1-2.6 1-3.6 0l-1.4-1.4c-1-1-1-2.6 0-3.6L16.3 3.7c1-1 2.6-1 3.6 0l1.4 1.4c1 1 1 2.6 0 3.6z"></path>' +
              '<path d="m7.5 10.5 2 2"></path>' +
              '<path d="m10.5 7.5 2 2"></path>' +
              '<path d="m13.5 4.5 2 2"></path>' +
              '<path d="m4.5 13.5 2 2"></path>' +
            '</svg>' +
          '</button>' +
          '<div id="measure-popover" class="measure-popover">' +
            '<div class="measure-popover-header">' +
              '<span>Měření v mapě</span>' +
              '<button type="button" id="btn-close-measure" class="btn-close-popover" title="Zavřít">✕</button>' +
            '</div>' +
            '<div class="measure-options">' +
              '<button type="button" class="measure-mode-btn" data-measure="line">' +
                '<div class="measure-mode-icon">' +
                  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
                    '<polyline points="4 19 10 7 15 15 20 5"></polyline>' +
                    '<circle cx="4" cy="19" r="2" fill="currentColor"></circle>' +
                    '<circle cx="10" cy="7" r="2" fill="currentColor"></circle>' +
                    '<circle cx="15" cy="15" r="2" fill="currentColor"></circle>' +
                    '<circle cx="20" cy="5" r="2" fill="currentColor"></circle>' +
                  '</svg>' +
                '</div>' +
                '<div class="measure-mode-info">' +
                  '<span class="measure-mode-title">Měření délky / linie</span>' +
                  '<span class="measure-mode-desc">Vzdálenosti segmentů a celková délka trasy</span>' +
                '</div>' +
              '</button>' +
              '<button type="button" class="measure-mode-btn" data-measure="area">' +
                '<div class="measure-mode-icon">' +
                  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">' +
                    '<polygon points="12 2 22 8.5 18 21 6 21 2 8.5 12 2" stroke-dasharray="2 2"></polygon>' +
                    '<circle cx="12" cy="2" r="2" fill="currentColor"></circle>' +
                    '<circle cx="22" cy="8.5" r="2" fill="currentColor"></circle>' +
                    '<circle cx="18" cy="21" r="2" fill="currentColor"></circle>' +
                    '<circle cx="6" cy="21" r="2" fill="currentColor"></circle>' +
                    '<circle cx="2" cy="8.5" r="2" fill="currentColor"></circle>' +
                  '</svg>' +
                '</div>' +
                '<div class="measure-mode-info">' +
                  '<span class="measure-mode-title">Měření plochy</span>' +
                  '<span class="measure-mode-desc">Výměra mnohoúhelníku (m², ha) a obvod</span>' +
                '</div>' +
              '</button>' +
            '</div>' +
            '<div class="measure-popover-footer">' +
              '<button type="button" id="btn-measure-clear" class="btn-measure-clear" title="Smazat nakreslené měření">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
                '<span>Vymazat měření</span>' +
              '</button>' +
              '<div class="measure-hint">' +
                '💡 <b>Kliknutím</b> vkládáte body. <b>Dvojklikem</b> nebo kliknutím na první bod měření dokončíte. <b>Esc</b> zruší měření.' +
              '</div>' +
            '</div>' +
          '</div>';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
      }
    });

    state.map.addControl(new MeasureControl());

    var btnToggle = document.getElementById("btn-measure-toggle");
    var popover = document.getElementById("measure-popover");
    var btnClose = document.getElementById("btn-close-measure");
    var btnClear = document.getElementById("btn-measure-clear");

    if (btnToggle && popover) {
      btnToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = popover.classList.toggle("is-open");
        btnToggle.classList.toggle("is-active", isOpen || !!measureState.mode);

        if (isOpen) {
          var basePopover = document.getElementById("basemap-popover");
          var baseBtn = document.getElementById("btn-basemap-toggle");
          if (basePopover) basePopover.classList.remove("is-open");
          if (baseBtn) baseBtn.classList.remove("is-active");

          if (typeof toggleSearchFlyout === "function") {
            toggleSearchFlyout(false);
          }
          if (state.elevationMode) {
            toggleElevationMode(false);
          }
        }
      });

      if (btnClose) {
        btnClose.addEventListener("click", function (e) {
          e.stopPropagation();
          popover.classList.remove("is-open");
          if (!measureState.mode) {
            btnToggle.classList.remove("is-active");
          }
        });
      }

      document.addEventListener("click", function (e) {
        if (!popover.contains(e.target) && !btnToggle.contains(e.target)) {
          popover.classList.remove("is-open");
          if (!measureState.mode) {
            btnToggle.classList.remove("is-active");
          }
        }
      });

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          if (popover.classList.contains("is-open")) {
            popover.classList.remove("is-open");
          }
          if (measureState.mode) {
            setMeasureMode(null);
          }
        }
      });
    }

    document.querySelectorAll(".measure-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var targetMode = this.getAttribute("data-measure");
        if (measureState.mode === targetMode) {
          setMeasureMode(null);
        } else {
          setMeasureMode(targetMode);
        }
        if (popover) popover.classList.remove("is-open");
      });
    });

    if (btnClear) {
      btnClear.addEventListener("click", function (e) {
        e.stopPropagation();
        clearMeasureDrawings();
        if (popover) popover.classList.remove("is-open");
        var statusText = document.getElementById("map-status-text");
        if (statusText && measureState.mode) {
          statusText.textContent = measureState.mode === "line"
            ? "Měření vzdálenosti: kliknutím vložte první bod"
            : "Měření plochy: kliknutím vložte první vrchol";
        }
      });
    }

    state.map.on("mousemove", onMeasureMouseMove);
    state.map.on("dblclick", onMeasureMapDblClick);
  }

  function setMeasureMode(mode) {
    measureState.mode = mode;
    clearMeasureDrawings();

    var btnToggle = document.getElementById("btn-measure-toggle");
    var mapEl = document.getElementById("map");
    var statusDot = document.getElementById("status-dot");
    var statusText = document.getElementById("map-status-text");

    document.querySelectorAll(".measure-mode-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-measure") === mode);
    });

    if (mode) {
      if (btnToggle) btnToggle.classList.add("is-active");
      if (mapEl) mapEl.classList.add("measuring-active");
      if (statusDot) statusDot.className = "status-dot measure-active";
      if (statusText) {
        statusText.textContent = mode === "line"
          ? "Režim měření vzdálenosti aktivní – kliknutím vložte první bod do mapy"
          : "Režim měření plochy aktivní – kliknutím vložte první vrchol mnohoúhelníku";
      }

      if (state.elevationMode) {
        toggleElevationMode(false);
      }
      if (typeof toggleSearchFlyout === "function") {
        toggleSearchFlyout(false);
      }
      state.map.doubleClickZoom.disable();
    } else {
      if (btnToggle) btnToggle.classList.remove("is-active");
      if (mapEl) mapEl.classList.remove("measuring-active");
      state.map.doubleClickZoom.enable();

      var z = state.map.getZoom();
      if (statusDot && statusText) {
        if (z >= 14) {
          statusDot.className = "status-dot";
          statusText.textContent = "Klikněte na parcelu v mapě pro zobrazení vlastností";
        } else {
          statusDot.className = "status-dot inactive";
          statusText.textContent = "Katastr neaktivní (přibližte na zoom 14+ pro dotazování)";
        }
      }
    }
  }

  function onMeasureMapClick(e) {
    if (!measureState.mode) return;
    var latlng = e.latlng;
    var pts = measureState.points;
    var len = pts.length;

    if (len >= 3 && measureState.mode === "area") {
      var distToFirst = latlng.distanceTo(pts[0]);
      var pxDist = state.map.latLngToContainerPoint(latlng).distanceTo(state.map.latLngToContainerPoint(pts[0]));
      if (distToFirst < 10 || pxDist < 18) {
        finishMeasure();
        return;
      }
    }

    pts.push(latlng);
    var newIdx = pts.length - 1;

    var isFirst = newIdx === 0;
    var nodeIcon = L.divIcon({
      className: "measure-node-wrapper",
      html: '<div class="measure-node-marker' + (isFirst ? ' first-node' : '') + '"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    var marker = L.marker(latlng, { icon: nodeIcon, interactive: true }).addTo(state.map);
    measureState.markers.push(marker);

    if (isFirst && measureState.mode === "area") {
      marker.on("click", function (me) {
        L.DomEvent.stopPropagation(me);
        if (measureState.points.length >= 3) {
          finishMeasure();
        }
      });
    }

    if (newIdx > 0) {
      var prevPt = pts[newIdx - 1];
      var segDist = prevPt.distanceTo(latlng);
      var midLat = (prevPt.lat + latlng.lat) / 2;
      var midLng = (prevPt.lng + latlng.lng) / 2;

      var segTooltip = L.tooltip({
        permanent: true,
        direction: "center",
        className: "measure-segment-tooltip",
        offset: [0, 0],
        interactive: false
      })
      .setLatLng([midLat, midLng])
      .setContent(formatMeasureDistance(segDist))
      .addTo(state.map);

      measureState.segmentTooltips.push(segTooltip);
    }

    updateFixedMeasureLayer();

    var statusText = document.getElementById("map-status-text");
    if (statusText) {
      if (measureState.mode === "line") {
        var totalDist = calculateLineDistance(pts);
        statusText.textContent = "Délka linie: " + formatMeasureDistance(totalDist) + " (" + pts.length + " uzlů) – dvojklik dokončí";
      } else {
        var totalArea = pts.length >= 3 ? calculatePolygonArea(pts) : 0;
        var perim = calculateLineDistance(pts) + (pts.length >= 3 ? pts[pts.length - 1].distanceTo(pts[0]) : 0);
        statusText.textContent = pts.length >= 3
          ? "Plocha: " + formatMeasureArea(totalArea) + " (obvod: " + formatMeasureDistance(perim) + ") – dvojklik dokončí"
          : "Měření plochy: vložte alespoň 3 body (" + pts.length + "/3)";
      }
    }
  }

  function onMeasureMouseMove(e) {
    if (!measureState.mode || measureState.points.length === 0) return;
    var cursorPt = e.latlng;
    var pts = measureState.points;
    var lastPt = pts[pts.length - 1];

    var segDist = lastPt.distanceTo(cursorPt);

    if (measureState.mode === "line") {
      var previewPts = pts.concat([cursorPt]);
      var totalDist = calculateLineDistance(previewPts);

      if (!measureState.rubberline) {
        measureState.rubberline = L.polyline([lastPt, cursorPt], {
          color: "#c96262",
          weight: 3,
          dashArray: "6, 6",
          opacity: 0.85
        }).addTo(state.map);
      } else {
        measureState.rubberline.setLatLngs([lastPt, cursorPt]);
      }

      var tooltipContent = pts.length === 1
        ? formatMeasureDistance(segDist)
        : '<span style="color:#fce7e7;">+ ' + formatMeasureDistance(segDist) + '</span> | Celkem: <b>' + formatMeasureDistance(totalDist) + '</b>';

      if (!measureState.liveTooltip) {
        measureState.liveTooltip = L.tooltip({
          permanent: true,
          direction: "right",
          className: "measure-total-tooltip",
          offset: [14, 0]
        })
        .setLatLng(cursorPt)
        .setContent(tooltipContent)
        .addTo(state.map);
      } else {
        measureState.liveTooltip.setLatLng(cursorPt).setContent(tooltipContent);
      }
    } else if (measureState.mode === "area") {
      var previewAreaPts = pts.concat([cursorPt]);

      if (!measureState.rubberpolygon) {
        measureState.rubberpolygon = L.polygon(previewAreaPts, {
          color: "#c96262",
          weight: 2,
          dashArray: "5, 5",
          fillColor: "#c96262",
          fillOpacity: 0.15
        }).addTo(state.map);
      } else {
        measureState.rubberpolygon.setLatLngs(previewAreaPts);
      }

      var tooltipAreaContent;
      if (pts.length < 2) {
        tooltipAreaContent = formatMeasureDistance(segDist);
      } else {
        var currentArea = calculatePolygonArea(previewAreaPts);
        var currentPerim = calculateLineDistance(previewAreaPts) + cursorPt.distanceTo(pts[0]);
        tooltipAreaContent = '<b>' + formatMeasureArea(currentArea) + '</b><br><span style="font-size:10px; font-weight:normal; opacity:0.9;">obvod ' + formatMeasureDistance(currentPerim) + '</span>';
      }

      if (!measureState.liveTooltip) {
        measureState.liveTooltip = L.tooltip({
          permanent: true,
          direction: "right",
          className: "measure-total-tooltip",
          offset: [14, 0]
        })
        .setLatLng(cursorPt)
        .setContent(tooltipAreaContent)
        .addTo(state.map);
      } else {
        measureState.liveTooltip.setLatLng(cursorPt).setContent(tooltipAreaContent);
      }
    }
  }

  function onMeasureMapDblClick(e) {
    if (!measureState.mode || measureState.points.length === 0) return;
    L.DomEvent.stopPropagation(e);
    finishMeasure();
  }

  function finishMeasure() {
    var pts = measureState.points;
    if (pts.length === 0) return;

    if (measureState.rubberline) {
      state.map.removeLayer(measureState.rubberline);
      measureState.rubberline = null;
    }
    if (measureState.rubberpolygon) {
      state.map.removeLayer(measureState.rubberpolygon);
      measureState.rubberpolygon = null;
    }
    if (measureState.liveTooltip) {
      state.map.removeLayer(measureState.liveTooltip);
      measureState.liveTooltip = null;
    }

    if (measureState.mode === "line") {
      if (pts.length >= 2) {
        var totalDist = calculateLineDistance(pts);
        var endPt = pts[pts.length - 1];

        var totalTooltip = L.tooltip({
          permanent: true,
          direction: "top",
          className: "measure-total-tooltip",
          offset: [0, -10]
        })
        .setLatLng(endPt)
        .setContent('Celková délka: <b>' + formatMeasureDistance(totalDist) + '</b>')
        .addTo(state.map);

        measureState.segmentTooltips.push(totalTooltip);

        var statusText = document.getElementById("map-status-text");
        if (statusText) {
          statusText.textContent = "Dokončeno měření linie: " + formatMeasureDistance(totalDist) + " (" + pts.length + " uzlů)";
        }
      }
    } else if (measureState.mode === "area") {
      if (pts.length >= 3) {
        var area = calculatePolygonArea(pts);
        var perim = calculateLineDistance(pts) + pts[pts.length - 1].distanceTo(pts[0]);

        var lastPt = pts[pts.length - 1];
        var firstPt = pts[0];
        var closingDist = lastPt.distanceTo(firstPt);
        var midLat = (lastPt.lat + firstPt.lat) / 2;
        var midLng = (lastPt.lng + firstPt.lng) / 2;

        var closingTooltip = L.tooltip({
          permanent: true,
          direction: "center",
          className: "measure-segment-tooltip",
          offset: [0, 0]
        })
        .setLatLng([midLat, midLng])
        .setContent(formatMeasureDistance(closingDist))
        .addTo(state.map);

        measureState.segmentTooltips.push(closingTooltip);

        var centerLat = 0;
        var centerLng = 0;
        pts.forEach(function (p) {
          centerLat += p.lat;
          centerLng += p.lng;
        });
        centerLat /= pts.length;
        centerLng /= pts.length;

        var areaTooltip = L.tooltip({
          permanent: true,
          direction: "center",
          className: "measure-area-label",
          offset: [0, 0]
        })
        .setLatLng([centerLat, centerLng])
        .setContent('<div>' + formatMeasureArea(area) + '</div><div class="sub-perimeter">obvod ' + formatMeasureDistance(perim) + '</div>')
        .addTo(state.map);

        measureState.segmentTooltips.push(areaTooltip);

        var statusText2 = document.getElementById("map-status-text");
        if (statusText2) {
          statusText2.textContent = "Dokončeno měření plochy: " + formatMeasureArea(area) + " (obvod: " + formatMeasureDistance(perim) + ")";
        }
      }
    }

    updateFixedMeasureLayer(true);
    measureState.mode = null;
    var mapEl = document.getElementById("map");
    if (mapEl) mapEl.classList.remove("measuring-active");
    state.map.doubleClickZoom.enable();

    document.querySelectorAll(".measure-mode-btn").forEach(function (btn) {
      btn.classList.remove("active");
    });
  }

  function updateFixedMeasureLayer(isFinished) {
    var pts = measureState.points;
    if (pts.length < 2) return;

    if (measureState.activeLayer) {
      state.map.removeLayer(measureState.activeLayer);
      measureState.activeLayer = null;
    }

    if (measureState.mode === "line" || (!measureState.mode && measureState.activeLayerType === "line")) {
      measureState.activeLayerType = "line";
      measureState.activeLayer = L.polyline(pts, {
        color: "#c96262",
        weight: 3.5,
        opacity: 0.95
      }).addTo(state.map);
    } else {
      measureState.activeLayerType = "area";
      measureState.activeLayer = L.polygon(pts, {
        color: "#c96262",
        weight: 3,
        fillColor: "#c96262",
        fillOpacity: 0.22,
        dashArray: isFinished ? null : "4, 4"
      }).addTo(state.map);
    }
  }

  function clearMeasureDrawings() {
    measureState.points = [];

    measureState.markers.forEach(function (m) {
      if (state.map.hasLayer(m)) state.map.removeLayer(m);
    });
    measureState.markers = [];

    measureState.segmentTooltips.forEach(function (t) {
      if (state.map.hasLayer(t)) state.map.removeLayer(t);
    });
    measureState.segmentTooltips = [];

    if (measureState.rubberline && state.map.hasLayer(measureState.rubberline)) {
      state.map.removeLayer(measureState.rubberline);
      measureState.rubberline = null;
    }
    if (measureState.rubberpolygon && state.map.hasLayer(measureState.rubberpolygon)) {
      state.map.removeLayer(measureState.rubberpolygon);
      measureState.rubberpolygon = null;
    }
    if (measureState.liveTooltip && state.map.hasLayer(measureState.liveTooltip)) {
      state.map.removeLayer(measureState.liveTooltip);
      measureState.liveTooltip = null;
    }
    if (measureState.activeLayer && state.map.hasLayer(measureState.activeLayer)) {
      state.map.removeLayer(measureState.activeLayer);
      measureState.activeLayer = null;
    }
  }

  function calculateLineDistance(pts) {
    var total = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      total += pts[i].distanceTo(pts[i + 1]);
    }
    return total;
  }

  function calculatePolygonArea(latlngs) {
    if (latlngs.length < 3) return 0;
    var RADIUS = 6378137;
    var total = 0;
    var len = latlngs.length;

    for (var i = 0; i < len; i++) {
      var p1 = latlngs[i];
      var p2 = latlngs[(i + 1) % len];

      var radLat1 = (p1.lat * Math.PI) / 180;
      var radLat2 = (p2.lat * Math.PI) / 180;
      var dLng = ((p2.lng - p1.lng) * Math.PI) / 180;

      total += dLng * (2 + Math.sin(radLat1) + Math.sin(radLat2));
    }

    return Math.abs((total * RADIUS * RADIUS) / 2.0);
  }

  function formatMeasureDistance(d) {
    if (d === undefined || isNaN(d)) return "0 m";
    if (d < 1000) {
      return d < 10 ? d.toFixed(2) + " m" : d.toFixed(1) + " m";
    }
    return (d / 1000).toFixed(3) + " km";
  }

  function formatMeasureArea(a) {
    if (a === undefined || isNaN(a)) return "0 m²";
    if (a < 10000) {
      return a < 100 ? a.toFixed(1) + " m²" : Math.round(a).toLocaleString("cs-CZ") + " m²";
    }
    var ha = a / 10000;
    return ha.toFixed(3) + " ha (" + Math.round(a).toLocaleString("cs-CZ") + " m²)";
  }

  // --------------------------------------------------------------------------
  // Vrstvy mapy (Basemaps & Overlays)
  // --------------------------------------------------------------------------

  function initBaseLayers() {
    // 1. Ortofoto ČÚZK
    state.baseLayers.orto = L.tileLayer.wms(
      "https://ags.cuzk.cz/arcgis1/services/ORTOFOTO_WM/MapServer/WMSServer",
      {
        layers: "0",
        format: "image/jpeg",
        transparent: false,
        version: "1.3.0",
        crs: L.CRS.EPSG3857,
        maxZoom: 21,
        attribution: "ČÚZK Ortofoto ČR"
      }
    );

    // 2. Základní topografická mapa ČR (ZTM ČÚZK)
    state.baseLayers.ztm = L.tileLayer.wms(
      "https://ags.cuzk.cz/arcgis1/services/ZTM_WM/MapServer/WMSServer",
      {
        layers: "0",
        format: "image/png",
        transparent: false,
        version: "1.3.0",
        crs: L.CRS.EPSG3857,
        maxZoom: 21,
        attribution: "ČÚZK ZTM ČR"
      }
    );

    // 3. OpenStreetMap
    state.baseLayers.osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    });

    // Výchozí podklad: Ortofotomapa ČÚZK
    state.baseLayers.orto.addTo(state.map);
  }

  function switchBasemap(key) {
    if (key === state.activeBasemap) return;
    if (state.baseLayers[state.activeBasemap]) {
      state.map.removeLayer(state.baseLayers[state.activeBasemap]);
    }
    if (state.baseLayers[key]) {
      state.baseLayers[key].addTo(state.map);
      state.baseLayers[key].bringToBack();
      state.activeBasemap = key;
    }
  }

  // Pomocná funkce pro vytváření ČÚZK WMS vrstev
  function createCuzkWms(serviceUrl, layersParam, opacity, attribution, format, minZoom, maxZoom) {
    return L.tileLayer.wms(serviceUrl, {
      layers: layersParam,
      format: format || "image/png",
      transparent: true,
      version: "1.3.0",
      crs: L.CRS.EPSG3857,
      minZoom: minZoom !== undefined ? minZoom : 13,
      maxZoom: maxZoom !== undefined ? maxZoom : 21,
      opacity: opacity !== undefined ? opacity : 0.9,
      uppercase: true,
      attribution: attribution || "ČÚZK KN"
    });
  }

  // Inicializace vrstev Katastru nemovitostí a RÚIAN
  function initOverlayLayers() {
    var kmUrl = "https://services.cuzk.gov.cz/wms/local-km-wms.asp";
    var uxUrl = "https://services.cuzk.gov.cz/wms/local-ux-wms.asp";
    var ruianWms = "https://ags.cuzk.cz/arcgis/services/RUIAN/MapServer/WMSServer";

    // 1. Katastrální mapa (kompletní)
    state.overlayLayers.kn_komplet = createCuzkWms(kmUrl, "KN", 0.9, "ČÚZK Katastrální mapa", null, 14);

    // 2. Podrobné vrstvy parcel DKM
    state.overlayLayers.hranice_parcel_barevne = createCuzkWms(kmUrl, "hranice_parcel_barevne", 0.9, "ČÚZK Hranice parcel", null, 14);
    state.overlayLayers.parcelni_cisla = createCuzkWms(kmUrl, "parcelni_cisla", 0.95, "ČÚZK Parcelní čísla", null, 14);
    state.overlayLayers.obrazy_parcel = createCuzkWms(kmUrl, "hranice_parcel,obrazy_parcel", 0.9, "ČÚZK Obrazy parcel", null, 14);
    state.overlayLayers.def_parcely = createCuzkWms(kmUrl, "DEF_PARCELY", 0.85, "ČÚZK Definiční body parcel", null, 14);
    state.overlayLayers.podrobne_body = createCuzkWms(kmUrl, "podrobne_body_barevne", 0.85, "ČÚZK Lomové body", null, 14);
    state.overlayLayers.rst_kn = createCuzkWms(kmUrl, "RST_KN,RST_KMD", 0.75, "ČÚZK Rastr KN", null, 13);

    // 3. Budovy a stavební objekty
    state.overlayLayers.polygony_budov = createCuzkWms(kmUrl, "POL_BUDOV", 0.85, "ČÚZK Budovy KN", null, 14);
    state.overlayLayers.def_budovy = createCuzkWms(kmUrl, "DEF_BUDOVY", 0.9, "ČÚZK Definiční body budov", null, 14);
    state.overlayLayers.stavebni_objekty_ruian = createCuzkWms(ruianWms, "StavebniObjekt", 0.85, "ČÚZK RÚIAN", null, 14);

    // 4. Katastrální a správní členění
    state.overlayLayers.prehledka_kat_uz = createCuzkWms(kmUrl, "prehledka_kat_uz", 0.85, "ČÚZK Katastrální území", null, 9);
    state.overlayLayers.hranice_obce = createCuzkWms(uxUrl, "AU.4thOrder.Obec.AdministrativeBoundary", 0.85, "ČÚZK Hranice obcí", null, 8);
    state.overlayLayers.hranice_mestske_casti = createCuzkWms(uxUrl, "UX.MOMC.Boundary", 0.85, "ČÚZK MOMC", null, 9);
    state.overlayLayers.hranice_okresu = createCuzkWms(uxUrl, "AU.3rdOrder.Okres.AdministrativeBoundary,AU.2ndOrder.Kraj.AdministrativeBoundary", 0.85, "ČÚZK Okresy a kraje", null, 6);

    // 5. Adresní místa a ulice
    state.overlayLayers.adresni_mista = createCuzkWms(ruianWms, "AdresniMisto", 0.9, "ČÚZK RÚIAN Adresy", null, 15);
    state.overlayLayers.ulicni_sit = createCuzkWms(ruianWms, "Ulice", 0.85, "ČÚZK RÚIAN Ulice", null, 12);

    // 6. Cenové údaje, bonita a věcná břemena
    state.overlayLayers.cenove_udaje = createCuzkWms(kmUrl, "nem_ceny", 0.85, "ČÚZK Cenové údaje", null, 14);
    state.overlayLayers.bpej = createCuzkWms(ruianWms, "BonitovanaPudneEkologickaJednotka", 0.7, "ČÚZK / VÚMOP BPEJ", null, 12);
    state.overlayLayers.vecna_bremena = createCuzkWms(kmUrl, "vb_linie,vb", 0.85, "ČÚZK Věcná břemena", null, 14);
  }

  // --------------------------------------------------------------------------
  // Obsluha postranního panelu vrstev
  // --------------------------------------------------------------------------
  function setupSidebarControls() {
    // 1. Jednotlivé samostatné vrstvy (layer-card)
    document.querySelectorAll(".layer-card").forEach(function (card) {
      var layerKey = card.getAttribute("data-layer");
      var checkbox = card.querySelector("input[type='checkbox']");
      var slider = card.querySelector(".opacity-slider");
      var valEl = card.querySelector(".opacity-val");

      if (checkbox) {
        checkbox.addEventListener("change", function () {
          toggleSingleLayer(layerKey, checkbox.checked);
          card.classList.toggle("is-active", checkbox.checked);
        });
      }

      if (slider && valEl) {
        slider.addEventListener("input", function () {
          var op = parseFloat(slider.value);
          valEl.textContent = Math.round(op * 100) + "%";
          state.layerOpacities[layerKey] = op;
          if (state.overlayLayers[layerKey]) {
            state.overlayLayers[layerKey].setOpacity(op);
          }
        });
      }
    });

    // 2. Skupiny vrstev (layer-group-card s podskupinami)
    document.querySelectorAll(".layer-group-card").forEach(function (groupCard) {
      var header = groupCard.querySelector(".layer-group-header");
      var masterSwitch = groupCard.querySelector(".group-master-switch");
      var groupOpacitySlider = groupCard.querySelector(".group-opacity-slider");
      var groupOpacityVal = groupCard.querySelector(".group-sublayer-toolbar .opacity-val");

      if (header) {
        header.addEventListener("click", function (e) {
          if (e.target.closest(".switch-control")) return;
          groupCard.classList.toggle("is-expanded");
        });
      }

      if (masterSwitch) {
        masterSwitch.addEventListener("change", function () {
          var isChecked = masterSwitch.checked;
          groupCard.querySelectorAll(".sublayer-checkbox").forEach(function (subCb) {
            subCb.checked = isChecked;
            var subKey = subCb.closest(".sublayer-item").getAttribute("data-sublayer");
            toggleSublayer(subKey, isChecked);
          });
          updateGroupBadge(groupCard);
        });
      }

      groupCard.querySelectorAll(".sublayer-checkbox").forEach(function (subCb) {
        subCb.addEventListener("change", function () {
          var subKey = subCb.closest(".sublayer-item").getAttribute("data-sublayer");
          toggleSublayer(subKey, subCb.checked);
          updateGroupBadge(groupCard);
        });
      });

      if (groupOpacitySlider && groupOpacityVal) {
        groupOpacitySlider.addEventListener("input", function () {
          var op = parseFloat(groupOpacitySlider.value);
          groupOpacityVal.textContent = Math.round(op * 100) + "%";
          groupCard.querySelectorAll(".sublayer-item").forEach(function (item) {
            var subKey = item.getAttribute("data-sublayer");
            state.layerOpacities[subKey] = op;
            if (state.overlayLayers[subKey]) {
              state.overlayLayers[subKey].setOpacity(op);
            }
          });
        });
      }
    });

    // 3. Tlačítko "Doporučené" (zapne Katastrální mapu + KÚ)
    var btnAllKn = document.getElementById("btn-all-kn");
    if (btnAllKn) {
      btnAllKn.addEventListener("click", function () {
        var card = document.querySelector('.layer-card[data-layer="kn_komplet"]');
        if (card) {
          var cb = card.querySelector("input[type='checkbox']");
          if (cb) {
            cb.checked = true;
            toggleSingleLayer("kn_komplet", true);
            card.classList.add("is-active");
          }
        }
        var kuCb = document.querySelector('.sublayer-item[data-sublayer="prehledka_kat_uz"] input[type="checkbox"]');
        if (kuCb) {
          kuCb.checked = true;
          toggleSublayer("prehledka_kat_uz", true);
          var groupCard = kuCb.closest(".layer-group-card");
          if (groupCard) updateGroupBadge(groupCard);
        }
      });
    }

    // 4. Tlačítko "Reset" (vypne všechny vrstvy)
    var btnReset = document.getElementById("btn-reset-layers");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        document.querySelectorAll(".layer-card").forEach(function (card) {
          var layerKey = card.getAttribute("data-layer");
          var cb = card.querySelector("input[type='checkbox']");
          if (cb) cb.checked = false;
          card.classList.remove("is-active");
          toggleSingleLayer(layerKey, false);
        });

        document.querySelectorAll(".layer-group-card").forEach(function (groupCard) {
          var master = groupCard.querySelector(".group-master-switch");
          if (master) master.checked = false;
          groupCard.querySelectorAll(".sublayer-checkbox").forEach(function (subCb) {
            subCb.checked = false;
            var subKey = subCb.closest(".sublayer-item").getAttribute("data-sublayer");
            toggleSublayer(subKey, false);
          });
          updateGroupBadge(groupCard);
        });
      });
    }

    // 5. Rychlý skok do měst (zoom 16)
    var CITIES = {
      praha: [50.0878, 14.4205],
      brno: [49.1951, 16.6068],
      ostrava: [49.8209, 18.2625],
      plzen: [49.7475, 13.3776],
      liberec: [50.7663, 15.0543],
      olomouc: [49.5938, 17.2509],
      hradec: [50.2104, 15.8252],
      cb: [48.9745, 14.4743]
    };

    document.querySelectorAll(".quick-jump-chips .chip-btn").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var cityKey = this.getAttribute("data-city");
        var coords = CITIES[cityKey];
        if (coords) {
          state.map.setView(coords, 16);
        }
      });
    });
  }

  function toggleSingleLayer(key, enable) {
    var layer = state.overlayLayers[key];
    if (!layer) return;

    if (enable) {
      if (!state.map.hasLayer(layer)) {
        layer.addTo(state.map);
      }
      state.activeSingleLayers.add(key);
    } else {
      if (state.map.hasLayer(layer)) {
        state.map.removeLayer(layer);
      }
      state.activeSingleLayers.delete(key);
    }

    if (typeof updateLegendBadge === "function") updateLegendBadge();
    if (typeof refreshActiveLegendsIfVisible === "function") refreshActiveLegendsIfVisible();
  }

  function toggleSublayer(key, enable) {
    var layer = state.overlayLayers[key];
    if (!layer) return;

    if (enable) {
      if (!state.map.hasLayer(layer)) {
        layer.addTo(state.map);
      }
      state.activeSublayers.add(key);
    } else {
      if (state.map.hasLayer(layer)) {
        state.map.removeLayer(layer);
      }
      state.activeSublayers.delete(key);
    }

    if (typeof updateLegendBadge === "function") updateLegendBadge();
    if (typeof refreshActiveLegendsIfVisible === "function") refreshActiveLegendsIfVisible();
  }

  function updateGroupBadge(groupCard) {
    var total = groupCard.querySelectorAll(".sublayer-checkbox").length;
    var checked = groupCard.querySelectorAll(".sublayer-checkbox:checked").length;
    var badge = groupCard.querySelector(".group-count-badge");
    var master = groupCard.querySelector(".group-master-switch");

    if (badge) {
      badge.textContent = checked + "/" + total;
      badge.classList.toggle("has-active", checked > 0);
    }

    if (master) {
      master.checked = checked === total && total > 0;
      master.indeterminate = checked > 0 && checked < total;
    }

    groupCard.classList.toggle("is-active", checked > 0);
  }

  // --------------------------------------------------------------------------
  // Legenda a značkový klíč katastru nemovitostí (ČÚZK & RÚIAN)
  // Dle vyhlášky č. 357/2013 Sb. o katastru nemovitostí (katastrální vyhláška)
  // --------------------------------------------------------------------------

  var KAT_LEGEND_DATA = {
    kn_komplet: {
      title: "Katastrální mapa (kompletní)",
      provider: "ČÚZK • KN",
      category: "Katastrální mapa",
      color: "#c96262",
      desc: "Kompletní katastrální mapa dle vyhlášky č. 357/2013 Sb. (hranice parcel, parcelní čísla, budovy, vnitřní kresba a břemena).",
      docUrl: "https://services.cuzk.cz/doc/znackovy-klic.pdf",
      docTitle: "Značkový klíč ČÚZK (PDF)",
      items: [
        { type: "line", color: "#16a34a", width: 2.2, label: "Hranice parcel určené číselně (kód kvality 3, přesnost 0,14 m)" },
        { type: "line", color: "#1e293b", width: 1.8, label: "Hranice parcel určené z dřívějších map (kód kvality 4–8)" },
        { type: "line", color: "#64748b", width: 1.5, dash: "4,3", label: "Hranice sporná, neujasněná nebo prozatímní" },
        { type: "text", text: "142/5", color: "#0f172a", label: "Parcelní číslo pozemkové parcely" },
        { type: "text", text: "st. 89", color: "#b91c1c", label: "Parcelní číslo stavební parcely (s předponou st.)" },
        { type: "polygon", color: "#b91c1c", fill: "rgba(185,28,28,0.25)", border: "#b91c1c", width: 1.8, label: "Budova zděná, betonová nebo kamenná" },
        { type: "polygon", color: "#ca8a04", fill: "rgba(202,138,4,0.25)", border: "#ca8a04", width: 1.8, label: "Budova dřevěná nebo lehká konstrukce" },
        { type: "polygon", color: "#78716c", fill: "transparent", border: "#78716c", width: 1.5, dash: "4,3", label: "Rozestavěná, podzemní stavba nebo přístřešek" },
        { type: "point", color: "#dc2626", border: "#991b1b", radius: 4, label: "Definiční bod parcely / budovy" },
        { type: "line", color: "#ea580c", width: 1.8, dash: "5,3", label: "Věcné břemeno (služebnost) k části pozemku" }
      ]
    },
    hranice_parcel_barevne: {
      title: "Hranice parcel (barevně dle kvality)",
      provider: "ČÚZK • KN",
      category: "Parcely a hranice",
      color: "#16a34a",
      desc: "Rozlišení původu a střední souřadnicové chyby lomových bodů dle přílohy č. 11 vyhlášky č. 357/2013 Sb.",
      docUrl: "https://services.cuzk.cz/doc/znackovy-klic.pdf",
      docTitle: "Značkový klíč ČÚZK (PDF)",
      items: [
        { type: "line", color: "#16a34a", width: 2.5, label: "Zelená plná: Kód charakteristiky kvality 3 (střední chyba m_xy = 0,14 m, geodetické zaměření S-JTSK)" },
        { type: "line", color: "#1e293b", width: 2, label: "Černá plná: Kód kvality 4–8 (střední chyba 0,26 m až >1 m, digitalizováno z dřívějších operátů)" },
        { type: "line", color: "#e11d48", width: 2, dash: "5,3", label: "Červená / čárkovaná: Sporná, neujasněná nebo prozatímní hranice" }
      ]
    },
    parcelni_cisla: {
      title: "Parcelní čísla",
      provider: "ČÚZK • KN",
      category: "Parcely a hranice",
      color: "#1e293b",
      desc: "Popisy parcel v katastrální mapě s rozlišením parcel pozemkových a stavebních.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalizace-a-vedeni-katastralnich-map.aspx",
      docTitle: "ČÚZK – Vedení katastrálních map",
      items: [
        { type: "text", text: "854/2", color: "#0f172a", label: "Pozemková parcela (kmenové číslo / poddělení)" },
        { type: "text", text: "st. 116", color: "#b91c1c", label: "Stavební parcela (zastavěná plocha a nádvoří)" },
        { type: "text", text: "854", color: "#475569", label: "Pozemková parcela s jednoduchým kmenovým číslem" }
      ]
    },
    obrazy_parcel: {
      title: "Vnitřní kresba a hranice parcel",
      provider: "ČÚZK • KN",
      category: "Parcely a hranice",
      color: "#c96262",
      desc: "Značkový klíč druhů pozemků uvnitř parcel a hranice způsobu využití.",
      docUrl: "https://services.cuzk.cz/doc/znackovy-klic.pdf",
      docTitle: "Značkový klíč ČÚZK (PDF)",
      items: [
        { type: "line", color: "#475569", width: 1.2, label: "Tenká černá čára: Hranice druhu pozemku uvnitř parcely" },
        { type: "icon", icon: "sprout", color: "#15803d", label: "Orná půda (kód 2) / Chmelnice (3) / Vinice (4)" },
        { type: "icon", icon: "tree", color: "#16a34a", label: "Zahrada (kód 5) / Ovocný sad (kód 6)" },
        { type: "icon", icon: "grass", color: "#65a30d", label: "Trvalý travní porost – louka, pastvina (kód 7)" },
        { type: "icon", icon: "forest", color: "#14532d", label: "Lesní pozemek (kód 10)" },
        { type: "icon", icon: "water", color: "#0284c7", label: "Vodní plocha – tok, nádrž, rybník (kód 11)" },
        { type: "icon", icon: "house", color: "#b91c1c", label: "Zastavěná plocha a nádvoří (kód 13)" },
        { type: "icon", icon: "layers", color: "#64748b", label: "Ostatní plocha – komunikace, zeleň, manipulační plocha (kód 14)" }
      ]
    },
    def_parcely: {
      title: "Definiční body parcel",
      provider: "ČÚZK • KN",
      category: "Parcely a hranice",
      color: "#0284c7",
      desc: "Centroidy parcel v informačním systému katastru nemovitostí (ISKN/RÚIAN).",
      items: [
        { type: "point", color: "#0284c7", border: "#0369a1", radius: 4.5, label: "Definiční bod parcely (prostorové těžiště pro atributy ISKN)" }
      ]
    },
    podrobne_body: {
      title: "Lomové body parcel (podrobné body)",
      provider: "ČÚZK • KN",
      category: "Parcely a hranice",
      color: "#d97706",
      desc: "Lomové body hranic parcel s třídou přesnosti určení dle vyhlášky č. 357/2013 Sb.",
      docUrl: "https://services.cuzk.cz/doc/znackovy-klic.pdf",
      docTitle: "Značkový klíč ČÚZK (PDF)",
      items: [
        { type: "point", color: "#ef4444", border: "#991b1b", radius: 4.5, label: "Červený bod: 3. třída přesnosti (kód 3, m_xy = 0,14 m – geodeticky zaměřeno)" },
        { type: "point", color: "#2563eb", border: "#1e40af", radius: 4.5, label: "Modrý bod: 4. třída přesnosti (kód 4, m_xy = 0,26 m)" },
        { type: "point", color: "#10b981", border: "#047857", radius: 4.5, label: "Zelený bod: 5. třída přesnosti (kód 5, m_xy = 0,50 m)" },
        { type: "point", color: "#64748b", border: "#334155", radius: 4.5, label: "Šedý bod: 6.–8. třída přesnosti (m_xy > 0,50 m, převzato z dřívějších map)" }
      ]
    },
    rst_kn: {
      title: "Rastrová katastrální mapa (KM-D / dřívější)",
      provider: "ČÚZK • KN",
      category: "Katastrální mapa",
      color: "#78716c",
      desc: "Skenované a georeferencované katastrální mapy dřívějších pozemkových operátů.",
      items: [
        { type: "polygon", color: "#78716c", fill: "rgba(120,113,108,0.25)", border: "#78716c", dash: "3,3", label: "Skenovaná rastrová mapa (stabilní katastr, KMD nebo KM-D)" }
      ]
    },
    polygony_budov: {
      title: "Budovy v katastrální mapě (KN)",
      provider: "ČÚZK • KN",
      category: "Budovy a stavby",
      color: "#854d0e",
      desc: "Budovy evidované v katastru nemovitostí s vyznačením druhu svislé konstrukce.",
      docUrl: "https://services.cuzk.cz/doc/znackovy-klic.pdf",
      docTitle: "Značkový klíč ČÚZK (PDF)",
      items: [
        { type: "polygon", color: "#b91c1c", fill: "rgba(185,28,28,0.25)", border: "#b91c1c", width: 2, label: "Zděná, betonová nebo kamenná budova (červeno-hnědý obvod / šrafura)" },
        { type: "polygon", color: "#ca8a04", fill: "rgba(202,138,4,0.25)", border: "#ca8a04", width: 2, label: "Dřevěná budova nebo lehká montovaná konstrukce" },
        { type: "polygon", color: "#78716c", fill: "transparent", border: "#78716c", width: 1.5, dash: "4,3", label: "Rozestavěná stavba, podzemní objekt nebo kryté stání" }
      ]
    },
    def_budovy: {
      title: "Definiční body budov (čísla domovní)",
      provider: "ČÚZK • KN",
      category: "Budovy a stavby",
      color: "#dc2626",
      desc: "Centroidy stavebních objektů s čísly popisnými nebo evidenčními v ISKN.",
      items: [
        { type: "point", color: "#dc2626", border: "#991b1b", radius: 4, label: "Definiční bod budovy (vazba na číslo popisné / evidenční)" }
      ]
    },
    stavebni_objekty_ruian: {
      title: "Stavební objekty (RÚIAN)",
      provider: "ČÚZK • RÚIAN",
      category: "Budovy a stavby",
      color: "#9333ea",
      desc: "Polygony všech stavebních objektů evidovaných v RÚIAN včetně detailních atributů.",
      wmsLegendUrl: "https://ags.cuzk.cz/arcgis/services/RUIAN/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=StavebniObjekt",
      items: [
        { type: "polygon", color: "#9333ea", fill: "rgba(147,51,234,0.22)", border: "#7e22ce", width: 1.8, label: "Stavební objekt evidovaný v registru RÚIAN" }
      ]
    },
    prehledka_kat_uz: {
      title: "Katastrální území (hranice KÚ)",
      provider: "ČÚZK • KN",
      category: "Správní členění",
      color: "#4f46e5",
      desc: "Hranice základních územních a evidenčních jednotek katastru nemovitostí.",
      items: [
        { type: "line", color: "#7c3aed", width: 2.5, label: "Fialová plná linie: Hranice katastrálního území (KÚ)" },
        { type: "text", text: "Olomouc [710504]", color: "#6d28d9", label: "Název KÚ a 6místný identifikační kód ČÚZK" }
      ]
    },
    hranice_obce: {
      title: "Hranice obcí a měst",
      provider: "ČÚZK • INSPIRE AU",
      category: "Správní členění",
      color: "#2563eb",
      desc: "Územně správní jednotka 4. řádu (obec, městys, město, statutární město).",
      items: [
        { type: "line", color: "#059669", width: 2.5, label: "Smaragdová linie: Administrativní hranice obce" }
      ]
    },
    hranice_mestske_casti: {
      title: "Městské části / obvody (MOMC)",
      provider: "ČÚZK • INSPIRE UX",
      category: "Správní členění",
      color: "#0891b2",
      desc: "Městské obvody a městské části statutárních měst a hlavního města Prahy.",
      items: [
        { type: "line", color: "#0891b2", width: 2, dash: "6,3", label: "Tyrkysovo-modrá čerchovaná linie: Hranice městského obvodu nebo části" }
      ]
    },
    hranice_okresu: {
      title: "Hranice okresů a krajů",
      provider: "ČÚZK • INSPIRE AU",
      category: "Správní členění",
      color: "#334155",
      desc: "Vyšší územní samosprávné celky (VÚSC) a okresy České republiky.",
      items: [
        { type: "line", color: "#1d4ed8", width: 2.2, label: "Modrá linie: Hranice okresu (LAU 1)" },
        { type: "line", color: "#581c87", width: 3.5, label: "Purpurová silná linie: Hranice samosprávného kraje (VÚSC / NUTS 3)" }
      ]
    },
    adresni_mista: {
      title: "Adresní místa (RÚIAN)",
      provider: "ČÚZK • RÚIAN",
      category: "Adresy a ulice",
      color: "#16a34a",
      desc: "Bodové reprezentace očíslovaných vchodů do stavebních objektů z registru RÚIAN.",
      wmsLegendUrl: "https://ags.cuzk.cz/arcgis/services/RUIAN/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=AdresniMisto",
      items: [
        { type: "point", color: "#ea580c", border: "#9a3412", radius: 4.5, label: "Adresní bod (číslo popisné, evidenční, orientační)" }
      ]
    },
    ulicni_sit: {
      title: "Uliční síť a názvy ulic (RÚIAN)",
      provider: "ČÚZK • RÚIAN",
      category: "Adresy a ulice",
      color: "#ca8a04",
      desc: "Geometrické osy pojmenovaných ulic a veřejných prostranství z registru RÚIAN.",
      wmsLegendUrl: "https://ags.cuzk.cz/arcgis/services/RUIAN/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=Ulice",
      items: [
        { type: "line", color: "#2563eb", width: 2.5, label: "Modrá osa ulice s oficiálním názvem prostranství" }
      ]
    },
    cenove_udaje: {
      title: "Nemovitosti s cenovými údaji (prodeje KN)",
      provider: "ČÚZK • KN",
      category: "Ceny a bonita",
      color: "#ea580c",
      desc: "Nemovitosti, u kterých byla v katastru zapsána dosažená kupní cena z kupních smluv.",
      items: [
        { type: "point", color: "#db2777", border: "#9d174d", radius: 4.5, label: "Nemovitost s evidovaným cenovým údajem z kupní smlouvy" },
        { type: "polygon", color: "#ec4899", fill: "rgba(236,72,153,0.22)", border: "#db2777", width: 1.8, label: "Parcela nebo budova s evidovanou kupní cenou" }
      ]
    },
    bpej: {
      title: "Bonitované půdně ekologické jednotky (BPEJ)",
      provider: "ČÚZK • VÚMOP",
      category: "Ceny a bonita",
      color: "#15803d",
      desc: "Bonita zemědělského půdního fondu (ZPF) vyjádřená 5místným kódem.",
      wmsLegendUrl: "https://ags.cuzk.cz/arcgis/services/RUIAN/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=BonitovanaPudneEkologickaJednotka",
      items: [
        { type: "line", color: "#15803d", width: 2, label: "Zelená polygonová hranice areálu půdní jednotky" },
        { type: "text", text: "2.15.00", color: "#166534", label: "5místný kód: 1. klim. region • 2.-3. hlavní půdní jednotka • 4. sklon/expozice • 5. skeletovitost a hloubka" }
      ]
    },
    vecna_bremena: {
      title: "Věcná břemena a služebnosti",
      provider: "ČÚZK • KN",
      category: "Ceny a bonita",
      color: "#7c3aed",
      desc: "Průběh a rozsah věcných břemen (služebností inženýrských sítí, chůze, jízdy) k částem parcel.",
      docUrl: "https://services.cuzk.cz/doc/znackovy-klic.pdf",
      docTitle: "Značkový klíč ČÚZK (PDF)",
      items: [
        { type: "line", color: "#ea580c", width: 2, dash: "6,3", label: "Oranžová čerchovaná čára: Průběh osy nebo hranice věcného břemene (služebnosti)" },
        { type: "polygon", color: "#ea580c", fill: "rgba(234,88,12,0.22)", border: "#c2410c", width: 1.8, label: "Oranžově vymezená plocha: Rozsah věcného břemene k části pozemku" }
      ]
    }
  };

  function getLegendSymbolIconSvg(iconName, color) {
    var c = color || "currentColor";
    if (iconName === "sprout") {
      return '<svg width="22" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M7 20h10M12 20V10M12 10c0-3 3-5 7-5 0 4-2 7-7 7zM12 14c0-2-2-4-5-4 0 3 1.5 5 5 5z"/>' +
      '</svg>';
    }
    if (iconName === "tree") {
      return '<svg width="22" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 22v-6M8 16a5 5 0 1 1 8 0z" fill="' + c + '" fill-opacity="0.2"/>' +
      '</svg>';
    }
    if (iconName === "grass") {
      return '<svg width="22" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M5 20c2-7 5-10 7-10-2 4-1 7-1 10M12 20c1-8 4-11 7-11-2 4-1 8-1 11"/>' +
      '</svg>';
    }
    if (iconName === "forest") {
      return '<svg width="22" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2l4 6h-3l4 6h-3l4 6H4l4-6H5l4-6H6z" fill="' + c + '" fill-opacity="0.2"/>' +
      '</svg>';
    }
    if (iconName === "water") {
      return '<svg width="22" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>' +
      '</svg>';
    }
    if (iconName === "house") {
      return '<svg width="22" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="' + c + '" fill-opacity="0.2"/>' +
      '</svg>';
    }
    if (iconName === "layers") {
      return '<svg width="22" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/>' +
      '</svg>';
    }
    return '<span style="font-size:10px; color:' + c + ';">●</span>';
  }

  function renderLegendItemGraphic(item) {
    if (item.type === "line") {
      var dash = item.dash ? 'stroke-dasharray="' + item.dash + '"' : "";
      return '<svg width="34" height="22" viewBox="0 0 34 22">' +
        '<line x1="2" y1="11" x2="32" y2="11" stroke="' + item.color + '" stroke-width="' + (item.width || 2) + '" ' + dash + ' stroke-linecap="round"/>' +
      '</svg>';
    }
    if (item.type === "polygon") {
      var pDash = item.dash ? 'stroke-dasharray="' + item.dash + '"' : "";
      return '<svg width="34" height="22" viewBox="0 0 34 22">' +
        '<rect x="3" y="3" width="28" height="16" rx="3" fill="' + (item.fill || "transparent") + '" stroke="' + (item.border || item.color) + '" stroke-width="' + (item.width || 1.8) + '" ' + pDash + '/>' +
      '</svg>';
    }
    if (item.type === "point") {
      return '<svg width="34" height="22" viewBox="0 0 34 22">' +
        '<circle cx="17" cy="11" r="' + (item.radius || 4.5) + '" fill="' + item.color + '" stroke="' + (item.border || '#ffffff') + '" stroke-width="1.8"/>' +
      '</svg>';
    }
    if (item.type === "text") {
      return '<span class="legend-text-preview" style="color:' + item.color + ';">' + item.text + '</span>';
    }
    if (item.type === "icon") {
      return getLegendSymbolIconSvg(item.icon, item.color);
    }
    return "";
  }

  function renderLegendCardHtml(layerKey, def, isInline) {
    if (!def) return "";

    var itemsHtml = '<div class="legend-items-table">';
    if (def.items && def.items.length > 0) {
      def.items.forEach(function (item) {
        itemsHtml +=
          '<div class="legend-row">' +
            '<div class="legend-symbol-swatch">' + renderLegendItemGraphic(item) + '</div>' +
            '<div class="legend-symbol-text">' + item.label + '</div>' +
          '</div>';
      });
    }
    itemsHtml += '</div>';

    var wmsGraphicHtml = "";
    if (def.wmsLegendUrl) {
      wmsGraphicHtml =
        '<div class="legend-wms-graphic-wrap">' +
          '<div class="legend-wms-label">Oficiální WMS grafika (' + def.provider + ')</div>' +
          '<img src="' + def.wmsLegendUrl + '" alt="WMS grafika ' + def.title + '" class="legend-wms-graphic-img" loading="lazy" />' +
        '</div>';
    }

    if (isInline) {
      return (
        '<div class="inline-legend-inner">' +
          '<div style="font-size:10.5px; font-weight:700; color:' + (def.color || "#c96262") + '; margin-bottom:4px;">' +
            def.title + ' <span style="font-size:9px; font-weight:600; color:var(--text-muted);">(' + def.provider + ')</span>' +
          '</div>' +
          '<div style="font-size:9.5px; color:var(--text-muted); margin-bottom:6px; line-height:1.35;">' + def.desc + '</div>' +
          itemsHtml +
          wmsGraphicHtml +
          (def.docUrl
            ? '<div style="margin-top:6px; text-align:right;"><a href="' + def.docUrl + '" target="_blank" rel="noopener noreferrer" class="legend-doc-link">' +
                '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>' +
                '<span>' + (def.docTitle || "Dokumentace ČÚZK") + '</span>' +
              '</a></div>'
            : "") +
        '</div>'
      );
    }

    var docLinkHtml = def.docUrl
      ? '<a href="' + def.docUrl + '" target="_blank" rel="noopener noreferrer" class="legend-doc-link">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>' +
          '<span>' + (def.docTitle || "Značkový klíč (PDF)") + '</span>' +
        '</a>'
      : '<span style="font-size:9.5px; color:var(--text-muted);">' + def.provider + '</span>';

    return (
      '<div class="legend-card" data-legend-card="' + layerKey + '">' +
        '<div class="legend-card-header">' +
          '<div class="legend-card-title-group">' +
            '<span class="legend-card-dot" style="background-color:' + (def.color || "#c96262") + ';"></span>' +
            '<span class="legend-card-title">' + def.title + '</span>' +
          '</div>' +
          '<span class="legend-card-provider">' + def.provider + '</span>' +
        '</div>' +
        '<div class="legend-card-desc">' + def.desc + '</div>' +
        itemsHtml +
        wmsGraphicHtml +
        '<div class="legend-card-footer">' +
          docLinkHtml +
          '<span style="font-size:9px; color:var(--text-muted); font-weight:600;">Vyhláška č. 357/2013 Sb.</span>' +
        '</div>' +
      '</div>'
    );
  }

  function renderLegendEmptyState() {
    return (
      '<div class="legend-empty-state">' +
        '<div class="legend-empty-icon">' +
          '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
            '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
            '<line x1="8" y1="7" x2="16" y2="7"></line>' +
            '<line x1="8" y1="12" x2="16" y2="12"></line>' +
            '<line x1="8" y1="17" x2="12" y2="17"></line>' +
          '</svg>' +
        '</div>' +
        '<div class="legend-empty-title">Žádná vrstva není aktivní</div>' +
        '<div class="legend-empty-text">V mapě momentálně není zapnutá žádná vrstva katastru ani RÚIAN.</div>' +
        '<div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">' +
          '<button type="button" class="btn-legend-switch-tab" id="btn-empty-goto-layers">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>' +
            '<span>Vybrat vrstvy</span>' +
          '</button>' +
          '<button type="button" class="btn-sidebar-action active" id="btn-empty-show-all" style="border:1px solid rgba(201,98,98,0.4);">' +
            'Zobrazit všechny vrstvy' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderAllLegends(filterMode) {
    var container = document.getElementById("legend-list-container");
    if (!container) return;

    var activeKeys = new Set();
    state.activeSingleLayers.forEach(function (k) { activeKeys.add(k); });
    state.activeSublayers.forEach(function (k) { activeKeys.add(k); });

    var targetKeys = [];
    if (filterMode === "active") {
      Object.keys(KAT_LEGEND_DATA).forEach(function (k) {
        if (activeKeys.has(k)) targetKeys.push(k);
      });
      if (targetKeys.length === 0) {
        container.innerHTML = renderLegendEmptyState();
        var btnGoto = document.getElementById("btn-empty-goto-layers");
        if (btnGoto) btnGoto.addEventListener("click", function () { switchToSidebarTab("layers"); });
        var btnShowAll = document.getElementById("btn-empty-show-all");
        if (btnShowAll) {
          btnShowAll.addEventListener("click", function () {
            var fAll = document.getElementById("btn-legend-filter-all");
            var fAct = document.getElementById("btn-legend-filter-active");
            if (fAll) fAll.classList.add("active");
            if (fAct) fAct.classList.remove("active");
            state.legendFilter = "all";
            renderAllLegends("all");
          });
        }
        return;
      }
    } else {
      targetKeys = Object.keys(KAT_LEGEND_DATA);
    }

    var html = "";
    targetKeys.forEach(function (key) {
      var def = KAT_LEGEND_DATA[key];
      if (def) {
        html += renderLegendCardHtml(key, def, false);
      }
    });

    container.innerHTML = html;
  }

  function updateLegendBadge() {
    var count = state.activeSingleLayers.size + state.activeSublayers.size;
    var badge = document.getElementById("legend-active-count");
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "inline-flex" : "none";
    }
    var filterActiveBtn = document.getElementById("btn-legend-filter-active");
    if (filterActiveBtn) {
      filterActiveBtn.textContent = "Aktivní (" + count + ")";
    }
  }

  function refreshActiveLegendsIfVisible() {
    if (state.currentTab === "legend" && state.legendFilter === "active") {
      renderAllLegends("active");
    }
  }

  function switchToSidebarTab(tabName) {
    state.currentTab = tabName;
    var tabBtnLayers = document.getElementById("tab-btn-layers");
    var tabBtnLegend = document.getElementById("tab-btn-legend");
    var paneLayers = document.getElementById("pane-layers");
    var paneLegend = document.getElementById("pane-legend");
    var actionsLayers = document.getElementById("sidebar-actions-layers");
    var actionsLegend = document.getElementById("sidebar-actions-legend");
    var mapLegendBtn = document.getElementById("btn-legend-map-toggle");

    if (tabName === "legend") {
      if (tabBtnLayers) tabBtnLayers.classList.remove("active");
      if (tabBtnLegend) tabBtnLegend.classList.add("active");
      if (paneLayers) paneLayers.style.display = "none";
      if (paneLegend) paneLegend.style.display = "block";
      if (actionsLayers) actionsLayers.style.display = "none";
      if (actionsLegend) actionsLegend.style.display = "flex";
      if (mapLegendBtn) mapLegendBtn.classList.add("is-active");
      renderAllLegends(state.legendFilter || "active");
    } else {
      if (tabBtnLegend) tabBtnLegend.classList.remove("active");
      if (tabBtnLayers) tabBtnLayers.classList.add("active");
      if (paneLegend) paneLegend.style.display = "none";
      if (paneLayers) paneLayers.style.display = "block";
      if (actionsLegend) actionsLegend.style.display = "none";
      if (actionsLayers) actionsLayers.style.display = "flex";
      if (mapLegendBtn) mapLegendBtn.classList.remove("is-active");
    }
  }

  function initLegendSystem() {
    // 1. Vložit přepínací tlačítka a inline kontejnery do všech .layer-card
    document.querySelectorAll(".layer-card").forEach(function (card) {
      var layerKey = card.getAttribute("data-layer");
      if (!layerKey || !KAT_LEGEND_DATA[layerKey]) return;

      var mainRow = card.querySelector(".layer-card-main");
      if (mainRow && !card.querySelector(".btn-layer-legend")) {
        var switchControl = mainRow.querySelector(".switch-control");
        var rightControls = document.createElement("div");
        rightControls.className = "layer-controls-right";

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-layer-legend";
        btn.setAttribute("data-legend-for", layerKey);
        btn.setAttribute("title", "Zobrazit legendu vrstvy");
        btn.setAttribute("aria-label", "Legenda vrstvy " + KAT_LEGEND_DATA[layerKey].title);
        btn.innerHTML =
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
            '<line x1="8" y1="7" x2="16" y2="7"></line>' +
            '<line x1="8" y1="12" x2="16" y2="12"></line>' +
            '<line x1="8" y1="17" x2="12" y2="17"></line>' +
          '</svg>';

        if (switchControl && switchControl.parentNode === mainRow) {
          mainRow.insertBefore(rightControls, switchControl);
          rightControls.appendChild(btn);
          rightControls.appendChild(switchControl);
        } else {
          mainRow.appendChild(btn);
        }

        var inlineContainer = document.createElement("div");
        inlineContainer.className = "layer-inline-legend";
        inlineContainer.id = "inline-legend-" + layerKey;
        inlineContainer.style.display = "none";
        card.appendChild(inlineContainer);

        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var isOpen = btn.classList.contains("is-open");
          if (isOpen) {
            btn.classList.remove("is-open");
            inlineContainer.style.display = "none";
          } else {
            btn.classList.add("is-open");
            inlineContainer.innerHTML = renderLegendCardHtml(layerKey, KAT_LEGEND_DATA[layerKey], true);
            inlineContainer.style.display = "block";
          }
        });
      }
    });

    // 2. Vložit přepínací tlačítka a inline kontejnery do všech .sublayer-item
    document.querySelectorAll(".sublayer-item").forEach(function (subItem) {
      var subKey = subItem.getAttribute("data-sublayer");
      if (!subKey || !KAT_LEGEND_DATA[subKey]) return;

      if (!subItem.querySelector(".btn-sublayer-legend")) {
        var subBtn = document.createElement("button");
        subBtn.type = "button";
        subBtn.className = "btn-sublayer-legend";
        subBtn.setAttribute("data-legend-for", subKey);
        subBtn.setAttribute("title", "Zobrazit legendu vrstvy");
        subBtn.setAttribute("aria-label", "Legenda vrstvy " + KAT_LEGEND_DATA[subKey].title);
        subBtn.innerHTML =
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
            '<line x1="8" y1="7" x2="16" y2="7"></line>' +
            '<line x1="8" y1="12" x2="16" y2="12"></line>' +
          '</svg>';

        subItem.appendChild(subBtn);

        var subInline = document.createElement("div");
        subInline.className = "sublayer-inline-legend";
        subInline.id = "inline-legend-" + subKey;
        subInline.style.display = "none";
        subItem.appendChild(subInline);

        subBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          var isOpen = subBtn.classList.contains("is-open");
          if (isOpen) {
            subBtn.classList.remove("is-open");
            subInline.style.display = "none";
          } else {
            subBtn.classList.add("is-open");
            subInline.innerHTML = renderLegendCardHtml(subKey, KAT_LEGEND_DATA[subKey], true);
            subInline.style.display = "block";
          }
        });
      }
    });

    // 3. Přepínání záložek v hlavičce (Vrstvy vs Legenda)
    var tabBtnLayers = document.getElementById("tab-btn-layers");
    var tabBtnLegend = document.getElementById("tab-btn-legend");

    if (tabBtnLayers) {
      tabBtnLayers.addEventListener("click", function () {
        switchToSidebarTab("layers");
      });
    }
    if (tabBtnLegend) {
      tabBtnLegend.addEventListener("click", function () {
        switchToSidebarTab("legend");
      });
    }

    // 4. Přepínače filtru legendy (Aktivní vs Všechny)
    var filterActiveBtn = document.getElementById("btn-legend-filter-active");
    var filterAllBtn = document.getElementById("btn-legend-filter-all");

    if (filterActiveBtn) {
      filterActiveBtn.addEventListener("click", function () {
        state.legendFilter = "active";
        filterActiveBtn.classList.add("active");
        if (filterAllBtn) filterAllBtn.classList.remove("active");
        renderAllLegends("active");
      });
    }
    if (filterAllBtn) {
      filterAllBtn.addEventListener("click", function () {
        state.legendFilter = "all";
        filterAllBtn.classList.add("active");
        if (filterActiveBtn) filterActiveBtn.classList.remove("active");
        renderAllLegends("all");
      });
    }

    updateLegendBadge();
  }

  function initLegendControl() {
    var LegendControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control legend-control");
        container.innerHTML =
          '<button type="button" id="btn-legend-map-toggle" class="legend-toggle-btn" title="Legenda vrstev katastru (vyhláška č. 357/2013 Sb.)" aria-label="Legenda katastru">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
              '<line x1="8" y1="7" x2="16" y2="7"></line>' +
              '<line x1="8" y1="12" x2="16" y2="12"></line>' +
              '<line x1="8" y1="17" x2="12" y2="17"></line>' +
            '</svg>' +
          '</button>';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
      }
    });

    state.map.addControl(new LegendControl());

    var btnLegend = document.getElementById("btn-legend-map-toggle");
    if (btnLegend) {
      btnLegend.addEventListener("click", function (e) {
        e.stopPropagation();
        if (state.currentTab === "legend") {
          switchToSidebarTab("layers");
        } else {
          switchToSidebarTab("legend");
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // Události mapy & Stavový řádek
  // --------------------------------------------------------------------------
  function setupMapEvents() {
    var statusDot = document.getElementById("status-dot");
    var statusText = document.getElementById("map-status-text");

    function updateZoom() {
      var z = state.map.getZoom();
      var zoomLevelEl = document.getElementById("zoom-level-display");
      if (zoomLevelEl) zoomLevelEl.textContent = z;

      if (statusDot && statusText && !statusDot.classList.contains("busy")) {
        if (typeof measureState !== "undefined" && measureState.mode) {
          statusDot.className = "status-dot measure-active";
          statusText.textContent = measureState.mode === "line"
            ? "Měření vzdálenosti: kliknutím vkládejte body linie (dvojklik dokončí)"
            : "Měření plochy: kliknutím vkládejte vrcholy mnohoúhelníku (dvojklik dokončí)";
        } else if (state.elevationMode) {
          statusDot.className = "status-dot elevation-active";
          statusText.textContent = "Režim měření výšky (DMR 5G) aktivní – klikněte kamkoliv do mapy";
        } else if (z >= 14) {
          statusDot.className = "status-dot";
          statusText.textContent = "Katastr aktivní – klikněte na parcelu v mapě pro podrobnosti";
        } else {
          statusDot.className = "status-dot inactive";
          statusText.textContent = "Katastr neaktivní (přibližte na zoom 14+ pro dotazování)";
        }
      }
    }

    state.map.on("zoomend", updateZoom);
    state.map.on("click", handleMapClick);
    updateZoom();
  }

  // --------------------------------------------------------------------------
  // Kliknutí do mapy (Měření / Výška / Dotazování na parcelu v KN)
  // --------------------------------------------------------------------------

  var queryState = {
    marker: null,
    polygonLayer: null,
    popup: null,
    currentData: null
  };

  var DRUH_POZEMKU_MAP = {
    2: "Orná půda",
    3: "Chmelnice",
    4: "Vinice",
    5: "Zahrada",
    6: "Ovocný sad",
    7: "Trvalý travní porost",
    10: "Lesní pozemek",
    11: "Vodní plocha",
    13: "Zastavěná plocha a nádvoří",
    14: "Ostatní plocha"
  };

  var ZPUSOB_VYUZITI_MAP = {
    1: "skleník, pařeniště",
    2: "školka",
    3: "plantáž dřevin",
    4: "vinice",
    5: "chmelnice",
    6: "ovocný sad",
    7: "orná půda",
    8: "travní porost",
    9: "rybník",
    10: "koryto vodního toku",
    11: "vodní nádrž",
    12: "mokřad",
    13: "ostatní vodní plocha",
    14: "dráha",
    15: "dálnice, silnice",
    16: "ostatní komunikace",
    17: "zeleň",
    18: "sportoviště",
    19: "hřbitov",
    20: "kulturní a osvětová plocha",
    21: "manipulační plocha",
    22: "dobývací prostor",
    23: "skládka",
    24: "jiná plocha",
    25: "neplodná půda",
    26: "bořiště, strž",
    27: "společný dvůr",
    28: "zbořeniště"
  };

  function handleMapClick(e) {
    var latlng = e.latlng;
    var zoom = state.map.getZoom();

    if (queryState.marker) {
      state.map.removeLayer(queryState.marker);
      queryState.marker = null;
    }
    if (queryState.polygonLayer) {
      state.map.removeLayer(queryState.polygonLayer);
      queryState.polygonLayer = null;
    }

    if (typeof measureState !== "undefined" && measureState.mode) {
      if (typeof onMeasureMapClick === "function") {
        onMeasureMapClick(e);
      }
      return;
    }

    if (state.elevationMode) {
      executeElevationQuery(latlng);
      return;
    }

    if (zoom < 14) {
      var lowZoomHtml =
        '<div class="dtm-popup-empty">' +
          '<div style="font-size:12.5px; font-weight:700; color:var(--text-main); margin-bottom:4px;">Přibližte mapu</div>' +
          '<div style="font-size:11px; color:var(--text-muted); line-height:1.4;">Pro dotazování na podrobnosti parcel přibližte prosím mapu na úroveň <b>zoom 14+</b>.</div>' +
          '<button type="button" class="dtm-popup-btn-zoom" id="btn-popup-zoom-in">Přiblížit sem (zoom 16)</button>' +
        '</div>';

      L.popup({ minWidth: 260, maxWidth: 300 })
        .setLatLng(latlng)
        .setContent(lowZoomHtml)
        .openOn(state.map);

      setTimeout(function () {
        var btn = document.getElementById("btn-popup-zoom-in");
        if (btn) {
          btn.addEventListener("click", function () {
            state.map.setView(latlng, 16);
          });
        }
      }, 50);
      return;
    }

    executeParcelQuery(latlng);
  }

  // --------------------------------------------------------------------------
  // Cache a resolver pro Katastrální území a Obec z RÚIAN
  // --------------------------------------------------------------------------
  var kuCache = {};
  var obecCache = {};

  async function resolveKuAndObec(kuKod) {
    if (!kuKod) return { kuNazev: "", obecNazev: "" };
    if (kuCache[kuKod]) {
      var cached = kuCache[kuKod];
      var obecNazev = cached.obecKod && obecCache[cached.obecKod] ? obecCache[cached.obecKod] : "";
      return { kuNazev: cached.nazev, obecNazev: obecNazev };
    }

    try {
      var kuUrl = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/7/query?where=kod%3D" + encodeURIComponent(kuKod) + "&outFields=nazev,obec&returnGeometry=false&f=json";
      var res = await fetch(kuUrl);
      var data = await res.json();
      if (data && data.features && data.features.length > 0) {
        var attrs = data.features[0].attributes || {};
        var kuNazev = attrs.nazev || "";
        var obecKod = attrs.obec;
        kuCache[kuKod] = { nazev: kuNazev, obecKod: obecKod };

        var obecNazev = "";
        if (obecKod) {
          if (obecCache[obecKod]) {
            obecNazev = obecCache[obecKod];
          } else {
            var obUrl = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/12/query?where=kod%3D" + encodeURIComponent(obecKod) + "&outFields=nazev&returnGeometry=false&f=json";
            var obRes = await fetch(obUrl);
            var obData = await obRes.json();
            if (obData && obData.features && obData.features.length > 0) {
              obecNazev = obData.features[0].attributes.nazev || "";
              obecCache[obecKod] = obecNazev;
            }
          }
        }
        return { kuNazev: kuNazev, obecNazev: obecNazev };
      }
    } catch (err) {
      console.warn("Chyba při zjišťování KÚ/obce:", err);
    }
    return { kuNazev: "", obecNazev: "" };
  }

  // Zjištění informací o parcele na zadané souřadnici
  async function executeParcelQuery(latlng) {
    updateClickMarker(latlng, "#c96262");

    var statusDot = document.getElementById("status-dot");
    var statusText = document.getElementById("map-status-text");
    if (statusDot) statusDot.className = "status-dot busy";
    if (statusText) statusText.textContent = "Zjišťuji parcelu a údaje katastru nemovitostí...";

    var loadingHtml =
      '<div class="dtm-popup-loading">' +
        '<div class="dtm-loading-spinner" style="border-top-color:#c96262;"></div>' +
        '<div style="font-size:12px; font-weight:600; color:var(--text-main);">Zjišťuji informace o parcele...</div>' +
        '<div style="font-size:10px; color:var(--text-muted);">ČÚZK Katastr nemovitostí &amp; RÚIAN</div>' +
      '</div>';

    var popup = L.popup({ minWidth: 320, maxWidth: 390, autoPan: true })
      .setLatLng(latlng)
      .setContent(loadingHtml)
      .openOn(state.map);

    queryState.popup = popup;

    popup.on("remove", function () {
      if (queryState.marker) {
        state.map.removeLayer(queryState.marker);
        queryState.marker = null;
      }
      if (queryState.polygonLayer) {
        state.map.removeLayer(queryState.polygonLayer);
        queryState.polygonLayer = null;
      }
      queryState.currentData = null;
      if (statusDot) statusDot.className = "status-dot";
      if (statusText) statusText.textContent = "Klikněte na parcelu v mapě pro zobrazení vlastností";
    });

    try {
      // 1. Přesný bodový dotaz (point-in-polygon)
      var pointUrl =
        "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/5/query?" +
        "geometry=" + encodeURIComponent(latlng.lng + "," + latlng.lat) +
        "&geometryType=esriGeometryPoint" +
        "&inSR=4326" +
        "&spatialRel=esriSpatialRelIntersects" +
        "&outFields=*" +
        "&returnGeometry=true" +
        "&f=geojson" +
        "&outSR=4326";

      var res = await fetch(pointUrl);
      var data = await res.json();
      var feats = (data && data.features) ? data.features : [];

      // 2. Pokud se kliklo těsně na hranici, zkusíme malý toleranční box (~2.5 m)
      if (feats.length === 0) {
        var delta = 0.000025;
        var boxUrl =
          "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/5/query?" +
          "geometry=" + encodeURIComponent((latlng.lng - delta) + "," + (latlng.lat - delta) + "," + (latlng.lng + delta) + "," + (latlng.lat + delta)) +
          "&geometryType=esriGeometryEnvelope" +
          "&inSR=4326" +
          "&spatialRel=esriSpatialRelIntersects" +
          "&outFields=*" +
          "&returnGeometry=true" +
          "&f=geojson" +
          "&outSR=4326";

        var boxRes = await fetch(boxUrl);
        var boxData = await boxRes.json();
        feats = (boxData && boxData.features) ? boxData.features : [];
      }

      if (feats.length === 0) {
        popup.setContent(
          '<div class="dtm-popup-empty">' +
            '<div style="font-size:12px; font-weight:700; color:var(--text-main);">V tomto místě nebyla nalezena parcela</div>' +
            '<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Zkuste kliknout dovnitř hranic pozemku. V některých případech (vodní toky, dálnice, nezaměřené plochy) není parcela v RÚIAN definována.</div>' +
          '</div>'
        );
        if (statusDot) statusDot.className = "status-dot";
        if (statusText) statusText.textContent = "Nenalezena žádná parcela v daném bodě";
        return;
      }

      // 3. Zjistit názvy KÚ a obce pro nalezené parcely
      for (var i = 0; i < feats.length; i++) {
        var kuKod = feats[i].properties ? feats[i].properties.katastralniuzemi : null;
        if (kuKod) {
          var resolved = await resolveKuAndObec(kuKod);
          feats[i]._kuNazev = resolved.kuNazev;
          feats[i]._obecNazev = resolved.obecNazev;
        }
      }

      queryState.currentData = {
        latlng: latlng,
        features: feats,
        index: 0
      };

      if (feats[0] && feats[0].geometry) {
        highlightParcelGeometry(feats[0].geometry, false);
      }

      popup.setContent(renderFeaturePopupContent(queryState.currentData));
      attachPopupListeners(popup);

      // Asynchronní zjištění nadmořské výšky z DMR 5G pro vybranou parcelu
      queryDmr5gElevation(latlng).then(function (elevRes) {
        var elevEl = document.getElementById("parcel-popup-elev");
        if (elevRes && elevRes.elevation !== null && !isNaN(elevRes.elevation)) {
          feats[0]._elevation = elevRes.elevation.toFixed(2);
          if (elevEl) {
            elevEl.innerHTML = '<b>' + elevRes.elevation.toFixed(2) + ' m n. m.</b> <span style="font-size:10px; color:var(--text-muted);">(Bpv)</span>';
          }
        } else if (elevEl) {
          elevEl.textContent = "—";
        }
      }).catch(function () {
        var elevEl = document.getElementById("parcel-popup-elev");
        if (elevEl) elevEl.textContent = "—";
      });

      if (statusDot) statusDot.className = "status-dot";
      var props = feats[0].properties || {};
      var isSt = props.druhcislovanikod === 2;
      var pNum = (isSt ? "st. " : "") + (props.cisloparcely || (props.kmenovecislo + (props.poddelenicisla ? "/" + props.poddelenicisla : "")));
      if (statusText) statusText.textContent = "Zobrazena parcela " + pNum + (feats[0]._kuNazev ? " v KÚ " + feats[0]._kuNazev : "");
    } catch (err) {
      console.warn("Chyba dotazu na parcelu:", err);
      popup.setContent(
        '<div class="dtm-popup-empty">' +
          '<div style="font-size:12px; font-weight:700; color:#c96262;">Chyba při komunikaci s registrem ČÚZK</div>' +
          '<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">' + (err.message || err) + '</div>' +
        '</div>'
      );
      if (statusDot) statusDot.className = "status-dot";
      if (statusText) statusText.textContent = "Chyba při dotazování na parcelu";
    }
  }

  function renderFeaturePopupContent(data) {
    if (!data || !data.features || data.features.length === 0) return "";
    var feat = data.features[data.index || 0];
    var props = feat.properties || {};

    var druhCislovani = props.druhcislovanikod;
    var isStavebni = druhCislovani === 2;
    var pKmen = props.kmenovecislo || "";
    var pPoddel = props.poddelenicisla || 0;
    var rawNum = props.cisloparcely || (pKmen ? (pKmen + (pPoddel ? "/" + pPoddel : "")) : (props.id || "Neznámé"));
    var fullNum = (isStavebni ? "st. " : "") + rawNum;

    var kuKod = props.katastralniuzemi || "";
    var kuNazev = feat._kuNazev || (kuKod ? "KÚ kód " + kuKod : "Neuvedeno");
    var obecNazev = feat._obecNazev || "";

    var vymera = props.vymeraparcely || props.vymera || "";
    if (vymera) {
      vymera = Number(vymera).toLocaleString("cs-CZ") + " m²";
    }

    var druhKod = props.druhpozemkukod;
    var druhNazev = DRUH_POZEMKU_MAP[druhKod] || (druhKod ? "Kód " + druhKod : "Neuveden");

    var zpusobKod = props.zpusobyvyuzitipozemku;
    var zpusobNazev = ZPUSOB_VYUZITI_MAP[zpusobKod] || (zpusobKod ? "Kód " + zpusobKod : "—");

    var druhCislovaniNazev = isStavebni ? "Stavební parcela (st.)" : "Pozemková parcela (PK/KN)";

    // Přímé oficiální odkazy do ČÚZK
    var nahlizeniUrl = props.id
      ? "https://nahlizenidokn.cuzk.gov.cz/ZobrazObjekt.aspx?typ=par&id=" + encodeURIComponent(props.id)
      : "https://nahlizenidokn.cuzk.gov.cz/VyberParcelu.aspx";
    var vdpUrl = props.id
      ? "https://vdp.cuzk.cz/vdp/ruian/parcely/" + encodeURIComponent(props.id)
      : "";

    // Pager pokud bylo v místě nalezeno více parcel
    var pagerHtml = "";
    if (data.features.length > 1) {
      pagerHtml =
        '<div class="dtm-popup-pager">' +
          '<button type="button" class="dtm-pager-btn dtm-pager-prev" title="Předchozí parcela"' + (data.index === 0 ? " disabled" : "") + '>&larr;</button>' +
          '<span class="dtm-pager-info">' + (data.index + 1) + ' / ' + data.features.length + '</span>' +
          '<button type="button" class="dtm-pager-btn dtm-pager-next" title="Další parcela"' + (data.index === data.features.length - 1 ? " disabled" : "") + '>&rarr;</button>' +
        '</div>';
    }

    var html =
      '<div class="dtm-popup-card">' +
        '<div class="dtm-popup-top">' +
          '<div class="dtm-popup-badge" style="background:rgba(201,98,98,0.12); color:#c96262; border-color:rgba(201,98,98,0.3);">' +
            '<span class="dtm-badge-dot" style="background-color:#c96262;"></span>' +
            '<span>Katastr nemovitostí (KN)</span>' +
          '</div>' +
          pagerHtml +
        '</div>' +

        '<div class="dtm-popup-title-row">' +
          '<div class="dtm-popup-title">Parcela č. ' + fullNum + '</div>' +
          '<div class="dtm-popup-kraj">' + kuNazev + (obecNazev && obecNazev !== kuNazev ? ' (obec ' + obecNazev + ')' : '') + '</div>' +
        '</div>' +

        '<div class="dtm-quick-props">' +
          '<div class="dtm-prop-row">' +
            '<span class="dtm-prop-k">Typ parcely:</span>' +
            '<span class="dtm-prop-v">' + druhCislovaniNazev + '</span>' +
          '</div>' +
          '<div class="dtm-prop-row">' +
            '<span class="dtm-prop-k">Katastrální území:</span>' +
            '<span class="dtm-prop-v"><b>' + kuNazev + '</b>' + (kuKod ? ' [' + kuKod + ']' : '') + '</span>' +
          '</div>' +
          (obecNazev ?
          '<div class="dtm-prop-row">' +
            '<span class="dtm-prop-k">Obec:</span>' +
            '<span class="dtm-prop-v">' + obecNazev + '</span>' +
          '</div>' : '') +
          '<div class="dtm-prop-row">' +
            '<span class="dtm-prop-k">Výměra parcely:</span>' +
            '<span class="dtm-prop-v highlight" style="color:#c96262;">' + (vymera || "—") + '</span>' +
          '</div>' +
          '<div class="dtm-prop-row">' +
            '<span class="dtm-prop-k">Nadmořská výška:</span>' +
            '<span class="dtm-prop-v" id="parcel-popup-elev" style="color:#0284c7; font-weight:600;">' +
              (feat._elevation ? '<b>' + feat._elevation + ' m n. m.</b> <span style="font-size:10px; color:var(--text-muted);">(Bpv)</span>' : '<span style="color:var(--text-muted); font-size:10.5px;">Zjišťuji z DMR 5G...</span>') +
            '</span>' +
          '</div>' +
          '<div class="dtm-prop-row">' +
            '<span class="dtm-prop-k">Druh pozemku:</span>' +
            '<span class="dtm-prop-v"><b>' + druhNazev + '</b></span>' +
          '</div>' +
          '<div class="dtm-prop-row">' +
            '<span class="dtm-prop-k">Způsob využití:</span>' +
            '<span class="dtm-prop-v">' + zpusobNazev + '</span>' +
          '</div>' +
          (props.id ?
          '<div class="dtm-prop-row">' +
            '<span class="dtm-prop-k">ID v RÚIAN:</span>' +
            '<span class="dtm-prop-v" style="font-family:\'JetBrains Mono\',monospace; font-size:11px;">' + props.id + '</span>' +
          '</div>' : '') +
        '</div>' +

        '<div class="dtm-popup-footer" style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">' +
          '<a href="' + nahlizeniUrl + '" target="_blank" rel="noopener noreferrer" class="btn-nahlizeni-link" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; width:100%; padding:8px 12px; font-size:11.5px; font-weight:700; color:#ffffff; background:linear-gradient(135deg,#c96262 0%,#b85454 100%); border-radius:6px; text-decoration:none; box-shadow:0 2px 6px rgba(184,84,84,0.3);">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>' +
            '<span>Otevřít v Nahlížení do KN (ČÚZK)</span>' +
          '</a>' +
          (vdpUrl ?
          '<a href="' + vdpUrl + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; width:100%; padding:6px 10px; font-size:11px; font-weight:600; color:var(--text-main); background:rgba(0,0,0,0.04); border:1px solid var(--border-color); border-radius:5px; text-decoration:none;">' +
            '<span>Detail v registru VDP RÚIAN</span>' +
          '</a>' : '') +
        '</div>' +
      '</div>';

    return html;
  }

  function attachPopupListeners(popup) {
    var prevBtn = document.querySelector(".dtm-pager-prev");
    var nextBtn = document.querySelector(".dtm-pager-next");
    if (prevBtn) {
      prevBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (queryState.currentData && queryState.currentData.index > 0) {
          queryState.currentData.index--;
          var f = queryState.currentData.features[queryState.currentData.index];
          if (f && f.geometry) highlightParcelGeometry(f.geometry, false);
          popup.setContent(renderFeaturePopupContent(queryState.currentData));
          attachPopupListeners(popup);
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (queryState.currentData && queryState.currentData.index < queryState.currentData.features.length - 1) {
          queryState.currentData.index++;
          var f = queryState.currentData.features[queryState.currentData.index];
          if (f && f.geometry) highlightParcelGeometry(f.geometry, false);
          popup.setContent(renderFeaturePopupContent(queryState.currentData));
          attachPopupListeners(popup);
        }
      });
    }
  }

  function highlightParcelGeometry(geometry, fitBounds) {
    if (queryState.polygonLayer) {
      state.map.removeLayer(queryState.polygonLayer);
      queryState.polygonLayer = null;
    }

    if (!geometry) return;

    var geojsonLayer = L.geoJSON(
      { type: "Feature", geometry: geometry },
      {
        style: {
          color: "#c96262",
          weight: 3,
          opacity: 0.95,
          fillColor: "#d87373",
          fillOpacity: 0.22,
          dashArray: null
        }
      }
    ).addTo(state.map);

    queryState.polygonLayer = geojsonLayer;

    if (fitBounds) {
      state.map.fitBounds(geojsonLayer.getBounds(), { padding: [50, 50], maxZoom: 19 });
    }
  }

  function updateClickMarker(latlng, color) {
    if (queryState.marker) {
      state.map.removeLayer(queryState.marker);
      queryState.marker = null;
    }

    var markerIcon = L.divIcon({
      className: "dtm-click-marker-wrap",
      html:
        '<div class="dtm-click-pulse" style="--marker-color:' + (color || "#c96262") + '"></div>' +
        '<div class="dtm-click-dot" style="--marker-color:' + (color || "#c96262") + '"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    queryState.marker = L.marker(latlng, { icon: markerIcon, interactive: false }).addTo(state.map);
  }

  // --------------------------------------------------------------------------
  // Měření nadmořské výšky z výškového modelu DMR 5G (ČÚZK)
  // --------------------------------------------------------------------------

  // Převod WGS-84 (GPS) na S-JTSK (EPSG:5514)
  function wgs84ToSjtsk(lat, lng) {
    if (typeof proj4 !== "undefined") {
      try {
        var p = proj4("EPSG:4326", "EPSG:5514", [lng, lat]);
        var yVal = Math.abs(p[0]);
        var xVal = Math.abs(p[1]);
        return {
          y: yVal,
          x: xVal,
          formattedY: yVal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " "),
          formattedX: xVal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " "),
          rawY: p[0],
          rawX: p[1]
        };
      } catch (err) {
        console.warn("Chyba při výpočtu S-JTSK:", err);
      }
    }
    return null;
  }

  function wgs84ToJtsk(lat, lng) {
    var res = wgs84ToSjtsk(lat, lng);
    return res ? { x: res.x, y: res.y } : null;
  }

  function jtskToWgs84(y, x) {
    if (typeof proj4 === "undefined") return null;
    try {
      var pt = proj4("EPSG:5514", "EPSG:4326", [x, y]);
      return L.latLng(pt[1], pt[0]);
    } catch (e) {
      console.error("Proj4 conversion error:", e);
      return null;
    }
  }

  // Zvýraznění zaměřeného výškového bodu v mapě
  function updateElevationMarker(latlng) {
    if (queryState.marker) {
      state.map.removeLayer(queryState.marker);
      queryState.marker = null;
    }

    var markerHtml =
      '<div class="dtm-target-marker" style="--marker-color: #0284c7;">' +
        '<div class="dtm-marker-pulse"></div>' +
        '<div class="dtm-marker-ring" style="border-color:#0284c7; box-shadow:0 0 12px #0284c7;"></div>' +
        '<div class="dtm-marker-center">' +
          '<span class="dtm-marker-dot" style="background:#0284c7;"></span>' +
        '</div>' +
      '</div>';

    var markerIcon = L.divIcon({
      className: "dtm-target-container",
      html: markerHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    queryState.marker = L.marker(latlng, { icon: markerIcon, interactive: false }).addTo(state.map);
  }

  // Zpracování hodnoty výšky z odpovědi ArcGIS ImageServer
  function parseElevationValue(data) {
    if (!data) return null;
    var raw = null;

    if (data.value !== undefined && data.value !== null) {
      raw = Array.isArray(data.value) ? data.value[0] : data.value;
    } else if (data.properties && data.properties.Values && data.properties.Values.length > 0) {
      raw = data.properties.Values[0];
    } else if (data.pixel && data.pixel.values && data.pixel.values.length > 0) {
      raw = data.pixel.values[0];
    }

    if (raw === null || raw === undefined || raw === "" || raw === "NoData") {
      return null;
    }

    var num = parseFloat(raw);
    return isFinite(num) ? num : null;
  }

  // Dotaz na nadmořskou výšku DMR 5G přes ArcGIS ImageServer identify
  function queryDmr5gElevation(latlng) {
    var geomObj = {
      x: latlng.lng,
      y: latlng.lat,
      spatialReference: { wkid: 4326 }
    };

    var params = {
      geometry: JSON.stringify(geomObj),
      geometryType: "esriGeometryPoint",
      returnGeometry: "false",
      returnCatalogItems: "false",
      f: "json"
    };

    var q = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");

    var primaryUrl = "https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer/identify?" + q;
    var fallbackUrl1 = "https://ags.cuzk.cz/arcgis2/rest/services/dmr5g/ImageServer/identify?" + q;

    function doFetch(url) {
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    }

    return doFetch(primaryUrl)
      .catch(function () {
        return doFetch(fallbackUrl1);
      })
      .then(function (data) {
        return {
          elevation: parseElevationValue(data),
          raw: data
        };
      });
  }

  // Spuštění dotazu na nadmořskou výšku z DMR 5G
  function executeElevationQuery(latlng) {
    // 1. Zvýrazňovací značka v mapě
    updateElevationMarker(latlng);

    // 2. Přepočet do S-JTSK
    var sjtsk = wgs84ToSjtsk(latlng.lat, latlng.lng);

    // 3. Stavový indikátor
    var statusDot = document.getElementById("status-dot");
    var statusText = document.getElementById("map-status-text");
    if (statusDot) statusDot.className = "status-dot busy";
    if (statusText) statusText.textContent = "Zjišťuji nadmořskou výšku z DMR 5G...";

    // 4. Načítací popup
    var loadingHtml =
      '<div class="dtm-popup-loading">' +
        '<div class="dtm-loading-spinner" style="border-top-color:#0284c7;"></div>' +
        '<div style="font-size:12.5px; font-weight:700; color:var(--text-main);">Zjišťuji nadmořskou výšku...</div>' +
        '<div style="font-size:10px; color:var(--text-muted);">ČÚZK DMR 5G (rastr 2 m, Bpv)</div>' +
      '</div>';

    var popup = L.popup({ minWidth: 290, maxWidth: 340, autoPan: true, className: "elevation-leaflet-popup" })
      .setLatLng(latlng)
      .setContent(loadingHtml)
      .openOn(state.map);

    queryState.popup = popup;

    popup.on("remove", function () {
      if (queryState.marker) {
        state.map.removeLayer(queryState.marker);
        queryState.marker = null;
      }
      if (statusDot && state.elevationMode) {
        statusDot.className = "status-dot elevation-active";
        statusText.textContent = "Režim měření výšky (DMR 5G) aktivní – klikněte kamkoliv do mapy";
      }
    });

    queryDmr5gElevation(latlng).then(function (result) {
      if (statusDot && state.elevationMode) {
        statusDot.className = "status-dot elevation-active";
        statusText.textContent = "Režim měření výšky (DMR 5G) aktivní – klikněte kamkoliv do mapy";
      }

      popup.setContent(renderElevationPopupContent(latlng, sjtsk, result.elevation));
      attachElevationPopupListeners(popup, latlng, sjtsk, result.elevation);
    }).catch(function (err) {
      console.warn("Chyba dotazu na DMR 5G:", err);
      if (statusDot && state.elevationMode) {
        statusDot.className = "status-dot elevation-active";
        statusText.textContent = "Režim měření výšky (DMR 5G) aktivní – klikněte kamkoliv do mapy";
      }

      popup.setContent(renderElevationPopupContent(latlng, sjtsk, null, err.message));
      attachElevationPopupListeners(popup, latlng, sjtsk, null);
    });
  }

  // Vykreslení obsahu popupu pro zjištěnou nadmořskou výšku a souřadnice
  function renderElevationPopupContent(latlng, sjtsk, elevation, errMsg) {
    var hasElev = elevation !== null && elevation !== undefined && !isNaN(elevation);
    var elevFormatted = hasElev ? elevation.toFixed(2) : null;

    var sjtskY = sjtsk ? sjtsk.formattedY : "-";
    var sjtskX = sjtsk ? sjtsk.formattedX : "-";
    var sjtskPlain = sjtsk ? "Y: " + sjtsk.y.toFixed(2) + ", X: " + sjtsk.x.toFixed(2) : "";

    var wgsLat = latlng.lat.toFixed(6);
    var wgsLng = latlng.lng.toFixed(6);
    var wgsPlain = wgsLat + ", " + wgsLng;

    return (
      '<div class="dtm-popup-card elevation-popup-card">' +
        '<div class="dtm-popup-top">' +
          '<div class="dtm-popup-badge" style="background-color:rgba(2, 132, 199, 0.12); color:#0284c7; border:1px solid rgba(2, 132, 199, 0.3);">' +
            '<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" style=\"margin-right:4px;\">' +
              '<path d=\"m8 3 4 8 5-5 5 15H2L8 3z\"></path>' +
            '</svg>' +
            'Výškový bod (DMR 5G)' +
          '</div>' +
          '<span class="elevation-sys-tag">Bpv (Balt po vyrovnání)</span>' +
        '</div>' +

        '<div class="elevation-hero-box">' +
          '<div class="elevation-value-label">Nadmořská výška (Z):</div>' +
          '<div class="elevation-hero-val">' +
            (hasElev
              ? '<span class="elevation-num">' + elevFormatted + '</span><span class="elevation-unit">m n. m.</span>'
              : '<span class="elevation-num na">–</span><span class="elevation-unit" style="font-size:11px; color:var(--text-muted);">' + (errMsg ? "Chyba služby" : "Mimo ČR / NoData") + '</span>'
            ) +
          '</div>' +
          (hasElev ? (
            '<button type="button" class="btn-elevation-copy-main" id="btn-copy-elev" title="Kopírovat hodnotu nadmořské výšky do schránky">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
              '<span>Kopírovat výšku (' + elevFormatted + ' m)</span>' +
            '</button>'
          ) : "") +
        '</div>' +

        '<div class="elevation-coords-section">' +
          (sjtsk ? (
            '<div class="elevation-coord-group">' +
              '<div class="elevation-group-title">' +
                '<span>S-JTSK (EPSG:5514)</span>' +
                '<button type="button" class="btn-copy-mini btn-copy-sjtsk" data-copy="' + sjtskPlain + '" title="Kopírovat S-JTSK">Kopírovat</button>' +
              '</div>' +
              '<div class="elevation-coord-grid">' +
                '<div class="coord-item"><span class="coord-k">Y:</span><span class="coord-v">' + sjtskY + ' m</span></div>' +
                '<div class="coord-item"><span class="coord-k">X:</span><span class="coord-v">' + sjtskX + ' m</span></div>' +
              '</div>' +
            '</div>'
          ) : "") +

          '<div class="elevation-coord-group">' +
            '<div class="elevation-group-title">' +
              '<span>WGS 84 (GPS)</span>' +
              '<button type="button" class="btn-copy-mini btn-copy-wgs" data-copy="' + wgsPlain + '" title="Kopírovat WGS 84">Kopírovat</button>' +
            '</div>' +
            '<div class="elevation-coord-grid">' +
              '<div class="coord-item"><span class="coord-k">Šířka:</span><span class="coord-v">' + wgsLat + '° N</span></div>' +
              '<div class="coord-item"><span class="coord-k">Délka:</span><span class="coord-v">' + wgsLng + '° E</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="dtm-popup-footer">' +
          '<span class="elevation-source-info">ČÚZK DMR 5G (rastr 2 m)</span>' +
          '<button type="button" class="btn-copy-all-xyz" id="btn-copy-all" title="Kopírovat souřadnice i výšku Y, X, Z">' +
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
            '<span>Kopírovat Y, X, Z</span>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  // Obsluha kopírovacích tlačítek v popupu nadmořské výšky
  function attachElevationPopupListeners(popup, latlng, sjtsk, elevation) {
    var el = popup.getElement();
    if (!el) return;

    var hasElev = elevation !== null && elevation !== undefined && !isNaN(elevation);
    var elevFormatted = hasElev ? elevation.toFixed(2) : "";

    function setupCopyBtn(btn, textToCopy, successMsg) {
      if (!btn) return;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy).then(function () {
            var span = btn.querySelector("span") || btn;
            var orig = span.textContent;
            span.textContent = successMsg || "Zkopírováno!";
            setTimeout(function () { span.textContent = orig; }, 1800);
          });
        }
      });
    }

    // 1. Tlačítko kopírovat výšku
    var btnCopyElev = el.querySelector("#btn-copy-elev");
    if (btnCopyElev && hasElev) {
      setupCopyBtn(btnCopyElev, elevFormatted + " m", "Zkopírováno!");
    }

    // 2. Tlačítko kopírovat S-JTSK
    var btnCopySjtsk = el.querySelector(".btn-copy-sjtsk");
    if (btnCopySjtsk && sjtsk) {
      setupCopyBtn(btnCopySjtsk, "Y: " + sjtsk.y.toFixed(2) + ", X: " + sjtsk.x.toFixed(2), "Zkopírováno!");
    }

    // 3. Tlačítko kopírovat WGS 84
    var btnCopyWgs = el.querySelector(".btn-copy-wgs");
    if (btnCopyWgs) {
      setupCopyBtn(btnCopyWgs, latlng.lat.toFixed(6) + ", " + latlng.lng.toFixed(6), "Zkopírováno!");
    }

    // 4. Tlačítko kopírovat kompletní bod Y, X, Z
    var btnCopyAll = el.querySelector("#btn-copy-all");
    if (btnCopyAll) {
      var allStr = sjtsk
        ? "Y: " + sjtsk.y.toFixed(2) + ", X: " + sjtsk.x.toFixed(2) + (hasElev ? ", Z: " + elevFormatted : "")
        : "Lat: " + latlng.lat.toFixed(6) + ", Lon: " + latlng.lng.toFixed(6) + (hasElev ? ", Z: " + elevFormatted : "");
      setupCopyBtn(btnCopyAll, allStr, "Zkopírováno!");
    }
  }

  // Spuštění při načtení stránky
  document.addEventListener("DOMContentLoaded", function () {
    initMap();
  });

})();
