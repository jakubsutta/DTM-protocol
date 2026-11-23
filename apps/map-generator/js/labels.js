/**
 * Map Generator - Labels Manager (Draggable & Rotatable Labels)
 */

window.MapApp = window.MapApp || {};

MapApp.labels = {
    toggleLabelEditMode() {
        const { state } = MapApp;
        state.isLabelEditMode = !state.isLabelEditMode;

        const btn = document.getElementById('btnToggleLabelEdit');
        const mapEl = document.getElementById('map');

        if (state.isLabelEditMode) {
            btn?.classList.add('active-toggle');
            if (btn) btn.textContent = 'Vypnout režim posunu popisků';
            mapEl?.classList.add('edit-mode-active');
        } else {
            btn?.classList.remove('active-toggle');
            if (btn) btn.textContent = 'Zapnout režim posunu/otáčení popisků';
            mapEl?.classList.remove('edit-mode-active');

            // Safety check: ensure map dragging is enabled
            if (state.map && state.map.dragging) {
                state.map.dragging.enable();
            }
        }

        // Re-check and bind any un-bound label markers
        if (state.labelMarkersGroup) {
            state.labelMarkersGroup.eachLayer(marker => {
                const el = marker.getElement();
                if (el) this._bindMarkerDrag(marker, el);
            });
        }
    },

    _bindMarkerDrag(labelMarker, el) {
        const { state } = MapApp;
        if (!el || el._dragBound) return;
        el._dragBound = true;

        // Prevent standard Leaflet click/scroll propagation on the marker
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);

        el.addEventListener('mousedown', (e) => {
            if (!state.isLabelEditMode) return;

            // Stop event from bubbling to map container so Leaflet does not pan the map
            L.DomEvent.stop(e);
            e.stopPropagation();
            e.preventDefault();

            // Temporarily disable map panning during label movement
            if (state.map && state.map.dragging) {
                state.map.dragging.disable();
            }

            const labelDiv = el.querySelector('.draggable-label') || el;
            const isRotating = !!e.shiftKey;
            const isDragging = !isRotating;

            let startX = e.clientX;
            let startY = e.clientY;
            let startAngle = parseFloat(labelDiv?.getAttribute('data-angle')) || 0;

            const onMouseMove = (moveEvent) => {
                L.DomEvent.stop(moveEvent);
                const zoomScale = MapApp.canvasZoom ? (MapApp.canvasZoom._scale || 1) : 1;

                if (isDragging) {
                    const currentPos = state.map.latLngToLayerPoint(labelMarker.getLatLng());
                    const newPoint = L.point(
                        currentPos.x + (moveEvent.clientX - startX) / zoomScale,
                        currentPos.y + (moveEvent.clientY - startY) / zoomScale
                    );
                    labelMarker.setLatLng(state.map.layerPointToLatLng(newPoint));
                    startX = moveEvent.clientX;
                    startY = moveEvent.clientY;
                } else if (isRotating && labelDiv) {
                    const newAngle = startAngle + (moveEvent.clientX - startX) / zoomScale;
                    labelDiv.style.transform = `rotate(${newAngle}deg)`;
                    labelDiv.setAttribute('data-angle', newAngle);
                }
            };

            const onMouseUp = (upEvent) => {
                if (upEvent) L.DomEvent.stop(upEvent);
                window.removeEventListener('mousemove', onMouseMove, true);
                window.removeEventListener('mouseup', onMouseUp, true);

                // Re-enable map dragging
                setTimeout(() => {
                    if (state.map && state.map.dragging) {
                        state.map.dragging.enable();
                    }
                }, 50);
            };

            window.addEventListener('mousemove', onMouseMove, true);
            window.addEventListener('mouseup', onMouseUp, true);
        });
    },

    updateLabelStyles() {
        const { ui } = MapApp;
        const fontSize = ui.num('labelFontSize') || 11;
        const fontColor = ui.val('labelFontColor') || '#000000';
        document.querySelectorAll('.draggable-label').forEach(el => {
            el.style.fontSize = fontSize + 'px';
            el.style.color = fontColor;
        });
    },

    attachLabel(layer, text) {
        const { state, ui } = MapApp;
        if (!state.map || !state.labelMarkersGroup) return;

        const labelCenter = layer.getBounds ? layer.getBounds().getCenter() : (layer.getLatLng ? layer.getLatLng() : null);
        if (!labelCenter) return;

        const fontSize = ui.num('labelFontSize') || 11;
        const fontColor = ui.val('labelFontColor') || '#000000';

        const labelIcon = L.divIcon({
            className: 'map-label-container',
            html: `<div class="draggable-label" data-angle="0" style="font-size: ${fontSize}px; color: ${fontColor};">${escapeHtml(String(text))}</div>`,
            iconAnchor: [10, 10]
        });

        const labelMarker = L.marker(labelCenter, {
            icon: labelIcon,
            zIndexOffset: 1000
        });

        state.labelMarkersGroup.addLayer(labelMarker);

        // Bind drag listeners immediately if element is already available, or wait for add
        const el = labelMarker.getElement();
        if (el) {
            this._bindMarkerDrag(labelMarker, el);
        } else {
            labelMarker.on('add', () => {
                const addedEl = labelMarker.getElement();
                if (addedEl) this._bindMarkerDrag(labelMarker, addedEl);
            });
        }
    }
};
