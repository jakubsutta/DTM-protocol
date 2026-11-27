/**
 * Generátor map – konfigurace, výchozí rozvržení a sdílené pomůcky
 *
 * Celý dokument (stránka, vodítka, rám mapy, prvky rozvržení, legenda)
 * je jeden serializovatelný objekt MapApp.doc – ukládá se do localStorage
 * a dá se exportovat/importovat jako šablona (JSON).
 * Všechny rozměry jsou v milimetrech, velikosti písma v bodech (pt).
 */

window.MapApp = window.MapApp || {};

MapApp.CONFIG = {
    PAGE_SIZES: { A4: [210, 297], A3: [297, 420] },
    // Okraje pro vodítka (mm) – vlevo širší kvůli vazbě, jako ve vzorových mapách z QGIS
    DEFAULT_MARGINS: { left: 15, right: 10, top: 10, bottom: 10 },
    DEFAULT_CENTER: [49.4062, 16.4066],
    DEFAULT_SCALE: 1500,
    // Měřítka, mezi kterými se přepíná kolečkem myši (jako pevná měřítka v QGIS)
    SCALES: [250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500,
        10000, 15000, 20000, 25000, 50000, 75000, 100000],
    WMS: {
        orto: {
            url: 'https://ags.cuzk.cz/arcgis1/services/ORTOFOTO_WM/MapServer/WMSServer',
            layers: '0', format: 'image/jpeg', transparent: false, maxSize: 4096
        },
        kn: {
            url: 'https://services.cuzk.cz/wms/local-km-wms.asp',
            layers: 'hranice_parcel,parcelni_cisla',
            layersInverse: 'hranice_parcel_i,parcelni_cisla_i',
            format: 'image/png', transparent: true, maxSize: 2048
        }
    },
    RUIAN_URL: 'https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer',
    STORAGE_KEY: 'jenda-mapgen-v2',
    FONT_STACK: "'Segoe UI', 'Segoe UI Variable', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
    // 1 CSS px = 25.4 / 96 mm (Leaflet kreslí v CSS px, tisk je 1:1 v mm)
    MM_PER_PX: 25.4 / 96
};

// S-JTSK / Křovák (EPSG:5514) – pro import SHP
if (typeof proj4 !== 'undefined') {
    proj4.defs(
        'EPSG:5514',
        '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=570.8,85.7,462.8,4.998,1.587,5.261,3.56 +units=m +no_defs'
    );
}

/* ---------- Výchozí legenda (pasport komunikací, podle vzorové mapy) ---------- */
MapApp.defaultLegendItems = function () {
    return [
        { kind: 'header', text: 'mosty a zařízení' },
        { kind: 'icon', icon: 'most', text: 'silniční most (M)', color: '#000000' },
        { kind: 'icon', icon: 'propustek', text: 'propustek (Mp)', color: '#000000' },
        { kind: 'icon', icon: 'lavka', text: 'lávka pro chodce (L)', color: '#000000' },
        { kind: 'header', text: 'kategorie komunikace' },
        { kind: 'line', text: 'silnice III. třídy', color: '#ffffff', width: 1.2, casing: '#9e9e9e', casingWidth: 0.3, dashed: false },
        { kind: 'line', text: 'místní komunikace III. třídy (c)', color: '#f2b766', width: 1.2, casing: '#a87a3a', casingWidth: 0.15, dashed: false },
        { kind: 'line', text: 'místní komunikace IV. třídy (d)', color: '#fbe8bf', width: 1.0, casing: '#b49a6a', casingWidth: 0.12, dashed: false },
        { kind: 'line', text: 'účelová komunikace jiná (u)', color: '#a7a7a7', width: 0.7, casing: '#000000', casingWidth: 0.35, dashed: true },
        { kind: 'line', text: 'účelová komunikace soukromá (u-sv)', color: '#c9b08a', width: 0.7, casing: '#000000', casingWidth: 0.35, dashed: true },
        { kind: 'line', text: 'účelová komunikace lesní (u)', color: '#2e9a3e', width: 0.7, casing: '#000000', casingWidth: 0.35, dashed: true },
        { kind: 'line', text: 'účelová komunikace polní (u)', color: '#b5c94a', width: 0.7, casing: '#000000', casingWidth: 0.35, dashed: true },
        { kind: 'header', text: 'přidružená plocha' },
        { kind: 'fill', text: 'odstavná plocha (OP)', color: '#d7dc78', stroke: '#3a2a1a', strokeWidth: 0.35 },
        { kind: 'fill', text: 'autobusová zastávka (Bus)', color: '#f7b55e', stroke: '#3a2a1a', strokeWidth: 0.35 },
        { kind: 'fill', text: 'parkoviště (P)', color: '#8a95e6', stroke: '#3a2a1a', strokeWidth: 0.35 },
        { kind: 'fill', text: 'garáž (G)', color: '#e27474', stroke: '#3a2a1a', strokeWidth: 0.35 },
        { kind: 'fill', text: 'autobusové nádraží (AN)', color: '#7fd0a8', stroke: '#3a2a1a', strokeWidth: 0.35 },
        { kind: 'fill', text: 'hranice katastrálního území', color: 'transparent', stroke: '#a3121a', strokeWidth: 0.6 }
    ];
};

