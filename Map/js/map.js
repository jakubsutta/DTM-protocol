/**
 * Map Generator - Map Service (Leaflet & WMS layers)
 */

window.MapApp = window.MapApp || {};

MapApp.mapService = {
    initMap() {
        const { state, CONFIG } = MapApp;

        state.map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            zoomSnap: 0,
            zoomDelta: 0.25
        }).setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);

        state.ortoLayer = L.tileLayer.wms(CONFIG.WMS_ORTOFOTO_URL, {
            layers: '0',
            format: 'image/png',
            transparent: true,
            maxZoom: 20
        }).addTo(state.map);

        state.knInverseLayer = L.tileLayer.wms(CONFIG.WMS_KN_URL, {
            layers: 'hranice_parcel_i,parcelni_cisla_i',
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            crs: L.CRS.EPSG3857,
            minZoom: 13,
            maxZoom: 20
        });

        state.labelMarkersGroup = L.layerGroup().addTo(state.map);

        state.map.on('zoomend moveend', this.syncScaleFromMap.bind(this));

        setTimeout(() => {
            state.map.invalidateSize();
            this.syncScaleFromMap();
        }, 300);
    },

    toggleWmsLayers() {
        const { state } = MapApp;
        if (!state.map) return;

        const chkOrto = document.getElementById('chkOrto');
        const chkKnInverse = document.getElementById('chkKnInverse');
        const isOrto = chkOrto && chkOrto.checked;
        const isKn = chkKnInverse && chkKnInverse.checked;

        if (isOrto) {
            if (!state.map.hasLayer(state.ortoLayer)) state.map.addLayer(state.ortoLayer);
        } else {
            if (state.map.hasLayer(state.ortoLayer)) state.map.removeLayer(state.ortoLayer);
        }

        if (isKn) {
            // Use inverse layer (white lines) when ortofoto is active, standard (dark lines) otherwise
            const layerName = isOrto ? 'hranice_parcel_i,parcelni_cisla_i' : 'hranice_parcel,parcelni_cisla';
            state.knInverseLayer.setParams({ layers: layerName });
            if (!state.map.hasLayer(state.knInverseLayer)) state.map.addLayer(state.knInverseLayer);
            
            // Maintain layer order: Ortofoto bottom, Katastr middle, GeoJSON & labels on top
            if (state.ortoLayer && state.map.hasLayer(state.ortoLayer)) {
                state.ortoLayer.bringToBack();
            }
        } else {
            if (state.map.hasLayer(state.knInverseLayer)) state.map.removeLayer(state.knInverseLayer);
        }
    },

    syncScaleFromMap() {
        const { state } = MapApp;
        if (!state.map) return;
        if (state.isManualScaleSetting) return;

        const scaleInput = document.getElementById('scaleInput');
        if (scaleInput && document.activeElement === scaleInput) return;

        const center = state.map.getCenter();
        const scale = Math.round(591657550.500000 / Math.pow(2, state.map.getZoom()) * Math.cos(center.lat * Math.PI / 180));

        if (scaleInput) {
            scaleInput.value = scale;
        }

        this.updateScaleBar(scale);
    },

    onManualScaleChange() {
        const { state } = MapApp;
        const scaleInput = document.getElementById('scaleInput');
        const scale = parseFloat(scaleInput?.value) || 0;

        if (!state.map || scale <= 0) return;
        const center = state.map.getCenter();
        const targetZoom = Math.log2(591657550.500000 * Math.cos(center.lat * Math.PI / 180) / scale);

        state.isManualScaleSetting = true;
        state.map.setZoom(targetZoom);
        this.updateScaleBar(scale);
        setTimeout(() => {
            state.isManualScaleSetting = false;
        }, 400);
    },

    updateScaleBar(scale) {
        const textEl = document.getElementById('outScaleText');
        const barEl = document.getElementById('outScaleBar');
        const lengthEl = document.getElementById('outScaleLengthText');

        if (textEl) {
            textEl.textContent = '1 : ' + (scale || 0).toLocaleString('cs-CZ');
        }

        if (!scale || scale <= 0) return;

        // Series of cartographic steps (in meters)
        const niceSteps = [
            0.5, 1, 2, 5, 10, 20, 25, 50, 75, 100, 150, 200, 250, 500,
            750, 1000, 1500, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000
        ];

        // Target an aesthetically pleasing scale bar width of ~25 mm on paper
        let bestStep = niceSteps[0];
        let minDiff = Infinity;

        for (const step of niceSteps) {
            const widthMm = (step * 1000) / scale;
            if (widthMm >= 15 && widthMm <= 40) {
                const diff = Math.abs(widthMm - 25);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestStep = step;
                }
            }
        }

        if (minDiff === Infinity) {
            for (const step of niceSteps) {
                const widthMm = (step * 1000) / scale;
                const diff = Math.abs(widthMm - 25);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestStep = step;
                }
            }
        }

        const widthMm = Math.max(12, Math.min(50, (bestStep * 1000) / scale));

        if (barEl) {
            barEl.style.width = widthMm.toFixed(1) + 'mm';
        }

        if (lengthEl) {
            lengthEl.textContent = bestStep >= 1000
                ? ((bestStep / 1000).toLocaleString('cs-CZ') + ' km')
                : (bestStep + ' m');
        }
    }
};
