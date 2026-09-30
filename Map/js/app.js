/**
 * Map Generator - Main Application Bootstrap & Event Listeners
 */

window.MapApp = window.MapApp || {};

MapApp.init = function () {
    // 1. Initialize Page layout and margins
    MapApp.ui.updatePageSize();

    // 2. Initialize Leaflet Map
    MapApp.mapService.initMap();

    // 3. Initialize Interactive Handles
    MapApp.ui.initInteractions();

    // 4. Initialize Legend
    MapApp.legend.renderManualInputs();
    MapApp.ui.toggleSymbolMode();
    MapApp.legend.toggleLegendMode();

    // 5. Wire DOM Event Listeners
    MapApp.wireEvents();

    // 6. Fit canvas to viewport
    setTimeout(() => {
        MapApp.canvasZoom?.fitToView();
    }, 200);
};

MapApp.wireEvents = function () {
    const bind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');
            if (tabId) MapApp.ui.switchTab(tabId, this);
        });
    });

    // Map & WMS
    bind('chkOrto', 'change', () => MapApp.mapService.toggleWmsLayers());
    bind('chkKnInverse', 'change', () => MapApp.mapService.toggleWmsLayers());

    // Page Settings
    bind('pageFormat', 'change', () => {
        MapApp.ui.updatePageSize();
        MapApp.canvasZoom?.fitToView();
    });
    bind('pageOrient', 'change', () => {
        MapApp.ui.updatePageSize();
        MapApp.canvasZoom?.fitToView();
    });
    bind('mT', 'change', () => MapApp.ui.updatePageSize());
    bind('mR', 'change', () => MapApp.ui.updatePageSize());
    bind('mB', 'change', () => MapApp.ui.updatePageSize());
    bind('mL', 'change', () => MapApp.ui.updatePageSize());
    bind('lockFrameBtn', 'click', () => MapApp.ui.toggleLockFrame());

    // Scale
    bind('scaleInput', 'change', () => MapApp.mapService.onManualScaleChange());
    bind('scaleInput', 'input', () => MapApp.mapService.onManualScaleChange());

    // Titles & Imprint
    ['inpTitle', 'inpSubtitle', 'inpMapNum', 'impAuthor', 'impContributors', 'impDate', 'impSource', 'impNote'].forEach(id => {
        bind(id, 'input', () => MapApp.ui.updateDecorations());
    });

    // Data / SHP
    bind('btnLoadShp', 'click', () => MapApp.data.loadShp());
    bind('categoryField', 'change', () => MapApp.data.onCategoryFieldChange());
    bind('btnRandomizeColors', 'click', () => MapApp.data.randomizeCategoryColors());

    // Symbology
    bind('pointType', 'change', () => {
        MapApp.ui.toggleSymbolMode();
        MapApp.data.updateVectorStyle();
    });

    ['symFillColor', 'symStrokeColor', 'symShape', 'symSize', 'symStrokeWidth'].forEach(id => {
        bind(id, 'change', () => MapApp.data.updateVectorStyle());
    });

    ['lineOutlineEnable', 'lineOutlineColor', 'lineOutlineWidth'].forEach(id => {
        bind(id, 'change', () => MapApp.data.updateVectorStyle());
    });

    ['iconUrl', 'svgCodeText'].forEach(id => {
        bind(id, 'input', () => MapApp.data.updateVectorStyle());
    });

    ['iconSize', 'iconAngle'].forEach(id => {
        bind(id, 'change', () => MapApp.data.updateVectorStyle());
    });

    // Labels
    bind('labelField', 'change', () => MapApp.data.updateVectorStyle());
    bind('labelFontSize', 'input', () => MapApp.labels.updateLabelStyles());
    bind('labelFontColor', 'input', () => MapApp.labels.updateLabelStyles());
    bind('btnToggleLabelEdit', 'click', () => MapApp.labels.toggleLabelEditMode());

    // Legend
    bind('showLegend', 'change', () => MapApp.ui.updateDecorations());
    bind('inpLegendTitle', 'input', () => MapApp.ui.updateDecorations());
    bind('legendMode', 'change', () => {
        MapApp.legend.toggleLegendMode();
        MapApp.ui.updateDecorations();
    });
    bind('btnAddManualLegend', 'click', () => MapApp.legend.addItem());
    bind('btnAddManualHeader', 'click', () => MapApp.legend.addHeader());

    // Export PDF
    bind('btnPrintPdf', 'click', () => window.print());

    // Canvas Zoom
    bind('btnZoomIn', 'click', () => MapApp.canvasZoom.zoomIn());
    bind('btnZoomOut', 'click', () => MapApp.canvasZoom.zoomOut());
    bind('btnZoomReset', 'click', () => MapApp.canvasZoom.fitToView());

    // Ctrl + Scroll Wheel on canvas area
    const canvasArea = document.getElementById('canvasArea');
    if (canvasArea) {
        canvasArea.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                if (e.deltaY < 0) MapApp.canvasZoom.zoomIn();
                else MapApp.canvasZoom.zoomOut();
            }
        }, { passive: false });
    }
};

