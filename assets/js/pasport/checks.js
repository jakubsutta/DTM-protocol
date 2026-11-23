/**
 * Kontroly pasportu:
 *  - přetečení stránky: stránka náhledu vyšší než A4 se orámuje a označí štítkem,
 *  - kontrola před uložením PDF (tlačítko PDF i Ctrl/Cmd+P): nevyplněné zástupné texty [..],
 *    prázdná pole, chybějící logo / razítko / obec v mapě, přetečené stránky,
 *  - název PDF: před tiskem se dočasně změní titulek stránky (Chrome z něj bere název souboru).
 *
 * Vyžaduje core.js.
 */
(function () {
    'use strict';

    var C = window.PasportCore;
    var preview = document.querySelector('.preview-panel');
    if (!preview) return;

    var style = document.createElement('style');
    style.textContent = [
        '.page.pp-overflow{outline:3px dashed #e53935;outline-offset:-3px;}',
        '.page.pp-overflow::before{content:attr(data-pp-overflow);position:absolute;top:8px;right:8px;z-index:5;background:#e53935;color:#fff;font:700 11px/1.3 system-ui,sans-serif;padding:4px 8px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.2);pointer-events:none;}',
        '.page.pp-overflow::after{content:"";position:absolute;left:0;right:0;top:var(--pp-a4-limit);border-top:2px solid #e53935;pointer-events:none;z-index:5;}',
        '.pp-flash{animation:pp-flash 1.6s ease;}',
        '@keyframes pp-flash{0%,60%{box-shadow:0 0 0 3px #e53935, 0 0 0 7px rgba(229,57,53,.25);}100%{box-shadow:none;}}',
        '@media print{.page.pp-overflow{outline:none!important;}.page.pp-overflow::before,.page.pp-overflow::after{display:none!important;}}'
    ].join('\n');
    document.head.appendChild(style);

    // ---------- PŘETEČENÍ A4 ----------
    var A4 = (function () {
        var d = document.createElement('div');
        d.style.cssText = 'position:absolute;visibility:hidden;height:297mm;width:1mm;';
        document.body.appendChild(d);
        var h = d.getBoundingClientRect().height;
        d.remove();
        return h;
    })();
    var PX_PER_MM = A4 / 297;

    function overflowPages() {
        var out = [];
        preview.querySelectorAll('.page').forEach(function (page, i) {
            var over = page.getBoundingClientRect().height - A4;
            if (over > 1.5) out.push({ page: page, index: i, mm: Math.ceil(over / PX_PER_MM) });
        });
        return out;
    }

    function markOverflow() {
        var over = overflowPages();
        preview.querySelectorAll('.page.pp-overflow').forEach(function (p) {
            if (!over.some(function (o) { return o.page === p; })) {
                p.classList.remove('pp-overflow');
                p.removeAttribute('data-pp-overflow');
            }
        });
        over.forEach(function (o) {
            o.page.classList.add('pp-overflow');
            o.page.setAttribute('data-pp-overflow', 'Obsah přesahuje A4 o ' + o.mm + ' mm – v PDF se stránka rozdělí');
            o.page.style.setProperty('--pp-a4-limit', A4 + 'px');
        });
    }

    var rafPending = false;
    function scheduleOverflow() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(function () { rafPending = false; markOverflow(); });
    }
    var ro = window.ResizeObserver ? new ResizeObserver(scheduleOverflow) : null;
    function observePages() {
        if (!ro) return;
        preview.querySelectorAll('.page').forEach(function (p) {
            if (!p.__ppObserved) { ro.observe(p); p.__ppObserved = true; }
        });
    }
    new MutationObserver(function () { observePages(); scheduleOverflow(); })
        .observe(preview, { childList: true, subtree: true, characterData: true });
    C.ready(function () { observePages(); markOverflow(); });
    window.addEventListener('resize', scheduleOverflow);

    // ---------- KONTROLA PŘED PDF ----------
    function visible(el) {
        if (!el || !el.isConnected) return false;
        var r = el.getBoundingClientRect();
        return r.width > 0 || r.height > 0;
    }

    // Prvek náhledu, na který lze kliknout (vede na pole formuláře).
    function anchorOf(node) {
        var el = node.nodeType === 1 ? node : node.parentElement;
        return (el && (el.closest('.info-table tr') || el.closest('[id^="p-"]') || el.closest('.ptext, td, p, div'))) || el;
    }

    function labelFor(el) {
        var tr = el.closest && el.closest('.info-table tr');
        if (tr && tr.cells && tr.cells[0]) return tr.cells[0].textContent.replace(/:\s*$/, '').trim();
        // nejbližší předchozí nadpis sekce
        var page = el.closest && el.closest('.page');
        if (page) {
            var titles = page.querySelectorAll('.sec-title, .p1-title');
            var best = null;
            titles.forEach(function (t) {
                if (t.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = t;
            });
            if (best) return best.textContent.trim();
        }
        return '';
    }

    function pageNo(el) {
        var pages = Array.prototype.slice.call(preview.querySelectorAll('.page'));
        var p = el.closest && el.closest('.page');
        return p ? pages.indexOf(p) + 1 : 0;
    }

    function findIssues() {
        var issues = [];
        var seen = new Set();
        function add(kind, el, text, detail) {
            var a = anchorOf(el);
            var key = kind + '|' + text + '|' + (a && a.id || '') + '|' + pageNo(a);
            if (seen.has(key)) return;
            seen.add(key);
            issues.push({ kind: kind, el: a, text: text, detail: detail || '' });
        }

        // 1) Nevyplněné zástupné texty – [Název obce], [rok], [počet]…
        var walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null);
        var re = /\[[^\[\]\n]{1,40}\]/g, n;
        while ((n = walker.nextNode())) {
            if (!n.parentElement || !n.parentElement.closest('.page') || !visible(n.parentElement)) continue;
            var m = n.nodeValue.match(re);
            if (!m) continue;
            m.forEach(function (ph) {
                var l = labelFor(n.parentElement);
                add('placeholder', n, ph, l);
            });
        }

        // 2) Prázdná pole v náhledu („—“ / „— nevyplněno —“)
        preview.querySelectorAll('.page [id^="p-"], .page .ph').forEach(function (el) {
            if (!visible(el)) return;
            if (el.querySelector('img, svg, table')) return;
            var t = el.textContent.replace(/\s+/g, ' ').trim();
            if (t === '—' || t === '-' || /^— ?nevyplněno ?—$/.test(t)) {
                var target = el.classList.contains('ph') ? (el.closest('[id^="p-"]') || el) : el;
                add('empty', target, labelFor(target) || 'Nevyplněné pole', '');
            }
        });

        // 3) Obrázky a mapa
        var logo = document.getElementById('p-logoObec');
        if (logo && !logo.querySelector('img')) add('image', logo, 'Logo obce', 'není nahrané');
        var stamp = document.getElementById('p-stamp');
        if (stamp && visible(stamp) && !stamp.querySelector('img')) add('image', stamp, 'Podpis / razítko', 'není nahrané');
        var map = document.getElementById('map-container');
        if (map && visible(map) && !C.getGlobal('markerLayer')) add('map', map, 'Mapa', 'není vyhledaná a vyznačená obec');

        // 4) Přetečené stránky
        overflowPages().forEach(function (o) {
            add('overflow', o.page, 'Strana ' + (o.index + 1) + ' přesahuje A4', 'o ' + o.mm + ' mm – v PDF se rozdělí na dvě');
        });

        return issues;
    }

    var ICONS = { placeholder: '✎', empty: '○', image: '🖼', map: '🗺', overflow: '⚠' };

    function goTo(issue) {
        var el = issue.el;
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('pp-flash');
        void el.offsetWidth;
        el.classList.add('pp-flash');
        setTimeout(function () { el.classList.remove('pp-flash'); }, 1700);
        // Stávající navigace náhled → formulář (initPreviewClickNavigation)
        if (issue.kind !== 'overflow') el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    function printWithTitle() {
        var original = document.title;
        var parts = ['Pasport ' + C.type, C.obecName(), C.val('rok')].filter(Boolean);
        document.title = parts.join(' - ');
        var restore = function () { document.title = original; window.removeEventListener('afterprint', restore); };
        window.addEventListener('afterprint', restore);
        window.print();
        setTimeout(restore, 1000);
    }

    function checkAndPrint() {
        var issues = findIssues();
        if (!issues.length) { printWithTitle(); return; }

        var ul = document.createElement('ul');
        ul.className = 'pp-list';
        var holder = document.createElement('div');
        var intro = document.createElement('p');
        intro.textContent = 'Před uložením PDF jsem v pasportu našel ' + issues.length +
            (issues.length === 1 ? ' věc, kterou je dobré zkontrolovat' : (issues.length < 5 ? ' věci, které je dobré zkontrolovat' : ' věcí, které je dobré zkontrolovat')) +
            '. Kliknutím na položku přejdete na místo v náhledu i ve formuláři.';
        holder.appendChild(intro);
        holder.appendChild(ul);

        C.modal({
            title: 'Kontrola před uložením PDF',
            node: holder,
            buttons: [
                { label: 'Zpět k úpravám', value: null, kind: 'ghost' },
                { label: 'Přesto uložit PDF', value: 'print', kind: 'primary' }
            ],
            onOpen: function (body, close) {
                issues.forEach(function (it) {
                    var li = document.createElement('li');
                    var p = pageNo(it.el);
                    var sub = [it.detail, p ? 'strana ' + p : ''].filter(Boolean).join(' · ');
                    li.innerHTML = '<span class="pp-ico">' + (ICONS[it.kind] || '•') + '</span><span><b>' + C.esc(it.text) + '</b>' +
                        (sub ? '<small>' + C.esc(sub) + '</small>' : '') + '</span>';
                    li.addEventListener('click', function () { close(null); setTimeout(function () { goTo(it); }, 50); });
                    ul.appendChild(li);
                });
            }
        }).then(function (v) { if (v === 'print') printWithTitle(); });
    }

    // Ctrl/Cmd+P → stejná kontrola jako tlačítko PDF
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'p' || e.key === 'P')) {
            if (document.querySelector('.pp-modal-backdrop')) return;
            e.preventDefault();
            checkAndPrint();
        }
    }, true);

    // Název PDF i při tisku z menu prohlížeče
    var savedTitle = null;
    window.addEventListener('beforeprint', function () {
        // Tisk z tlačítka / Ctrl+P už titulek nastavil (printWithTitle) – tady jen tisk z menu prohlížeče.
        if (savedTitle !== null || /^Pasport /.test(document.title)) return;
        savedTitle = document.title;
        document.title = ['Pasport ' + C.type, C.obecName(), C.val('rok')].filter(Boolean).join(' - ');
    });
    window.addEventListener('afterprint', function () {
        if (savedTitle !== null) { document.title = savedTitle; savedTitle = null; }
    });

    window.PasportChecks = {
        print: checkAndPrint,
        findIssues: findIssues,
        overflowPages: overflowPages
    };
})();
