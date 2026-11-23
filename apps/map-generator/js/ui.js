/**
 * Map Generator - UI Controller (Tabs, Page Layout, Frame Snapping & Dragging)
 */

window.MapApp = window.MapApp || {};

MapApp.ui = {
    val(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    },

    num(id) {
        return parseFloat(this.val(id)) || 0;
    },

    switchTab(tabId, btnElement) {
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

        const targetPane = document.getElementById(tabId);
        if (targetPane) targetPane.classList.add('active');
        if (btnElement) btnElement.classList.add('active');
    },

    updatePageSize() {
        const { state, CONFIG } = MapApp;
        const format = this.val('pageFormat') || 'A4';
        const orient = this.val('pageOrient') || 'landscape';

        let [w, h] = CONFIG.PAGE_SIZES[format] || [210, 297];
        if (orient === 'landscape') [w, h] = [h, w];

        const page = document.getElementById('page');
        if (page) {
            page.style.width = w + 'mm';
            page.style.height = h + 'mm';
        }

        const mt = this.num('mT'), mr = this.num('mR'), mb = this.num('mB'), ml = this.num('mL');
        const guide = document.getElementById('marginGuide');
        if (guide) {
            guide.style.top = mt + 'mm';
            guide.style.left = ml + 'mm';
            guide.style.width = Math.max(0, w - ml - mr) + 'mm';
            guide.style.height = Math.max(0, h - mt - mb) + 'mm';
        }

        // Dynamically configure print page size rule
        let printStyle = document.getElementById('dynamicPrintStyle');
        if (!printStyle) {
            printStyle = document.createElement('style');
            printStyle.id = 'dynamicPrintStyle';
            document.head.appendChild(printStyle);
        }
        printStyle.textContent = `@page { size: ${format} ${orient}; margin: 0; }`;

        this.updateDecorations();

        if (state.map) {
            setTimeout(() => state.map.invalidateSize(), 100);
        }
    },

    toggleLockFrame() {
        const { state } = MapApp;
        state.isLocked = !state.isLocked;

        const frame = document.getElementById('mapFrame');
        const btn = document.getElementById('lockFrameBtn');

        if (state.isLocked) {
            frame?.classList.add('locked');
            btn?.classList.add('locked');
            if (btn) btn.textContent = 'Rám je UZAMČEN (Kliknutím odemknete)';
        } else {
            frame?.classList.remove('locked');
            btn?.classList.remove('locked');
            if (btn) btn.textContent = 'Rám je volný (Kliknutím uzamknete)';
        }
    },

    toggleSymbolMode() {
        const mode = this.val('pointType');
        const secVector = document.getElementById('secVectorSym');
        const secIcon = document.getElementById('secIconSym');
        const secIconUrl = document.getElementById('secIconUrl');
        const secSvgCode = document.getElementById('secSvgCode');

        if (secVector) secVector.style.display = mode === 'vector' ? 'block' : 'none';
        if (secIcon) secIcon.style.display = mode !== 'vector' ? 'block' : 'none';
        if (secIconUrl) secIconUrl.style.display = mode === 'iconUrl' ? 'block' : 'none';
        if (secSvgCode) secSvgCode.style.display = mode === 'svgCode' ? 'block' : 'none';
    },

    updateDecorations() {
        const titleEl = document.getElementById('outTitle');
        const subtitleEl = document.getElementById('outSubtitle');
        const mapNumEl = document.getElementById('outMapNum');
        const imprintEl = document.getElementById('outImprint');
        const legendWrapper = document.getElementById('mapLegend');
        const legendTitleEl = document.getElementById('outLegendTitle');
        const legendContent = document.getElementById('outLegendContent');
        const showLegendChk = document.getElementById('showLegend');

        if (titleEl) titleEl.textContent = this.val('inpTitle');
        if (subtitleEl) subtitleEl.textContent = this.val('inpSubtitle');
        if (mapNumEl) mapNumEl.textContent = this.val('inpMapNum');

        if (imprintEl) {
            const author = this.val('impAuthor');
            const contributors = this.val('impContributors');
            const date = this.val('impDate');
            const source = this.val('impSource');
            const note = this.val('impNote');

            const parts = [];
            if (author) parts.push(`<div><strong>Pořizovatel:</strong> ${escapeHtml(author)}</div>`);
            if (contributors) parts.push(`<div><strong>Přispěvatelé:</strong> ${escapeHtml(contributors)}</div>`);

            const meta = [];
            if (date) meta.push(`<strong>Datum:</strong> ${escapeHtml(date)}`);
            if (source) meta.push(`<strong>Zdroj dat:</strong> ${escapeHtml(source)}`);
            if (meta.length > 0) parts.push(`<div>${meta.join(' | ')}</div>`);

            if (note) parts.push(`<div>${escapeHtml(note)}</div>`);

            imprintEl.innerHTML = parts.join('');
        }

        if (legendWrapper) {
            legendWrapper.style.display = (showLegendChk && showLegendChk.checked) ? 'block' : 'none';
        }

        if (legendTitleEl) {
            legendTitleEl.textContent = this.val('inpLegendTitle') || 'LEGENDA';
        }

        if (legendContent) {
            legendContent.innerHTML = '';
            MapApp.legend.renderLegendContent(legendContent);
        }

        MapApp.mapService.updateScaleBar(this.num('scaleInput'));
    },

    initInteractions() {
        const { state } = MapApp;
        const frame = document.getElementById('mapFrame');
        const page = document.getElementById('page');
        if (!frame || !page) return;

        let mode = null;
        let targetEl = null;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;
        let startW = 0, startH = 0;

        const getMpp = () => {
            const pageWmm = parseFloat(page.style.width) || 297;
            const pageBcr = page.getBoundingClientRect();
            return pageBcr.width > 0 ? pageWmm / pageBcr.width : 0.264583;
        };

        const moveHandle = document.getElementById('moveHandle');
        if (moveHandle) {
            moveHandle.addEventListener('mousedown', (e) => {
                if (state.isLocked) return;
                mode = 'frame_move';
                targetEl = frame;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = parseFloat(frame.style.left) || 0;
                startTop = parseFloat(frame.style.top) || 0;
                e.stopPropagation();
                e.preventDefault();
            });
        }

        const resizeHandle = document.getElementById('resizeHandle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                if (state.isLocked) return;
                mode = 'frame_resize';
                targetEl = frame;
                startX = e.clientX;
                startY = e.clientY;
                startW = parseFloat(frame.style.width) || 0;
                startH = parseFloat(frame.style.height) || 0;
                e.stopPropagation();
                e.preventDefault();
            });
        }

        document.querySelectorAll('.map-elem').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                mode = 'elem_move';
                targetEl = el;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = parseFloat(el.style.left) || el.offsetLeft;
                startTop = parseFloat(el.style.top) || el.offsetTop;
                el.style.right = 'auto';
                el.style.bottom = 'auto';
                el.style.left = startLeft + 'px';
                el.style.top = startTop + 'px';
                e.stopPropagation();
                e.preventDefault();
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!mode) return;
            const mpp = getMpp();
            const dx = (e.clientX - startX) * mpp;
            const dy = (e.clientY - startY) * mpp;
            const snapEnabled = document.getElementById('snapToGuides')?.checked;

            const mt = this.num('mT');
            const mr = this.num('mR');
            const mb = this.num('mB');
            const ml = this.num('mL');

            const pageW = parseFloat(page.style.width) || 297;
            const pageH = parseFloat(page.style.height) || 210;

            if (mode === 'frame_move') {
                let newL = startLeft + dx;
                let newT = startTop + dy;
                const frameW = parseFloat(frame.style.width) || 0;
                const frameH = parseFloat(frame.style.height) || 0;

                if (snapEnabled) {
                    if (Math.abs(newL - ml) < 5) newL = ml;
                    if (Math.abs(newT - mt) < 5) newT = mt;
                    if (Math.abs((newL + frameW) - (pageW - mr)) < 5) newL = pageW - mr - frameW;
                    if (Math.abs((newT + frameH) - (pageH - mb)) < 5) newT = pageH - mb - frameH;
                }

                frame.style.left = newL + 'mm';
                frame.style.top = newT + 'mm';
            } else if (mode === 'frame_resize') {
                let newW = Math.max(50, startW + dx);
                let newH = Math.max(50, startH + dy);
                const frameLeft = parseFloat(frame.style.left) || 0;
                const frameTop = parseFloat(frame.style.top) || 0;

                if (snapEnabled) {
                    if (Math.abs((frameLeft + newW) - (pageW - mr)) < 5) newW = pageW - mr - frameLeft;
                    if (Math.abs((frameTop + newH) - (pageH - mb)) < 5) newH = pageH - mb - frameTop;
                }

                frame.style.width = newW + 'mm';
                frame.style.height = newH + 'mm';

                if (state.map) state.map.invalidateSize();
            } else if (mode === 'elem_move' && targetEl) {
                const zoomScale = MapApp.canvasZoom ? (MapApp.canvasZoom._scale || 1) : 1;
                targetEl.style.left = (startLeft + (e.clientX - startX) / zoomScale) + 'px';
                targetEl.style.top = (startTop + (e.clientY - startY) / zoomScale) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            mode = null;
        });
    }
};
