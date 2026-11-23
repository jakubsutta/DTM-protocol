/**
 * Export pasportu do Wordu (.docx).
 *
 * Převádí vykreslený náhled (.preview-panel .page) na dokument Word pomocí knihovny docx
 * (assets/vendor/docx, načte se až při prvním exportu). Styl textu (tučné, kurzíva, barva,
 * velikost, zarovnání) se bere z computed style prohlížeče, svislé mezery z vykreslených pozic.
 * Tabulky → tabulky Wordu, bloky vedle sebe (flex) → tabulky bez okrajů, obrázky → PNG,
 * mapa Leaflet → snímek složený z dlaždic ČÚZK + hranice obce. Každá stránka náhledu = nová strana.
 *
 * Vyžaduje core.js.
 */
(function () {
    'use strict';

    var C = window.PasportCore;
    var LIB_URL = C.scriptBase + '../../vendor/docx/docx.iife.js';
    var PX = 15;            // 1 CSS px = 15 twipů (96 dpi)
    var IMG_SCALE = 2;      // rasterizace obrázků ve 2× rozlišení

    var libPromise = null;
    function loadLib() {
        if (window.docx) return Promise.resolve(window.docx);
        if (!libPromise) {
            libPromise = new Promise(function (resolve, reject) {
                var s = document.createElement('script');
                s.src = LIB_URL;
                s.onload = function () { window.docx ? resolve(window.docx) : reject(new Error('Knihovna docx se nenačetla')); };
                s.onerror = function () { libPromise = null; reject(new Error('Nepodařilo se načíst knihovnu docx')); };
                document.head.appendChild(s);
            });
        }
        return libPromise;
    }

    // ---------- POMOCNÉ ----------
    function hex(color) {
        var m = String(color || '').match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
        var a = p.length > 3 ? p[3] : 1;
        if (a === 0) return null;
        var mix = function (c) { return Math.round(c * a + 255 * (1 - a)); };
        return [mix(p[0]), mix(p[1]), mix(p[2])].map(function (c) { return c.toString(16).padStart(2, '0'); }).join('').toUpperCase();
    }
    function px(v) { return parseFloat(v) || 0; }
    function fontName(cs) {
        var f = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
        if (!f || /^(system-ui|-apple-system|BlinkMacSystemFont|sans-serif|serif|ui-sans-serif|monospace)$/i.test(f)) return 'Arial';
        return f;
    }
    function hidden(el, cs) {
        return cs.display === 'none' || cs.visibility === 'hidden' || px(cs.opacity) === 0 && cs.opacity !== '';
    }
    var SKIP = '.page-footer, .logo-placeholder, .leaflet-control-container, .sort-icon, .pp-toast, script, style';
    var BLOCK_DISPLAY = /^(block|flex|grid|table|list-item|flow-root|table-row-group|table-header-group|table-footer-group)$/;
    function isBlock(el, cs) {
        cs = cs || getComputedStyle(el);
        if (el.tagName === 'TABLE' || el.tagName === 'UL' || el.tagName === 'OL' || el.tagName === 'HR') return true;
        if (el.classList.contains('leaflet-container')) return true;
        return BLOCK_DISPLAY.test(cs.display);
    }
    function hasBlockChild(el) {
        for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
            if (c.matches(SKIP)) continue;
            var cs = getComputedStyle(c);
            if (hidden(c, cs)) continue;
            if (isBlock(c, cs) || hasBlockChild(c)) return true;
        }
        return false;
    }
    function border(cs, side) {
        var w = px(cs['border' + side + 'Width']);
        var st = cs['border' + side + 'Style'];
        var col = hex(cs['border' + side + 'Color']);
        if (!w || st === 'none' || st === 'hidden' || !col) return null;
        return { style: st === 'dashed' ? 'dashed' : (st === 'dotted' ? 'dotted' : (st === 'double' ? 'double' : 'single')),
                 size: Math.max(2, Math.round(w * 6)), color: col };
    }

    // ---------- OBRÁZKY ----------
    var jobs = [];
    function loadImage(src, cors) {
        return new Promise(function (resolve, reject) {
            var im = new Image();
            if (cors) im.crossOrigin = 'anonymous';
            im.onload = function () { resolve(im); };
            im.onerror = function () { reject(new Error('obrázek nelze načíst: ' + src.slice(0, 80))); };
            im.src = src;
        });
    }
    function canvasToBytes(cv) {
        return new Promise(function (resolve, reject) {
            cv.toBlob(function (b) {
                if (!b) { reject(new Error('canvas')); return; }
                b.arrayBuffer().then(function (ab) { resolve(new Uint8Array(ab)); }, reject);
            }, 'image/png');
        });
    }
    // Obrázek → PNG v cílové velikosti (respektuje object-fit: contain).
    function imageRun(img) {
        var r = img.getBoundingClientRect();
        var cs = getComputedStyle(img);
        var run = { image: true, width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)), data: null };
        var src = img.currentSrc || img.src;
        jobs.push(loadImage(src, !/^data:|^blob:/.test(src) && new URL(src, location.href).origin !== location.origin)
            .catch(function () { return loadImage(src, false); })
            .then(function (im) {
                var nw = im.naturalWidth || run.width, nh = im.naturalHeight || run.height;
                if (cs.objectFit === 'contain' || cs.objectFit === 'scale-down') {
                    var k = Math.min(run.width / nw, run.height / nh);
                    if (cs.objectFit === 'scale-down') k = Math.min(k, 1);
                    run.width = Math.max(1, Math.round(nw * k));
                    run.height = Math.max(1, Math.round(nh * k));
                }
                var cv = document.createElement('canvas');
                cv.width = run.width * IMG_SCALE;
                cv.height = run.height * IMG_SCALE;
                cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
                return canvasToBytes(cv);
            })
            .then(function (bytes) { run.data = bytes; })
            .catch(function (e) { console.warn('DOCX: obrázek vynechán', e); }));
        return run;
    }
    function svgRun(svg) {
        var r = svg.getBoundingClientRect();
        var run = { image: true, width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)), data: null };
        var clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', run.width);
        clone.setAttribute('height', run.height);
        var color = getComputedStyle(svg).color;
        var xml = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, color);
        var src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
        jobs.push(loadImage(src, false).then(function (im) {
            var cv = document.createElement('canvas');
            cv.width = run.width * IMG_SCALE; cv.height = run.height * IMG_SCALE;
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            return canvasToBytes(cv);
        }).then(function (b) { run.data = b; }).catch(function (e) { console.warn('DOCX: SVG vynecháno', e); }));
        return run;
    }
    // Snímek mapy: dlaždice znovu stažené s CORS + hranice obce.
    function mapRun(el) {
        var r = el.getBoundingClientRect();
        var run = { image: true, width: Math.round(r.width), height: Math.round(r.height), data: null };
        var cv = document.createElement('canvas');
        cv.width = run.width * IMG_SCALE; cv.height = run.height * IMG_SCALE;
        var ctx = cv.getContext('2d');
        ctx.scale(IMG_SCALE, IMG_SCALE);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, run.width, run.height);
        var tiles = Array.prototype.slice.call(el.querySelectorAll('img.leaflet-tile'));
        var tileJobs = tiles.map(function (t) {
            var tr = t.getBoundingClientRect();
            if (tr.right < r.left || tr.left > r.right || tr.bottom < r.top || tr.top > r.bottom) return Promise.resolve();
            var layer = t.closest('.leaflet-layer');
            var alpha = layer ? px(getComputedStyle(layer).opacity || 1) : 1;
            return fetch(t.src, { mode: 'cors', cache: 'no-store' })
                .then(function (res) { if (!res.ok) throw new Error(res.status); return res.blob(); })
                .then(function (b) { return createImageBitmap(b); })
                .then(function (bmp) {
                    ctx.globalAlpha = alpha || 1;
                    ctx.drawImage(bmp, tr.left - r.left, tr.top - r.top, tr.width, tr.height);
                    ctx.globalAlpha = 1;
                })
                .catch(function (e) { console.warn('DOCX: dlaždice vynechána', e); });
        });
        jobs.push(Promise.all(tileJobs).then(function () {
            var map = C.getGlobal('mapInstance'), layer = C.getGlobal('markerLayer');
            if (map && layer && map.getContainer() === el && layer.getLatLngs) {
                var o = layer.options || {};
                var rings = layer.getLatLngs();
                if (rings.length && rings[0].lat !== undefined) rings = [rings];
                var flat = [];
                (function walk(a) { if (a.length && a[0].lat !== undefined) flat.push(a); else a.forEach(walk); })(rings);
                ctx.beginPath();
                flat.forEach(function (ring) {
                    ring.forEach(function (ll, i) {
                        var p = map.latLngToContainerPoint(ll);
                        if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
                    });
                    ctx.closePath();
                });
                ctx.globalAlpha = o.fillOpacity != null ? o.fillOpacity : 0.2;
                ctx.fillStyle = o.fillColor || o.color || '#3388ff';
                ctx.fill('evenodd');
                ctx.globalAlpha = o.opacity != null ? o.opacity : 1;
                ctx.lineWidth = o.weight || 3;
                ctx.strokeStyle = o.color || '#3388ff';
                ctx.lineJoin = 'round';
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            ctx.strokeStyle = '#cfd8dc';
            ctx.lineWidth = 1;
            ctx.strokeRect(0.5, 0.5, run.width - 1, run.height - 1);
            return canvasToBytes(cv);
        }).then(function (b) { run.data = b; }).catch(function (e) { console.warn('DOCX: mapa vynechána', e); }));
        return run;
    }

    // ---------- PŘEVOD DOM → SPECIFIKACE ----------
    // spec odstavce: { t:'p', runs:[], align, before, line, borders, shading, outline }
    // spec tabulky:  { t:'table', rows:[{header, cells:[{blocks, w, span, bg, borders, valign, pad}]}], w, cols, layout }

    function textRun(text, cs) {
        if (cs.textTransform === 'uppercase') text = text.toUpperCase();
        else if (cs.textTransform === 'lowercase') text = text.toLowerCase();
        var deco = cs.textDecorationLine || cs.textDecoration || '';
        return {
            text: text,
            bold: parseInt(cs.fontWeight, 10) >= 600 || cs.fontWeight === 'bold',
            italics: cs.fontStyle === 'italic',
            underline: /underline/.test(deco),
            strike: /line-through/.test(deco),
            color: hex(cs.color),
            size: Math.max(2, Math.round(px(cs.fontSize) * 1.5)),
            font: fontName(cs)
        };
    }

    function inlineRuns(node, out) {
        for (var n = node.firstChild; n; n = n.nextSibling) {
            if (n.nodeType === 3) {
                var t = n.nodeValue.replace(/\s+/g, ' ');
                if (t) out.push(textRun(t, getComputedStyle(n.parentElement)));
            } else if (n.nodeType === 1) {
                if (n.matches(SKIP)) continue;
                var cs = getComputedStyle(n);
                if (hidden(n, cs)) continue;
                if (n.tagName === 'BR') out.push({ br: true });
                else if (n.tagName === 'IMG') out.push(imageRun(n));
                else if (n.tagName.toLowerCase() === 'svg') out.push(svgRun(n));
                else if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') { if (n.value) out.push(textRun(n.value, cs)); }
                else inlineRuns(n, out);
            }
        }
        return out;
    }

    function tidyRuns(runs) {
        // sloučit mezery na hranách odstavce a mezi běhy
        var prevSpace = true;
        runs.forEach(function (r) {
            if (r.br) { prevSpace = true; return; }
            if (r.image) { prevSpace = false; return; }
            if (prevSpace) r.text = r.text.replace(/^ /, '');
            prevSpace = / $/.test(r.text);
        });
        for (var i = runs.length - 1; i >= 0; i--) {
            var r = runs[i];
            if (r.br || r.image) break;
            r.text = r.text.replace(/ $/, '');
            if (r.text) break;
        }
        return runs.filter(function (r) { return r.br || r.image || r.text; });
    }

    function contentBox(el) {
        var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return {
            left: r.left + px(cs.borderLeftWidth) + px(cs.paddingLeft),
            right: r.right - px(cs.borderRightWidth) - px(cs.paddingRight),
            top: r.top + px(cs.borderTopWidth) + px(cs.paddingTop),
            bottom: r.bottom - px(cs.borderBottomWidth) - px(cs.paddingBottom)
        };
    }

    // Zarovnání: explicitní text-align, jinak podle polohy obsahu vůči rámu (stránka / buňka).
    function alignOf(el, cs, frame) {
        var ta = cs.textAlign;
        if (ta === 'center') return 'center';
        if (ta === 'right' || ta === 'end') return 'right';
        if (ta === 'justify') return 'both';
        if (frame) {
            var rng = document.createRange();
            rng.selectNodeContents(el);
            var rr = rng.getBoundingClientRect();
            if (rr.width > 0) {
                var lg = rr.left - frame.left, rg = frame.right - rr.right;
                if (lg > 12 && Math.abs(lg - rg) < Math.max(6, (frame.right - frame.left) * 0.04)) return 'center';
                if (lg > 24 && rg < 6) return 'right';
            }
        }
        return 'left';
    }

    // Zarovnání samostatného prvku (mapa, obrázek) podle jeho rámečku vůči rámu.
    function alignBox(el, frame) {
        if (!frame) return 'left';
        var r = el.getBoundingClientRect();
        var lg = r.left - frame.left, rg = frame.right - r.right;
        if (lg > 8 && Math.abs(lg - rg) < Math.max(6, (frame.right - frame.left) * 0.04)) return 'center';
        if (lg > 24 && rg < 6) return 'right';
        return 'left';
    }

    function paraProps(el, cs, frame) {
        var lh = px(cs.lineHeight), fs = px(cs.fontSize);
        var props = { align: alignOf(el, cs, frame), before: 0, line: (lh && fs) ? Math.round(lh / fs * 240) : null, borders: {}, shading: null };
        ['Top', 'Bottom', 'Left', 'Right'].forEach(function (s) {
            var b = border(cs, s);
            if (b) { b.space = Math.round(px(cs['padding' + s]) * 0.75); props.borders[s.toLowerCase()] = b; }
        });
        var bg = hex(cs.backgroundColor);
        if (bg && bg !== 'FFFFFF') props.shading = bg;
        if (el.matches('.sec-title, .p1-title, h1, h2, h3')) props.outline = el.matches('.p1-title, h1') ? 0 : 1;
        return props;
    }

    function paragraphFrom(el, frame, runs) {
        var cs = getComputedStyle(el);
        var p = paraProps(el, cs, frame);
        p.t = 'p';
        p.runs = tidyRuns(runs || inlineRuns(el, []));
        var hasBorder = Object.keys(p.borders).length > 0;
        if (!p.runs.length && !hasBorder && !p.shading) return null;
        if (!p.runs.length) p.runs = [{ text: '', size: Math.max(2, Math.round(Math.min(px(cs.fontSize), 6) * 1.5)) }];
        return p;
    }

    function tableSpec(table, frame) {
        var tr = table.getBoundingClientRect();
        var rows = [];
        var colEdges = new Set();
        Array.prototype.forEach.call(table.rows, function (row) {
            var rcs = getComputedStyle(row);
            if (hidden(row, rcs)) return;
            var cells = [];
            Array.prototype.forEach.call(row.cells, function (cell) {
                var ccs = getComputedStyle(cell);
                if (hidden(cell, ccs)) return;
                var cr = cell.getBoundingClientRect();
                colEdges.add(Math.round(cr.left - tr.left)); colEdges.add(Math.round(cr.right - tr.left));
                var b = {};
                ['Top', 'Bottom', 'Left', 'Right'].forEach(function (s) { b[s.toLowerCase()] = border(ccs, s); });
                cells.push({
                    blocks: blocksOf(cell, contentBox(cell)),
                    left: cr.left - tr.left, right: cr.right - tr.left,
                    bg: hex(ccs.backgroundColor) || hex(rcs.backgroundColor) || (row.parentElement ? hex(getComputedStyle(row.parentElement).backgroundColor) : null),
                    borders: b,
                    valign: ccs.verticalAlign === 'middle' ? 'center' : (ccs.verticalAlign === 'bottom' ? 'bottom' : 'top'),
                    pad: { top: px(ccs.paddingTop), bottom: px(ccs.paddingBottom), left: px(ccs.paddingLeft), right: px(ccs.paddingRight) }
                });
            });
            if (cells.length) rows.push({ header: row.parentElement && row.parentElement.tagName === 'THEAD', cells: cells });
        });
        return gridify({ t: 'table', rows: rows, w: tr.width, layout: false }, colEdges);
    }

    // Sloupce tabulky z hran buněk → šířky sloupců a columnSpan.
    function gridify(spec, edgesSet) {
        var edges = Array.from(edgesSet).sort(function (a, b) { return a - b; });
        var merged = [];
        edges.forEach(function (e) { if (!merged.length || e - merged[merged.length - 1] > 2) merged.push(e); });
        if (merged.length < 2) merged = [0, Math.round(spec.w)];
        spec.cols = [];
        for (var i = 1; i < merged.length; i++) spec.cols.push(Math.max(1, merged[i] - merged[i - 1]));
        var idx = function (x) {
            var best = 0, d = Infinity;
            merged.forEach(function (e, i) { var dd = Math.abs(e - x); if (dd < d) { d = dd; best = i; } });
            return best;
        };
        var nCols = merged.length - 1;
        spec.rows.forEach(function (row) {
            row.cells.forEach(function (c) {
                c.a = idx(c.left); c.b = Math.max(c.a + 1, idx(c.right));
            });
            row.cells.sort(function (x, y) { return x.a - y.a; });
            // mezery mezi buňkami (a na okrajích) vyplnit prázdnými buňkami → konzistentní mřížka
            var filled = [], pos = 0;
            var gapCell = function (a, b) {
                return { blocks: [], a: a, b: b, bg: null, borders: {}, valign: 'top', pad: { top: 0, bottom: 0, left: 0, right: 0 } };
            };
            row.cells.forEach(function (c) {
                if (c.a < pos) { c.a = pos; if (c.b <= c.a) c.b = c.a + 1; }
                if (c.a > pos) filled.push(gapCell(pos, c.a));
                filled.push(c);
                pos = c.b;
            });
            if (pos < nCols) filled.push(gapCell(pos, nCols));
            filled.forEach(function (c) {
                c.span = Math.max(1, c.b - c.a);
                c.w = Math.max(1, merged[Math.min(c.b, nCols)] - merged[c.a]);
            });
            row.cells = filled;
        });
        return spec;
    }

    // Bloky vedle sebe (flex/grid řádek) → tabulka bez okrajů.
    function layoutSpec(el, kids) {
        var r = el.getBoundingClientRect();
        var edges = new Set();
        var cells = kids.map(function (k) {
            var kr = k.getBoundingClientRect();
            edges.add(Math.round(kr.left - r.left)); edges.add(Math.round(kr.right - r.left));
            return { blocks: blocksOf(k, k.getBoundingClientRect(), true), left: kr.left - r.left, right: kr.right - r.left,
                     bg: null, borders: {}, valign: 'top', pad: { top: 0, bottom: 0, left: 0, right: 0 } };
        });
        // mezery mezi sloupci jako samostatné prázdné sloupce zachová gridify
        return gridify({ t: 'table', rows: [{ header: false, cells: cells }], w: r.width, layout: true }, edges);
    }

    function isRowFlex(el, cs) {
        if (!/flex|grid/.test(cs.display)) return null;
        if (/flex/.test(cs.display) && /column/.test(cs.flexDirection)) return null;
        for (var t = el.firstChild; t; t = t.nextSibling) {
            if (t.nodeType === 3 && t.nodeValue.trim()) return null;   // volný text → běžný odstavec
        }
        var kids = [];
        for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
            if (c.matches(SKIP)) continue;
            var ccs = getComputedStyle(c);
            if (hidden(c, ccs) || ccs.position === 'absolute' || ccs.position === 'fixed') continue;
            kids.push(c);
        }
        if (kids.length < 2) return null;
        // skutečně vedle sebe = svislé překrytí prvních dvou
        var a = kids[0].getBoundingClientRect(), b = kids[1].getBoundingClientRect();
        if (b.top >= a.bottom - 1) return null;
        return kids;
    }

    function blocksOf(el, frame, inCell) {
        var out = [];
        var box = contentBox(el);
        var prevBottom = box.top;
        var pending = [];   // souvislé inline uzly bez blokového obalu

        function push(specs, top, bottom) {
            if (!specs.length) return;
            var gap = Math.max(0, top - prevBottom);
            specs[0].before = (specs[0].before || 0) + gap;
            prevBottom = bottom;
            out.push.apply(out, specs);
        }
        function flushInline() {
            if (!pending.length) return;
            var tmp = [];
            pending.forEach(function (n) {
                if (n.nodeType === 3) {
                    var t = n.nodeValue.replace(/\s+/g, ' ');
                    if (t) tmp.push(textRun(t, getComputedStyle(n.parentElement)));
                } else if (n.tagName === 'BR') tmp.push({ br: true });
                else if (n.tagName === 'IMG') tmp.push(imageRun(n));
                else if (n.tagName.toLowerCase() === 'svg') tmp.push(svgRun(n));
                else inlineRuns(n, tmp);
            });
            var rng = document.createRange();
            rng.setStartBefore(pending[0]); rng.setEndAfter(pending[pending.length - 1]);
            var rr = rng.getBoundingClientRect();
            var cs = getComputedStyle(el);
            var p = paraProps(el, cs, frame);
            p.borders = {}; p.shading = null;
            p.t = 'p';
            p.runs = tidyRuns(tmp);
            pending = [];
            if (p.runs.length) push([p], rr.top, rr.bottom);
        }

        for (var n = el.firstChild; n; n = n.nextSibling) {
            if (n.nodeType === 3) { if (n.nodeValue.trim()) pending.push(n); continue; }
            if (n.nodeType !== 1) continue;
            if (n.matches(SKIP)) continue;
            var cs = getComputedStyle(n);
            if (hidden(n, cs) || cs.position === 'fixed') continue;
            if (!isBlock(n, cs) && !hasBlockChild(n)) { pending.push(n); continue; }
            flushInline();
            var r = n.getBoundingClientRect();
            push(convert(n, cs, frame), r.top, r.bottom);
        }
        flushInline();
        return out;
    }

    function convert(el, cs, frame) {
        if (el.classList.contains('leaflet-container')) {
            return [{ t: 'p', runs: [mapRun(el)], align: alignBox(el, frame), before: 0, borders: {} }];
        }
        if (el.tagName === 'TABLE') return [tableSpec(el, frame)];
        if (el.tagName === 'IMG') return [{ t: 'p', runs: [imageRun(el)], align: alignBox(el, frame), before: 0, borders: {} }];
        if (el.tagName.toLowerCase() === 'svg') return [{ t: 'p', runs: [svgRun(el)], align: 'left', before: 0, borders: {} }];
        if (el.tagName === 'UL' || el.tagName === 'OL') {
            var items = [];
            Array.prototype.forEach.call(el.children, function (li, i) {
                var lcs = getComputedStyle(li);
                if (hidden(li, lcs)) return;
                var p = paragraphFrom(li, frame);
                if (!p) return;
                if (el.tagName === 'OL') p.runs.unshift({ text: (i + 1) + '. ', size: p.runs[0].size, font: p.runs[0].font });
                else p.bullet = true;
                items.push(p);
            });
            return items;
        }
        var kids = isRowFlex(el, cs);
        if (kids) {
            var spec = layoutSpec(el, kids);
            var b = border(cs, 'Bottom'), t = border(cs, 'Top');
            if (!b && !t) return [spec];
            var res = [spec];
            if (b) res.push({ t: 'p', runs: [{ text: '', size: 2 }], before: 0, borders: { top: b } });
            return res;
        }
        if (!hasBlockChild(el)) {
            var p = paragraphFrom(el, frame);
            return p ? [p] : [];
        }
        var inner = blocksOf(el, frame);
        // ohraničení / pozadí kontejneru → na první odstavec
        var bb = border(cs, 'Bottom');
        if (bb && inner.length && inner[inner.length - 1].t === 'p') {
            var last = inner[inner.length - 1];
            if (!last.borders.bottom) { bb.space = Math.round(px(cs.paddingBottom) * 0.75); last.borders.bottom = bb; }
        }
        return inner;
    }

    // ---------- SPECIFIKACE → DOCX ----------
    function build(D, pages, footerInfo, pageBox) {
        var NONE = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        var BSTYLE = { single: D.BorderStyle.SINGLE, dashed: D.BorderStyle.DASHED, dotted: D.BorderStyle.DOTTED, double: D.BorderStyle.DOUBLE };
        var ALIGN = { left: D.AlignmentType.LEFT, center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, both: D.AlignmentType.JUSTIFIED };
        function bd(b) { return b ? { style: BSTYLE[b.style] || D.BorderStyle.SINGLE, size: b.size, color: b.color, space: b.space || 0 } : undefined; }

        function run(r) {
            if (r.br) return new D.TextRun({ break: 1 });
            if (r.image) {
                if (!r.data) return null;
                return new D.ImageRun({ type: 'png', data: r.data, transformation: { width: r.width, height: r.height } });
            }
            return new D.TextRun({
                text: r.text, bold: r.bold || undefined, italics: r.italics || undefined,
                underline: r.underline ? {} : undefined, strike: r.strike || undefined,
                color: r.color || undefined, size: r.size, font: r.font
            });
        }
        function para(s, pageBreak) {
            var borders = {};
            Object.keys(s.borders || {}).forEach(function (k) { if (s.borders[k]) borders[k] = bd(s.borders[k]); });
            var opts = {
                children: (s.runs || []).map(run).filter(Boolean),
                alignment: ALIGN[s.align] || D.AlignmentType.LEFT,
                spacing: { before: Math.round((s.before || 0) * PX), after: 0 },
                pageBreakBefore: pageBreak || undefined
            };
            if (s.line) { opts.spacing.line = Math.max(200, Math.min(600, s.line)); opts.spacing.lineRule = D.LineRuleType.AUTO; }
            if (Object.keys(borders).length) opts.border = borders;
            if (s.shading) opts.shading = { type: D.ShadingType.CLEAR, color: 'auto', fill: s.shading };
            if (s.bullet) opts.bullet = { level: 0 };
            if (s.outline != null) opts.outlineLevel = s.outline;
            return new D.Paragraph(opts);
        }
        function table(s) {
            var tableW = s.cols.reduce(function (a, b) { return a + b; }, 0);
            var rows = s.rows.map(function (row) {
                return new D.TableRow({
                    tableHeader: row.header || undefined,
                    cantSplit: true,
                    children: row.cells.map(function (c) {
                        var children = blocks(c.blocks);
                        if (!children.length || !(children[children.length - 1] instanceof D.Paragraph)) children.push(new D.Paragraph({ children: [] }));
                        var b = s.layout ? { top: NONE, bottom: NONE, left: NONE, right: NONE } : {
                            top: bd(c.borders.top) || NONE, bottom: bd(c.borders.bottom) || NONE,
                            left: bd(c.borders.left) || NONE, right: bd(c.borders.right) || NONE
                        };
                        return new D.TableCell({
                            children: children,
                            width: { size: Math.round(c.w * PX), type: D.WidthType.DXA },
                            columnSpan: c.span > 1 ? c.span : undefined,
                            shading: c.bg && c.bg !== 'FFFFFF' ? { type: D.ShadingType.CLEAR, color: 'auto', fill: c.bg } : undefined,
                            verticalAlign: c.valign === 'center' ? D.VerticalAlign.CENTER : (c.valign === 'bottom' ? D.VerticalAlign.BOTTOM : D.VerticalAlign.TOP),
                            margins: { top: Math.round(c.pad.top * PX), bottom: Math.round(c.pad.bottom * PX), left: Math.round(c.pad.left * PX), right: Math.round(c.pad.right * PX) },
                            borders: b
                        });
                    })
                });
            });
            var opts = {
                rows: rows,
                width: { size: Math.round(tableW * PX), type: D.WidthType.DXA },
                columnWidths: s.cols.map(function (w) { return Math.round(w * PX); }),
                layout: D.TableLayoutType.FIXED
            };
            if (s.layout) opts.borders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
            return new D.Table(opts);
        }
        function blocks(specs, pageBreak) {
            var out = [];
            specs.forEach(function (s, i) {
                var pb = pageBreak && i === 0;
                if (s.t === 'table') {
                    if (pb || s.before > 2) out.push(new D.Paragraph({ children: [], pageBreakBefore: pb || undefined,
                        spacing: { before: 0, after: 0, line: Math.max(20, Math.round((s.before || 0) * PX)), lineRule: D.LineRuleType.EXACT } }));
                    out.push(table(s));
                } else out.push(para(s, pb));
            });
            return out;
        }

        var children = [];
        pages.forEach(function (specs, i) { children.push.apply(children, blocks(specs, i > 0)); });

        var footer = new D.Footer({
            children: [new D.Paragraph({
                tabStops: [{ type: D.TabStopType.RIGHT, position: Math.round(pageBox.contentW * PX) }],
                border: footerInfo.border ? { top: bd(footerInfo.border) } : undefined,
                children: [
                    new D.TextRun({ text: footerInfo.text, size: footerInfo.size, color: footerInfo.color, font: footerInfo.font }),
                    new D.TextRun({ children: ['\t', D.PageNumber.CURRENT], size: footerInfo.size, color: footerInfo.color, font: footerInfo.font })
                ]
            })]
        });

        return new D.Document({
            creator: 'Atomicon GIS',
            title: document.title,
            styles: { default: { document: { run: { font: pageBox.font, size: pageBox.size } } } },
            sections: [{
                properties: {
                    titlePage: true,
                    page: {
                        size: { width: 11906, height: 16838 },
                        margin: {
                            top: Math.round(pageBox.top * PX), bottom: Math.round(pageBox.bottom * PX),
                            left: Math.round(pageBox.left * PX), right: Math.round(pageBox.right * PX),
                            footer: 340, header: 340
                        }
                    }
                },
                footers: { default: footer, first: new D.Footer({ children: [new D.Paragraph({ children: [] })] }) },
                children: children
            }]
        });
    }

    // ---------- PŘÍPRAVA NÁHLEDU ----------
    // Tiskové styly pasportu (skryté rámečky log, zástupné texty…) dočasně zapnout i na obrazovce,
    // aby Word odpovídal PDF. Pravidla měnící rozvržení celé stránky (formulář, panel) vynecháme.
    function applyPrintStyles() {
        var css = [];
        var LAYOUT = /(^|[\s,>+~])(html|body|\*|\.app|\.form-panel|\.preview-panel|\.preview-actions)(?![\w-])/;
        function walk(rules) {
            Array.prototype.forEach.call(rules, function (r) {
                if (r.type === 4 /* MEDIA */) {
                    var m = r.media.mediaText;
                    if (/\bprint\b/.test(m) && !/\bscreen\b/.test(m)) {
                        Array.prototype.forEach.call(r.cssRules, function (rr) {
                            if (rr.selectorText && !LAYOUT.test(rr.selectorText)) css.push(rr.cssText);
                        });
                    }
                }
            });
        }
        Array.prototype.forEach.call(document.styleSheets, function (sh) {
            try { walk(sh.cssRules); } catch (e) { /* cizí stylesheet (CDN) – nečitelný */ }
        });
        var st = document.createElement('style');
        st.setAttribute('data-pp-docx', '');
        st.textContent = css.join('\n');
        document.head.appendChild(st);
        return function () { st.remove(); };
    }

    // Obrázky s loading="lazy" mimo obrazovku nejsou načtené (nulová velikost) → vynutit načtení.
    function loadAllImages() {
        var imgs = Array.prototype.slice.call(document.querySelectorAll('.preview-panel .page img'));
        function waitAll() {
            return Promise.all(imgs.map(function (img) {
                if (img.loading === 'lazy') img.loading = 'eager';
                if (img.complete && img.naturalWidth) return null;
                return new Promise(function (res) {
                    var done = function () { res(); };
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                    setTimeout(done, 6000);
                });
            }));
        }
        // druhé kolo: chyba načtení může přepnout zdroj na zálohu (např. Wikimedia u značek DZ)
        return waitAll().then(function () { return new Promise(function (r) { setTimeout(r, 300); }); }).then(waitAll)
            .then(function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); });
    }

    // ---------- EXPORT ----------
    var busy = false;
    function exportDocx() {
        if (busy) return;
        busy = true;
        C.toast('Připravuji dokument Word…', 8000);
        jobs = [];
        var removePrint = null;
        Promise.all([loadLib(), loadAllImages()]).then(function (res) {
            var D = res[0];
            removePrint = applyPrintStyles();
            var pageEls = Array.prototype.slice.call(document.querySelectorAll('.preview-panel .page'));
            if (!pageEls.length) throw new Error('Náhled neobsahuje žádné stránky.');
            var pcs = getComputedStyle(pageEls[pageEls.length > 1 ? 1 : 0]);
            var pageBox = {
                top: px(pcs.paddingTop), bottom: px(pcs.paddingBottom), left: px(pcs.paddingLeft), right: px(pcs.paddingRight),
                contentW: pageEls[0].getBoundingClientRect().width - px(pcs.paddingLeft) - px(pcs.paddingRight),
                font: fontName(pcs), size: Math.round(px(pcs.fontSize) * 1.5)
            };
            var pages = pageEls.map(function (p) { return blocksOf(p, contentBox(p)); });
            // rozměry a styly jsou změřené (obrázky se jen dokreslují do canvasu) → tiskové styly pryč
            removePrint(); removePrint = null;

            // Zápatí Wordu je společné pro všechny strany → nejčastější text zápatí náhledu
            var fEls = Array.prototype.slice.call(document.querySelectorAll('.preview-panel .page-footer'));
            var counts = {};
            fEls.forEach(function (f) {
                var t = ((f.firstElementChild || f).textContent || '').replace(/\s+/g, ' ').trim();
                if (t) counts[t] = (counts[t] || 0) + 1;
            });
            var fEl = fEls[0];
            var footerInfo = { text: '', size: 16, color: '90A4AE', font: pageBox.font, border: null };
            if (fEl) {
                var fcs = getComputedStyle(fEl);
                footerInfo.text = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || '';
                footerInfo.size = Math.round(px(fcs.fontSize) * 1.5);
                footerInfo.color = hex(fcs.color) || footerInfo.color;
                footerInfo.border = border(fcs, 'Top');
            }

            return Promise.all(jobs).then(function () {
                var doc = build(D, pages, footerInfo, pageBox);
                return D.Packer.toBlob(doc);
            });
        }).then(function (blob) {
            var name = ['Pasport-' + C.type, C.slug(C.obecName()), C.val('rok')].filter(Boolean).join('_') + '.docx';
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
            C.toast('Dokument Word uložen: ' + name);
        }).catch(function (e) {
            console.error(e);
            C.modal({ title: 'Export do Wordu selhal', html: '<p>' + C.esc(e.message || String(e)) + '</p>' });
        }).then(function () { if (removePrint) removePrint(); busy = false; jobs = []; });
    }

    window.PasportDocx = { export: exportDocx };
})();