/* ---------- Výchozí dokument ---------- */
MapApp.defaultDoc = function (format, orient) {
    format = format || 'A3';
    orient = orient || 'landscape';
    const [W, H] = MapApp.pageSize(format, orient);
    const m = MapApp.CONFIG.DEFAULT_MARGINS;
    const frame = { x: m.left, y: m.top, w: W - m.left - m.right, h: H - m.top - m.bottom };
    const fR = frame.x + frame.w, fB = frame.y + frame.h;
    const inset = 2.5;

    return {
        version: 2,
        page: { format, orient },
        guides: {
            h: [m.top, H - m.bottom],
            v: [m.left, W - m.right],
            show: true,
            snap: true
        },
        frame: Object.assign(frame, { linked: true, border: 0.35, borderColor: '#000000' }),
        map: {
            center: MapApp.CONFIG.DEFAULT_CENTER.slice(),
            scale: MapApp.CONFIG.DEFAULT_SCALE,
            basemap: 'orto',
            kn: false,
            knInverse: true,
            quality: 2
        },
        style: {
            boxBg: '#ffffff',
            boxOpacity: 0.82,
            boxBorder: 0.4,
            boxBorderColor: '#000000',
            boxRadius: 1.2,
            boxPadding: 2.2,
            accent: '#ea521f',
            textColor: '#000000',
            inset
        },
        items: [
            {
                id: 'title', type: 'title', name: 'Nadpis', visible: true, box: true,
                x: frame.x + inset, y: frame.y + inset, anchor: 'tl',
                text: 'PŘEHLED MÍSTNÍCH A ÚČELOVÝCH KOMUNIKACÍ',
                subtitle: 'Městys Lomnice, místní část Brusná, 2026',
                size: 11, subSize: 10.5, accentLine: true
            },
            {
                id: 'mapnum', type: 'text', name: 'Číslo mapy', visible: true, box: true,
                x: fR - inset, y: frame.y + inset, anchor: 'tr',
                text: 'Mapa B01A', size: 11, weight: 700, align: 'center'
            },
            {
                id: 'legend', type: 'legend', name: 'Legenda', visible: true, box: true,
                x: fR - inset - 2, y: frame.y + 19, anchor: 'tr',
                title: '', titleSize: 9, size: 7.9, headerSize: 7.9,
                rowGap: 3.2, patchW: 8, patchH: 4.2, colGap: 2,
                footer: 'Podklad: Ortofotomapa ČR',
                legendItems: MapApp.defaultLegendItems()
            },
            {
                id: 'scale', type: 'scale', name: 'Měřítko', visible: true, box: true,
                x: frame.x + inset, y: fB - inset, anchor: 'bl',
                segments: 2, segLen: 0, targetWidth: 50, size: 7.5, ratioSize: 9,
                showRatio: true, barStyle: 'ticks', units: 'auto'
            },
            {
                id: 'imprint', type: 'imprint', name: 'Tiráž', visible: true, box: true,
                x: fR - inset, y: fB - inset, anchor: 'br',
                size: 9.5, align: 'right',
                lines: [
                    { label: 'Zpracovatel:', value: '© Atomicon s.r.o. 2026' },
                    { label: 'Zdroj dat:', value: 'poskytovatel' },
                    { label: 'Přispěvatelé:', value: '© ČÚZK [2026]' },
                    { label: '', value: 'www.atomicon.cz' }
                ]
            },
            {
                id: 'north', type: 'north', name: 'Severka', visible: false, box: false,
                x: fR - inset - 2, y: fB - 30, anchor: 'br', sizeMm: 12
            }
        ]
    };
};

/* ---------- Pomůcky ---------- */
MapApp.pageSize = function (format, orient) {
    let [w, h] = MapApp.CONFIG.PAGE_SIZES[format] || MapApp.CONFIG.PAGE_SIZES.A3;
    if (orient === 'landscape') [w, h] = [h, w];
    return [w, h];
};

MapApp.clone = function (obj) {
    return JSON.parse(JSON.stringify(obj));
};

MapApp.round = function (v, step) {
    step = step || 0.1;
    return Math.round(v / step) * step;
};

MapApp.fmtMm = function (v) {
    return (Math.round(v * 10) / 10).toString();
};

// Formát měřítka „1 : 1 500“ (mezera jako oddělovač tisíců)
MapApp.fmtScale = function (scale) {
    return '1 : ' + Math.round(scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

MapApp.ptToMm = function (pt) {
    return pt * 25.4 / 72;
};

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Hex barva + průhlednost → rgba()
MapApp.rgba = function (hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex || 'transparent';
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/* ---------- Běhový stav (neukládá se) ---------- */
MapApp.state = {
    map: null,
    geojsonLayer: null,
    outlineLayer: null,
    labelMarkersGroup: null,
    isLabelEditMode: false,
    importedGeoJSON: null,
    detectedGeomType: null,
    categoryColors: {},
    selectedId: null
};
