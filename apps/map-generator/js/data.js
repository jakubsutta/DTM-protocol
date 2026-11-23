/**
 * Map Generator - Data Layer (SHP Import, Symbology, Categorization & GeoJSON Styling)
 *
 * SHP Import Approach (ported from Find-parcel.html):
 * shpjs internally uses the .prj file to auto-reproject to WGS84, but its
 * built-in Helmert transformation is imprecise for Czech S-JTSK data, causing
 * a visible positional shift. The fix: use JSZip to manually extract .shp and
 * .dbf from the ZIP, call shp.parseShp() WITHOUT the .prj content, then detect
 * whether the resulting coordinates are already WGS84 or still in S-JTSK and
 * reproject through proj4 (which uses the accurate 7-parameter Helmert).
 */

window.MapApp = window.MapApp || {};

MapApp.data = {
    PALETTE: [
        '#0288D1', '#ea521f', '#2e7d32', '#7b1fa2', '#f57c00',
        '#0097a7', '#c2185b', '#388e3c', '#e65100', '#5d4037',
        '#455a64', '#1565c0', '#d81b60', '#8e24aa', '#3949ab',
        '#00897b', '#43a047', '#7cb342', '#c0ca33', '#fdd835'
    ],

    getRandomColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    },

    /**
     * Determine whether a [x, y] pair is in WGS84 (lon/lat) or S-JTSK (meters).
     * In the Czech Republic, WGS84 longitude ≈ 12°–19°, latitude ≈ 48°–51°.
     * S-JTSK values are hundreds of thousands of meters (negative by convention).
     */
    _isWgs84(x, y) {
        return Math.abs(x) <= 180 && Math.abs(y) <= 90;
    },

    /**
     * Convert a single coordinate pair from S-JTSK to WGS84 [lon, lat].
     * Handles both positive and negative S-JTSK conventions.
     */
    _sjtskToWgs84(x, y) {
        const sjtskY = x > 0 ? -x : x;
        const sjtskX = y > 0 ? -y : y;
        const wgs = proj4('EPSG:5514', 'EPSG:4326', [sjtskY, sjtskX]);
        return [wgs[0], wgs[1]];
    },

    /**
     * Recursively transform all coordinate pairs in a GeoJSON coordinates array
     * from S-JTSK to WGS84.
     */
    _transformCoords(coords) {
        if (typeof coords[0] === 'number') {
            return this._sjtskToWgs84(coords[0], coords[1]);
        }
        return coords.map(c => this._transformCoords(c));
    },

    /**
     * Parse the SHP ZIP with JSZip to bypass shpjs's imprecise internal reprojection.
     */
    async _parseShpZip(buffer) {
        if (window.JSZip) {
            const zip = await JSZip.loadAsync(buffer);
            const shpFiles = Object.keys(zip.files).filter(
                k => k.toLowerCase().endsWith('.shp') && !k.includes('__MACOSX')
            );

            if (shpFiles.length > 0) {
                const collections = [];

                for (const shpFile of shpFiles) {
                    const base = shpFile.slice(0, -4);
                    const shpBuf = await zip.files[shpFile].async('arraybuffer');

                    const dbfKey = Object.keys(zip.files).find(
                        k => k.toLowerCase() === (base + '.dbf').toLowerCase()
                    );
                    const dbfBuf = dbfKey
                        ? await zip.files[dbfKey].async('arraybuffer')
                        : null;

                    const cpgKey = Object.keys(zip.files).find(
                        k => k.toLowerCase() === (base + '.cpg').toLowerCase()
                    );
                    const cpg = cpgKey
                        ? await zip.files[cpgKey].async('text')
                        : undefined;

                    const geoms = shp.parseShp(shpBuf);
                    const props = dbfBuf ? shp.parseDbf(dbfBuf, cpg) : [];
                    const geojson = shp.combine([geoms, props]);
                    collections.push(geojson);
                }

                const sampleFeature = collections[0]?.features?.[0];
                if (sampleFeature) {
                    let sample = sampleFeature.geometry?.coordinates;
                    while (Array.isArray(sample) && Array.isArray(sample[0])) {
                        sample = sample[0];
                    }
                    if (Array.isArray(sample) && sample.length >= 2 &&
                        !this._isWgs84(sample[0], sample[1])) {
                        for (const col of collections) {
                            for (const feat of (col.features || [])) {
                                if (feat.geometry && feat.geometry.coordinates) {
                                    feat.geometry.coordinates =
                                        this._transformCoords(feat.geometry.coordinates);
                                }
                            }
                        }
                    }
                }

                return collections.length === 1 ? collections[0] : collections;
            }
        }

        // Fallback: standard shpjs parsing
        return await shp(buffer);
    },

    detectGeomType(geojson) {
        const features = (Array.isArray(geojson) ? geojson[0] : geojson).features || [];
        for (const f of features) {
            const t = f.geometry?.type;
            if (t === 'LineString' || t === 'MultiLineString') return 'line';
            if (t === 'Polygon' || t === 'MultiPolygon') return 'polygon';
            if (t === 'Point' || t === 'MultiPoint') return 'point';
        }
        return 'line';
    },

    async loadShp() {
        const { state } = MapApp;
        const fileInput = document.getElementById('shpFile');
        const status = document.getElementById('shpStatus');
        const file = fileInput?.files?.[0];

        if (!file) {
            if (status) {
                status.className = 'status err';
                status.textContent = 'Vyberte prosím .zip soubor se SHP daty.';
            }
            return;
        }

        if (status) {
            status.className = 'status';
            status.textContent = 'Načítám a transformuji SHP…';
        }

        try {
            const buffer = await file.arrayBuffer();
            const parsed = await this._parseShpZip(buffer);
            state.importedGeoJSON = parsed;
            state.detectedGeomType = this.detectGeomType(parsed);
            state.categoryColors = {};

            if (state.geojsonLayer && state.map) state.map.removeLayer(state.geojsonLayer);
            if (state.outlineLayer && state.map) state.map.removeLayer(state.outlineLayer);
            if (state.labelMarkersGroup) state.labelMarkersGroup.clearLayers();

            // Populate attribute selects for labels & categories
            const labelSelect = document.getElementById('labelField');
            const categorySelect = document.getElementById('categoryField');
            if (labelSelect) labelSelect.innerHTML = '<option value="">-- Bez popisků --</option>';
            if (categorySelect) categorySelect.innerHTML = '<option value="">-- Jednotný symbol (Bez kategorií) --</option>';

            const firstFeat = (Array.isArray(parsed) ? parsed[0] : parsed).features?.[0];
            if (firstFeat && firstFeat.properties) {
                Object.keys(firstFeat.properties).forEach(propName => {
                    if (labelSelect) labelSelect.appendChild(new Option(propName, propName));
                    if (categorySelect) categorySelect.appendChild(new Option(propName, propName));
                });
            }

            this.buildCategoryList();
            this.updateVectorStyle();

            if (state.geojsonLayer && state.map) {
                const bounds = state.geojsonLayer.getBounds();
                if (bounds.isValid()) {
                    state.map.fitBounds(bounds, { padding: [20, 20] });
                }
            }

            if (status) {
                status.className = 'status success';
                status.textContent = 'Data byla úspěšně načtena a zobrazena v mapě.';
            }
        } catch (e) {
            if (status) {
                status.className = 'status err';
                status.textContent = 'Chyba při načítání SHP: ' + e.message;
            }
        }
    },

    buildCategoryList() {
        const { state, ui } = MapApp;
        const categoryField = ui.val('categoryField');
        const secCategories = document.getElementById('secCategories');
        const container = document.getElementById('categoryListContainer');

        if (!categoryField || !state.importedGeoJSON) {
            if (secCategories) secCategories.style.display = 'none';
            state.categoryColors = {};
            return;
        }

        if (secCategories) secCategories.style.display = 'block';
        if (!container) return;
        container.innerHTML = '';

        const features = (Array.isArray(state.importedGeoJSON) ? state.importedGeoJSON[0] : state.importedGeoJSON).features || [];

        // Count occurrences of each category
        const counts = {};
        features.forEach(f => {
            const rawVal = f.properties ? f.properties[categoryField] : null;
            const val = (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') ? String(rawVal) : '(Neuvedeno)';
            counts[val] = (counts[val] || 0) + 1;
        });

        const uniqueVals = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

        // Assign colors if not already assigned
        uniqueVals.forEach((val, idx) => {
            if (!state.categoryColors[val]) {
                state.categoryColors[val] = this.PALETTE[idx % this.PALETTE.length];
            }
        });

        // Render category rows
        uniqueVals.forEach(val => {
            const row = document.createElement('div');
            row.className = 'category-item';

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = state.categoryColors[val] || '#0288D1';
            colorInput.title = 'Změnit barvu kategorie';
            colorInput.addEventListener('input', (e) => {
                state.categoryColors[val] = e.target.value;
                this.updateVectorStyle();
                MapApp.ui.updateDecorations();
            });

            const labelEl = document.createElement('span');
            labelEl.className = 'category-label';
            labelEl.textContent = val;
            labelEl.title = val;

            const countEl = document.createElement('span');
            countEl.className = 'category-count';
            countEl.textContent = counts[val] + '×';

            row.appendChild(colorInput);
            row.appendChild(labelEl);
            row.appendChild(countEl);
            container.appendChild(row);
        });
    },

    randomizeCategoryColors() {
        const { state } = MapApp;
        const keys = Object.keys(state.categoryColors);
        if (keys.length === 0) return;

        const shuffled = [...this.PALETTE].sort(() => Math.random() - 0.5);
        keys.forEach((key, idx) => {
            state.categoryColors[key] = shuffled[idx % shuffled.length];
        });

        this.buildCategoryList();
        this.updateVectorStyle();
        MapApp.ui.updateDecorations();
    },

    onCategoryFieldChange() {
        const { state, ui } = MapApp;
        const categoryField = ui.val('categoryField');
        state.categoryColors = {};
        this.buildCategoryList();
        this.updateVectorStyle();
    },

    updateVectorStyle() {
        const { state, ui, labels } = MapApp;
        if (!state.importedGeoJSON || !state.map) return;

        if (state.geojsonLayer) state.map.removeLayer(state.geojsonLayer);
        if (state.outlineLayer) state.map.removeLayer(state.outlineLayer);
        if (state.labelMarkersGroup) state.labelMarkersGroup.clearLayers();

        const categoryField = ui.val('categoryField');

        const isLineGeom = (feature) => {
            const t = feature.geometry?.type;
            return t === 'LineString' || t === 'MultiLineString';
        };

        const getColor = (feature) => {
            if (categoryField && feature.properties) {
                const rawVal = feature.properties[categoryField];
                const val = (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') ? String(rawVal) : '(Neuvedeno)';
                if (state.categoryColors[val]) {
                    return state.categoryColors[val];
                }
            }
            return ui.val('symFillColor');
        };

        const lineOutlineChecked = document.getElementById('lineOutlineEnable')?.checked;
        if (lineOutlineChecked) {
            state.outlineLayer = L.geoJSON(state.importedGeoJSON, {
                style: {
                    color: ui.val('lineOutlineColor'),
                    weight: ui.num('lineOutlineWidth'),
                    opacity: 1
                }
            }).addTo(state.map);
        }

        state.geojsonLayer = L.geoJSON(state.importedGeoJSON, {
            style: (feature) => {
                const col = getColor(feature);
                const isLine = isLineGeom(feature);
                return {
                    color: isLine ? col : ui.val('symStrokeColor'),
                    weight: ui.num('symStrokeWidth') || 2,
                    fillColor: col,
                    fillOpacity: 0.75,
                    opacity: 1
                };
            },
            pointToLayer: (feature, latlng) => {
                const pointType = ui.val('pointType');
                const size = ui.num('iconSize') || 24;
                const angle = ui.num('iconAngle') || 0;
                const fillCol = getColor(feature);
                const strokeCol = ui.val('symStrokeColor');
                const strokeW = ui.num('symStrokeWidth') || 1.5;

                if (pointType === 'iconUrl') {
                    const iconUrl = ui.val('iconUrl');
                    return L.marker(latlng, {
                        icon: L.divIcon({
                            html: `<img src="${iconUrl}" style="width:${size}px; height:${size}px; transform: rotate(${angle}deg); display:block;">`,
                            className: '',
                            iconSize: [size, size],
                            iconAnchor: [size / 2, size / 2]
                        })
                    });
                }

                if (pointType === 'svgCode') {
                    const svgText = ui.val('svgCodeText');
                    return L.marker(latlng, {
                        icon: L.divIcon({
                            html: `<div style="width:${size}px; height:${size}px; transform: rotate(${angle}deg);">${svgText}</div>`,
                            className: '',
                            iconSize: [size, size],
                            iconAnchor: [size / 2, size / 2]
                        })
                    });
                }

                // Vector shape: circle vs square
                const symShape = ui.val('symShape');
                const ptRadius = ui.num('symSize') || 6;

                if (symShape === 'square') {
                    const side = ptRadius * 2;
                    return L.marker(latlng, {
                        icon: L.divIcon({
                            html: `<div style="width:${side}px; height:${side}px; background:${fillCol}; border:${strokeW}px solid ${strokeCol}; box-sizing:border-box;"></div>`,
                            className: '',
                            iconSize: [side, side],
                            iconAnchor: [side / 2, side / 2]
                        })
                    });
                }

                return L.circleMarker(latlng, {
                    radius: ptRadius,
                    fillColor: fillCol,
                    color: strokeCol,
                    weight: strokeW,
                    fillOpacity: 0.85
                });
            },
            onEachFeature: (feature, layer) => {
                const labelField = ui.val('labelField');
                if (labelField && feature.properties && feature.properties[labelField]) {
                    labels.attachLabel(layer, feature.properties[labelField]);
                }
            }
        }).addTo(state.map);

        ui.updateDecorations();
    }
};
