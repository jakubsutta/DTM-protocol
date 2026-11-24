/**
 * J.E.N.D.A. – maskot rozcestníku.
 *
 * Vlevo dole je ke spodní hraně přilepená záložka „rozklikni mě“ (vykukuje jen část).
 * Po kliknutí ze spodní hrany vyskočí pixel-art panáček (zeměměřič s výtyčkou a GNSS
 * anténou), mává a z bubliny střídá hlášky. Klik na bublinu → další hláška, křížek / Esc → schovat.
 *
 * Samostatný modul: styly i grafika jsou zde, na stránce stačí <script src="assets/js/jenda.js">.
 */
(function () {
    'use strict';

    // ---------- HLÁŠKY ----------
    function today() {
        var d = new Date();
        var den = d.toLocaleDateString('cs-CZ', { weekday: 'long' });
        return den + ' ' + d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
    }
    var dashboardLink = document.querySelector('.panel-feedback-link');
    var dashboardUrl = dashboardLink ? dashboardLink.href : null;

    function link(href, text) {
        return href ? '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + text + '</a>' : text;
    }

    var MESSAGES = [
        function () { return 'Ahoj! Dnes je ' + today() + '.'; },
        function () { return 'Tohle je rozcestník nástrojů pro ulehčení práce.'; },
        function () { return 'Pokud máš nějaký nápad nebo jsi našel chybu, napiš ji do ' + link(dashboardUrl, 'dashboardu') + '.'; },
        function () { return 'Poznáš, co je to za stavbu na pozadí?'; },
        function () { return 'Nezapomeň na upozornění nahoře!'; },
        function () { return 'Už jsi vyzkoušel nový ' + link('./apps/modul-dtm/index.html', 'Modul DTM') + ' / ' + link('./apps/modul-katastr/index.html', 'Katastr') + '?'; },
        function () { return 'Nikam nešiř prosím tento web, jen mezi námi v práci.. :)'; }
    ];
    var ROTATE_MS = 6500;

    // ---------- PIXEL ART (20 × 28) ----------
    var PALETTE = {
        H: '#ea521f', h: '#b93f15', w: '#ff9a70',            // helma: základ, stín, odlesk
        S: '#f6c9a3', s: '#e2a77f',                          // kůže, stín
        R: '#6b4226',                                         // vlasy, obočí
        E: '#1f2937', W: '#ffffff', M: '#b4532a',             // oči, bělmo, ústa
        V: '#f97316', v: '#d65f0d',                           // reflexní vesta
        Y: '#fde047', y: '#e5c321',                           // reflexní pruh
        B: '#475569', b: '#334155',                           // rukávy
        L: '#1f2937', l: '#cbd5e1',                           // pásek, přezka
        P: '#1e3a8a', p: '#172a63',                           // kalhoty
        K: '#292524', k: '#57534e',                           // boty
        r: '#dc2626', G: '#f1f5f9', g: '#64748b'              // výtyčka (červená / bílá), anténa
    };
    var BODY = [
        '.......HHHHHH.......',
        '.....HHwwHHHHHH.....',
        '....HHwwHHHHHHHH....',
        '....HHHHHHHHHHhH....',
        '...hhhhhhhhhhhhhh...',
        '..hhhhhhhhhhhhhhhh..',
        '....RSSSSSSSSSSR....',
        '....RSRRSSSSRRSR....',
        '...sSSWESSSSWESSs...',
        '...sSSSSSSSSSSSSs...',
        '....SSSSSssSSSSS....',
        '....SSSMSSSSMSSS....',
        '....sSSSMMMMSSSs....',
        '.....sSSSSSSSSs.....',
        '......sSSSSSSs......',
        '....VVVVsSSsVVVV....',
        '..BBVVVVVVVVVVVv....',
        '..BbVYYYYYYYYYYv....',
        '..BbVVVVVVVVVVVv....',
        '..BbVVVVVVVVVVVv....',
        '..BbVyYYYYYYYYyv....',
        '..BbVVVVVVVVVVVv....',
        '..SsLLLLLlLLLLLL....',
        '....PPPPPPPPPPpp....',
        '....PPPPp..PPPPp....',
        '....PPPPp..PPPPp....',
        '...kKKKKK..kKKKKK...',
        '...KKKKKK..KKKKKK...'
    ];
    // Výtyčka s GNSS anténou (v levé ruce) – červenobílé dílky po 3 px
    var POLE = [[0, 4, 'g'], [1, 4, 'G'], [2, 4, 'g'], [0, 5, 'g'], [1, 5, 'g'], [2, 5, 'g']];
    for (var py = 6; py <= 27; py++) POLE.push([1, py, py === 27 ? 'g' : (Math.floor((py - 6) / 3) % 2 === 0 ? 'r' : 'G')]);

    // Mávající ruka – dvě polohy [sloupec, řádek, barva]
    var ARM_UP = [[16, 16, 'B'], [17, 16, 'b'], [17, 15, 'B'], [18, 15, 'b'], [17, 14, 'B'], [18, 14, 'b'],
                  [17, 13, 'B'], [18, 13, 'b'], [17, 12, 'B'], [18, 12, 'b'], [17, 11, 'S'], [18, 11, 's'],
                  [17, 10, 'S'], [18, 10, 's'], [17, 9, 'S'], [18, 9, 'S'], [16, 10, 'S']];
    var ARM_OUT = [[16, 16, 'B'], [17, 16, 'b'], [17, 15, 'B'], [18, 15, 'b'], [17, 14, 'B'], [18, 14, 'b'],
                   [18, 13, 'B'], [19, 13, 'b'], [18, 12, 'B'], [19, 12, 'b'], [18, 11, 'S'], [19, 11, 's'],
                   [18, 10, 'S'], [19, 10, 's'], [18, 9, 'S'], [19, 9, 'S'], [17, 10, 'S']];
    // Mrknutí – zavřená víčka
    var BLINK = [[6, 8, 's'], [7, 8, 's'], [12, 8, 's'], [13, 8, 's']];

    function rects(cells) {
        return cells.map(function (c) {
            return '<rect x="' + c[0] + '" y="' + c[1] + '" width="1" height="1" fill="' + PALETTE[c[2]] + '"/>';
        }).join('');
    }
    function bodyRects() {
        var out = [];
        BODY.forEach(function (row, y) {
            row.split('').forEach(function (ch, x) { if (ch !== '.') out.push([x, y, ch]); });
        });
        return rects(out);
    }
    var ART = rects(POLE) + bodyRects() +
        '<g class="jenda-arm jenda-arm-up">' + rects(ARM_UP) + '</g>' +
        '<g class="jenda-arm jenda-arm-out">' + rects(ARM_OUT) + '</g>' +
        '<g class="jenda-blink">' + rects(BLINK) + '</g>';
    function svg(viewBox) {
        return '<svg viewBox="' + viewBox + '" shape-rendering="crispEdges" aria-hidden="true">' + ART + '</svg>';
    }

    // ---------- STYLY ----------
    var css = [
        '.jenda-root{position:fixed;left:22px;bottom:0;z-index:900;font-family:inherit;pointer-events:none;}',
        '.jenda-root>*{pointer-events:auto;}',

        /* záložka přilepená ke spodní hraně – vykukuje jen horní část */
        '.jenda-teaser{position:absolute;left:0;bottom:0;display:inline-flex;align-items:center;gap:7px;padding:7px 14px 16px 7px;white-space:nowrap;',
        '  border:1px solid rgba(234,82,31,.30);border-bottom:none;border-radius:14px 14px 0 0;',
        '  background:linear-gradient(180deg,rgba(234,82,31,.12),rgba(234,82,31,.07)),#fff;color:#1e293b;',
        '  font-family:inherit;font-size:11.5px;font-weight:700;line-height:1;cursor:pointer;',
        '  box-shadow:0 -3px 14px rgba(15,23,42,.14);transform:translateY(42%);',
        '  transition:transform .35s cubic-bezier(.34,1.56,.64,1),box-shadow .2s ease;}',
        '.jenda-teaser:hover,.jenda-teaser:focus-visible{transform:translateY(0);box-shadow:0 -5px 18px rgba(15,23,42,.2);}',
        '.jenda-root.is-open .jenda-teaser,.jenda-root.is-closing .jenda-teaser{transform:translateY(110%);transition-timing-function:ease-in;transition-duration:.22s;}',
        '.jenda-teaser-face{width:28px;height:28px;border-radius:8px;background:rgba(234,82,31,.12);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;}',
        '.jenda-teaser-face svg{width:22px;height:auto;}',
        '.jenda-teaser .jenda-arm-out,.jenda-teaser .jenda-blink{display:none;}',
        '.jenda-teaser:hover .jenda-teaser-face svg{animation:jenda-hop .5s steps(2) 1;}',

        /* scéna: panáček stojí na spodní hraně, vedle něj bublina */
        '.jenda-stage{display:none;align-items:flex-end;gap:12px;}',
        '.jenda-root.is-open .jenda-stage,.jenda-root.is-closing .jenda-stage{display:flex;}',
        '.jenda-figure{width:80px;height:112px;flex-shrink:0;cursor:pointer;transform-origin:50% 100%;',
        '  filter:drop-shadow(0 -1px 0 rgba(255,255,255,.6)) drop-shadow(0 4px 6px rgba(15,23,42,.28));}',
        '.jenda-figure svg{width:100%;height:100%;display:block;}',
        '.jenda-root.is-open .jenda-figure:not(.is-shown){animation:jenda-rise .55s cubic-bezier(.34,1.56,.64,1) both;}',
        '.jenda-root.is-closing .jenda-figure{animation:jenda-sink .3s ease-in both;}',
        '.jenda-figure .jenda-arm-up{animation:jenda-wave-a .8s steps(1) infinite;}',
        '.jenda-figure .jenda-arm-out{animation:jenda-wave-b .8s steps(1) infinite;}',
        '.jenda-figure .jenda-blink{opacity:0;animation:jenda-blink 4.2s steps(1) infinite;}',
        '.jenda-figure.is-shown.is-hop{animation:jenda-hop .45s steps(3) 1;}',

        /* bublina – „nafoukne“ se od ocásku u úst panáčka */
        '.jenda-bubble{position:relative;margin-bottom:62px;max-width:260px;min-width:180px;padding:11px 32px 11px 14px;border-radius:14px;',
        '  background:#fff;color:#1e293b;border:1px solid rgba(234,82,31,.30);box-shadow:0 8px 24px rgba(15,23,42,.18);',
        '  font-size:12.5px;line-height:1.45;cursor:pointer;user-select:none;transform-origin:0% 85%;}',
        '.jenda-bubble::before{content:"";position:absolute;left:-7px;bottom:16px;width:12px;height:12px;background:inherit;',
        '  border-left:1px solid rgba(234,82,31,.30);border-bottom:1px solid rgba(234,82,31,.30);transform:rotate(45deg);}',
        '.jenda-root.is-open .jenda-bubble:not(.is-shown){animation:jenda-pop .5s cubic-bezier(.34,1.7,.64,1) .32s both;}',
        '.jenda-root.is-closing .jenda-bubble{animation:jenda-unpop .2s ease-in both;}',
        '.jenda-bubble.is-shown.is-bump{animation:jenda-bump .35s cubic-bezier(.34,1.7,.64,1) 1;}',
        '.jenda-name{display:block;font-size:10px;font-weight:800;letter-spacing:.12em;color:#ea521f;margin-bottom:3px;}',
        '.jenda-text{display:block;transition:opacity .18s ease,transform .18s ease;}',
        '.jenda-text.is-fading{opacity:0;transform:translateY(3px);}',
        '.jenda-text a{color:#ea521f;font-weight:700;text-decoration:underline dotted;}',
        '.jenda-dots{display:flex;gap:4px;margin-top:7px;}',
        '.jenda-dots span{width:5px;height:5px;border-radius:50%;background:rgba(234,82,31,.22);transition:background .2s,transform .2s;}',
        '.jenda-dots span.is-on{background:#ea521f;transform:scale(1.25);}',
        '.jenda-close{position:absolute;top:6px;right:6px;width:20px;height:20px;border:none;border-radius:5px;background:transparent;',
        '  color:#94a3b8;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
        '.jenda-close:hover{background:rgba(234,82,31,.1);color:#ea521f;}',

        'body.dark-theme .jenda-teaser{background:linear-gradient(180deg,rgba(234,82,31,.16),rgba(234,82,31,.09)),#0f172a;color:#e2e8f0;border-color:rgba(234,82,31,.34);}',
        'body.dark-theme .jenda-bubble{background:#1e293b;color:#e2e8f0;border-color:rgba(234,82,31,.35);}',
        'body.dark-theme .jenda-figure{filter:drop-shadow(0 4px 6px rgba(0,0,0,.5));}',

        '@keyframes jenda-rise{0%{transform:translateY(105%);}70%{transform:translateY(-4%) scaleY(1.03);}85%{transform:translateY(1%) scaleY(.97);}100%{transform:none;}}',
        '@keyframes jenda-sink{to{transform:translateY(105%);}}',
        '@keyframes jenda-pop{0%{opacity:0;transform:scale(.15) rotate(-6deg);}60%{opacity:1;}100%{opacity:1;transform:none;}}',
        '@keyframes jenda-unpop{to{opacity:0;transform:scale(.2) rotate(-4deg);}}',
        '@keyframes jenda-bump{0%{transform:scale(.94);}100%{transform:none;}}',
        '@keyframes jenda-wave-a{0%{opacity:1;}50%{opacity:0;}}',
        '@keyframes jenda-wave-b{0%{opacity:0;}50%{opacity:1;}}',
        '@keyframes jenda-blink{0%{opacity:0;}94%{opacity:1;}100%{opacity:0;}}',
        '@keyframes jenda-hop{50%{transform:translateY(-6px);}}',
        '@media (max-width:640px){.jenda-root{left:10px;}.jenda-figure{width:60px;height:84px;}.jenda-bubble{max-width:210px;min-width:150px;font-size:12px;margin-bottom:44px;}}',
        '@media (prefers-reduced-motion:reduce){.jenda-root *{animation:none !important;transition:none !important;}.jenda-figure .jenda-arm-out,.jenda-figure .jenda-blink{opacity:0;}}',
        '@media print{.jenda-root{display:none!important;}}'
    ].join('\n');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // ---------- DOM ----------
    var root = document.createElement('div');
    root.className = 'jenda-root';
    root.innerHTML =
        '<button type="button" class="jenda-teaser" aria-expanded="false" aria-label="Rozklikni mě – maskot J.E.N.D.A.">' +
            '<span class="jenda-teaser-face">' + svg('3 0 15 15') + '</span>rozklikni mě' +
        '</button>' +
        '<div class="jenda-stage">' +
            '<div class="jenda-figure" title="J.E.N.D.A.">' + svg('0 0 20 28') + '</div>' +
            '<div class="jenda-bubble" role="status" aria-live="polite" title="Klikni pro další">' +
                '<span class="jenda-name">J.E.N.D.A.</span>' +
                '<span class="jenda-text"></span>' +
                '<span class="jenda-dots">' + MESSAGES.map(function () { return '<span></span>'; }).join('') + '</span>' +
                '<button type="button" class="jenda-close" aria-label="Schovat">&times;</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(root);

    var teaser = root.querySelector('.jenda-teaser');
    var figure = root.querySelector('.jenda-figure');
    var bubble = root.querySelector('.jenda-bubble');
    var text = root.querySelector('.jenda-text');
    var dots = root.querySelectorAll('.jenda-dots span');
    var closeBtn = root.querySelector('.jenda-close');

    var idx = 0, timer = null, closeTimer = null;

    function restart(el, cls) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
    }
    function show(i, bump) {
        idx = (i + MESSAGES.length) % MESSAGES.length;
        text.classList.add('is-fading');
        setTimeout(function () {
            text.innerHTML = MESSAGES[idx]();
            text.classList.remove('is-fading');
        }, 170);
        dots.forEach(function (d, j) { d.classList.toggle('is-on', j === idx); });
        if (bump) restart(bubble, 'is-bump');
    }
    function schedule() {
        clearInterval(timer);
        timer = setInterval(function () { show(idx + 1, true); }, ROTATE_MS);
    }

    function open() {
        clearTimeout(closeTimer);
        root.classList.remove('is-closing');
        root.classList.add('is-open');
        teaser.setAttribute('aria-expanded', 'true');
        show(0, false);
        schedule();
    }
    function close() {
        if (!root.classList.contains('is-open')) return;
        clearInterval(timer);
        root.classList.remove('is-open');
        figure.classList.remove('is-shown', 'is-hop');
        bubble.classList.remove('is-shown', 'is-bump');
        root.classList.add('is-closing');
        teaser.setAttribute('aria-expanded', 'false');
        closeTimer = setTimeout(function () { root.classList.remove('is-closing'); }, 320);
    }

    teaser.addEventListener('click', open);
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    // Po doběhnutí příjezdové animace ji vypnout (jinak by se po poskočení / ťuknutí přehrála znovu)
    bubble.addEventListener('animationend', function (e) {
        if (e.target !== bubble) return;
        if (e.animationName === 'jenda-pop') bubble.classList.add('is-shown');
        bubble.classList.remove('is-bump');
    });
    bubble.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;      // odkaz v hlášce
        show(idx + 1, true);
        schedule();
    });
    figure.addEventListener('animationend', function (e) {
        if (e.target !== figure) return;
        if (e.animationName === 'jenda-rise') figure.classList.add('is-shown');
        figure.classList.remove('is-hop');
    });
    figure.addEventListener('click', function () { restart(figure, 'is-hop'); show(idx + 1, true); schedule(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && root.classList.contains('is-open')) close();
    });
})();