// ---- Canvas Zoom Controller ----
MapApp.canvasZoom = {
    _scale: 1,
    _STEP: 0.1,
    _MIN: 0.3,
    _MAX: 1.5,

    _apply() {
        const scaler = document.getElementById('pageScaler');
        const label = document.getElementById('zoomLevelLabel');
        if (scaler) scaler.style.transform = `scale(${this._scale})`;
        if (label) label.textContent = Math.round(this._scale * 100) + '%';
        // After scale change, let Leaflet know the container size changed
        if (MapApp.state.map) {
            setTimeout(() => MapApp.state.map.invalidateSize(), 160);
        }
    },

    zoomIn() {
        this._scale = Math.min(this._MAX, Math.round((this._scale + this._STEP) * 100) / 100);
        this._apply();
    },

    zoomOut() {
        this._scale = Math.max(this._MIN, Math.round((this._scale - this._STEP) * 100) / 100);
        this._apply();
    },

    fitToView() {
        const canvasArea = document.getElementById('canvasArea');
        const page = document.getElementById('page');
        if (!canvasArea || !page) { this._scale = 1; this._apply(); return; }

        // Temporarily reset scale to measure natural page size
        const scaler = document.getElementById('pageScaler');
        if (scaler) scaler.style.transform = 'scale(1)';

        requestAnimationFrame(() => {
            const canvasRect = canvasArea.getBoundingClientRect();
            const pageRect = page.getBoundingClientRect();
            const availW = canvasRect.width - 60; // padding
            const availH = canvasRect.height - 60;
            const fitScale = Math.min(availW / pageRect.width, availH / pageRect.height, 1);
            this._scale = Math.max(this._MIN, Math.round(fitScale * 100) / 100);
            this._apply();
        });
    }
};

// Global Bridge Functions for backwards-compatibility
window.switchTab = (tabId, btn) => MapApp.ui.switchTab(tabId, btn);
window.updatePageSize = () => MapApp.ui.updatePageSize();
window.toggleWmsLayers = () => MapApp.mapService.toggleWmsLayers();
window.toggleLockFrame = () => MapApp.ui.toggleLockFrame();
window.onManualScaleChange = () => MapApp.mapService.onManualScaleChange();
window.updateDecorations = () => MapApp.ui.updateDecorations();
window.loadShp = () => MapApp.data.loadShp();
window.updateVectorStyle = () => MapApp.data.updateVectorStyle();
window.toggleSymbolMode = () => MapApp.ui.toggleSymbolMode();
window.toggleLabelEditMode = () => MapApp.labels.toggleLabelEditMode();
window.toggleLegendMode = () => MapApp.legend.toggleLegendMode();
window.addManualLegendItem = () => MapApp.legend.addItem();
window.addManualLegendHeader = () => MapApp.legend.addHeader();
window.removeManualLegendItem = (index) => MapApp.legend.removeItem(index);

// Auto-bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    MapApp.init();
});
