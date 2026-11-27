/* ==========================================================================
   Liquid Glass – lom světla (refrakce) pro motiv „Liquid Glass“ v rozcestníku

   Skutečné „tekuté sklo“ není jen rozmazání + průhlednost: okraj skla funguje
   jako čočka a pozadí se na něm ohýbá. To tu děláme SVG filtrem:
   - pro každý skleněný prvek se do canvasu vygeneruje mapa posunu (displacement
     map) podle jeho velikosti a zaoblení – uprostřed nulová, u okraje silná,
   - feDisplacementMap posune pozadí (backdrop) podle mapy, každý barevný kanál
     trochu jinak (jemná chromatická aberace jako u skutečného skla),
   - filtr se prvku přiřadí přes CSS proměnnou --lg-filter
     (backdrop-filter: url(#…)).

   backdrop-filter s url() umí jen prohlížeče na Chromiu (Chrome, Edge, Opera).
   Jinde (Firefox, Safari) zůstane záložní vzhled z hub.css (rozostření + odlesk).

   Navíc: odlesk na hranách skla se natáčí podle polohy kurzoru (--lg-lx, --lg-ly).
   ========================================================================== */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';

    // Skleněné prvky: šířka „čočky“ u okraje (bezel), síla lomu (scale), rozostření
    var TARGETS = [
        { sel: '.main-header', bezel: 20, scale: 70, blur: 2.5 },
        { sel: '.side-panel', bezel: 26, scale: 80, blur: 4 },
        { sel: '.theme-menu', bezel: 16, scale: 52, blur: 1.5 },
        { sel: '.dropdown-menu', bezel: 16, scale: 52, blur: 1.5 },
        { sel: '.changelog-modal-container', bezel: 26, scale: 80, blur: 3 }
    ];

    var ua = navigator.userAgent;
    var brands = navigator.userAgentData && navigator.userAgentData.brands;
    var isChromium = brands
        ? brands.some(function (b) { return /Chromium/i.test(b.brand); })
        : /Chrome\/\d+/.test(ua) && !/Firefox|FxiOS|CriOS/.test(ua);

    var mqTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
    var mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    var defs = null;
    var states = [];      // { el, cfg, id, key, filter }
    var scheduled = false;

    function isGlass() {
        return document.body.classList.contains('glass-theme');
    }

    function refractionEnabled() {
        return isChromium && !mqTransparency.matches;
    }

    // ---- Mapa posunu: R = posun v ose x, G = v ose y (128 = bez posunu) ----
    function buildMap(w, h, radius, bezel) {
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        var img = ctx.createImageData(w, h);
        var data = img.data;
        var hw = w / 2, hh = h / 2;
        var r = Math.max(0, Math.min(radius, hw, hh));
        var b = Math.max(1, Math.min(bezel, hw, hh));

        for (var y = 0; y < h; y++) {
            var py = y + 0.5 - hh;
            var sy = py < 0 ? -1 : 1;
            var ay = Math.abs(py) - (hh - r);
            for (var x = 0; x < w; x++) {
                var px = x + 0.5 - hw;
                var sx = px < 0 ? -1 : 1;
                var ax = Math.abs(px) - (hw - r);
                var dist, nx, ny;

                if (ax > 0 && ay > 0) {
                    // zaoblený roh: normála míří od středu oblouku
                    var len = Math.sqrt(ax * ax + ay * ay) || 1;
                    dist = r - len;
                    nx = (ax / len) * sx;
                    ny = (ay / len) * sy;
                } else if (ax > ay) {
                    dist = r - ax;
                    nx = sx;
                    ny = 0;
                } else {
                    dist = r - ay;
                    nx = 0;
                    ny = sy;
                }

                var i = (y * w + x) * 4;
                var mag = 0;
                if (dist < b) {
                    // vypouklý profil: u samého okraje se světlo láme nejvíc
                    var t = 1 - Math.max(0, dist) / b;
                    mag = t * t * t * 0.6 + t * t * 0.4;
                }
                // vzorkujeme pozadí směrem dovnitř → okraj „nasává“ obraz jako čočka
                data[i] = 128 - nx * mag * 127;
                data[i + 1] = 128 - ny * mag * 127;
                data[i + 2] = 128;
                data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvas.toDataURL('image/png');
    }

    function el(name, attrs, parent) {
        var node = document.createElementNS(SVG_NS, name);
        for (var k in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
        }
        if (parent) parent.appendChild(node);
        return node;
    }

    function ensureDefs() {
        if (defs) return defs;
        var svg = el('svg', {
            width: '0', height: '0', 'aria-hidden': 'true', focusable: 'false',
            style: 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
        });
        defs = el('defs', {}, svg);
        document.body.appendChild(svg);
        return defs;
    }

    // Filtr: lehké rozostření → posun po kanálech R/G/B → složení → sytost
    function buildFilter(id, w, h, map, cfg) {
        var f = el('filter', {
            id: id, x: '0', y: '0', width: String(w), height: String(h),
            filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
            'color-interpolation-filters': 'sRGB'
        });
        el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: String(cfg.blur), result: 'blur' }, f);
        el('feImage', {
            href: map, x: '0', y: '0', width: String(w), height: String(h),
            preserveAspectRatio: 'none', result: 'map'
        }, f);

        var channels = [
            { name: 'r', k: 1.00, m: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0' },
            { name: 'g', k: 0.94, m: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0' },
            { name: 'b', k: 0.88, m: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' }
        ];
        channels.forEach(function (c) {
            el('feDisplacementMap', {
                in: 'blur', in2: 'map', scale: String(cfg.scale * c.k),
                xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + c.name
            }, f);
            el('feColorMatrix', { in: 'd' + c.name, type: 'matrix', values: c.m, result: c.name }, f);
        });
        el('feComposite', { in: 'r', in2: 'g', operator: 'arithmetic', k2: '1', k3: '1', result: 'rg' }, f);
        el('feComposite', { in: 'rg', in2: 'b', operator: 'arithmetic', k2: '1', k3: '1', result: 'rgb' }, f);
        el('feColorMatrix', { in: 'rgb', type: 'saturate', values: '1.45' }, f);
        return f;
    }

    function update() {
        scheduled = false;        var on = isGlass() && refractionEnabled();
        document.documentElement.classList.toggle('lg-refract', on);
        if (!on) return;

        states.forEach(function (s) {
            var w = s.el.offsetWidth, h = s.el.offsetHeight;
            if (!w || !h) return;
            var radius = parseFloat(getComputedStyle(s.el).borderTopLeftRadius) || 0;
            var key = w + 'x' + h + '@' + radius;
            if (key === s.key) return;
            s.key = key;

            var filter = buildFilter(s.id, w, h, buildMap(w, h, radius, s.cfg.bezel), s.cfg);
            if (s.filter) s.filter.replaceWith(filter);
            else ensureDefs().appendChild(filter);
            s.filter = filter;
            s.el.style.setProperty('--lg-filter', 'url(#' + s.id + ')');
        });
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        // rAF se na skryté stránce nespouští → záložní časovač, co přijde dřív
        var done = false;
        function run() { if (!done) { done = true; update(); } }
        requestAnimationFrame(run);
        setTimeout(run, 120);
    }

    // ---- Materializace: sklo se při otevření „zhmotní“ postupným nabíháním lomu
    //      (Apple: „materializes in and out by gradually modulating the light bending“) ----
    var MATERIALIZE = [
        { trigger: '.theme-picker', target: '.theme-menu' },
        { trigger: '.changelog-modal-overlay', target: '.changelog-modal-container' }
    ];

    function materialize(state) {
        if (!state || !state.filter || mqMotion.matches) return;
        var maps = state.filter.querySelectorAll('feDisplacementMap');
        var blur = state.filter.querySelector('feGaussianBlur');
        var targets = Array.prototype.map.call(maps, function (m) { return parseFloat(m.getAttribute('scale')) || 0; });
        var start = performance.now(), DURATION = 520;

        function frame(now) {
            var t = Math.min(1, (now - start) / DURATION);
            // pružný dojezd: lom krátce přestřelí a usadí se
            var e = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
            Array.prototype.forEach.call(maps, function (m, i) {
                m.setAttribute('scale', (targets[i] * e).toFixed(2));
            });
            if (blur) blur.setAttribute('stdDeviation', (state.cfg.blur + (1 - t) * 10).toFixed(2));
            if (t < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    function watchMaterialize() {
        MATERIALIZE.forEach(function (m) {
            var trigger = document.querySelector(m.trigger);
            if (!trigger) return;
            var wasOpen = trigger.classList.contains('open');
            new MutationObserver(function () {
                var open = trigger.classList.contains('open');
                if (open && !wasOpen && isGlass()) {
                    var target = document.querySelector(m.target);
                    var state = states.filter(function (s) { return s.el === target; })[0];
                    // filtr se mohl teprve vytvořit → dej mu snímek
                    setTimeout(function () { materialize(state); }, 0);
                }
                wasOpen = open;
            }).observe(trigger, { attributes: true, attributeFilter: ['class'] });
        });
    }

    // ---- Lesk pod kurzorem na ovládacích prvcích (--lg-mx, --lg-my na prvku) ----
    var CONTROL_SEL = '.header-action-btn, .theme-toggle, .panel-btn, .column-collapse-btn';
    function onControlMove(e) {
        if (!isGlass() || !e.target.closest) return;
        var btn = e.target.closest(CONTROL_SEL);
        if (!btn) return;
        var r = btn.getBoundingClientRect();
        btn.style.setProperty('--lg-mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        btn.style.setProperty('--lg-my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }

    // ---- Odlesk hran podle kurzoru (zdroj světla = poloha myši) ----
    var lightRaf = 0, lastX = 0, lastY = 0;
    function applyLight() {
        lightRaf = 0;
        var vw = window.innerWidth, vh = window.innerHeight;
        if (vw < 50 || vh < 50) return;
        var lx = Math.max(-1, Math.min(1, 1 - (2 * lastX) / vw));
        var ly = Math.max(-1, Math.min(1, 1 - (2 * lastY) / vh));
        // světlo vždy trochu shora, ať horní hrany nezhasnou
        ly = Math.max(0.35, Math.min(1, (ly + 1) / 2 + 0.25));
        document.body.style.setProperty('--lg-lx', lx.toFixed(3));
        document.body.style.setProperty('--lg-ly', ly.toFixed(3));
    }

    function onPointerMove(e) {
        if (!isGlass() || mqMotion.matches) return;
        lastX = e.clientX;
        lastY = e.clientY;
        if (!lightRaf) lightRaf = requestAnimationFrame(applyLight);
    }

    function init() {
        // odlesk podle kurzoru funguje ve všech prohlížečích, lom jen na Chromiu
        document.addEventListener('pointermove', onPointerMove, { passive: true });
        document.addEventListener('pointermove', onControlMove, { passive: true });
        if (!isChromium) return;
        watchMaterialize();

        TARGETS.forEach(function (cfg) {
            document.querySelectorAll(cfg.sel).forEach(function (node) {
                states.push({ el: node, cfg: cfg, id: 'lg-refract-' + states.length, key: '', filter: null });
            });
        });

        if ('ResizeObserver' in window) {
            var ro = new ResizeObserver(schedule);
            states.forEach(function (s) { ro.observe(s.el); });
        } else {
            window.addEventListener('resize', schedule);
        }

        // přepnutí motivu (třída na body) → zapnout / vypnout lom
        new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        if (mqTransparency.addEventListener) mqTransparency.addEventListener('change', schedule);

        schedule();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
