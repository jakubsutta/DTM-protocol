/* ==========================================================================
   Umístění plovoucích akčních tlačítek (.preview-actions) vpravo vedle
   stránky náhledu. Kotva se zadává selektorem v atributu data-anchor,
   např. <div class="preview-actions" data-anchor="#protokol">.
   Tlačítka nikdy nevyjedou z okna (max. 58 px od pravého okraje).
   ========================================================================== */
(function () {
    'use strict';

    var GAP = 14;
    var EDGE = 58;
    var queued = false;

    function place() {
        queued = false;
        var bars = document.querySelectorAll('.preview-actions[data-anchor]');
        for (var i = 0; i < bars.length; i++) {
            var bar = bars[i];
            // Kotvou je první viditelný prvek odpovídající selektoru
            // (např. "#page, #overviewPage" – přepínání zobrazení)
            var anchors = document.querySelectorAll(bar.getAttribute('data-anchor'));
            var maxLeft = document.documentElement.clientWidth - EDGE;
            var left = maxLeft;
            for (var j = 0; j < anchors.length; j++) {
                var r = anchors[j].getBoundingClientRect();
                if (r.width > 0) { left = Math.min(r.right + GAP, maxLeft); break; }
            }
            var value = Math.max(0, Math.round(left)) + 'px';
            // Zápis jen při změně – jinak by MutationObserver spouštěl smyčku
            if (bar.style.left !== value) bar.style.left = value;
        }
    }

    function schedule() {
        if (queued) return;
        queued = true;
        // setTimeout místo requestAnimationFrame – rAF neběží ve skryté záložce
        setTimeout(place, 16);
    }

    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    // Vodorovné posouvání náhledu (široké stránky) mění polohu pravého okraje
    document.addEventListener('scroll', schedule, true);

    // Náhled se často překresluje (změna formátu, orientace, přidání stránky)
    if (window.MutationObserver) {
        var start = function () {
            new MutationObserver(schedule).observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
            schedule();
        };
        if (document.body) start();
        else document.addEventListener('DOMContentLoaded', start);
    }

    window.PreviewActions = { update: schedule };
})();
