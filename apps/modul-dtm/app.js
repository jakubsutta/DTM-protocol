/**
 * Modul DTM – Mapová aplikace pro prohlížení DI, TI a ZPS
 * ČÚZK IS DMVS WMS & Ortofoto ČÚZK
 * Podpora hierarchických skupin DI a TI s volitelnými podskupinami sítí
 */

(function () {
  "use strict";

  // Mapování podskupin DI na skutečné WMS vrstvy ČÚZK IS DMVS
  var DI_MAPPING = {
    pozemni_komunikace: ["siln_dopr", "dopr_st_skup"],
    draha: ["dr_dopr"],
    letiste: ["let_dopr", "vod_dopr"]
  };

  // Mapování podskupin TI (7 inženýrských sítí) na skutečné WMS vrstvy ČÚZK IS DMVS
  var TI_MAPPING = {
    vodovod: ["voda", "priv_vody"],
    kanalizace: ["kan"],
    elektro: ["el_ved"],
    plynovod: ["plyn"],
    teplovod: ["teplo"],
    elektronicke_komunikace: ["el_kom"],
    produktovod: ["produkt", "potrub_posta"]
  };

  var DI_SUBLAYERS = Object.keys(DI_MAPPING);
  var TI_SUBLAYERS = Object.keys(TI_MAPPING);

  // Převod zvolených podskupin na čárkou oddělený řetězec oficiálních ČÚZK WMS vrstev
  function resolveWmsLayers(groupKey, activeKeys) {
    var mapping = groupKey === "dtm_di" ? DI_MAPPING : TI_MAPPING;
    var allKeys = groupKey === "dtm_di" ? DI_SUBLAYERS : TI_SUBLAYERS;
    var defaultMaster = groupKey === "dtm_di" ? "dtm_di_ver" : "dtm_ti_ver";

    // Pokud jsou zapnuty všechny podskupiny, použijeme master vrstvu služby
    if (activeKeys.length === allKeys.length) {
      return defaultMaster;
    }

    var wmsList = [];
    activeKeys.forEach(function (key) {
      var arr = mapping[key];
      if (arr) {
        for (var i = 0; i < arr.length; i++) {
          if (wmsList.indexOf(arr[i]) === -1) {
            wmsList.push(arr[i]);
          }
        }
      }
    });

    return wmsList.join(",");
  }

  // Základní konfigurace měst pro rychlý skok
  var CITY_BOOKMARKS = {
    praha: { name: "Praha", coords: [50.0875, 14.4214], zoom: 16 },
    brno: { name: "Brno", coords: [49.1951, 16.6068], zoom: 16 },
    ostrava: { name: "Ostrava", coords: [49.8356, 18.2923], zoom: 16 },
    plzen: { name: "Plzeň", coords: [49.7475, 13.3776], zoom: 16 },
    liberec: { name: "Liberec", coords: [50.7671, 15.0562], zoom: 16 },
    olomouc: { name: "Olomouc", coords: [49.5938, 17.2509], zoom: 16 },
    pardubice: { name: "Pardubice", coords: [50.0385, 15.7792], zoom: 16 },
    hradec: { name: "Hradec Králové", coords: [50.2092, 15.8328], zoom: 16 },
    budejovice: { name: "Č. Budějovice", coords: [48.9745, 14.4743], zoom: 16 },
    zlin: { name: "Zlín", coords: [49.2243, 17.6627], zoom: 16 }
  };

  // Aplikační stav
  var state = {
    map: null,
    currentBaseLayer: "orto",
    elevationMode: false,
    baseLayers: {},
    overlayLayers: {},
    activeSublayers: {
      dtm_di: new Set(),
      dtm_ti: new Set()
    },
    groupOpacity: {
      dtm_di: 0.9,
      dtm_ti: 0.9
    },
    activeSingleLayers: new Set(),
    legendFilter: "active",
    currentTab: "layers"
  };

  // Inicializace mapy
  function initMap() {
    // Definice projekce S-JTSK v proj4, pokud je knihovna načtena
    if (typeof proj4 !== "undefined") {
      proj4.defs("EPSG:5514", "+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=570.8,85.7,462.8,4.998,1.587,5.261,3.56 +units=m +no_defs");
    }

    // Výchozí zobrazení: Praha centrum na zoomu 16 (kde jsou DTM data plně aktivní a načítají se rychle)
    var defaultCenter = [50.0875, 14.4214];
    var defaultZoom = 16;

    state.map = L.map("map", {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: true
    });

    // Měřítko vlevo dole
    L.control.scale({
      position: "bottomleft",
      metric: true,
      imperial: false
    }).addTo(state.map);

    // Číselný zoom ukazatel mezi tlačítky [+] a [-] v Leaflet zoom control
    initZoomDisplay();

    // Inicializace podkladových map (Ortofoto ČÚZK, ZTM, OSM)
    initBaseLayers();

    // Tlačítko podkladové mapy přímo pod zoom controls
    initBasemapControl();

    // Tlačítko měření nadmořské výšky (DMR 5G) pod podkladovými mapami
    initElevationControl();

    // Tlačítko vyhledávání v RÚIAN (Adresa, Parcela, Kat. území) pod nadmořskou výškou
    initSearchControl();

    // Tlačítko měření (vzdálenost / linie, plocha) pod vyhledáváním
    initMeasureControl();

    // Tlačítko legendy na mapě pod měřením
    initLegendControl();

    // Inicializace překryvných vrstev DTM a KN
    initOverlayLayers();

    // Event listenery mapy (aktualizace zoom indikátoru)
    setupMapEvents();

    // Nastavení UI ovládacích prvků v pevném panelu vrstev
    setupUIControls();

    // Inicializace systému legendy a značkového klíče DTM
    initLegendSystem();
  }

  // Definice podkladových map (Ověřené ČÚZK WMS a OSM)
  function initBaseLayers() {
    // 1. Ortofotomapa ČÚZK (výchozí osvědčená služba)
    state.baseLayers.orto = L.tileLayer.wms(
      "https://ags.cuzk.cz/arcgis1/services/ORTOFOTO_WM/MapServer/WMSServer",
      {
        layers: "0",
        format: "image/jpeg",
        transparent: false,
        version: "1.3.0",
        crs: L.CRS.EPSG3857,
        maxZoom: 20,
        uppercase: true,
        attribution: '&copy; <a href="https://cuzk.gov.cz" target="_blank" rel="noopener">ČÚZK</a> Ortofoto'
      }
    );

    // 2. Základní topografická mapa ČR (ČÚZK ZTM)
    state.baseLayers.ztm = L.tileLayer.wms(
      "https://ags.cuzk.cz/arcgis1/services/ZTM_WM/MapServer/WMSServer",
      {
        layers: "0",
        format: "image/jpeg",
        transparent: false,
        version: "1.3.0",
        crs: L.CRS.EPSG3857,
        maxZoom: 20,
        uppercase: true,
        attribution: '&copy; <a href="https://cuzk.gov.cz" target="_blank" rel="noopener">ČÚZK</a> ZTM'
      }
    );

    // 3. OpenStreetMap (standardní rychlý celosvětový podklad)
    state.baseLayers.osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      }
    );

    // Výchozí podklad je Ortofoto
    state.baseLayers[state.currentBaseLayer].addTo(state.map);
  }

  // Ovládací prvek pro výběr podkladové mapy (umístěný přímo pod zoom controls vlevo)
  function initBasemapControl() {
    var BasemapControl = L.Control.extend({
      options: {
        position: "topleft"
      },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control basemap-control");

        container.innerHTML =
          '<button type="button" id="btn-basemap-toggle" class="basemap-toggle-btn" title="Podkladová mapa (Ortofoto, ZTM, OSM)" aria-label="Změnit podkladovou mapu">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
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
              '<div class="base-map-item active" data-base="orto">' +
                '<div class="base-map-radio"></div>' +
                '<div class="base-map-info">' +
                  '<span class="base-map-name">Ortofotomapa ČÚZK</span>' +
                  '<span class="base-map-desc">Aktuální letecké snímky ČR</span>' +
                '</div>' +
              '</div>' +
              '<div class="base-map-item" data-base="ztm">' +
                '<div class="base-map-radio"></div>' +
                '<div class="base-map-info">' +
                  '<span class="base-map-name">Základní topografická mapa</span>' +
                  '<span class="base-map-desc">ČÚZK ZTM s místopisem</span>' +
                '</div>' +
              '</div>' +
              '<div class="base-map-item" data-base="osm">' +
                '<div class="base-map-radio"></div>' +
                '<div class="base-map-info">' +
                  '<span class="base-map-name">OpenStreetMap</span>' +
                  '<span class="base-map-desc">Globální uliční mapa</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';

        // Zamezení probublávání kliknutí a scrollování do mapy
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

      // Zavření při kliknutí mimo
      document.addEventListener("click", function (e) {
        if (!popover.contains(e.target) && !btnToggle.contains(e.target)) {
          popover.classList.remove("is-open");
          btnToggle.classList.remove("is-active");
        }
      });

      // Zavření klávesou Escape
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          popover.classList.remove("is-open");
          btnToggle.classList.remove("is-active");
        }
      });
    }

    // Kliknutí na volby podkladové mapy uvnitř popoveru
    document.querySelectorAll(".basemap-popover .base-map-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var baseKey = this.getAttribute("data-base");
        setBaseLayer(baseKey);
        if (popover && btnToggle) {
          popover.classList.remove("is-open");
          btnToggle.classList.remove("is-active");
        }
      });
    });
  }

  // Ovládací prvek pro měření nadmořské výšky (DMR 5G ČÚZK) umístěný pod podkladovými mapami
  function initElevationControl() {
    var ElevationControl = L.Control.extend({
      options: {
        position: "topleft"
      },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control elevation-control");

        container.innerHTML =
          '<button type="button" id="btn-elevation-toggle" class="elevation-toggle-btn" title="Dotazování na nadmořskou výšku (DMR 5G ČÚZK)" aria-label="Měření nadmořské výšky">' +
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

    var btnElev = document.getElementById("btn-elevation-toggle");
    if (btnElev) {
      btnElev.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleElevationMode();
      });
    }

    // Vypnutí režimu klávesou Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.elevationMode) {
        toggleElevationMode(false);
      }
    });
  }

  // Přepnutí režimu dotazování na nadmořskou výšku (zapnuto / vypnuto)
  function toggleElevationMode(forceState) {
    var nextState = forceState !== undefined ? forceState : !state.elevationMode;
    state.elevationMode = nextState;

    var btn = document.getElementById("btn-elevation-toggle");
    var mapEl = document.getElementById("map");
    var statusDot = document.getElementById("status-dot");
    var statusText = document.getElementById("map-status-text");

    if (state.elevationMode) {
      if (btn) btn.classList.add("is-active");
      if (mapEl) mapEl.classList.add("elevation-mode-active");
      if (statusDot) statusDot.className = "status-dot elevation-active";
      if (statusText) statusText.textContent = "Režim měření výšky (DMR 5G) aktivní – klikněte kamkoliv do mapy";

      // Zavřít případný popover podkladových map, vyhledávání a měření
      var popover = document.getElementById("basemap-popover");
      var btnBasemap = document.getElementById("btn-basemap-toggle");
      if (popover) popover.classList.remove("is-open");
      if (btnBasemap) btnBasemap.classList.remove("is-active");
      if (typeof toggleSearchFlyout === "function") {
        toggleSearchFlyout(false);
      }
      if (typeof setMeasureMode === "function" && measureState.mode) {
        setMeasureMode(null);
      }
      var measurePopover = document.getElementById("measure-popover");
      var btnMeasure = document.getElementById("btn-measure-toggle");
      if (measurePopover) measurePopover.classList.remove("is-open");
      if (btnMeasure && !measureState.mode) btnMeasure.classList.remove("is-active");
    } else {
      if (btn) btn.classList.remove("is-active");
      if (mapEl) mapEl.classList.remove("elevation-mode-active");
      if (statusDot) statusDot.className = "status-dot";
      if (statusText) statusText.textContent = "Klikněte na prvek v mapě pro zobrazení vlastností";
    }
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

  // --------------------------------------------------------------------------
  // Vyhledávání v RÚIAN (Adresa, Parcela, Katastrální území)
  // --------------------------------------------------------------------------
  var searchState = {
    isOpen: false,
    activeTab: "adresa",
    addressMarker: null,
    kuLayer: null,
    selectedParcelKu: null,
    debounceTimer: null,
    kuDebounceTimer: null
  };

  // Ovládací prvek pro vyhledávání (RÚIAN) umístěný pod nadmořskou výškou
  function initSearchControl() {
    var SearchControl = L.Control.extend({
      options: {
        position: "topleft"
      },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control search-control");

        container.innerHTML =
          '<button type="button" id="btn-search-toggle" class="search-toggle-btn" title="Hledat (RÚIAN – Adresa, Parcela, Kat. území)" aria-label="Hledat">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="11" cy="11" r="8"></circle>' +
              '<line x1="21" y1="21" x2="16.65" y2="16.65"></line>' +
            '</svg>' +
          '</button>' +
          '<div id="search-flyout" class="search-flyout">' +
            '<div class="search-flyout-header">' +
              '<div class="search-flyout-title">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
                  '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>' +
                '</svg>' +
                '<span>Vyhledávání v RÚIAN</span>' +
              '</div>' +
              '<button type="button" id="btn-close-search" class="btn-close-popover" title="Zavřít">✕</button>' +
            '</div>' +

            '<div class="search-tabs">' +
              '<button type="button" class="search-tab-btn active" data-tab="adresa">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                  '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>' +
                '</svg>' +
                '<span>Adresa</span>' +
              '</button>' +
              '<button type="button" class="search-tab-btn" data-tab="parcela">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                  '<path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>' +
                '</svg>' +
                '<span>Parcela</span>' +
              '</button>' +
              '<button type="button" class="search-tab-btn" data-tab="ku">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                  '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>' +
                  '<line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line>' +
                '</svg>' +
                '<span>Kat. území</span>' +
              '</button>' +
            '</div>' +

            '<div class="search-tab-content">' +
              '<!-- 1. Záložka Adresa -->' +
              '<div class="search-pane active" id="pane-adresa">' +
                '<div class="search-input-wrap">' +
                  '<input type="text" id="search-input-adresa" class="search-input" placeholder="Zadejte adresu (např. Václavské náměstí 1, Praha)" autocomplete="off">' +
                  '<button type="button" id="search-clear-adresa" class="search-clear-btn" title="Vymazat" style="display:none;">✕</button>' +
                '</div>' +
                '<div id="search-results-adresa" class="search-results-list">' +
                  '<div class="search-tip">Zadejte alespoň 2 znaky pro vyhledání adresního místa z RÚIAN.</div>' +
                '</div>' +
              '</div>' +

              '<!-- 2. Záložka Parcela -->' +
              '<div class="search-pane" id="pane-parcela">' +
                '<div class="search-parcel-form">' +
                  '<div class="search-field-group">' +
                    '<label class="search-field-label">Katastrální území (KÚ)</label>' +
                    '<div class="search-input-wrap">' +
                      '<input type="text" id="search-parcel-ku" class="search-input" placeholder="Název nebo kód KÚ (např. Karlín)" autocomplete="off">' +
                      '<button type="button" id="search-clear-parcel-ku" class="search-clear-btn" title="Vymazat" style="display:none;">✕</button>' +
                      '<div id="parcel-ku-suggestions" class="search-dropdown-suggestions" style="display:none;"></div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="search-field-row">' +
                    '<div class="search-field-group" style="flex:1;">' +
                      '<label class="search-field-label">Číslo parcely</label>' +
                      '<input type="text" id="search-parcel-num" class="search-input" placeholder="např. 125/1 nebo 54" autocomplete="off">' +
                    '</div>' +
                    '<div class="search-field-group" style="width:115px;">' +
                      '<label class="search-field-label">Druh</label>' +
                      '<select id="search-parcel-kind" class="search-select">' +
                        '<option value="pozemkova">Pozemková</option>' +
                        '<option value="stavebni">Stavební (st.)</option>' +
                        '<option value="vse">Všechny</option>' +
                      '</select>' +
                    '</div>' +
                  '</div>' +
                  '<button type="button" id="btn-submit-parcel-search" class="btn-search-action">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
                    '<span>Vyhledat parcelu</span>' +
                  '</button>' +
                '</div>' +
                '<div id="search-results-parcela" class="search-results-list"></div>' +
              '</div>' +

              '<!-- 3. Záložka Katastrální území -->' +
              '<div class="search-pane" id="pane-ku">' +
                '<div class="search-input-wrap">' +
                  '<input type="text" id="search-input-ku" class="search-input" placeholder="Název nebo 6-místný kód KÚ (např. Nové Město, 727186)" autocomplete="off">' +
                  '<button type="button" id="search-clear-ku" class="search-clear-btn" title="Vymazat" style="display:none;">✕</button>' +
                '</div>' +
                '<div id="search-results-ku" class="search-results-list">' +
                  '<div class="search-tip">Zadejte alespoň 2 znaky pro vyhledání katastrálního území.</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
      }
    });

    state.map.addControl(new SearchControl());
    setupSearchEvents();
  }

  // Přepnutí vysouvacího okna vyhledávání (otevřeno / zavřeno)
  function toggleSearchFlyout(forceState) {
    var flyout = document.getElementById("search-flyout");
    var btn = document.getElementById("btn-search-toggle");
    if (!flyout || !btn) return;

    var nextState = forceState !== undefined ? forceState : !searchState.isOpen;
    searchState.isOpen = nextState;

    flyout.classList.toggle("is-open", nextState);
    btn.classList.toggle("is-active", nextState);

    if (nextState) {
      // Zavřít basemap popover
      var basePopover = document.getElementById("basemap-popover");
      var baseBtn = document.getElementById("btn-basemap-toggle");
      if (basePopover) basePopover.classList.remove("is-open");
      if (baseBtn) baseBtn.classList.remove("is-active");

      // Vypnout elevation režim, pokud běží
      if (state.elevationMode) {
        toggleElevationMode(false);
      }

      // Zavřít měření popover
      var measurePopover = document.getElementById("measure-popover");
      var btnMeasure = document.getElementById("btn-measure-toggle");
      if (measurePopover) measurePopover.classList.remove("is-open");
      if (btnMeasure && typeof measureState !== "undefined" && !measureState.mode) {
        btnMeasure.classList.remove("is-active");
      }

      focusActiveSearchInput();
    }
  }

  function focusActiveSearchInput() {
    setTimeout(function () {
      if (searchState.activeTab === "adresa") {
        var inp = document.getElementById("search-input-adresa");
        if (inp) inp.focus();
      } else if (searchState.activeTab === "parcela") {
        var inpKu = document.getElementById("search-parcel-ku");
        var inpNum = document.getElementById("search-parcel-num");
        if (searchState.selectedParcelKu && inpNum) {
          inpNum.focus();
        } else if (inpKu) {
          inpKu.focus();
        }
      } else if (searchState.activeTab === "ku") {
        var inpKu2 = document.getElementById("search-input-ku");
        if (inpKu2) inpKu2.focus();
      }
    }, 60);
  }

  // Obsluha událostí vyhledávacího panelu
  function setupSearchEvents() {
    var btnToggle = document.getElementById("btn-search-toggle");
    var btnClose = document.getElementById("btn-close-search");
    var flyout = document.getElementById("search-flyout");

    if (btnToggle) {
      btnToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleSearchFlyout();
      });
    }

    if (btnClose) {
      btnClose.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleSearchFlyout(false);
      });
    }

    document.addEventListener("click", function (e) {
      if (flyout && btnToggle && !flyout.contains(e.target) && !btnToggle.contains(e.target)) {
        toggleSearchFlyout(false);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && searchState.isOpen) {
        toggleSearchFlyout(false);
      }
    });

    // Přepínání záložek
    var tabBtns = document.querySelectorAll(".search-tab-btn");
    tabBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = this.getAttribute("data-tab");
        searchState.activeTab = tab;
        tabBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
        document.querySelectorAll(".search-pane").forEach(function (pane) {
          pane.classList.toggle("active", pane.id === "pane-" + tab);
        });
        focusActiveSearchInput();
      });
    });

    // 1. Záložka: Vyhledávání adresy
    var inpAddr = document.getElementById("search-input-adresa");
    var clearAddr = document.getElementById("search-clear-adresa");
    if (inpAddr) {
      inpAddr.addEventListener("input", function () {
        var val = inpAddr.value.trim();
        if (clearAddr) clearAddr.style.display = val ? "flex" : "none";
        if (searchState.debounceTimer) clearTimeout(searchState.debounceTimer);
        var resultsEl = document.getElementById("search-results-adresa");

        if (val.length < 2) {
          if (resultsEl) resultsEl.innerHTML = '<div class="search-tip">Zadejte alespoň 2 znaky pro vyhledání adresního místa z RÚIAN.</div>';
          return;
        }

        searchState.debounceTimer = setTimeout(function () {
          executeAddressSearch(val);
        }, 260);
      });

      inpAddr.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          var val = inpAddr.value.trim();
          if (val.length >= 2) executeAddressSearch(val);
        }
      });
    }

    if (clearAddr) {
      clearAddr.addEventListener("click", function () {
        if (inpAddr) {
          inpAddr.value = "";
          clearAddr.style.display = "none";
          var resultsEl = document.getElementById("search-results-adresa");
          if (resultsEl) resultsEl.innerHTML = '<div class="search-tip">Zadejte alespoň 2 znaky pro vyhledání adresního místa z RÚIAN.</div>';
          inpAddr.focus();
        }
      });
    }

    // 2. Záložka: Vyhledávání Katastrálního území
    var inpKu = document.getElementById("search-input-ku");
    var clearKu = document.getElementById("search-clear-ku");
    if (inpKu) {
      inpKu.addEventListener("input", function () {
        var val = inpKu.value.trim();
        if (clearKu) clearKu.style.display = val ? "flex" : "none";
        if (searchState.debounceTimer) clearTimeout(searchState.debounceTimer);
        var resultsEl = document.getElementById("search-results-ku");

        if (val.length < 2) {
          if (resultsEl) resultsEl.innerHTML = '<div class="search-tip">Zadejte alespoň 2 znaky pro vyhledání katastrálního území.</div>';
          return;
        }

        searchState.debounceTimer = setTimeout(function () {
          executeKuSearch(val);
        }, 260);
      });

      inpKu.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          var val = inpKu.value.trim();
          if (val.length >= 2) executeKuSearch(val);
        }
      });
    }

    if (clearKu) {
      clearKu.addEventListener("click", function () {
        if (inpKu) {
          inpKu.value = "";
          clearKu.style.display = "none";
          var resultsEl = document.getElementById("search-results-ku");
          if (resultsEl) resultsEl.innerHTML = '<div class="search-tip">Zadejte alespoň 2 znaky pro vyhledání katastrálního území.</div>';
          inpKu.focus();
        }
      });
    }

    // 3. Záložka: Parcela
    setupParcelKuAutocomplete();

    var btnSubmitParcel = document.getElementById("btn-submit-parcel-search");
    var inpParcelNum = document.getElementById("search-parcel-num");
    if (btnSubmitParcel) {
      btnSubmitParcel.addEventListener("click", executeParcelSearch);
    }
    if (inpParcelNum) {
      inpParcelNum.addEventListener("keydown", function (e) {
        if (e.key === "Enter") executeParcelSearch();
      });
    }
  }

  // Vyhledání adresního místa přes RÚIAN vrstvu 1
  async function executeAddressSearch(query) {
    var resultsEl = document.getElementById("search-results-adresa");
    if (!resultsEl) return;

    resultsEl.innerHTML =
      '<div class="search-loading">' +
        '<div class="dtm-loading-spinner" style="width:14px; height:14px; border-width:2px; border-top-color:#103778;"></div>' +
        '<span>Vyhledávám adresy v RÚIAN...</span>' +
      '</div>';

    try {
      var words = query.trim().split(/\s+/).filter(Boolean);
      var whereParts = words.map(function (w) {
        return "UPPER(adresa) LIKE '%" + w.replace(/'/g, "''").toUpperCase() + "%'";
      });
      var whereStr = whereParts.join(" AND ");

      var url = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/1/query?" +
        "where=" + encodeURIComponent(whereStr) +
        "&outFields=adresa,kod,cislodomovni,cisloorientacni,psc" +
        "&returnGeometry=true" +
        "&outSR=4326" +
        "&resultRecordCount=12" +
        "&f=json";

      var resp = await fetch(url);
      var data = await resp.json();

      if (data.error) {
        console.error("RÚIAN error:", data.error);
        resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Chyba RÚIAN: ' + (data.error.message || "Chyba dotazu") + '</div>';
        return;
      }

      var feats = data.features || [];

      if (feats.length === 0) {
        resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Pro dotaz „' + query + '“ nebyla nalezena žádná adresa.</div>';
        return;
      }

      var html = "";
      feats.forEach(function (f, idx) {
        var att = f.attributes || {};
        var subText = "Kód RÚIAN: " + att.kod + (att.psc ? " • PSČ: " + att.psc : "");
        html +=
          '<div class="search-result-item" data-addr-idx="' + idx + '">' +
            '<div class="search-res-title">' + (att.adresa || "Adresní místo") + '</div>' +
            '<div class="search-res-sub">' + subText + '</div>' +
          '</div>';
      });

      resultsEl.innerHTML = html;

      resultsEl.querySelectorAll(".search-result-item").forEach(function (itemEl) {
        itemEl.addEventListener("click", function () {
          var idx = parseInt(this.getAttribute("data-addr-idx"), 10);
          if (feats[idx]) {
            selectAddressResult(feats[idx]);
          }
        });
      });
    } catch (err) {
      console.error("Chyba při hledání adresy:", err);
      resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Chyba při komunikaci se serverem RÚIAN: ' + (err.message || err) + '</div>';
    }
  }

  // Zobrazení a přechod na vybrané adresní místo
  function selectAddressResult(item) {
    if (!item || !item.geometry) return;
    var lat = item.geometry.y;
    var lng = item.geometry.x;
    var latlng = L.latLng(lat, lng);

    state.map.setView(latlng, Math.max(state.map.getZoom(), 18));

    if (searchState.addressMarker) {
      state.map.removeLayer(searchState.addressMarker);
      searchState.addressMarker = null;
    }

    var icon = L.divIcon({
      className: "dtm-search-marker-wrap",
      html: '<div class="dtm-target-marker" style="--marker-color:#0284c7;"><div class="dtm-marker-pulse"></div><div class="dtm-marker-ring"></div><div class="dtm-marker-center"><div class="dtm-marker-dot"></div></div></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    searchState.addressMarker = L.marker(latlng, { icon: icon }).addTo(state.map);

    var att = item.attributes || {};
    var popupHtml =
      '<div class="dtm-popup-card">' +
        '<div class="dtm-popup-header">' +
          '<div class="dtm-popup-title">' + (att.adresa || "Adresní místo") + '</div>' +
          '<div class="dtm-layer-tag">RÚIAN Adresa</div>' +
        '</div>' +
        '<div class="dtm-prop-table">' +
          '<div class="dtm-prop-row"><span class="dtm-prop-k">Kód adresy:</span><span class="dtm-prop-v code">' + att.kod + '</span></div>' +
          (att.psc ? '<div class="dtm-prop-row"><span class="dtm-prop-k">PSČ:</span><span class="dtm-prop-v">' + att.psc + '</span></div>' : '') +
          (att.cislodomovni ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Číslo domovní/orientační:</span><span class="dtm-prop-v">' + att.cislodomovni + (att.cisloorientacni ? "/" + att.cisloorientacni : "") + '</span></div>' : '') +
        '</div>' +
        '<button type="button" class="btn-query-here" id="btn-query-address-dtm" style="margin-top:8px;">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
          '<span>Dotázat se na sítě DTM a parcelu</span>' +
        '</button>' +
      '</div>';

    var popup = L.popup({ minWidth: 280, maxWidth: 350, autoPan: true })
      .setLatLng(latlng)
      .setContent(popupHtml)
      .openOn(state.map);

    attachAddressPopupListeners(popup, latlng);

    popup.on("remove", function () {
      if (searchState.addressMarker) {
        state.map.removeLayer(searchState.addressMarker);
        searchState.addressMarker = null;
      }
    });
  }

  // Obsluha tlačítek v popupu adresního místa
  function attachAddressPopupListeners(popup, latlng) {
    function bind() {
      var el = popup.getElement();
      if (!el) {
        setTimeout(bind, 25);
        return;
      }
      var btnQ = el.querySelector("#btn-query-address-dtm");
      if (btnQ) {
        btnQ.addEventListener("click", function (ev) {
          ev.stopPropagation();
          executeCoordinateQuery(latlng);
        });
      }
    }
    bind();
  }

  // Vyhledání katastrálního území přes RÚIAN vrstvu 7
  async function executeKuSearch(query) {
    var resultsEl = document.getElementById("search-results-ku");
    if (!resultsEl) return;

    resultsEl.innerHTML =
      '<div class="search-loading">' +
        '<div class="dtm-loading-spinner" style="width:14px; height:14px; border-width:2px; border-top-color:#103778;"></div>' +
        '<span>Vyhledávám katastrální území v RÚIAN...</span>' +
      '</div>';

    try {
      var cleanQ = query.trim().replace(/'/g, "''");
      var isNumeric = /^\d+$/.test(cleanQ);
      var whereClause = isNumeric ? ("kod=" + cleanQ) : ("UPPER(nazev) LIKE UPPER('%" + cleanQ + "%')");

      var url = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/7/query?" +
        "where=" + encodeURIComponent(whereClause) +
        "&outFields=kod,nazev,obec,platiod" +
        "&returnGeometry=true" +
        "&outSR=4326" +
        "&resultRecordCount=12" +
        "&f=geojson";

      var resp = await fetch(url);
      var data = await resp.json();

      if (data.error) {
        console.error("RÚIAN error:", data.error);
        resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Chyba RÚIAN: ' + (data.error.message || "Chyba dotazu") + '</div>';
        return;
      }

      var feats = data.features || [];

      if (feats.length === 0) {
        resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Pro dotaz „' + query + '“ nebylo nalezeno žádné katastrální území.</div>';
        return;
      }

      var html = "";
      feats.forEach(function (f, idx) {
        var p = f.properties || {};
        html +=
          '<div class="search-result-item" data-ku-idx="' + idx + '">' +
            '<div class="search-res-title">' + (p.nazev || "Katastrální území") + '</div>' +
            '<div class="search-res-sub">Kód KÚ: ' + p.kod + (p.obec ? ' • Kód obce: ' + p.obec : '') + '</div>' +
          '</div>';
      });

      resultsEl.innerHTML = html;

      resultsEl.querySelectorAll(".search-result-item").forEach(function (itemEl) {
        itemEl.addEventListener("click", function () {
          var idx = parseInt(this.getAttribute("data-ku-idx"), 10);
          if (feats[idx]) {
            selectKuResult(feats[idx]);
          }
        });
      });
    } catch (err) {
      console.error("Chyba při hledání KÚ:", err);
      resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Chyba při komunikaci se serverem RÚIAN: ' + (err.message || err) + '</div>';
    }
  }

  // Zvýraznění a přiblížení vybraného katastrálního území
  function selectKuResult(feat) {
    if (!feat || !feat.geometry) return;
    if (searchState.kuLayer) {
      state.map.removeLayer(searchState.kuLayer);
      searchState.kuLayer = null;
    }

    var kuName = feat.properties.nazev || "Katastrální území";
    var kuKod = feat.properties.kod;

    searchState.kuLayer = L.geoJSON(feat, {
      style: {
        color: "#0284c7",
        weight: 2.5,
        dashArray: "6, 6",
        fillColor: "#38bdf8",
        fillOpacity: 0.06
      }
    }).addTo(state.map);

    var bounds = searchState.kuLayer.getBounds();
    state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });

    // Informační banner o aktivním zvýraznění KÚ v panelu vyhledávání
    var resultsEl = document.getElementById("search-results-ku");
    if (resultsEl) {
      var oldBanner = document.getElementById("ku-active-highlight-banner");
      if (oldBanner) oldBanner.remove();

      var banner = document.createElement("div");
      banner.id = "ku-active-highlight-banner";
      banner.className = "ku-active-banner";
      banner.innerHTML =
        '<div style="font-size:11px; font-weight:700; color:#0284c7;">Aktivní KÚ: ' + kuName + ' (' + kuKod + ')</div>' +
        '<button type="button" class="btn-clear-ku-highlight" id="btn-clear-ku-pane">Zrušit zvýraznění</button>';
      resultsEl.insertBefore(banner, resultsEl.firstChild);

      var btnClearPane = banner.querySelector("#btn-clear-ku-pane");
      if (btnClearPane) {
        btnClearPane.addEventListener("click", function (e) {
          e.stopPropagation();
          clearKuHighlight();
        });
      }
    }

    var center = bounds.getCenter();
    var popupContent =
      '<div class="dtm-popup-card">' +
        '<div class="dtm-popup-header">' +
          '<div class="dtm-popup-title">' + kuName + '</div>' +
          '<div class="dtm-layer-tag">Katastrální území</div>' +
        '</div>' +
        '<div class="dtm-prop-table">' +
          '<div class="dtm-prop-row"><span class="dtm-prop-k">Kód KÚ:</span><span class="dtm-prop-v code">' + kuKod + '</span></div>' +
          (feat.properties.obec ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Kód obce:</span><span class="dtm-prop-v">' + feat.properties.obec + '</span></div>' : '') +
        '</div>' +
        '<div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">' +
          '<button type="button" class="btn-query-here" id="btn-use-ku-for-parcel">' +
            '<span>Hledat parcelu v tomto KÚ</span>' +
          '</button>' +
          '<button type="button" class="btn-remove-ku-action" id="btn-remove-ku-layer">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
            '<span>Zrušit zvýraznění KÚ</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    var popup = L.popup({ minWidth: 260, maxWidth: 320, autoPan: true })
      .setLatLng(center)
      .setContent(popupContent)
      .openOn(state.map);

    attachKuPopupListeners(popup, feat);
  }

  // Zrušení zvýraznění katastrálního území
  function clearKuHighlight() {
    if (searchState.kuLayer) {
      state.map.removeLayer(searchState.kuLayer);
      searchState.kuLayer = null;
    }
    var banner = document.getElementById("ku-active-highlight-banner");
    if (banner) {
      banner.remove();
    }
  }

  // Obsluha tlačítek uvnitř popupu katastrálního území
  function attachKuPopupListeners(popup, feat) {
    function bind() {
      var el = popup.getElement();
      if (!el) {
        setTimeout(bind, 25);
        return;
      }

      var btnUse = el.querySelector("#btn-use-ku-for-parcel");
      var btnRemove = el.querySelector("#btn-remove-ku-layer");
      var kuName = (feat && feat.properties && feat.properties.nazev) || "Katastrální území";
      var kuKod = (feat && feat.properties && feat.properties.kod) || "";

      if (btnUse) {
        btnUse.addEventListener("click", function (e) {
          e.stopPropagation();
          var tabBtn = document.querySelector('.search-tab-btn[data-tab="parcela"]');
          if (tabBtn) tabBtn.click();
          var inpKu = document.getElementById("search-parcel-ku");
          if (inpKu) inpKu.value = kuName + " (" + kuKod + ")";
          searchState.selectedParcelKu = { kod: kuKod, nazev: kuName };
          var clearBtn = document.getElementById("search-clear-parcel-ku");
          if (clearBtn) clearBtn.style.display = "flex";
          var inpNum = document.getElementById("search-parcel-num");
          if (inpNum) inpNum.focus();
        });
      }

      if (btnRemove) {
        btnRemove.addEventListener("click", function (e) {
          e.stopPropagation();
          clearKuHighlight();
          state.map.closePopup(popup);
        });
      }
    }
    bind();
  }

  // Našeptávač pro výběr KÚ v záložce Parcela
  function setupParcelKuAutocomplete() {
    var inpKu = document.getElementById("search-parcel-ku");
    var suggestions = document.getElementById("parcel-ku-suggestions");
    var clearBtn = document.getElementById("search-clear-parcel-ku");
    if (!inpKu || !suggestions) return;

    inpKu.addEventListener("input", function () {
      var val = inpKu.value.trim();
      if (clearBtn) clearBtn.style.display = val ? "flex" : "none";
      searchState.selectedParcelKu = null;

      if (searchState.kuDebounceTimer) clearTimeout(searchState.kuDebounceTimer);
      if (val.length < 2) {
        suggestions.style.display = "none";
        suggestions.innerHTML = "";
        return;
      }

      searchState.kuDebounceTimer = setTimeout(async function () {
        var cleanQ = val.replace(/'/g, "''");
        var isNum = /^\d+$/.test(cleanQ);
        var where = isNum ? ("kod=" + cleanQ) : ("UPPER(nazev) LIKE UPPER('%" + cleanQ + "%')");
        var url = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/7/query?" +
          "where=" + encodeURIComponent(where) +
          "&outFields=kod,nazev&returnGeometry=false&resultRecordCount=8&f=json";

        try {
          var resp = await fetch(url);
          var data = await resp.json();
          var feats = data.features || [];

          if (feats.length === 0) {
            suggestions.style.display = "none";
            return;
          }

          var html = "";
          feats.forEach(function (f) {
            var att = f.attributes;
            html +=
              '<div class="search-dropdown-item" data-kod="' + att.kod + '" data-nazev="' + att.nazev + '">' +
                '<span>' + att.nazev + '</span>' +
                '<span class="search-item-badge">' + att.kod + '</span>' +
              '</div>';
          });
          suggestions.innerHTML = html;
          suggestions.style.display = "block";

          suggestions.querySelectorAll(".search-dropdown-item").forEach(function (el) {
            el.addEventListener("click", function () {
              var kod = this.getAttribute("data-kod");
              var nazev = this.getAttribute("data-nazev");
              inpKu.value = nazev + " (" + kod + ")";
              searchState.selectedParcelKu = { kod: kod, nazev: nazev };
              suggestions.style.display = "none";
              var inpNum = document.getElementById("search-parcel-num");
              if (inpNum) inpNum.focus();
            });
          });
        } catch (e) {
          suggestions.style.display = "none";
        }
      }, 240);
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        inpKu.value = "";
        searchState.selectedParcelKu = null;
        clearBtn.style.display = "none";
        suggestions.style.display = "none";
        inpKu.focus();
      });
    }

    document.addEventListener("click", function (e) {
      if (!inpKu.contains(e.target) && !suggestions.contains(e.target)) {
        suggestions.style.display = "none";
      }
    });
  }

  // Vyhledání parcely v RÚIAN (MapServer/5)
  async function executeParcelSearch() {
    var inpKu = document.getElementById("search-parcel-ku");
    var inpNum = document.getElementById("search-parcel-num");
    var selectKind = document.getElementById("search-parcel-kind");
    var resultsEl = document.getElementById("search-results-parcela");
    if (!resultsEl) return;

    var kuVal = (inpKu ? inpKu.value : "").trim();
    var numVal = (inpNum ? inpNum.value : "").trim();
    var kindVal = selectKind ? selectKind.value : "pozemkova";

    if (!kuVal) {
      resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Vyplňte název nebo kód katastrálního území.</div>';
      if (inpKu) inpKu.focus();
      return;
    }

    if (!numVal) {
      resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Vyplňte číslo parcely (např. 125/1 nebo 54).</div>';
      if (inpNum) inpNum.focus();
      return;
    }

    resultsEl.innerHTML =
      '<div class="search-loading">' +
        '<div class="dtm-loading-spinner" style="width:14px; height:14px; border-width:2px; border-top-color:#103778;"></div>' +
        '<span>Vyhledávám parcelu v RÚIAN...</span>' +
      '</div>';

    try {
      // 1. Získat kód KÚ
      var kuCode = null;
      var kuName = kuVal;

      if (searchState.selectedParcelKu && searchState.selectedParcelKu.kod) {
        kuCode = searchState.selectedParcelKu.kod;
        kuName = searchState.selectedParcelKu.nazev;
      } else if (/^\d{6}$/.test(kuVal)) {
        kuCode = kuVal;
      } else {
        var cleanKu = kuVal.replace(/\s*\(\d+\)$/, "").replace(/'/g, "''");
        var kuQueryUrl = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/7/query?" +
          "where=" + encodeURIComponent("UPPER(nazev) LIKE UPPER('%" + cleanKu + "%')") +
          "&outFields=kod,nazev&returnGeometry=false&resultRecordCount=1&f=json";
        var kuResp = await fetch(kuQueryUrl);
        var kuData = await kuResp.json();
        if (kuData.features && kuData.features.length > 0) {
          kuCode = kuData.features[0].attributes.kod;
          kuName = kuData.features[0].attributes.nazev;
        } else {
          resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Katastrální území „' + kuVal + '“ nebylo nalezeno.</div>';
          return;
        }
      }

      // 2. Parsovat parcelní číslo
      var m = numVal.match(/^(?:st\.\s*)?(\d+)(?:\s*\/\s*(\d+))?$/i);
      if (!m) {
        resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Neplatný formát čísla parcely (zadejte např. 125/1 nebo 54).</div>';
        return;
      }

      var isStavebniExplicit = /^st\./i.test(numVal);
      var kmen = parseInt(m[1], 10);
      var poddel = m[2] ? parseInt(m[2], 10) : null;

      // 3. Sestavit dotaz na Layer 5 (Parcely)
      var whereParts = [
        "katastralniuzemi = " + kuCode,
        "kmenovecislo = " + kmen
      ];

      if (poddel !== null) {
        whereParts.push("poddelenicisla = " + poddel);
      } else {
        whereParts.push("(poddelenicisla IS NULL OR poddelenicisla = 0)");
      }

      if (kindVal === "stavebni" || isStavebniExplicit) {
        whereParts.push("druhcislovanikod = 1");
      } else if (kindVal === "pozemkova" && !isStavebniExplicit) {
        whereParts.push("druhcislovanikod = 2");
      }

      var parcelUrl = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/5/query?" +
        "where=" + encodeURIComponent(whereParts.join(" AND ")) +
        "&outFields=*&returnGeometry=true&outSR=4326&f=geojson";

      var resp = await fetch(parcelUrl);
      var data = await resp.json();
      var feats = data.features || [];

      // Pokud nenalezeno přesnou shodou, zkusíme volnější dotaz na kmenové číslo
      if (feats.length === 0) {
        var fallbackUrl = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/5/query?" +
          "where=" + encodeURIComponent("katastralniuzemi = " + kuCode + " AND kmenovecislo = " + kmen) +
          "&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=10&f=geojson";
        var respFb = await fetch(fallbackUrl);
        var dataFb = await respFb.json();
        feats = dataFb.features || [];
      }

      if (feats.length === 0) {
        resultsEl.innerHTML =
          '<div class="search-tip" style="color:#ef4444;">' +
            'Parcela č. ' + numVal + ' v k.ú. ' + kuName + ' (' + kuCode + ') nebyla v RÚIAN nalezena.' +
            '<div style="margin-top:4px; font-size:10px; color:var(--text-muted);">' +
              'Zkontrolujte správnost k.ú. a čísla parcely (např. zda nejde o stavební parcelu st.).' +
            '</div>' +
          '</div>';
        return;
      }

      if (feats.length === 1) {
        displayFoundParcel(feats[0]);
      } else {
        var html = '<div style="font-size:11px; font-weight:700; margin-bottom:4px; color:var(--text-main);">Nalezeno ' + feats.length + ' parcel:</div>';
        feats.forEach(function (f, idx) {
          var p = f.properties || {};
          var pNum = (p.druhcislovanikod === 1 ? "st. " : "") + p.kmenovecislo + (p.poddelenicisla ? "/" + p.poddelenicisla : "");
          var pKind = p.druhcislovanikod === 1 ? "Stavební" : "Pozemková";
          var pArea = p.vymeraparcely ? Number(p.vymeraparcely).toLocaleString("cs-CZ") + " m²" : "";

          html +=
            '<div class="search-result-item" data-parcel-idx="' + idx + '">' +
              '<div class="search-res-title">Parcela č. ' + pNum + '</div>' +
              '<div class="search-res-sub">' +
                '<span>' + pKind + '</span>' +
                (pArea ? '<span>• ' + pArea + '</span>' : '') +
              '</div>' +
            '</div>';
        });
        resultsEl.innerHTML = html;

        resultsEl.querySelectorAll(".search-result-item").forEach(function (itemEl) {
          itemEl.addEventListener("click", function () {
            var idx = parseInt(this.getAttribute("data-parcel-idx"), 10);
            if (feats[idx]) {
              displayFoundParcel(feats[idx]);
            }
          });
        });
      }
    } catch (err) {
      console.error("Chyba při vyhledávání parcely:", err);
      resultsEl.innerHTML = '<div class="search-tip" style="color:#ef4444;">Chyba při komunikaci se serverem RÚIAN ČÚZK: ' + (err.message || err) + '</div>';
    }
  }

  // Zobrazení a zvýraznění nalezené parcely na mapě
  function displayFoundParcel(feature) {
    if (!feature || !feature.geometry) return;
    feature._isParcel = true;

    highlightParcelGeometry(feature.geometry, true);

    var layer = L.geoJSON(feature);
    var bounds = layer.getBounds();
    state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 19 });

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
          '<span>Parcela č. ' + num + ' byla zobrazena na mapě.</span>' +
        '</div>';
    }
  }

  // --------------------------------------------------------------------------
  // Nástroje měření: Měření vzdálenosti (linie) a plochy (polygon)
  // - Živé zobrazení vzdálenosti na segmentu během pohybu myši
  // - Vzdálenosti na jednotlivých segmentech
  // - Zvýrazněné uzlové body (vrcholy)
  // - Celková délka a celková plocha + obvod
  // --------------------------------------------------------------------------

  var measureState = {
    mode: null, // "line" | "area" | null
    points: [], // L.LatLng[]
    markers: [], // L.Marker[]
    segmentTooltips: [], // L.Tooltip[]
    rubberline: null, // L.Polyline pro živý segment od posledního bodu k myši
    rubberpolygon: null, // L.Polygon pro živý polygon
    liveTooltip: null, // L.Tooltip pro živou vzdálenost
    activeLayer: null // L.Polyline nebo L.Polygon pro pevnou geometrii
  };

  function initMeasureControl() {
    var MeasureControl = L.Control.extend({
      options: {
        position: "topleft"
      },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control measure-control");

        container.innerHTML =
          '<button type="button" id="btn-measure-toggle" class="measure-toggle-btn" title="Měření (linie, vzdálenost, plocha)" aria-label="Měření">' +
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
                '💡 <b>Kliknutím</b> vkládáte uzlové body. <b>Dvojklikem</b> nebo kliknutím na výchozí bod měření dokončíte. <b>Esc</b> zruší rozpracované měření.' +
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
          // Zavřít basemap a vyhledávání
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

      // Zavření kliknutím mimo
      document.addEventListener("click", function (e) {
        if (!popover.contains(e.target) && !btnToggle.contains(e.target)) {
          popover.classList.remove("is-open");
          if (!measureState.mode) {
            btnToggle.classList.remove("is-active");
          }
        }
      });

      // Klávesa Escape
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

    // Výběr režimu měření (linie / plocha)
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

    // Posluchače mapy pro živé kreslení a dvojklik
    state.map.on("mousemove", onMeasureMouseMove);
    state.map.on("dblclick", onMeasureMapDblClick);
  }

  // Zapnutí / vypnutí režimu měření
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

      // Vypnout elevation režim, pokud byl zapnutý
      if (state.elevationMode) {
        toggleElevationMode(false);
      }
      // Zavřít vyhledávání
      if (typeof toggleSearchFlyout === "function") {
        toggleSearchFlyout(false);
      }
      // Zakázat doubleClickZoom mapy, aby dvojklik dokončoval kreslení a nezoomoval
      state.map.doubleClickZoom.disable();
    } else {
      if (btnToggle) btnToggle.classList.remove("is-active");
      if (mapEl) mapEl.classList.remove("measuring-active");
      state.map.doubleClickZoom.enable();

      var z = state.map.getZoom();
      if (statusDot && statusText) {
        if (z >= 14) {
          statusDot.className = "status-dot";
          statusText.textContent = "Aktivní data DTM – klikněte na prvek pro atributy";
        } else {
          statusDot.className = "status-dot inactive";
          statusText.textContent = "DTM neaktivní (přibližte na zoom 14+ pro dotazování)";
        }
      }
    }
  }

  // Kliknutí do mapy při měření – přidání uzlového bodu
  function onMeasureMapClick(e) {
    if (!measureState.mode) return;
    var latlng = e.latlng;
    var pts = measureState.points;
    var len = pts.length;

    // Pokud uživatel klikl velmi blízko k prvnímu bodu a máme alespoň 3 body u plochy, dokončit
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

    // Vytvořit uzel (marker)
    var isFirst = newIdx === 0;
    var nodeIcon = L.divIcon({
      className: "measure-node-wrapper",
      html: '<div class="measure-node-marker' + (isFirst ? ' first-node' : '') + '"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    var marker = L.marker(latlng, { icon: nodeIcon, interactive: true }).addTo(state.map);
    measureState.markers.push(marker);

    // Kliknutí na první bod u plochy ji uzavře
    if (isFirst && measureState.mode === "area") {
      marker.on("click", function (me) {
        L.DomEvent.stopPropagation(me);
        if (measureState.points.length >= 3) {
          finishMeasure();
        }
      });
    }

    // Pokud máme předchozí bod, vytvořit popisek vzdálenosti na segmentu
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

    // Aktualizace pevné geometrie
    updateFixedMeasureLayer();

    // Aktualizace status baru
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

  // Pohyb myši po mapě – živá gumová čára a zobrazení vzdálenosti/plochy
  function onMeasureMouseMove(e) {
    if (!measureState.mode || measureState.points.length === 0) return;
    var cursorPt = e.latlng;
    var pts = measureState.points;
    var lastPt = pts[pts.length - 1];

    var segDist = lastPt.distanceTo(cursorPt);

    if (measureState.mode === "line") {
      var previewPts = pts.concat([cursorPt]);
      var totalDist = calculateLineDistance(previewPts);

      // Živá gumová čára
      if (!measureState.rubberline) {
        measureState.rubberline = L.polyline([lastPt, cursorPt], {
          color: "#0d9488",
          weight: 3,
          dashArray: "6, 6",
          opacity: 0.85
        }).addTo(state.map);
      } else {
        measureState.rubberline.setLatLngs([lastPt, cursorPt]);
      }

      // Živý tooltip u kurzoru s délkou segmentu i celkovou délkou
      var tooltipContent = pts.length === 1
        ? formatMeasureDistance(segDist)
        : '<span style="color:#5eead4;">+ ' + formatMeasureDistance(segDist) + '</span> | Celkem: <b>' + formatMeasureDistance(totalDist) + '</b>';

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
          color: "#0d9488",
          weight: 2,
          dashArray: "5, 5",
          fillColor: "#0d9488",
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

  // Dvojklik – dokončení měření
  function onMeasureMapDblClick(e) {
    if (!measureState.mode || measureState.points.length === 0) return;
    L.DomEvent.stopPropagation(e);
    finishMeasure();
  }

  // Dokončení kreslení linie nebo plochy
  function finishMeasure() {
    var pts = measureState.points;
    if (pts.length === 0) return;

    // Odstranit živé prvky
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

        // Zvýrazněný finální tooltip na konci linie
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

        // Popisek na závěrečném segmentu mezi posledním a prvním bodem
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

        // Vypočítat centroid mnohoúhelníku pro hlavní štítek plochy
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
    // Ukončit aktivní režim zadávání, ponechat nakreslený výsledek
    measureState.mode = null;
    var mapEl = document.getElementById("map");
    if (mapEl) mapEl.classList.remove("measuring-active");
    state.map.doubleClickZoom.enable();

    document.querySelectorAll(".measure-mode-btn").forEach(function (btn) {
      btn.classList.remove("active");
    });
  }

  // Vykreslení pevné vrstvy (linie nebo polygon)
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
        color: "#0d9488",
        weight: 3.5,
        opacity: 0.95
      }).addTo(state.map);
    } else {
      measureState.activeLayerType = "area";
      measureState.activeLayer = L.polygon(pts, {
        color: "#0d9488",
        weight: 3,
        fillColor: "#0d9488",
        fillOpacity: 0.22,
        dashArray: isFinished ? null : "4, 4"
      }).addTo(state.map);
    }
  }

  // Vymazání nakresleného měření
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

  // Výpočet celkové délky lomené čáry
  function calculateLineDistance(pts) {
    var total = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      total += pts[i].distanceTo(pts[i + 1]);
    }
    return total;
  }

  // Výpočet plochy sférického mnohoúhelníku (Geodesic / Spherical Polygon Area)
  function calculatePolygonArea(latlngs) {
    if (latlngs.length < 3) return 0;
    var RADIUS = 6378137; // WGS84 poloměr Země v metrech
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

    var area = Math.abs((total * RADIUS * RADIUS) / 2.0);
    return area;
  }

  // Formátování vzdálenosti (metry / kilometry)
  function formatMeasureDistance(d) {
    if (d === undefined || isNaN(d)) return "0 m";
    if (d < 1000) {
      return d < 10 ? d.toFixed(2) + " m" : d.toFixed(1) + " m";
    }
    return (d / 1000).toFixed(3) + " km";
  }

  // Formátování plochy (m² / ha)
  function formatMeasureArea(a) {
    if (a === undefined || isNaN(a)) return "0 m²";
    if (a < 10000) {
      return a < 100 ? a.toFixed(1) + " m²" : Math.round(a).toLocaleString("cs-CZ") + " m²";
    }
    var ha = a / 10000;
    return ha.toFixed(3) + " ha (" + Math.round(a).toLocaleString("cs-CZ") + " m²)";
  }

  // Společná pomocná funkce pro ČÚZK WMS vrstvy
  function createDtmWms(serviceUrl, layersParam, opacity, attribution) {
    return L.tileLayer.wms(serviceUrl, {
      layers: layersParam,
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      crs: L.CRS.EPSG3857,
      minZoom: 14,
      maxZoom: 21,
      opacity: opacity !== undefined ? opacity : 0.9,
      uppercase: true,
      attribution: attribution || 'ČÚZK IS DMVS'
    });
  }

  // Definice překryvných vrstev DTM (IS DMVS ČÚZK) a KN
  function initOverlayLayers() {
    // 1. Přípojky TI
    state.overlayLayers.dtm_pripojky = createDtmWms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_pripojky",
      "dtm_pripojky",
      0.9,
      'ČÚZK IS DMVS (Přípojky)'
    );

    // 2. ZPS – Polohopis linie a body
    state.overlayLayers.dtm_zps_lb = createDtmWms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_zps_linie_body",
      "dtm_zps_linie_body",
      0.85,
      'ČÚZK IS DMVS (ZPS linie/body)'
    );

    // 3. ZPS – Plochy (barevné)
    state.overlayLayers.dtm_zps_pl_bar = createDtmWms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_zps_plochy_bar",
      "dtm_zps_plochy_bar",
      0.45,
      'ČÚZK IS DMVS (ZPS plochy barevně)'
    );

    // 4. ZPS – Plochy (šedé)
    state.overlayLayers.dtm_zps_pl_seda = createDtmWms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_zps_plochy_seda",
      "dtm_zps_plochy_seda",
      0.45,
      'ČÚZK IS DMVS (ZPS plochy šedě)'
    );

    // 5. Katastrální mapa ČÚZK (KN WMS)
    state.overlayLayers.kn = L.tileLayer.wms(
      "https://services.cuzk.cz/wms/local-km-wms.asp",
      {
        layers: "hranice_parcel_i,parcelni_cisla_i",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        crs: L.CRS.EPSG3857,
        minZoom: 13,
        maxZoom: 20,
        opacity: 0.8,
        uppercase: true,
        attribution: 'ČÚZK KN'
      }
    );

    // Výchozí stav: všechny vrstvy vypnuté
    updateGroupLayer("dtm_di");
    updateGroupLayer("dtm_ti");
  }

  // Správa vrstvy skupiny (DI nebo TI)
  // Dynamicky sestaví parametr layers podle vybraných podskupin
  function updateGroupLayer(groupKey) {
    var allSublayers = groupKey === "dtm_di" ? DI_SUBLAYERS : TI_SUBLAYERS;
    var activeSet = state.activeSublayers[groupKey];
    var activeList = [];
    activeSet.forEach(function (item) { activeList.push(item); });
    var opacity = state.groupOpacity[groupKey];
    var groupCard = document.querySelector('.layer-group-card[data-group="' + groupKey + '"]');
    var masterSwitch = groupCard ? groupCard.querySelector(".group-master-switch") : null;

    var serviceUrl = groupKey === "dtm_di"
      ? "https://dmvs.cuzk.gov.cz/api/wms/dtm_di_ver"
      : "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver";

    var attrText = groupKey === "dtm_di" ? "ČÚZK IS DMVS (DI)" : "ČÚZK IS DMVS (TI)";

    // Odstranit stávající vrstvu skupiny z mapy, pokud existuje
    if (state.overlayLayers[groupKey]) {
      if (state.map.hasLayer(state.overlayLayers[groupKey])) {
        state.map.removeLayer(state.overlayLayers[groupKey]);
      }
      state.overlayLayers[groupKey] = null;
    }

    if (activeList.length === 0) {
      // Žádná podskupina není aktivní
      if (groupCard) groupCard.classList.remove("is-active");
      if (masterSwitch) masterSwitch.checked = false;
    } else {
      // Získat oficiální ČÚZK vrstvy pro vybrané podskupiny
      var layersParam = resolveWmsLayers(groupKey, activeList);

      state.overlayLayers[groupKey] = createDtmWms(serviceUrl, layersParam, opacity, attrText);
      state.overlayLayers[groupKey].addTo(state.map);

      if (groupCard) groupCard.classList.add("is-active");
      if (masterSwitch) masterSwitch.checked = true;
    }

    var countBadge = groupCard ? groupCard.querySelector(".group-count-badge") : null;
    if (countBadge) {
      countBadge.textContent = activeList.length + "/" + allSublayers.length;
    }

    if (typeof updateLegendBadge === "function") updateLegendBadge();
    if (typeof refreshActiveLegendsIfVisible === "function") refreshActiveLegendsIfVisible();
  }

  // Zapnutí / vypnutí samostatné překryvné vrstvy (Přípojky, ZPS, KN)
  function activateLayer(layerKey, enable) {
    var layer = state.overlayLayers[layerKey];
    var card = document.querySelector('.layer-card[data-layer="' + layerKey + '"]');
    var input = card ? card.querySelector('input[type="checkbox"]') : null;

    if (!layer) return;

    if (enable) {
      state.activeSingleLayers.add(layerKey);
      if (!state.map.hasLayer(layer)) {
        layer.addTo(state.map);
      }
      if (card) card.classList.add("is-active");
      if (input) input.checked = true;
    } else {
      state.activeSingleLayers.delete(layerKey);
      if (state.map.hasLayer(layer)) {
        state.map.removeLayer(layer);
      }
      if (card) card.classList.remove("is-active");
      if (input) input.checked = false;
    }

    if (typeof updateLegendBadge === "function") updateLegendBadge();
    if (typeof refreshActiveLegendsIfVisible === "function") refreshActiveLegendsIfVisible();
  }

  // Přepnutí podkladové mapy
  function setBaseLayer(baseKey) {
    if (!state.baseLayers[baseKey] || state.currentBaseLayer === baseKey) return;

    state.map.removeLayer(state.baseLayers[state.currentBaseLayer]);
    state.baseLayers[baseKey].addTo(state.map);
    state.currentBaseLayer = baseKey;

    // Aktualizace aktivní třídy v UI (v popoveru podkladových map)
    document.querySelectorAll(".base-map-item").forEach(function (el) {
      if (el.getAttribute("data-base") === baseKey) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  }

  // Události mapy (zoom indikátor a kliknutí pro dotazování)
  function setupMapEvents() {
    var zoomBadge = document.getElementById("zoom-badge");
    var statusDot = document.getElementById("status-dot");
    var statusText = document.getElementById("map-status-text");

    function updateZoom() {
      var z = state.map.getZoom();
      var zoomLevelEl = document.getElementById("zoom-level-display");
      if (zoomLevelEl) {
        zoomLevelEl.textContent = z;
      }

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
          statusText.textContent = "Aktivní data DTM – klikněte na prvek pro atributy";
        } else {
          statusDot.className = "status-dot inactive";
          statusText.textContent = "DTM neaktivní (přibližte na zoom 14+ pro dotazování)";
        }
      }
    }

    state.map.on("zoomend", updateZoom);
    state.map.on("click", handleMapClick);
    updateZoom();
  }

  // --------------------------------------------------------------------------
  // Funkce pro dotazování na vlastnosti a atributy prvků DTM (GetFeatureInfo)
  // --------------------------------------------------------------------------

  var queryState = {
    marker: null,
    polygonLayer: null,
    popup: null,
    currentData: null
  };

  // Číselníky druhů a využití pozemků (Katastr nemovitostí / RÚIAN)
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

  var ATTR_LABELS = {
    objektovytypnazev: "Typ objektu",
    nazevvlastnika: "Vlastník",
    nazevspravce: "Správce",
    nazevprovozovatele: "Provozovatel",
    urovenumisteniobjektuti: "Úroveň umístění (TI)",
    urovenumisteniobjektuzps: "Úroveň umístění (ZPS)",
    zpusobporizeniti: "Způsob pořízení (TI)",
    zpusobporizenizps: "Způsob pořízení (ZPS)",
    tridapresnostipoloha: "Třída polohové přesnosti",
    tridapresnostivyska: "Třída výškové přesnosti",
    datumvkladu: "Datum vkladu",
    datumzmeny: "Datum změny",
    evidencnicisloobjektu: "Evidenční číslo",
    pocetvedenivtrase: "Počet vedení v trase",
    idexterni: "Externí ID",
    id: "ID prvku / parcely",
    code_base: "Kód typu objektu",
    ideditora: "Editor prvku",
    idzmeny: "ID změny",
    neuplnadata: "Neúplná data",
    ics: "IČS",
    cisloparcely: "Číslo parcely",
    kmenovecislo: "Kmenové číslo",
    poddelenicisla: "Poddělení čísla",
    vymeraparcely: "Výměra parcely",
    zpusobyvyuzitipozemku: "Způsob využití",
    druhpozemkukod: "Druh pozemku",
    katastralniuzemi: "Katastrální území (KÚ)",
    "st_area(shape)": "Plocha tvaru",
    "st_length(shape)": "Obvod parcely"
  };

  function formatLevelValue(val) {
    if (val === "-1" || val === -1) return "Podzemní (-1)";
    if (val === "0" || val === 0) return "Povrch (0)";
    if (val === "1" || val === 1) return "Nadzemní (+1)";
    if (val === "-2" || val === -2) return "Hluboko podzemní (-2)";
    return val;
  }

  function formatAccuracyValue(val) {
    var map = {
      "1": "1. třída (do 4 cm)",
      "2": "2. třída (do 8 cm)",
      "3": "3. třída (do 14 cm)",
      "4": "4. třída (do 26 cm)",
      "5": "5. třída (do 50 cm)",
      "9": "9. třída (nezjištěno)"
    };
    return map[val] || (val ? val + ". třída" : "-");
  }

  function formatBooleanValue(val) {
    if (val === true || val === "true") return "Ano";
    if (val === false || val === "false") return "Ne";
    return val;
  }

  // Zjištění specifické barvy sítě prvku DTM nebo parcely KN
  function getFeatureColor(feature) {
    if (feature._isParcel) return "#059669"; // smaragdová pro parcely KN

    var props = feature.properties || {};
    var title = (props.objektovytypnazev || "").toLowerCase();
    var cat = feature._categoryKey;

    if (cat === "dtm_ti") {
      if (title.indexOf("vodovod") !== -1 || title.indexOf("voda") !== -1 || title.indexOf("přivaděč") !== -1 || title.indexOf("hydrant") !== -1) return "#0284c7"; // modrá voda
      if (title.indexOf("kanaliz") !== -1 || title.indexOf("stok") !== -1 || title.indexOf("šacht") !== -1 || title.indexOf("čov") !== -1) return "#78350f"; // hnědá kanalizace
      if (title.indexOf("elektr") !== -1 || title.indexOf("kabel") !== -1 || title.indexOf("vedení vn") !== -1 || title.indexOf("vedení nn") !== -1 || title.indexOf("osvětlen") !== -1 || title.indexOf("trafo") !== -1) return "#dc2626"; // červené elektro
      if (title.indexOf("plyn") !== -1 || title.indexOf("hup") !== -1) return "#ca8a04"; // žlutý plyn
      if (title.indexOf("tepl") !== -1 || title.indexOf("horkovod") !== -1 || title.indexOf("parovod") !== -1) return "#ea580c"; // oranžové teplo
      if (title.indexOf("komunikac") !== -1 || title.indexOf("sdělovac") !== -1 || title.indexOf("optik") !== -1 || title.indexOf("ek") !== -1) return "#16a34a"; // zelená optika / EK
      if (title.indexOf("produkt") !== -1 || title.indexOf("ropovod") !== -1) return "#9333ea"; // fialový produktovod
      return "#2563eb";
    }

    if (cat === "dtm_di") {
      if (title.indexOf("dráh") !== -1 || title.indexOf("kolej") !== -1 || title.indexOf("tramvaj") !== -1 || title.indexOf("železnic") !== -1 || title.indexOf("vlečk") !== -1) return "#7c3aed"; // fialová dráha
      if (title.indexOf("letiš") !== -1 || title.indexOf("vzlet") !== -1 || title.indexOf("přístav") !== -1 || title.indexOf("vodní") !== -1) return "#0284c7"; // modrá letiště/voda
      return "#ea521f"; // oranžová silnice
    }

    if (cat === "dtm_pripojky") {
      if (title.indexOf("plyn") !== -1) return "#ca8a04";
      if (title.indexOf("el") !== -1) return "#dc2626";
      if (title.indexOf("kan") !== -1) return "#78350f";
      if (title.indexOf("vod") !== -1) return "#0284c7";
      return "#0284c7";
    }

    if (cat && cat.indexOf("zps") !== -1) {
      if (title.indexOf("budov") !== -1) return "#e11d48";
      if (title.indexOf("zeleň") !== -1 || title.indexOf("vegetac") !== -1) return "#16a34a";
      if (title.indexOf("doprav") !== -1 || title.indexOf("komunikac") !== -1) return "#d97706";
      return "#64748b";
    }

    return feature._categoryColor || "#103778";
  }

  // Zvýraznění dotazovaného místa v mapě pulzujícím radarem
  function updateClickMarker(latlng, color) {
    if (queryState.marker) {
      state.map.removeLayer(queryState.marker);
      queryState.marker = null;
    }

    var markerColor = color || "#103778";
    var markerHtml =
      '<div class="dtm-target-marker" style="--marker-color: ' + markerColor + ';">' +
        '<div class="dtm-marker-pulse"></div>' +
        '<div class="dtm-marker-ring"></div>' +
        '<div class="dtm-marker-center">' +
          '<span class="dtm-marker-dot"></span>' +
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

  // Zvýraznění vektorového polygonu parcely v mapě
  function highlightParcelGeometry(geometryOrFeature, isPrimary) {
    if (queryState.polygonLayer) {
      state.map.removeLayer(queryState.polygonLayer);
      queryState.polygonLayer = null;
    }

    if (!geometryOrFeature) return;

    queryState.polygonLayer = L.geoJSON(geometryOrFeature, {
      interactive: false,
      style: {
        color: isPrimary ? "#059669" : "#059669",
        weight: isPrimary ? 3 : 1.5,
        opacity: isPrimary ? 0.95 : 0.55,
        dashArray: isPrimary ? null : "4, 4",
        fillColor: "#10b981",
        fillOpacity: isPrimary ? 0.28 : 0.06,
        lineCap: "round",
        lineJoin: "round"
      }
    }).addTo(state.map);
  }

  // Aktualizace zaměřovače a vektorového zvýraznění geometrie vybraného prvku / parcely
  function updateHighlightForFeature(curFeat, allFeatures) {
    if (!curFeat) {
      highlightParcelGeometry(null);
      return;
    }

    // Nastavit zaměřovací terč na souřadnice kliknutí
    if (queryState.currentData && queryState.currentData.latlng) {
      updateClickMarker(queryState.currentData.latlng, getFeatureColor(curFeat));
    }

    // Zvýraznění vektorové geometrie parcely
    if (curFeat._isParcel && curFeat.geometry) {
      highlightParcelGeometry(curFeat.geometry, true);
    } else {
      // Pokud máme v seznamu prvků i parcelu, ponecháme ji jemně podkreslenou pod sítí DTM
      var parcelFeat = (allFeatures || []).find(function (item) { return item._isParcel; });
      if (parcelFeat && parcelFeat.geometry) {
        highlightParcelGeometry(parcelFeat.geometry, false);
      } else {
        highlightParcelGeometry(null);
      }
    }
  }

  // Sestavení URL dotazu pro ČÚZK RÚIAN MapServer/5 (Parcely)
  function buildRuianQueryUrl(latlng) {
    var params = {
      geometryType: "esriGeometryPoint",
      geometry: latlng.lng + "," + latlng.lat,
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "true",
      f: "geojson"
    };

    var queryStr = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");

    return "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/5/query?" + queryStr;
  }

  // Sestavení URL dotazu WMS GetFeatureInfo pro danou vrstvu
  function buildFeatureInfoUrl(layer, latlng) {
    var map = state.map;
    var point = map.latLngToContainerPoint(latlng, map.getZoom());
    var size = map.getSize();
    var bounds = map.getBounds();
    var sw = map.options.crs.project(bounds.getSouthWest());
    var ne = map.options.crs.project(bounds.getNorthEast());

    var layersParam = layer.wmsParams.layers;

    var params = {
      service: "WMS",
      version: "1.3.0",
      request: "GetFeatureInfo",
      layers: layersParam,
      query_layers: layersParam,
      styles: "",
      crs: "EPSG:3857",
      bbox: [sw.x, sw.y, ne.x, ne.y].join(","),
      width: Math.round(size.x),
      height: Math.round(size.y),
      i: Math.max(0, Math.min(Math.round(size.x), Math.round(point.x))),
      j: Math.max(0, Math.min(Math.round(size.y), Math.round(point.y))),
      info_format: "application/json",
      feature_count: 15
    };

    return layer._url + L.Util.getParamString(params, layer._url, true);
  }

  // Obsluha kliknutí do mapy
  function handleMapClick(e) {
    var latlng = e.latlng;
    var zoom = state.map.getZoom();

    // Vyčistit předchozí marker a polygon
    if (queryState.marker) {
      state.map.removeLayer(queryState.marker);
      queryState.marker = null;
    }
    if (queryState.polygonLayer) {
      state.map.removeLayer(queryState.polygonLayer);
      queryState.polygonLayer = null;
    }

    // Pokud je aktivní režim měření (linie nebo plocha)
    if (typeof measureState !== "undefined" && measureState.mode) {
      if (typeof onMeasureMapClick === "function") {
        onMeasureMapClick(e);
      }
      return;
    }

    // Pokud je aktivní režim měření nadmořské výšky (DMR 5G ČÚZK)
    if (state.elevationMode) {
      executeElevationQuery(latlng);
      return;
    }

    // Při malém zoomu nabídnout přiblížení
    if (zoom < 14) {
      var lowZoomHtml =
        '<div class="dtm-popup-empty">' +
          '<svg class="dtm-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>' +
          '</svg>' +
          '<div style="font-size:12.5px; font-weight:700; color:var(--text-main);">Přibližte mapu</div>' +
          '<div style="font-size:11px; color:var(--text-muted); line-height:1.35;">Pro dotazování na podrobné atributy prvků DTM přibližte prosím mapu na úroveň <b>zoom 14+</b>.</div>' +
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
            state.map.closePopup();
            state.map.flyTo(latlng, 16, { duration: 0.8 });
            state.map.once("moveend", function () {
              executeFeatureQuery(latlng);
            });
          });
        }
      }, 50);
      return;
    }

    executeFeatureQuery(latlng);
  }

  // Spuštění dotazu na aktivní DTM vrstvy a parcelu KN
  function executeFeatureQuery(latlng) {
    var activeTargets = [];

    if (state.overlayLayers.dtm_ti && state.map.hasLayer(state.overlayLayers.dtm_ti)) {
      activeTargets.push({
        key: "dtm_ti",
        title: "Technická infrastruktura (TI)",
        color: "#2563eb",
        layer: state.overlayLayers.dtm_ti
      });
    }

    if (state.overlayLayers.dtm_di && state.map.hasLayer(state.overlayLayers.dtm_di)) {
      activeTargets.push({
        key: "dtm_di",
        title: "Dopravní infrastruktura (DI)",
        color: "#ea521f",
        layer: state.overlayLayers.dtm_di
      });
    }

    if (state.overlayLayers.dtm_pripojky && state.map.hasLayer(state.overlayLayers.dtm_pripojky)) {
      activeTargets.push({
        key: "dtm_pripojky",
        title: "Přípojka TI",
        color: "#0284c7",
        layer: state.overlayLayers.dtm_pripojky
      });
    }

    if (state.overlayLayers.dtm_zps_lb && state.map.hasLayer(state.overlayLayers.dtm_zps_lb)) {
      activeTargets.push({
        key: "dtm_zps_lb",
        title: "ZPS linie a body",
        color: "#475569",
        layer: state.overlayLayers.dtm_zps_lb
      });
    }

    if (state.overlayLayers.dtm_zps_pl_bar && state.map.hasLayer(state.overlayLayers.dtm_zps_pl_bar)) {
      activeTargets.push({
        key: "dtm_zps_pl_bar",
        title: "ZPS plochy barevně",
        color: "#16a34a",
        layer: state.overlayLayers.dtm_zps_pl_bar
      });
    }

    if (state.overlayLayers.dtm_zps_pl_seda && state.map.hasLayer(state.overlayLayers.dtm_zps_pl_seda)) {
      activeTargets.push({
        key: "dtm_zps_pl_seda",
        title: "ZPS plochy šedě",
        color: "#64748b",
        layer: state.overlayLayers.dtm_zps_pl_seda
      });
    }

    var isKnActive = state.overlayLayers.kn && state.map.hasLayer(state.overlayLayers.kn);

    if (activeTargets.length === 0 && !isKnActive) {
      L.popup({ minWidth: 260, maxWidth: 300 })
        .setLatLng(latlng)
        .setContent(
          '<div class="dtm-popup-empty">' +
            '<div style="font-size:12px; font-weight:700; color:var(--text-main);">Žádná vrstva není zapnutá</div>' +
            '<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Pro zobrazení atributů zapněte v pravém panelu např. Technickou (TI), Dopravní (DI) infrastrukturu nebo Katastrální mapu (KN).</div>' +
          '</div>'
        )
        .openOn(state.map);
      return;
    }

    // Pulzující zaměřovací radar v mapě
    updateClickMarker(latlng, "#103778");

    // Indikátor ve stavovém řádku
    var statusDot = document.getElementById("status-dot");
    var statusText = document.getElementById("map-status-text");
    if (statusDot) statusDot.className = "status-dot busy";
    if (statusText) statusText.textContent = isKnActive ? "Dotazuji se na atributy DTM a parcely KN..." : "Dotazuji se na atributy prvků...";

    // Načítací popup
    var loadingHtml =
      '<div class="dtm-popup-loading">' +
        '<div class="dtm-loading-spinner"></div>' +
        '<div style="font-size:12px; font-weight:600; color:var(--text-main);">Zjišťuji vlastnosti objektů...</div>' +
        '<div style="font-size:10px; color:var(--text-muted);">ČÚZK IS DMVS / RÚIAN Katastr nemovitostí</div>' +
      '</div>';

    var popup = L.popup({ minWidth: 320, maxWidth: 380, autoPan: true })
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
      if (statusText) statusText.textContent = "Klikněte na prvek v mapě pro zobrazení vlastností";
    });

    // Paralelní dotazy na všechny zapnuté WMS služby DTM
    var fetchPromises = activeTargets.map(function (target) {
      var url = buildFeatureInfoUrl(target.layer, latlng);
      return fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          var feats = (data && data.features) ? data.features : [];
          return feats.map(function (f) {
            f._categoryTitle = target.title;
            f._categoryColor = target.color;
            f._categoryKey = target.key;
            f._isDtmk = data.isDtmk ? data.isDtmk.nazev : null;
            return f;
          });
        })
        .catch(function (err) {
          console.warn("Chyba GetFeatureInfo pro " + target.key, err);
          return [];
        });
    });

    // Dotaz na RÚIAN parcelu s geometrií polygonu (ČÚZK ArcGIS REST layer 5)
    var ruianUrl = buildRuianQueryUrl(latlng);
    var ruianPromise = fetch(ruianUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var feats = (data && data.features) ? data.features : [];
        return feats.map(function (f) {
          f._isParcel = true;
          f._categoryTitle = "Katastr nemovitostí (KN)";
          f._categoryColor = "#059669";
          f._categoryKey = "kn";
          return f;
        });
      })
      .catch(function (err) {
        console.warn("Chyba RÚIAN dotazu pro parcelu", err);
        return [];
      });

    var allPromises = fetchPromises.concat([ruianPromise]);

    Promise.all(allPromises).then(function (results) {
      if (statusDot) statusDot.className = "status-dot";
      if (statusText) statusText.textContent = "Klikněte na prvek v mapě pro zobrazení vlastností";

      var dtmFeatures = [];
      for (var i = 0; i < activeTargets.length; i++) {
        dtmFeatures = dtmFeatures.concat(results[i] || []);
      }
      var parcelFeatures = results[activeTargets.length] || [];

      // Sloučení prvků: DTM prvky mají přednost, následované parcelou
      var allFeatures = dtmFeatures.concat(parcelFeatures);

      if (allFeatures.length === 0) {
        var emptyHtml =
          '<div class="dtm-popup-empty">' +
            '<svg class="dtm-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
              '<circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line>' +
            '</svg>' +
            '<div style="font-size:12.5px; font-weight:700; color:var(--text-main);">Žádný prvek nenalezen</div>' +
            '<div style="font-size:11px; color:var(--text-muted); line-height:1.35;">V místě kliknutí nebyl v aktivních vrstvách DTM ani v katastru detekován žádný objekt. Zkuste kliknout na jiné místo.</div>' +
            '<div style="font-size:9.5px; color:var(--text-muted); margin-top:4px;">' + latlng.lat.toFixed(5) + ', ' + latlng.lng.toFixed(5) + '</div>' +
          '</div>';

        popup.setContent(emptyHtml);
        return;
      }

      queryState.currentData = {
        features: allFeatures,
        index: 0,
        latlng: latlng
      };

      // Aktualizovat zvýraznění (zaměřovač i vektorová geometrie parcely)
      updateHighlightForFeature(allFeatures[0], allFeatures);

      popup.setContent(renderFeaturePopupContent(queryState.currentData));
      attachPopupListeners(popup);
    });
  }

  // Vykreslení obsahu popupu pro vybraný prvek
  function renderFeaturePopupContent(data) {
    var features = data.features;
    var index = data.index;
    var latlng = data.latlng;
    var f = features[index];
    var props = f.properties || {};

    var catColor = getFeatureColor(f);
    var catTitle = f._categoryTitle || "DTM";
    var isDtmk = f._isDtmk || "";

    var coordsStr = latlng.lat.toFixed(5) + " N, " + latlng.lng.toFixed(5) + " E";

    // Pager HTML (pokud je více nalezených prvků)
    var pagerHtml = features.length > 1 ? (
      '<div class="dtm-popup-pager">' +
        '<button type="button" class="dtm-pager-btn btn-prev" ' + (index === 0 ? "disabled" : "") + ' title="Předchozí objekt">‹</button>' +
        '<span class="dtm-pager-info">' + (index + 1) + ' z ' + features.length + '</span>' +
        '<button type="button" class="dtm-pager-btn btn-next" ' + (index === features.length - 1 ? "disabled" : "") + ' title="Další objekt">›</button>' +
      '</div>'
    ) : "";

    // 1. Zvláštní render pro PARCELU Katastru nemovitostí (RÚIAN)
    if (f._isParcel) {
      var parcelNum = props.cisloparcely || (props.kmenovecislo + (props.poddelenicisla ? "/" + props.poddelenicisla : ""));
      var parcelTitle = "Parcela č. " + (parcelNum || (props.id ? String(props.id) : "KN"));
      var kuCode = props.katastralniuzemi ? "KÚ kód: " + props.katastralniuzemi : "";
      var vymera = props.vymeraparcely ? Number(props.vymeraparcely).toLocaleString("cs-CZ") + " m²" : null;
      var druhPozemku = DRUH_POZEMKU_MAP[props.druhpozemkukod] || (props.druhpozemkukod ? "Kód " + props.druhpozemkukod : null);
      var zpusobVyuziti = ZPUSOB_VYUZITI_MAP[props.zpusobyvyuzitipozemku] || (props.zpusobyvyuzitipozemku ? String(props.zpusobyvyuzitipozemku) : null);
      var ruianId = props.id;

      var nahlizeniUrl = ruianId
        ? "https://nahlizenidokn.cuzk.cz/ZobrazObjekt.aspx?typ=Parcela&id=" + encodeURIComponent(ruianId)
        : null;

      var parcelPropKeys = Object.keys(props);
      var parcelRowsHtml = parcelPropKeys.map(function (k) {
        var label = ATTR_LABELS[k] || k;
        var rawVal = props[k];
        var displayVal = (rawVal === null || rawVal === undefined || rawVal === "")
          ? '<span style="opacity:0.4;">–</span>'
          : (typeof rawVal === "boolean" ? formatBooleanValue(rawVal) : String(rawVal));

        if (k === "druhpozemkukod" && druhPozemku) {
          displayVal = druhPozemku + " (" + rawVal + ")";
        } else if (k === "zpusobyvyuzitipozemku" && zpusobVyuziti) {
          displayVal = zpusobVyuziti + " (" + rawVal + ")";
        } else if (k === "vymeraparcely" && vymera) {
          displayVal = vymera;
        }

        return (
          '<tr>' +
            '<td class="attr-key" title="' + k + '">' + label + '</td>' +
            '<td class="attr-val">' + displayVal + '</td>' +
          '</tr>'
        );
      }).join("");

      return (
        '<div class="dtm-popup-card">' +
          '<div class="dtm-popup-top">' +
            '<div class="dtm-popup-badge" style="background-color:' + catColor + '18; color:' + catColor + '; border:1px solid ' + catColor + '40;">' +
              '<span class="dtm-badge-dot" style="background-color:' + catColor + ';"></span>' +
              catTitle +
            '</div>' +
            pagerHtml +
          '</div>' +

          '<div class="dtm-popup-title-row">' +
            '<div class="dtm-popup-title" style="color:#047857;">' + parcelTitle + '</div>' +
            (kuCode ? '<div class="dtm-popup-kraj">' + kuCode + '</div>' : "") +
          '</div>' +

          '<div class="dtm-quick-props">' +
            (vymera ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Výměra:</span><span class="dtm-prop-v highlight" style="color:#059669; font-weight:700;">' + vymera + '</span></div>' : "") +
            (druhPozemku ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Druh pozemku:</span><span class="dtm-prop-v">' + druhPozemku + '</span></div>' : "") +
            (zpusobVyuziti ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Využití:</span><span class="dtm-prop-v">' + zpusobVyuziti + '</span></div>' : "") +
            (props.kmenovecislo && props.poddelenicisla ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Kmenové/poddělení:</span><span class="dtm-prop-v">' + props.kmenovecislo + ' / ' + props.poddelenicisla + '</span></div>' : "") +
            (props.katastralniuzemi ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Katastrální území:</span><span class="dtm-prop-v">' + props.katastralniuzemi + '</span></div>' : "") +
            (ruianId ? '<div class="dtm-prop-row"><span class="dtm-prop-k">RÚIAN ID:</span><span class="dtm-prop-v code">' + ruianId + '</span></div>' : "") +
          '</div>' +

          (nahlizeniUrl ? (
            '<a href="' + nahlizeniUrl + '" target="_blank" rel="noopener noreferrer" class="btn-nahlizeni" title="Otevřít detail parcely v Nahlížení do katastru nemovitostí ČÚZK">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>' +
                '<polyline points="15 3 21 3 21 9"></polyline>' +
                '<line x1="10" y1="14" x2="21" y2="3"></line>' +
              '</svg>' +
              '<span>Nahlížet do KN (ČÚZK)</span>' +
            '</a>'
          ) : "") +

          '<details class="dtm-all-props-details">' +
            '<summary class="dtm-details-summary">' +
              '<span>Všechny atributy (' + parcelPropKeys.length + ')</span>' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
            '</summary>' +
            '<div class="dtm-all-props-content">' +
              '<table class="dtm-attr-table"><tbody>' + parcelRowsHtml + '</tbody></table>' +
            '</div>' +
          '</details>' +

          '<div class="dtm-popup-footer">' +
            '<span>' + coordsStr + '</span>' +
            '<button type="button" class="btn-copy-json" title="Kopírovat GeoJSON této parcely s geometrií do schránky">' +
              '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
              '<span>Kopírovat GeoJSON</span>' +
            '</button>' +
          '</div>' +
        '</div>'
      );
    }

    // 2. Render pro DTM PRVKY (TI, DI, Přípojky, ZPS)
    var title = props.objektovytypnazev || "Prvek DTM (" + (props.code_base || "objekt") + ")";
    var owner = props.nazevvlastnika;
    var manager = props.nazevspravce;
    var operator = props.nazevprovozovatele;
    var level = formatLevelValue(props.urovenumisteniobjektuti !== undefined ? props.urovenumisteniobjektuti : props.urovenumisteniobjektuzps);
    var acquisition = props.zpusobporizeniti || props.zpusobporizenizps;
    var accuracy = formatAccuracyValue(props.tridapresnostipoloha);
    var dateInserted = props.datumvkladu;
    var id = props.id;
    var numLines = props.pocetvedenivtrase;

    var allPropKeys = Object.keys(props);
    var allRowsHtml = allPropKeys.map(function (k) {
      var label = ATTR_LABELS[k] || k;
      var rawVal = props[k];
      var displayVal = (rawVal === null || rawVal === undefined || rawVal === "")
        ? '<span style="opacity:0.4;">–</span>'
        : (typeof rawVal === "boolean" ? formatBooleanValue(rawVal) : String(rawVal));

      return (
        '<tr>' +
          '<td class="attr-key" title="' + k + '">' + label + '</td>' +
          '<td class="attr-val">' + displayVal + '</td>' +
        '</tr>'
      );
    }).join("");

    return (
      '<div class="dtm-popup-card">' +
        '<div class="dtm-popup-top">' +
          '<div class="dtm-popup-badge" style="background-color:' + catColor + '18; color:' + catColor + '; border:1px solid ' + catColor + '40;">' +
            '<span class="dtm-badge-dot" style="background-color:' + catColor + ';"></span>' +
            catTitle +
          '</div>' +
          pagerHtml +
        '</div>' +

        '<div class="dtm-popup-title-row">' +
          '<div class="dtm-popup-title">' + title + '</div>' +
          (isDtmk ? '<div class="dtm-popup-kraj">Kraj: ' + isDtmk + '</div>' : "") +
        '</div>' +

        '<div class="dtm-quick-props">' +
          (owner ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Vlastník:</span><span class="dtm-prop-v highlight">' + owner + '</span></div>' : "") +
          (manager && manager !== owner ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Správce:</span><span class="dtm-prop-v">' + manager + '</span></div>' : "") +
          (operator && operator !== owner ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Provozovatel:</span><span class="dtm-prop-v">' + operator + '</span></div>' : "") +
          (level ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Umístění:</span><span class="dtm-prop-v">' + level + '</span></div>' : "") +
          (acquisition ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Pořízení:</span><span class="dtm-prop-v">' + acquisition + '</span></div>' : "") +
          (accuracy && accuracy !== "-" ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Přesnost:</span><span class="dtm-prop-v">' + accuracy + '</span></div>' : "") +
          (numLines !== undefined && numLines !== null ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Počet vedení:</span><span class="dtm-prop-v">' + numLines + '</span></div>' : "") +
          (dateInserted ? '<div class="dtm-prop-row"><span class="dtm-prop-k">Vloženo:</span><span class="dtm-prop-v">' + dateInserted + '</span></div>' : "") +
          (id ? '<div class="dtm-prop-row"><span class="dtm-prop-k">ID prvku:</span><span class="dtm-prop-v code">' + id + '</span></div>' : "") +
        '</div>' +

        '<details class="dtm-all-props-details">' +
          '<summary class="dtm-details-summary">' +
            '<span>Všechny atributy (' + allPropKeys.length + ')</span>' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
          '</summary>' +
          '<div class="dtm-all-props-content">' +
            '<table class="dtm-attr-table"><tbody>' + allRowsHtml + '</tbody></table>' +
          '</div>' +
        '</details>' +

        '<div class="dtm-popup-footer">' +
          '<span>' + coordsStr + '</span>' +
          '<button type="button" class="btn-copy-json" title="Kopírovat GeoJSON tohoto prvku do schránky">' +
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
            '<span>Kopírovat JSON</span>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  // Obsluha tlačítek uvnitř popupu (přepínání prvků, kopírování)
  function attachPopupListeners(popup) {
    var el = popup.getElement();
    if (!el) return;

    var prevBtn = el.querySelector(".btn-prev");
    var nextBtn = el.querySelector(".btn-next");
    var copyBtn = el.querySelector(".btn-copy-json");

    if (prevBtn) {
      prevBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (queryState.currentData && queryState.currentData.index > 0) {
          queryState.currentData.index--;
          var curFeat = queryState.currentData.features[queryState.currentData.index];
          updateHighlightForFeature(curFeat, queryState.currentData.features);
          popup.setContent(renderFeaturePopupContent(queryState.currentData));
          attachPopupListeners(popup);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (queryState.currentData && queryState.currentData.index < queryState.currentData.features.length - 1) {
          queryState.currentData.index++;
          var curFeat = queryState.currentData.features[queryState.currentData.index];
          updateHighlightForFeature(curFeat, queryState.currentData.features);
          popup.setContent(renderFeaturePopupContent(queryState.currentData));
          attachPopupListeners(popup);
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (!queryState.currentData) return;
        var feat = queryState.currentData.features[queryState.currentData.index];
        var text = JSON.stringify(feat, null, 2);

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            var span = copyBtn.querySelector("span");
            if (span) {
              span.textContent = "Zkopírováno!";
              setTimeout(function () { span.textContent = "Kopírovat JSON"; }, 2000);
            }
          });
        }
      });
    }
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
    var fallbackUrl2 = "https://ags.cuzk.cz/arcgis/rest/services/3D/DMR5G/ImageServer/identify?" + q;

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
      .catch(function () {
        return doFetch(fallbackUrl2);
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
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:4px;">' +
              '<path d="m8 3 4 8 5-5 5 15H2L8 3z"></path>' +
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

  // Napojení ovládacích prvků v panelu vrstev
  function setupUIControls() {
    // 1. Ovládání hierarchických skupin (DI a TI)
    document.querySelectorAll(".layer-group-card").forEach(function (card) {
      var groupKey = card.getAttribute("data-group");
      var header = card.querySelector(".layer-group-header");
      var masterSwitch = card.querySelector(".group-master-switch");
      var slider = card.querySelector(".group-opacity-slider");
      var opacityVal = card.querySelector(".opacity-val");
      var allSublayers = groupKey === "dtm_di" ? DI_SUBLAYERS : TI_SUBLAYERS;
      var countBadge = card.querySelector(".group-count-badge");

      function updateCountBadge() {
        if (!countBadge) return;
        var activeCount = state.activeSublayers[groupKey] ? state.activeSublayers[groupKey].size : 0;
        countBadge.textContent = activeCount + "/" + allSublayers.length;
      }

      // Rozkliknutí kliknutím na CELOU skupinu (hlavičku)
      if (header) {
        header.addEventListener("click", function (e) {
          // Pokud uživatel kliknul přímo na vypínač nebo slider, nerozbalovat/nesbalovat
          if (e.target.closest(".switch-control") || e.target.closest(".opacity-slider") || e.target.closest(".group-sublayer-toolbar")) {
            return;
          }
          card.classList.toggle("is-expanded");
        });
      }

      // Hlavní vypínač skupiny (zapne / vypne všechny podskupiny najednou)
      if (masterSwitch) {
        var switchControl = masterSwitch.closest(".switch-control");
        if (switchControl) {
          switchControl.addEventListener("click", function (e) {
            e.stopPropagation();
          });
        }

        masterSwitch.addEventListener("change", function (e) {
          e.stopPropagation();
          var isChecked = this.checked;
          if (isChecked) {
            state.activeSublayers[groupKey] = new Set(allSublayers);
          } else {
            state.activeSublayers[groupKey].clear();
          }

          // Aktualizovat všechny podskupinové checkboxy v UI
          card.querySelectorAll(".sublayer-checkbox").forEach(function (cb) {
            cb.checked = isChecked;
          });

          updateCountBadge();
          updateGroupLayer(groupKey);
        });
      }

      // Posuvník průhlednosti celé skupiny
      if (slider) {
        slider.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        slider.addEventListener("input", function (e) {
          e.stopPropagation();
          var val = parseFloat(this.value);
          state.groupOpacity[groupKey] = val;
          var pct = Math.round(val * 100) + "%";
          if (opacityVal) opacityVal.textContent = pct;

          if (state.overlayLayers[groupKey]) {
            state.overlayLayers[groupKey].setOpacity(val);
          }
        });
      }

      // Zaškrtávátka jednotlivých podskupin
      card.querySelectorAll(".sublayer-item").forEach(function (item) {
        var sublayerKey = item.getAttribute("data-sublayer");
        var cb = item.querySelector(".sublayer-checkbox");

        if (cb) {
          cb.addEventListener("change", function () {
            if (this.checked) {
              state.activeSublayers[groupKey].add(sublayerKey);
            } else {
              state.activeSublayers[groupKey].delete(sublayerKey);
            }
            updateCountBadge();
            updateGroupLayer(groupKey);
          });
        }
      });

      updateCountBadge();
    });

    // 2. Přepínače samostatných překryvných vrstev (Přípojky, ZPS, KN)
    document.querySelectorAll(".layer-card").forEach(function (card) {
      var layerKey = card.getAttribute("data-layer");
      var checkbox = card.querySelector('input[type="checkbox"]');
      var slider = card.querySelector(".opacity-slider");
      var opacityVal = card.querySelector(".opacity-val");

      if (checkbox) {
        checkbox.addEventListener("change", function () {
          activateLayer(layerKey, this.checked);
        });
      }

      if (slider) {
        slider.addEventListener("input", function () {
          var val = parseFloat(this.value);
          var pct = Math.round(val * 100) + "%";
          if (opacityVal) opacityVal.textContent = pct;
          if (state.overlayLayers[layerKey]) {
            state.overlayLayers[layerKey].setOpacity(val);
          }
        });
      }
    });

    // 3. Rychlé skoky na města (chips)
    document.querySelectorAll(".chip-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cityKey = this.getAttribute("data-city");
        var target = CITY_BOOKMARKS[cityKey];
        if (target && state.map) {
          state.map.flyTo(target.coords, target.zoom, {
            duration: 1.2
          });
        }
      });
    });

    // 4. Reset vrstev (výchozí stav – všechny vrstvy vypnuté)
    var btnReset = document.getElementById("btn-reset-layers");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        // Vypnout samostatné vrstvy
        activateLayer("dtm_pripojky", false);
        activateLayer("dtm_zps_lb", false);
        activateLayer("dtm_zps_pl_bar", false);
        activateLayer("dtm_zps_pl_seda", false);
        activateLayer("kn", false);

        // Vypnout všechny podskupiny DI
        state.activeSublayers.dtm_di.clear();
        document.querySelectorAll('.layer-group-card[data-group="dtm_di"] .sublayer-checkbox').forEach(function (cb) {
          cb.checked = false;
        });
        updateGroupLayer("dtm_di");

        // Vypnout všechny podskupiny TI
        state.activeSublayers.dtm_ti.clear();
        document.querySelectorAll('.layer-group-card[data-group="dtm_ti"] .sublayer-checkbox').forEach(function (cb) {
          cb.checked = false;
        });
        updateGroupLayer("dtm_ti");

        // Podkladová mapa Ortofoto
        setBaseLayer("orto");
      });
    }

    // 5. Zapnout všechny DTM vrstvy
    var btnAllDtm = document.getElementById("btn-all-dtm");
    if (btnAllDtm) {
      btnAllDtm.addEventListener("click", function () {
        // Zapnout všechny podskupiny DI
        state.activeSublayers.dtm_di = new Set(DI_SUBLAYERS);
        document.querySelectorAll('.layer-group-card[data-group="dtm_di"] .sublayer-checkbox').forEach(function (cb) {
          cb.checked = true;
        });
        updateGroupLayer("dtm_di");

        // Zapnout všechny podskupiny TI
        state.activeSublayers.dtm_ti = new Set(TI_SUBLAYERS);
        document.querySelectorAll('.layer-group-card[data-group="dtm_ti"] .sublayer-checkbox').forEach(function (cb) {
          cb.checked = true;
        });
        updateGroupLayer("dtm_ti");

        // Zapnout ostatní vrstvy
        activateLayer("dtm_pripojky", true);
        activateLayer("dtm_zps_lb", true);
        activateLayer("dtm_zps_pl_bar", true);
        activateLayer("kn", true);
      });
    }
  }

  // ==========================================================================
  // SUBSYSTÉM: LEGENDA A ZNAČKOVÝ KLÍČ DTM (ČÚZK IS DMVS, DI, TI, ZPS, KN)
  // Používá výhradně oficiální grafické značkové klíče ze serveru ČÚZK IS DMVS
  // ==========================================================================

  var DTM_LEGEND_DATA = {
    // 1. Skupina Dopravní infrastruktura
    dtm_di: {
      title: "Dopravní infrastruktura (DI)",
      provider: "ČÚZK • IS DMVS",
      category: "Dopravní infrastruktura",
      color: "#ea521f",
      desc: "Kompletní dopravní sítě a objekty v souladu s vyhláškou č. 393/2020 Sb. a datovým modelem JVF DTM.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – Digitální technická mapa ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_di_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=dtm_di_ver"
    },

    pozemni_komunikace: {
      title: "Pozemní komunikace",
      provider: "ČÚZK • IS DMVS",
      category: "Dopravní infrastruktura",
      color: "#ea521f",
      desc: "Dálnice, silnice I.–III. třídy, místní a účelové komunikace, chodníky, cyklostezky a parkoviště.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_di_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=siln_dopr"
    },

    draha: {
      title: "Drážní doprava",
      provider: "ČÚZK • IS DMVS",
      category: "Dopravní infrastruktura",
      color: "#7c3aed",
      desc: "Celostátní a regionální železniční tratě, vlečky, tramvajové a trolejbusové trasy, lanové dráhy a metro.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_di_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=dr_dopr"
    },

    letiste: {
      title: "Letecká a vodní doprava",
      provider: "ČÚZK • IS DMVS",
      category: "Dopravní infrastruktura",
      color: "#0284c7",
      desc: "Vzletové a přistávací dráhy, pojezdové dráhy letišť, plavební toky, plavební komory a přístavy.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_di_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=let_dopr"
    },

    // 2. Skupina Technická infrastruktura
    dtm_ti: {
      title: "Technická infrastruktura (TI)",
      provider: "ČÚZK • IS DMVS",
      category: "Technická infrastruktura",
      color: "#2563eb",
      desc: "Všechny inženýrské sítě a technologie dle vyhlášky č. 393/2020 Sb. a datového modelu JVF DTM.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=dtm_ti_ver"
    },

    vodovod: {
      title: "Vodovod",
      provider: "ČÚZK • IS DMVS",
      category: "Technická infrastruktura",
      color: "#0284c7",
      desc: "Dálkové vodovodní řady, rozvodné sítě pitné a užitkové vody, šoupata, hydranty, vodojemy a úpravny vody.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=voda"
    },

    kanalizace: {
      title: "Kanalizace",
      provider: "ČÚZK • IS DMVS",
      category: "Technická infrastruktura",
      color: "#78350f",
      desc: "Splašková, dešťová a jednotná kanalizace, gravitační a tlakové stoky, revizní šachty, uliční vpusti a ČOV.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=kan"
    },

    elektro: {
      title: "Elektroenergetika",
      provider: "ČÚZK • IS DMVS",
      category: "Technická infrastruktura",
      color: "#dc2626",
      desc: "Vedení VVN, VN a NN, kabelové trasy v zemi, venkovní vedení, stožáry, trafostanice a distribuční skříně.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=el_ved"
    },

    plynovod: {
      title: "Plynárenství",
      provider: "ČÚZK • IS DMVS",
      category: "Technická infrastruktura",
      color: "#ca8a04",
      desc: "Vysokotlaké (VTL), středotlaké (STL) a nízkotlaké (NTL) plynovody, uzávěry, HUP a regulační stanice plynu.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=plyn"
    },

    teplovod: {
      title: "Teplárenství",
      provider: "ČÚZK • IS DMVS",
      category: "Technická infrastruktura",
      color: "#ea580c",
      desc: "Parovody, horkovody a teplovody (napájecí i vratná větev), šachty, armaturní komory a výměníkové stanice.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=teplo"
    },

    elektronicke_komunikace: {
      title: "Elektronické komunikace",
      provider: "ČÚZK • IS DMVS",
      category: "Technická infrastruktura",
      color: "#16a34a",
      desc: "Optické a metalické kabely, kabelovody, chráničky HDPE, kabelové komory, rozvaděče a vysílače.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=el_kom"
    },

    produktovod: {
      title: "Produktovody",
      provider: "ČÚZK • IS DMVS",
      category: "Technická infrastruktura",
      color: "#9333ea",
      desc: "Ropovody, produktovody pohonných hmot, technické plyny, bioplynovody a potrubní pošta.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=produkt"
    },

    // 3. Přípojky TI
    dtm_pripojky: {
      title: "Přípojky TI",
      provider: "ČÚZK • IS DMVS",
      category: "Přípojky technické infrastruktury",
      color: "#9333ea",
      desc: "Domovní a areálové přípojky inženýrských sítí (voda, kanalizace, elektro, plyn, teplo a telekomunikace).",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_pripojky?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=dtm_pripojky"
    },

    // 4. Základní prostorová složka (ZPS)
    dtm_zps_lb: {
      title: "ZPS – Linie a body",
      provider: "ČÚZK • IS DMVS",
      category: "Základní prostorová složka",
      color: "#475569",
      desc: "Polohopisné hrany, obrubníky, oplocení, opěrné zdi, terénní stupně a podrobné body ZPS s geodetickým ověřením.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_zps_linie_body?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=dtm_zps_linie_body"
    },

    dtm_zps_pl_bar: {
      title: "ZPS – Plochy (barevné)",
      provider: "ČÚZK • IS DMVS",
      category: "Základní prostorová složka",
      color: "#16a34a",
      desc: "Polygony využití a povrchů dle JVF DTM (budovy, komunikace, chodníky, trávníky, zeleň, vodní toky).",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_zps_plochy_bar?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=dtm_zps_plochy_bar"
    },

    dtm_zps_pl_seda: {
      title: "ZPS – Plochy (šedé)",
      provider: "ČÚZK • IS DMVS",
      category: "Základní prostorová složka",
      color: "#64748b",
      desc: "Kartograficky optimalizovaný šedotónový podklad polohopisu pro maximální kontrast inženýrských sítí TI a DI.",
      docUrl: "https://www.cuzk.cz/Katastr-nemovitosti/Digitalni-technicka-mapa.aspx",
      docTitle: "ČÚZK – DTM ČR",
      wmsLegendUrl: "https://dmvs.cuzk.gov.cz/api/wms/dtm_zps_plochy_seda?SERVICE=WMS&REQUEST=GetLegendGraphic&VERSION=1.3.0&FORMAT=image/png&LAYER=dtm_zps_plochy_seda"
    },

    // 5. Katastr nemovitostí
    kn: {
      title: "Katastrální mapa (ČÚZK)",
      provider: "ČÚZK • KN",
      category: "Katastr nemovitostí",
      color: "#c51f1f",
      desc: "Katastrální mapa zobrazuje hranice katastrálních území, parcelní hranice a parcelní čísla. Oficiální značkový klíč je stanoven přílohou vyhlášky č. 357/2013 Sb. o katastru nemovitostí (katastrální vyhláška).",
      docUrl: "https://services.cuzk.cz/doc/znackovy-klic.pdf",
      docTitle: "Oficiální značkový klíč ČÚZK (PDF)"
    }
  };

  // Sestavení HTML pro jednu kartu legendy
  function renderLegendCardHtml(key, def, isInline) {
    if (!def) return "";

    var html = "";
    if (!isInline) {
      html += '<div class="legend-card" data-legend-key="' + key + '">';
    }

    html += '<div class="legend-card-header">';
    html += '  <div class="legend-card-title-group">';
    html += '    <span class="legend-card-dot" style="background-color: ' + def.color + ';"></span>';
    html += '    <div class="legend-card-title">' + def.title + '</div>';
    html += '  </div>';
    html += '  <span class="legend-card-provider">' + def.provider + '</span>';
    html += '</div>';

    if (def.desc) {
      html += '<div class="legend-card-desc">' + def.desc + '</div>';
    }

    // Oficiální WMS grafika přímo ze serveru ČÚZK IS DMVS
    if (def.wmsLegendUrl) {
      html += '<div class="legend-wms-graphic-wrap">';
      html += '  <span class="legend-wms-label">Oficiální značkový klíč ČÚZK IS DMVS</span>';
      html += '  <img src="' + def.wmsLegendUrl + '" alt="Oficiální WMS legenda ' + def.title + '" class="legend-wms-graphic-img" loading="lazy" />';
      html += '</div>';
    }

    if (def.docUrl) {
      html += '<div class="legend-card-footer">';
      html += '  <a href="' + def.docUrl + '" target="_blank" rel="noopener noreferrer" class="legend-doc-link">';
      html += '    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">';
      html += '      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>';
      html += '      <polyline points="15 3 21 3 21 9"></polyline>';
      html += '      <line x1="10" y1="14" x2="21" y2="3"></line>';
      html += '    </svg>';
      html += '    <span>' + (def.docTitle || "Oficiální značkový klíč ČÚZK") + '</span>';
      html += '  </a>';
      html += '</div>';
    }

    if (!isInline) {
      html += '</div>';
    }

    return html;
  }

  // Získání klíčů aktuálně aktivních vrstev a podvrstev
  function getActiveLegendKeys() {
    var keys = [];

    // Podvrstvy DI
    if (state.activeSublayers.dtm_di && state.activeSublayers.dtm_di.size > 0) {
      state.activeSublayers.dtm_di.forEach(function (k) {
        if (DTM_LEGEND_DATA[k] && keys.indexOf(k) === -1) {
          keys.push(k);
        }
      });
    }

    // Podvrstvy TI
    if (state.activeSublayers.dtm_ti && state.activeSublayers.dtm_ti.size > 0) {
      state.activeSublayers.dtm_ti.forEach(function (k) {
        if (DTM_LEGEND_DATA[k] && keys.indexOf(k) === -1) {
          keys.push(k);
        }
      });
    }

    // Samostatné vrstvy (Přípojky, ZPS, KN)
    if (state.activeSingleLayers) {
      state.activeSingleLayers.forEach(function (k) {
        if (DTM_LEGEND_DATA[k] && keys.indexOf(k) === -1) {
          keys.push(k);
        }
      });
    }

    return keys;
  }

  // Prázdný stav při vypnutých vrstvách
  function renderLegendEmptyState() {
    var html = '<div class="legend-empty-state">';
    html += '  <div class="legend-empty-icon">';
    html += '    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">';
    html += '      <rect x="3" y="3" width="18" height="18" rx="2"></rect>';
    html += '      <line x1="8" y1="7" x2="16" y2="7"></line>';
    html += '      <line x1="8" y1="12" x2="16" y2="12"></line>';
    html += '      <line x1="8" y1="17" x2="12" y2="17"></line>';
    html += '    </svg>';
    html += '  </div>';
    html += '  <div class="legend-empty-title">Žádná vrstva není zapnutá</div>';
    html += '  <div class="legend-empty-text">Zapněte požadované sítě a vrstvy v záložce Vrstvy nebo si prohlédněte celý značkový klíč.</div>';
    html += '  <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">';
    html += '    <button type="button" class="btn-legend-switch-tab" id="btn-empty-switch-layers">';
    html += '      <span>Vybrat vrstvy</span>';
    html += '    </button>';
    html += '    <button type="button" class="btn-legend-switch-tab" id="btn-empty-show-all" style="background: rgba(16, 55, 120, 0.1); color: var(--brand-primary);">';
    html += '      <span>Zobrazit vše</span>';
    html += '    </button>';
    html += '  </div>';
    html += '</div>';
    return html;
  }

  // Vykreslení všech karet do záložky Legenda
  function renderAllLegends(filterMode) {
    var container = document.getElementById("legend-list-container");
    if (!container) return;

    var mode = filterMode || state.legendFilter || "active";
    state.legendFilter = mode;

    var keys = [];
    if (mode === "active") {
      keys = getActiveLegendKeys();
    } else {
      keys = Object.keys(DTM_LEGEND_DATA);
    }

    if (mode === "active" && keys.length === 0) {
      container.innerHTML = renderLegendEmptyState();
      var btnSwitch = document.getElementById("btn-empty-switch-layers");
      if (btnSwitch) {
        btnSwitch.addEventListener("click", function () {
          switchToSidebarTab("layers");
        });
      }
      var btnShowAll = document.getElementById("btn-empty-show-all");
      if (btnShowAll) {
        btnShowAll.addEventListener("click", function () {
          var btnAll = document.getElementById("btn-legend-filter-all");
          var btnAct = document.getElementById("btn-legend-filter-active");
          if (btnAll) btnAll.classList.add("active");
          if (btnAct) btnAct.classList.remove("active");
          renderAllLegends("all");
        });
      }
      return;
    }

    var html = "";
    keys.forEach(function (k) {
      var def = DTM_LEGEND_DATA[k];
      if (def) {
        html += renderLegendCardHtml(k, def, false);
      }
    });

    container.innerHTML = html;
  }

  // Aktualizace počítadla aktivních vrstev v záložce Legenda
  function updateLegendBadge() {
    var badge = document.getElementById("legend-active-count");
    var btnActiveFilter = document.getElementById("btn-legend-filter-active");
    var diCount = state.activeSublayers.dtm_di ? state.activeSublayers.dtm_di.size : 0;
    var tiCount = state.activeSublayers.dtm_ti ? state.activeSublayers.dtm_ti.size : 0;
    var singleCount = state.activeSingleLayers ? state.activeSingleLayers.size : 0;
    var totalCount = diCount + tiCount + singleCount;

    if (badge) {
      badge.textContent = totalCount;
      if (totalCount > 0) {
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
      }
    }

    if (btnActiveFilter) {
      btnActiveFilter.textContent = totalCount > 0 ? "Aktivní (" + totalCount + ")" : "Aktivní";
    }
  }

  // Reaktivní překreslení aktivní legendy, pokud je zrovna otevřená
  function refreshActiveLegendsIfVisible() {
    if (state.currentTab === "legend" && state.legendFilter === "active") {
      renderAllLegends("active");
    }
  }

  // Přepínání mezi záložkami panelu: Vrstvy / Legenda
  function switchToSidebarTab(tabName) {
    state.currentTab = tabName;

    var btnLayers = document.getElementById("tab-btn-layers");
    var btnLegend = document.getElementById("tab-btn-legend");
    var paneLayers = document.getElementById("pane-layers");
    var paneLegend = document.getElementById("pane-legend");
    var actionsLayers = document.getElementById("sidebar-actions-layers");
    var actionsLegend = document.getElementById("sidebar-actions-legend");
    var mapLegendBtn = document.getElementById("btn-legend-map-toggle");

    if (tabName === "legend") {
      if (btnLayers) {
        btnLayers.classList.remove("active");
        btnLayers.setAttribute("aria-selected", "false");
      }
      if (btnLegend) {
        btnLegend.classList.add("active");
        btnLegend.setAttribute("aria-selected", "true");
      }
      if (paneLayers) paneLayers.style.display = "none";
      if (paneLegend) paneLegend.style.display = "block";
      if (actionsLayers) actionsLayers.style.display = "none";
      if (actionsLegend) actionsLegend.style.display = "flex";
      if (mapLegendBtn) mapLegendBtn.classList.add("is-active");

      renderAllLegends(state.legendFilter || "active");
    } else {
      if (btnLayers) {
        btnLayers.classList.add("active");
        btnLayers.setAttribute("aria-selected", "true");
      }
      if (btnLegend) {
        btnLegend.classList.remove("active");
        btnLegend.setAttribute("aria-selected", "false");
      }
      if (paneLayers) paneLayers.style.display = "block";
      if (paneLegend) paneLegend.style.display = "none";
      if (actionsLayers) actionsLayers.style.display = "flex";
      if (actionsLegend) actionsLegend.style.display = "none";
      if (mapLegendBtn) mapLegendBtn.classList.remove("is-active");
    }
  }

  // Inicializace tlačítek a inline legendy u každé vrstvy a podvrstvy
  function initLegendSystem() {
    var legendSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>' +
      '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>' +
    '</svg>';

    // 1. Injektování inline legendy do samostatných karet vrstev (.layer-card)
    document.querySelectorAll(".layer-card").forEach(function (card) {
      var layerKey = card.getAttribute("data-layer");
      var def = DTM_LEGEND_DATA[layerKey];
      if (!def) return;

      var cardMain = card.querySelector(".layer-card-main");
      if (cardMain && !cardMain.querySelector(".btn-layer-legend")) {
        var switchCtrl = cardMain.querySelector(".switch-control");

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-layer-legend";
        btn.title = "Zobrazit značkový klíč a legendu pro " + def.title;
        btn.innerHTML = legendSvg;

        if (switchCtrl) {
          cardMain.insertBefore(btn, switchCtrl);
        } else {
          cardMain.appendChild(btn);
        }

        var inlineContainer = document.createElement("div");
        inlineContainer.className = "layer-inline-legend";
        inlineContainer.style.display = "none";
        card.appendChild(inlineContainer);

        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var isOpen = inlineContainer.style.display === "block";
          if (isOpen) {
            inlineContainer.style.display = "none";
            btn.classList.remove("is-open");
          } else {
            if (!inlineContainer.innerHTML) {
              inlineContainer.innerHTML = renderLegendCardHtml(layerKey, def, true);
            }
            inlineContainer.style.display = "block";
            btn.classList.add("is-open");
          }
        });
      }
    });

    // 2. Injektování tlačítka legendy do skupinových karet DI a TI (.layer-group-card)
    document.querySelectorAll(".layer-group-card").forEach(function (card) {
      var groupKey = card.getAttribute("data-group");
      var def = DTM_LEGEND_DATA[groupKey];
      if (!def) return;

      var groupHeaderRight = card.querySelector(".group-header-right");
      if (groupHeaderRight && !groupHeaderRight.querySelector(".btn-layer-legend")) {
        var switchCtrl = groupHeaderRight.querySelector(".switch-control");

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-layer-legend";
        btn.title = "Zobrazit oficiální legendu skupiny " + def.title;
        btn.innerHTML = legendSvg;

        if (switchCtrl) {
          groupHeaderRight.insertBefore(btn, switchCtrl);
        } else {
          groupHeaderRight.appendChild(btn);
        }

        var inlineContainer = document.createElement("div");
        inlineContainer.className = "layer-inline-legend";
        inlineContainer.style.display = "none";
        inlineContainer.style.margin = "8px 12px";
        card.appendChild(inlineContainer);

        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var isOpen = inlineContainer.style.display === "block";
          if (isOpen) {
            inlineContainer.style.display = "none";
            btn.classList.remove("is-open");
          } else {
            if (!inlineContainer.innerHTML) {
              inlineContainer.innerHTML = renderLegendCardHtml(groupKey, def, true);
            }
            inlineContainer.style.display = "block";
            btn.classList.add("is-open");
          }
        });
      }
    });

    // 3. Injektování tlačítek inline legendy do podvrstev (.sublayer-item)
    document.querySelectorAll(".sublayer-item").forEach(function (item) {
      var sublayerKey = item.getAttribute("data-sublayer");
      var def = DTM_LEGEND_DATA[sublayerKey];
      if (!def) return;

      if (!item.querySelector(".btn-sublayer-legend")) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-sublayer-legend";
        btn.title = "Zobrazit značkový klíč pro " + def.title;
        btn.innerHTML = legendSvg;

        item.appendChild(btn);

        var inlineContainer = document.createElement("div");
        inlineContainer.className = "sublayer-inline-legend";
        inlineContainer.style.display = "none";
        item.parentNode.insertBefore(inlineContainer, item.nextSibling);

        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var isOpen = inlineContainer.style.display === "block";
          if (isOpen) {
            inlineContainer.style.display = "none";
            btn.classList.remove("is-open");
          } else {
            if (!inlineContainer.innerHTML) {
              inlineContainer.innerHTML = renderLegendCardHtml(sublayerKey, def, true);
            }
            inlineContainer.style.display = "block";
            btn.classList.add("is-open");
          }
        });
      }
    });

    // 4. Záložky hlavičky panelu
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

    // 5. Filtry v hlavičce záložky Legenda (Aktivní / Všechny)
    var btnFilterActive = document.getElementById("btn-legend-filter-active");
    var btnFilterAll = document.getElementById("btn-legend-filter-all");

    if (btnFilterActive) {
      btnFilterActive.addEventListener("click", function () {
        btnFilterActive.classList.add("active");
        if (btnFilterAll) btnFilterAll.classList.remove("active");
        renderAllLegends("active");
      });
    }

    if (btnFilterAll) {
      btnFilterAll.addEventListener("click", function () {
        btnFilterAll.classList.add("active");
        if (btnFilterActive) btnFilterActive.classList.remove("active");
        renderAllLegends("all");
      });
    }

    // Inicializace odznáčku aktivních vrstev
    updateLegendBadge();
  }

  // Tlačítko legendy na Leaflet mapě (vlevo pod měřením)
  function initLegendControl() {
    if (!state.map) return;

    var LegendControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar legend-control");
        var btn = L.DomUtil.create("button", "legend-toggle-btn", container);
        btn.id = "btn-legend-map-toggle";
        btn.type = "button";
        btn.title = "Zobrazit legendu vrstev a značkový klíč DTM";
        btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="3" y="3" width="18" height="18" rx="2"></rect>' +
          '<line x1="8" y1="7" x2="16" y2="7"></line>' +
          '<line x1="8" y1="12" x2="16" y2="12"></line>' +
          '<line x1="8" y1="17" x2="12" y2="17"></line>' +
        '</svg>';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        L.DomEvent.on(btn, "click", function (e) {
          L.DomEvent.preventDefault(e);
          if (state.currentTab === "legend") {
            switchToSidebarTab("layers");
          } else {
            switchToSidebarTab("legend");
          }
        });

        return container;
      }
    });

    state.map.addControl(new LegendControl());
  }

  // Spuštění po načtení DOMu
  document.addEventListener("DOMContentLoaded", initMap);
})();
