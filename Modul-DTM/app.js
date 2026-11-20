/**
 * Modul DTM – Mapová aplikace pro prohlížení DI, TI a ZPS
 * ČÚZK / IS DMVS WMS služby & ortofoto
 */

(function () {
  "use strict";

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
    baseLayers: {},
    overlayLayers: {}
  };

  // Inicializace mapy
  function initMap() {
    var defaultCenter = [49.8175, 15.473];
    var defaultZoom = 8;

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

    // Inicializace podkladových vrstev
    initBaseLayers();

    // Inicializace překryvných vrstev DTM a KN
    initOverlayLayers();

    // Event listenery mapy
    setupMapEvents();

    // Nastavení UI ovládacích prvků
    setupUIControls();
  }

  // Definice podkladových map
  function initBaseLayers() {
    // 1. Ortofotomapa ČÚZK (výchozí)
    state.baseLayers.orto = L.tileLayer.wms(
      "https://ags.cuzk.cz/arcgis1/services/ORTOFOTO_WM/MapServer/WMSServer",
      {
        layers: "0",
        format: "image/jpeg",
        transparent: false,
        version: "1.3.0",
        maxZoom: 20,
        attribution: '&copy; <a href="https://cuzk.gov.cz" target="_blank">ČÚZK</a> Ortofoto'
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
        maxZoom: 20,
        attribution: '&copy; <a href="https://cuzk.gov.cz" target="_blank">ČÚZK</a> ZTM'
      }
    );

    // 3. OpenStreetMap
    state.baseLayers.osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
      }
    );

    // Výchozí podklad je Ortofoto
    state.baseLayers[state.currentBaseLayer].addTo(state.map);
  }

  // Definice překryvných vrstev DTM (IS DMVS ČÚZK)
  function initOverlayLayers() {
    // Společné parametry pro DTM WMS služby ČÚZK
    var dtmWmsOptions = {
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      crs: L.CRS.EPSG3857,
      maxZoom: 21
    };

    // 1. Dopravní infrastruktura (DI)
    state.overlayLayers.dtm_di = L.tileLayer.wms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_di_ver",
      Object.assign({}, dtmWmsOptions, {
        layers: "dtm_di_ver",
        opacity: 0.9,
        attribution: 'ČÚZK IS DMVS (DI)'
      })
    );

    // 2. Technická infrastruktura (TI)
    state.overlayLayers.dtm_ti = L.tileLayer.wms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_ti_ver",
      Object.assign({}, dtmWmsOptions, {
        layers: "dtm_ti_ver",
        opacity: 0.9,
        attribution: 'ČÚZK IS DMVS (TI)'
      })
    );

    // 3. Přípojky TI
    state.overlayLayers.dtm_pripojky = L.tileLayer.wms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_pripojky",
      Object.assign({}, dtmWmsOptions, {
        layers: "dtm_pripojky",
        opacity: 0.9,
        attribution: 'ČÚZK IS DMVS (Přípojky)'
      })
    );

    // 4. ZPS – Linie a body
    state.overlayLayers.dtm_zps_lb = L.tileLayer.wms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_zps_linie_body",
      Object.assign({}, dtmWmsOptions, {
        layers: "dtm_zps_linie_body",
        opacity: 0.85,
        attribution: 'ČÚZK IS DMVS (ZPS linie)'
      })
    );

    // 5. ZPS – Plochy (barevné)
    state.overlayLayers.dtm_zps_pl_bar = L.tileLayer.wms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_zps_plochy_bar",
      Object.assign({}, dtmWmsOptions, {
        layers: "dtm_zps_plochy_bar",
        opacity: 0.45,
        attribution: 'ČÚZK IS DMVS (ZPS plochy bar)'
      })
    );

    // 6. ZPS – Plochy (šedé)
    state.overlayLayers.dtm_zps_pl_seda = L.tileLayer.wms(
      "https://dmvs.cuzk.gov.cz/api/wms/dtm_zps_plochy_seda",
      Object.assign({}, dtmWmsOptions, {
        layers: "dtm_zps_plochy_seda",
        opacity: 0.45,
        attribution: 'ČÚZK IS DMVS (ZPS plochy šedé)'
      })
    );

    // 7. Katastrální mapa ČÚZK (KN)
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
        attribution: 'ČÚZK KN'
      }
    );

    // Výchozí aktivní vrstvy: DI, TI a ZPS linie
    activateLayer("dtm_di", true);
    activateLayer("dtm_ti", true);
    activateLayer("dtm_zps_lb", true);
  }

  // Zapnutí / vypnutí překryvné vrstvy
  function activateLayer(layerKey, enable) {
    var layer = state.overlayLayers[layerKey];
    var card = document.querySelector('.layer-card[data-layer="' + layerKey + '"]');
    var input = card ? card.querySelector('input[type="checkbox"]') : null;

    if (!layer) return;

    if (enable) {
      if (!state.map.hasLayer(layer)) {
        layer.addTo(state.map);
      }
      if (card) card.classList.add("is-active");
      if (input) input.checked = true;
    } else {
      if (state.map.hasLayer(layer)) {
        state.map.removeLayer(layer);
      }
      if (card) card.classList.remove("is-active");
      if (input) input.checked = false;
    }
  }

  // Přepnutí podkladové mapy
  function setBaseLayer(baseKey) {
    if (!state.baseLayers[baseKey] || state.currentBaseLayer === baseKey) return;

    state.map.removeLayer(state.baseLayers[state.currentBaseLayer]);
    state.baseLayers[baseKey].addTo(state.map);
    state.currentBaseLayer = baseKey;

    // Aktualizace aktivní třídy v UI
    document.querySelectorAll(".base-map-item").forEach(function (el) {
      if (el.getAttribute("data-base") === baseKey) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  }

  // Události mapy (zoom, pohyb kurzoru)
  function setupMapEvents() {
    var zoomBadge = document.getElementById("zoom-badge");
    var coordsBox = document.getElementById("coords-display");

    function updateZoom() {
      var z = state.map.getZoom();
      if (!zoomBadge) return;
      if (z >= 14) {
        zoomBadge.textContent = "Zoom: " + z + " (DTM aktivní)";
        zoomBadge.classList.add("dtm-active");
      } else {
        zoomBadge.textContent = "Zoom: " + z + " (DTM od zoomu 14)";
        zoomBadge.classList.remove("dtm-active");
      }
    }

    state.map.on("zoomend", updateZoom);
    updateZoom();

    state.map.on("mousemove", function (e) {
      if (!coordsBox) return;
      var lat = e.latlng.lat.toFixed(5);
      var lng = e.latlng.lng.toFixed(5);
      coordsBox.textContent = lat + "° N, " + lng + "° E";
    });
  }

  // Napojení ovládacích prvků v panelu a hlavičce
  function setupUIControls() {
    // 1. Přepínač podkladových map
    document.querySelectorAll(".base-map-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var baseKey = this.getAttribute("data-base");
        setBaseLayer(baseKey);
      });
    });

    // 2. Přepínače překryvných vrstev (checkbox + klik na label)
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

    // 4. Reset vrstev
    var btnReset = document.getElementById("btn-reset-layers");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        // Vypnout všechny
        Object.keys(state.overlayLayers).forEach(function (k) {
          activateLayer(k, false);
        });
        // Zapnout výchozí sadu
        activateLayer("dtm_di", true);
        activateLayer("dtm_ti", true);
        activateLayer("dtm_zps_lb", true);
        setBaseLayer("orto");
      });
    }

    // 5. Zapnout všechny DTM vrstvy
    var btnAllDtm = document.getElementById("btn-all-dtm");
    if (btnAllDtm) {
      btnAllDtm.addEventListener("click", function () {
        activateLayer("dtm_di", true);
        activateLayer("dtm_ti", true);
        activateLayer("dtm_pripojky", true);
        activateLayer("dtm_zps_lb", true);
        activateLayer("dtm_zps_pl_bar", true);
        activateLayer("kn", true);
      });
    }

    // 6. Tlačítko zobrazení / skrytí pravého panelu
    var btnSidebarToggle = document.getElementById("sidebar-toggle");
    var sidebarPanel = document.getElementById("sidebar-panel");
    if (btnSidebarToggle && sidebarPanel) {
      btnSidebarToggle.addEventListener("click", function () {
        sidebarPanel.classList.toggle("collapsed");
        this.classList.toggle("active");
        setTimeout(function () {
          state.map.invalidateSize();
        }, 260);
      });
    }

    // Tlačítko zavření uvnitř panelu
    var btnCloseSidebar = document.getElementById("btn-close-sidebar");
    if (btnCloseSidebar && sidebarPanel && btnSidebarToggle) {
      btnCloseSidebar.addEventListener("click", function () {
        sidebarPanel.classList.add("collapsed");
        btnSidebarToggle.classList.remove("active");
        setTimeout(function () {
          state.map.invalidateSize();
        }, 260);
      });
    }
  }

  // Spuštění po načtení DOMu
  document.addEventListener("DOMContentLoaded", initMap);
})();
