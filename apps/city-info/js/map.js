/**
 * Mapa (Leaflet) – inicializace, ortofoto vrstvy, klik na obec.
 * Ortofoto přepínač je vlastní Leaflet control uvnitř mapy.
 * Marker používá vlastní SVG ikonu v barvě primární palety.
 */
var CityInfo = window.CityInfo || {};

CityInfo.Map = (function () {
  "use strict";

  var H = null;
  var LAYER = null;

  var map = null;
  var mapStatus = null;
  var clickMarker = null;
  var obecOutline = null;
  var markerIcon = null;

  // Custom SVG marker icon
  function createMarkerIcon() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
      '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#4483fc"/>' +
      '<circle cx="12" cy="11" r="4.5" fill="#fff"/>' +
      '</svg>';
    return L.divIcon({
      html: svg,
      className: "ci-marker-icon",
      iconSize: [24, 36],
      iconAnchor: [12, 36],
      popupAnchor: [0, -36]
    });
  }

  function drawOutline(geometry) {
    if (!map) return;
    if (obecOutline) { map.removeLayer(obecOutline); obecOutline = null; }
    if (!geometry || !geometry.rings) return;
    var latlngs = geometry.rings.map(function (ring) {
      return ring.map(function (pt) { return [pt[1], pt[0]]; });
    });
    obecOutline = L.polygon(latlngs, { color: "#4483fc", weight: 2, fillOpacity: .05 }).addTo(map);
  }

  function handleMapClick(e) {
    var lat = e.latlng.lat, lon = e.latlng.lng;
    if (clickMarker) map.removeLayer(clickMarker);
    clickMarker = L.marker([lat, lon], { icon: markerIcon }).addTo(map);
    H.setStatus(mapStatus, "Vyhledávám obec v daném bodě…");
    H.ruianQuery(LAYER.OBEC, {
      geometry: lon + "," + lat,
      geometryType: "esriGeometryPoint",
      inSR: 4326,
      spatialRel: "esriSpatialRelIntersects",
      returnGeometry: true,
      outSR: 4326
    }).then(function (data) {
      var f = data.features && data.features[0];
      if (!f) {
        H.setStatus(mapStatus, "Na tomto místě se nepodařilo najít žádnou obec (mimo území ČR?).", true);
        return;
      }
      H.setStatus(mapStatus, "");
      CityInfo.Render.showObec(f.attributes, f.geometry);
    }).catch(function () {
      H.setStatus(mapStatus, "Dotaz na RÚIAN selhal, zkuste kliknout znovu.", true);
    });
  }

  function fitBounds(geometry) {
    if (!map || !geometry) return;
    try {
      var b = L.geoJSON({ type: "Polygon", coordinates: geometry.rings }).getBounds();
      map.fitBounds(b, { maxZoom: 13, padding: [20, 20] });
    } catch (e) { /* noop */ }
  }

  // Custom Leaflet control for ortofoto toggle
  var OrtofotoControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function () {
      var container = L.DomUtil.create("div", "leaflet-control-ortofoto leaflet-bar");
      var btn = L.DomUtil.create("button", "ortofoto-btn", container);
      btn.type = "button";
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polygon points="12,2 2,7 12,12 22,7"/>' +
        '<polyline points="2,17 12,22 22,17"/>' +
        '<polyline points="2,12 12,17 22,12"/>' +
        '</svg>' +
        'Ortofoto';

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      this._btn = btn;
      this._active = false;
      return container;
    }
  });

  // SVG icons for fullscreen toggle
  var expandSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>' +
    '<line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  var compressSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>' +
    '<line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';


  function init() {
    H = CityInfo.Helpers;
    LAYER = CityInfo.Config.LAYER;
    mapStatus = document.getElementById("mapStatus");
    markerIcon = createMarkerIcon();

    try {
      if (typeof L === "undefined") throw new Error("Leaflet se nenačetlo (knihovna z CDN)");
      map = L.map("map", { attributionControl: true, zoomControl: true }).setView([49.8175, 15.4730], 7);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap"
      }).addTo(map);

      // Custom pane for state border to ensure it stays above ortofoto
      map.createPane("bordersPane");
      map.getPane("bordersPane").style.zIndex = 250;
      map.getPane("bordersPane").style.pointerEvents = "none"; // allow clicking through

      // State border WMS layer
      var stateBorder = L.tileLayer.wms("https://ags.cuzk.cz/arcgis/services/RUIAN/MapServer/WMSServer", {
        layers: "Stat",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        pane: "bordersPane"
      });
      stateBorder.addTo(map);

      // ORP boundaries & labels (vector only – no WMS to avoid duplicate labels)
      var orpBordersGroup = L.layerGroup();
      var orpLabelsGroup = L.layerGroup();
      var orpDataLoaded = false;
      var ORP_LABEL_MIN_ZOOM = 9;

      function loadOrpData() {
        if (orpDataLoaded) return;
        orpDataLoaded = true;

        var url = CityInfo.Config.RUIAN + "/" + LAYER.ORP + "/query?" +
          "where=1%3D1&outFields=nazev&returnGeometry=true&geometryPrecision=3" +
          "&maxAllowableOffset=0.002&outSR=4326&f=json&resultRecordCount=1000";

        H.fetchJson(url).then(function (data) {
          if (!data.features) return;
          data.features.forEach(function (f) {
            if (!f.attributes || !f.attributes.nazev || !f.geometry || !f.geometry.rings) return;

            // Draw polygon border
            var latlngs = f.geometry.rings.map(function (ring) {
              return ring.map(function (pt) { return [pt[1], pt[0]]; });
            });
            var poly = L.polygon(latlngs, {
              color: "#c4431a",
              weight: 2,
              opacity: 0.6,
              fill: false,
              interactive: false
            });
            orpBordersGroup.addLayer(poly);

            // Compute centroid from first ring for label
            var ring = f.geometry.rings[0];
            var cx = 0, cy = 0;
            for (var i = 0; i < ring.length; i++) {
              cx += ring[i][0];
              cy += ring[i][1];
            }
            cx /= ring.length;
            cy /= ring.length;

            var marker = L.marker([cy, cx], {
              icon: L.divIcon({
                className: "orp-label",
                html: '<span>' + H.esc(f.attributes.nazev) + '</span>',
                iconSize: [0, 0],
                iconAnchor: [0, 0]
              }),
              interactive: false
            });
            orpLabelsGroup.addLayer(marker);
          });
        }).catch(function () { /* noop */ });
      }

      // Load data immediately & add borders to map
      loadOrpData();
      orpBordersGroup.addTo(map);

      function updateOrpLabelsVisibility() {
        var z = map.getZoom();
        if (z >= ORP_LABEL_MIN_ZOOM) {
          if (!map.hasLayer(orpLabelsGroup)) map.addLayer(orpLabelsGroup);
        } else {
          if (map.hasLayer(orpLabelsGroup)) map.removeLayer(orpLabelsGroup);
        }
      }
      map.on("zoomend", updateOrpLabelsVisibility);
      updateOrpLabelsVisibility();

      var ortofoto = L.tileLayer.wms(CityInfo.Config.ORTOFOTO_WMS, {
        layers: "0", format: "image/png", transparent: true, version: "1.3.0",
        attribution: "Ortofoto &copy; ČÚZK"
      });

      // Add custom controls
      var ortofotoCtrl = new OrtofotoControl();
      map.addControl(ortofotoCtrl);
      var ortofotoOn = false;
      ortofotoCtrl._btn.addEventListener("click", function () {
        ortofotoOn = !ortofotoOn;
        ortofotoCtrl._btn.classList.toggle("active", ortofotoOn);
        if (ortofotoOn) map.addLayer(ortofoto); else map.removeLayer(ortofoto);
      });

      // Fullscreen button – injected directly into the zoom control bar
      var zoomBar = map.zoomControl.getContainer();
      var fsBtn = document.createElement("a");
      fsBtn.className = "leaflet-control-fullscreen-btn";
      fsBtn.href = "#";
      fsBtn.title = "Celá obrazovka";
      fsBtn.setAttribute("role", "button");
      fsBtn.innerHTML = expandSvg;
      zoomBar.appendChild(fsBtn);

      var mapContainer = map.getContainer();
      fsBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!document.fullscreenElement) {
          mapContainer.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      });
      document.addEventListener("fullscreenchange", function () {
        var isFs = !!document.fullscreenElement;
        fsBtn.innerHTML = isFs ? compressSvg : expandSvg;
        fsBtn.title = isFs ? "Opustit celou obrazovku" : "Celá obrazovka";
        setTimeout(function () { map.invalidateSize(); }, 100);
      });

      map.on("click", handleMapClick);
    } catch (err) {
      H.setStatus(mapStatus, "Mapu se nepodařilo načíst (" + err.message + "). Zkuste obnovit stránku.", true);
    }
  }

  function clear() {
    if (clickMarker) { map.removeLayer(clickMarker); clickMarker = null; }
    if (obecOutline) { map.removeLayer(obecOutline); obecOutline = null; }
  }

  return {
    init: init,
    drawOutline: drawOutline,
    fitBounds: fitBounds,
    clear: clear,
    get instance() { return map; }
  };
})();
