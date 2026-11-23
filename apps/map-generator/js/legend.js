/**
 * Map Generator - Legend Manager (Auto & Manual Legend)
 */

window.MapApp = window.MapApp || {};

MapApp.legend = {
    toggleLegendMode() {
        const modeSelect = document.getElementById('legendMode');
        const manualSection = document.getElementById('secManualLegend');
        if (manualSection && modeSelect) {
            manualSection.style.display = modeSelect.value === 'manual' ? 'block' : 'none';
        }
    },

    renderManualInputs() {
        const { state } = MapApp;
        const container = document.getElementById('manualLegendItems');
        if (!container) return;

        container.innerHTML = '';

        state.manualItems.forEach((item, index) => {
            const isHeader = item.geom === 'header';
            const card = document.createElement('div');
            card.className = 'manual-item-card' + (isHeader ? ' is-header' : '');

            // Top row: Text input + Actions (Move Up, Move Down, Delete)
            const rowTop = document.createElement('div');
            rowTop.className = 'manual-item-row';

            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.value = item.text;
            textInput.placeholder = isHeader ? 'Text podnadpisu (např. Komunikace)' : 'Název položky';
            textInput.style.fontWeight = isHeader ? '600' : 'normal';
            textInput.addEventListener('input', (e) => {
                state.manualItems[index].text = e.target.value;
                MapApp.ui.updateDecorations();
            });

            // Reorder & Delete button group
            const btnGroup = document.createElement('div');
            btnGroup.style.display = 'inline-flex';
            btnGroup.style.gap = '2px';

            if (index > 0) {
                const upBtn = document.createElement('button');
                upBtn.type = 'button';
                upBtn.className = 'outline mini-btn';
                upBtn.textContent = '▲';
                upBtn.title = 'Posunout nahoru';
                upBtn.addEventListener('click', () => this.moveItem(index, -1));
                btnGroup.appendChild(upBtn);
            }

            if (index < state.manualItems.length - 1) {
                const downBtn = document.createElement('button');
                downBtn.type = 'button';
                downBtn.className = 'outline mini-btn';
                downBtn.textContent = '▼';
                downBtn.title = 'Posunout dolů';
                downBtn.addEventListener('click', () => this.moveItem(index, 1));
                btnGroup.appendChild(downBtn);
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'outline mini-btn';
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Odstranit';
            deleteBtn.addEventListener('click', () => {
                this.removeItem(index);
            });
            btnGroup.appendChild(deleteBtn);

            rowTop.appendChild(textInput);
            rowTop.appendChild(btnGroup);
            card.appendChild(rowTop);

            // Bottom row: Geometry / Type Selector (+ Color if not header/svg)
            const rowBottom = document.createElement('div');
            rowBottom.className = 'manual-item-row';

            const geomSelect = document.createElement('select');
            geomSelect.style.flex = '1';
            const geomOptions = [
                { value: 'header', text: '── Podnadpis (sekce) ──' },
                { value: 'point', text: 'Bod (Kruh)' },
                { value: 'line', text: 'Linie' },
                { value: 'polygon', text: 'Polygon' },
                { value: 'svg', text: 'Vlastní SVG' }
            ];
            geomOptions.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt.value;
                optionEl.textContent = opt.text;
                if (item.geom === opt.value) optionEl.selected = true;
                geomSelect.appendChild(optionEl);
            });
            geomSelect.addEventListener('change', (e) => {
                state.manualItems[index].geom = e.target.value;
                if (e.target.value !== 'header' && !state.manualItems[index].color) {
                    state.manualItems[index].color = '#0288D1';
                }
                this.renderManualInputs();
                MapApp.ui.updateDecorations();
            });
            rowBottom.appendChild(geomSelect);

            if (!isHeader && item.geom !== 'svg') {
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = item.color || '#000000';
                colorInput.style.width = '42px';
                colorInput.style.height = '30px';
                colorInput.addEventListener('change', (e) => {
                    state.manualItems[index].color = e.target.value;
                    MapApp.ui.updateDecorations();
                });
                rowBottom.appendChild(colorInput);
            }

            card.appendChild(rowBottom);

            if (!isHeader && item.geom === 'svg') {
                const rowSvg = document.createElement('div');
                rowSvg.className = 'manual-item-row';

                const svgInput = document.createElement('input');
                svgInput.type = 'text';
                svgInput.value = item.svg || '';
                svgInput.placeholder = '<svg>...</svg>';
                svgInput.addEventListener('input', (e) => {
                    state.manualItems[index].svg = e.target.value;
                    MapApp.ui.updateDecorations();
                });

                rowSvg.appendChild(svgInput);
                card.appendChild(rowSvg);
            }

            container.appendChild(card);
        });
    },

    addItem() {
        const { state } = MapApp;
        state.manualItems.push({
            text: 'Nová položka',
            geom: 'line',
            color: '#0288D1',
            svg: ''
        });
        this.renderManualInputs();
        MapApp.ui.updateDecorations();
    },

    addHeader() {
        const { state } = MapApp;
        state.manualItems.push({
            text: 'Nový podnadpis',
            geom: 'header',
            color: '',
            svg: ''
        });
        this.renderManualInputs();
        MapApp.ui.updateDecorations();
    },

    moveItem(index, direction) {
        const { state } = MapApp;
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= state.manualItems.length) return;
        const temp = state.manualItems[index];
        state.manualItems[index] = state.manualItems[targetIndex];
        state.manualItems[targetIndex] = temp;
        this.renderManualInputs();
        MapApp.ui.updateDecorations();
    },

    removeItem(index) {
        const { state } = MapApp;
        state.manualItems.splice(index, 1);
        this.renderManualInputs();
        MapApp.ui.updateDecorations();
    },

    renderLegendContent(container) {
        const { state, ui } = MapApp;
        const legendMode = ui.val('legendMode');

        if (legendMode === 'manual') {
            state.manualItems.forEach(item => {
                if (item.geom === 'header') {
                    const headerEl = document.createElement('div');
                    headerEl.className = 'legend-header-item';
                    headerEl.textContent = item.text;
                    container.appendChild(headerEl);
                    return;
                }

                let symHtml = '';
                if (item.geom === 'point') {
                    symHtml = `<svg width="20" height="14"><circle cx="10" cy="7" r="5" fill="${item.color}" stroke="#000" stroke-width="1"/></svg>`;
                } else if (item.geom === 'line') {
                    symHtml = `<svg width="20" height="14"><line x1="1" y1="7" x2="19" y2="7" stroke="${item.color}" stroke-width="3"/></svg>`;
                } else if (item.geom === 'polygon') {
                    symHtml = `<svg width="20" height="14"><rect x="2" y="2" width="16" height="10" fill="${item.color}" stroke="#000" stroke-width="1"/></svg>`;
                } else if (item.geom === 'svg') {
                    symHtml = `<div style="width:20px; height:14px; display:flex; align-items:center; justify-content:center;">${item.svg || ''}</div>`;
                }

                const row = document.createElement('div');
                row.className = 'legend-item';
                row.innerHTML = `<div class="legend-sym-box">${symHtml}</div><span>${escapeHtml(item.text)}</span>`;
                container.appendChild(row);
            });
        } else {
            const categoryField = ui.val('categoryField');
            const hasCategories = categoryField && Object.keys(state.categoryColors).length > 0;
            const geomType = state.detectedGeomType || 'polygon';

            if (hasCategories) {
                Object.keys(state.categoryColors).forEach(catVal => {
                    const col = state.categoryColors[catVal];
                    let symSvg = `<svg width="20" height="14"><rect x="1" y="1" width="18" height="12" fill="${col}" stroke="#000" stroke-width="1"/></svg>`;
                    if (geomType === 'line') {
                        symSvg = `<svg width="20" height="14"><line x1="1" y1="7" x2="19" y2="7" stroke="${col}" stroke-width="3"/></svg>`;
                    } else if (geomType === 'point') {
                        symSvg = `<svg width="20" height="14"><circle cx="10" cy="7" r="5" fill="${col}" stroke="#000" stroke-width="1"/></svg>`;
                    }

                    const row = document.createElement('div');
                    row.className = 'legend-item';
                    row.innerHTML = `<div class="legend-sym-box">${symSvg}</div><span>${escapeHtml(catVal)}</span>`;
                    container.appendChild(row);
                });
            } else {
                const fillCol = ui.val('symFillColor');
                const strokeCol = ui.val('symStrokeColor');
                let symSvg = `<svg width="20" height="14"><rect x="1" y="1" width="18" height="12" fill="${fillCol}" stroke="${strokeCol}" stroke-width="1"/></svg>`;
                
                if (geomType === 'line') {
                    symSvg = `<svg width="20" height="14"><line x1="1" y1="7" x2="19" y2="7" stroke="${fillCol}" stroke-width="3"/></svg>`;
                } else if (geomType === 'point' || (ui.val('pointType') === 'vector' && ui.val('symShape') === 'circle')) {
                    symSvg = `<svg width="18" height="18"><circle cx="9" cy="9" r="6" fill="${fillCol}" stroke="${strokeCol}" stroke-width="1.5"/></svg>`;
                }

                const row = document.createElement('div');
                row.className = 'legend-item';
                row.innerHTML = `<div class="legend-sym-box">${symSvg}</div><span>Objekty pasportu</span>`;
                container.appendChild(row);
            }
        }
    }
};
