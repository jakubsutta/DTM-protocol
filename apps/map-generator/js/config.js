/**
 * Map Generator - Configuration & Initial State
 */

window.MapApp = window.MapApp || {};

MapApp.CONFIG = {
    PAGE_SIZES: {
        A4: [210, 297],
        A3: [297, 420]
    },
    DEFAULT_CENTER: [49.817, 15.473],
    DEFAULT_ZOOM: 14,
    DEFAULT_SCALE: 2000,
    WMS_ORTOFOTO_URL: 'https://ags.cuzk.cz/arcgis1/services/ORTOFOTO_WM/MapServer/WMSServer',
    WMS_KN_URL: 'https://services.cuzk.cz/wms/local-km-wms.asp'
};

// S-JTSK / Křovák coordinate reference system (EPSG:5514)
if (typeof proj4 !== 'undefined') {
    proj4.defs(
        'EPSG:5514',
        '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=570.8,85.7,462.8,4.998,1.587,5.261,3.56 +units=m +no_defs'
    );
}

// Global Application State
MapApp.state = {
    map: null,
    ortoLayer: null,
    knInverseLayer: null,
    geojsonLayer: null,
    outlineLayer: null,
    labelMarkersGroup: null,
    isLocked: false,
    isLabelEditMode: false,
    importedGeoJSON: null,
    categoryColors: {},
    manualItems: [
        { text: 'Dopravní infrastruktura', geom: 'header', color: '', svg: '' },
        { text: 'Hlavní komunikace', geom: 'line', color: '#ea521f', svg: '' },
        { text: 'Bod zájmu', geom: 'point', color: '#0284c7', svg: '' },
        { text: 'Plocha zeleně', geom: 'polygon', color: '#16a34a', svg: '' }
    ]
};

// Shared utility: HTML-escape user-supplied text
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
