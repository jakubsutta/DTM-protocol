/**
 * Společný základ nástrojů pro pasporty (tools/pasporty/Text_Pasport-*.html).
 * Poskytuje: typ pasportu, přístup ke globálním proměnným stránky, modální dialog,
 * krátká oznámení (toast) a barvy převzaté z tlačítek daného pasportu.
 *
 * Pořadí načítání: core.js → backup.js → checks.js → ares.js → docx.js (vše na konci <body>).
 */
(function () {
    'use strict';

    var type = (location.pathname.match(/Text_Pasport-([A-Za-z0-9]+)\.html/) || [])[1] || 'pasport';
    var scriptBase = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');

    // Globální proměnné stránky deklarované přes let/const nejsou na window → přístup přes Function.
    function getGlobal(name) {
        try { return new Function('return typeof ' + name + ' !== "undefined" ? ' + name + ' : undefined;')(); }
        catch (e) { return undefined; }
    }
    function setGlobal(name, value) {
        try { new Function('v', name + ' = v;')(value); return true; }
        catch (e) { return false; }
    }
    function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
    function slug(s) {
        return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    }
    function obecName() { return val('nazevObce'); }

    // Barvy pasportu – z existujících tříd .btn-primary / .btn-secondary
    function themeColors() {
        var probe = function (cls) {
            var b = document.createElement('button');
            b.className = cls;
            b.style.cssText = 'position:absolute;visibility:hidden;';
            document.body.appendChild(b);
            var cs = getComputedStyle(b);
            var r = { bg: cs.backgroundColor, fg: cs.color };
            b.remove();
            return r;
        };
        var p = probe('btn-primary'), s = probe('btn-secondary');
        var root = document.documentElement.style;
        root.setProperty('--pp-primary', p.bg);
        root.setProperty('--pp-primary-fg', p.fg);
        root.setProperty('--pp-soft', s.bg);
        root.setProperty('--pp-soft-fg', s.fg);
    }

    var css = [
        '.pp-modal-backdrop{position:fixed;inset:0;background:rgba(20,24,30,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit;}',
        '.pp-modal{background:#fff;color:#1a1a1a;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.3);width:min(520px,100%);max-height:85vh;display:flex;flex-direction:column;overflow:hidden;}',
        '.pp-modal-head{padding:16px 20px 10px;font-size:16px;font-weight:800;border-top:4px solid var(--pp-primary,#555);}',
        '.pp-modal-body{padding:4px 20px 14px;font-size:13px;line-height:1.5;overflow-y:auto;}',
        '.pp-modal-body p{margin:0 0 8px;}',
        '.pp-modal-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;padding:12px 20px 16px;border-top:1px solid #eceff1;}',
        '.pp-btn{border:none;border-radius:6px;padding:9px 14px;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;}',
        '.pp-btn-primary{background:var(--pp-primary,#555);color:var(--pp-primary-fg,#fff);}',
        '.pp-btn-secondary{background:var(--pp-soft,#eee);color:var(--pp-soft-fg,#333);}',
        '.pp-btn-ghost{background:transparent;color:#546e7a;}',
        '.pp-btn-danger{background:#c62828;color:#fff;}',
        '.pp-btn:hover{filter:brightness(.95);}',
        '.pp-list{list-style:none;margin:6px 0 0;padding:0;}',
        '.pp-list li{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border:1px solid #eceff1;border-radius:6px;margin-bottom:6px;cursor:pointer;}',
        '.pp-list li:hover{background:var(--pp-soft,#f5f5f5);}',
        '.pp-list .pp-ico{flex-shrink:0;width:18px;text-align:center;}',
        '.pp-list small{display:block;color:#78909c;}',
        '.pp-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:#263238;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:10001;opacity:0;transition:opacity .2s,transform .2s;max-width:80vw;}',
        '.pp-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}',
        '@media print{.pp-modal-backdrop,.pp-toast{display:none!important;}}'
    ].join('\n');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    /**
     * Modální dialog. Vrací Promise s hodnotou zvoleného tlačítka (Esc / klik mimo = null).
     * opts: { title, html | node, buttons: [{ label, value, kind: 'primary'|'secondary'|'ghost'|'danger' }] }
     */
    function modal(opts) {
        return new Promise(function (resolve) {
            var back = document.createElement('div');
            back.className = 'pp-modal-backdrop';
            var box = document.createElement('div');
            box.className = 'pp-modal';
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-modal', 'true');
            var head = document.createElement('div');
            head.className = 'pp-modal-head';
            head.textContent = opts.title || '';
            var body = document.createElement('div');
            body.className = 'pp-modal-body';
            if (opts.node) body.appendChild(opts.node); else body.innerHTML = opts.html || '';
            var foot = document.createElement('div');
            foot.className = 'pp-modal-foot';
            box.appendChild(head); box.appendChild(body); box.appendChild(foot);
            back.appendChild(box);

            var done = false;
            function close(v) {
                if (done) return;
                done = true;
                document.removeEventListener('keydown', onKey, true);
                back.remove();
                resolve(v);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); if (opts.dismissable !== false) close(null); }
            }
            (opts.buttons || [{ label: 'OK', value: true, kind: 'primary' }]).forEach(function (b) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pp-btn pp-btn-' + (b.kind || 'secondary');
                btn.textContent = b.label;
                btn.addEventListener('click', function () { close(b.value); });
                foot.appendChild(btn);
            });
            back.addEventListener('mousedown', function (e) { if (e.target === back && opts.dismissable !== false) close(null); });
            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(back);
            var primary = foot.querySelector('.pp-btn-primary') || foot.querySelector('.pp-btn');
            if (primary) primary.focus();
            if (opts.onOpen) opts.onOpen(body, close);
        });
    }

    var toastEl = null, toastTimer = null;
    function toast(msg, ms) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'pp-toast';
            toastEl.setAttribute('role', 'status');
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = msg;
        requestAnimationFrame(function () { toastEl.classList.add('show'); });
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 3200);
    }

    // Spustí fn po úplné inicializaci pasportu (window.onload / DOMContentLoaded handlery stránky).
    function ready(fn) {
        var run = function () { setTimeout(fn, 0); };
        if (document.readyState === 'complete') run();
        else window.addEventListener('load', run);
    }

    // Hodnota zobrazená v náhledu i jako typ pasportu pro uživatele (např. "DZ", "VO").
    function label() { return type; }

    themeColors();

    window.PasportCore = {
        type: type,
        scriptBase: scriptBase,
        getGlobal: getGlobal,
        setGlobal: setGlobal,
        clone: clone,
        esc: esc,
        val: val,
        slug: slug,
        obecName: obecName,
        label: label,
        modal: modal,
        toast: toast,
        ready: ready
    };
})();
