/**
 * Záloha, automatické ukládání a ochrana proti ztrátě rozpracovaného pasportu.
 *
 *  - Zálohovat / Načíst: JSON soubor se vším, co je ve formuláři (pole, Quill texty, tabulky,
 *    nahrané obrázky, hranice obce v mapě).
 *  - Automatické ukládání: průběžně do prohlížeče (IndexedDB, klíč = typ pasportu). Po znovuotevření
 *    pasportu se nabídne obnovení rozpracované verze.
 *  - Vymazat formulář: dialog s možností nejdřív uložit zálohu.
 *  - Zavření stránky se změnami, které nejsou v žádném záložním souboru → varování prohlížeče.
 *
 * Vyžaduje core.js. Vkládá se na konec <body>, tedy před window.onload – díky tomu si zapamatuje
 * jen statická pole formuláře (dynamicky generované řádky tabulek se obnovují přes data).
 */
(function () {
    'use strict';

    var C = window.PasportCore;
    var FORMAT = 'atomicon-pasport-zaloha';
    var VERSION = 1;

    // Globální proměnné pasportů (let/const), které nesou data mimo pole formuláře.
    var STATE_VARS = [
        'orTableData', 'vodTableData',
        'voTableData', 'voTable2Data', 'sortTable1', 'sortTable2', 'rvoDefaultColor', 'rvoList',
        'currentObecName', 'currentOkresName', 'currentKrajName'
    ];
    // Vykreslovací funkce volané po obnově (pokud v daném pasportu existují).
    var RENDERERS = [
        'renderTableEditors', 'renderOrTable', 'renderVodTable',
        'renderVoTableForm', 'renderVoTable2Form', 'updateVoTablesPreview',
        'renderRvoForm', 'renderRvoPreview'
    ];

    // Statická pole formuláře – zachycena hned při načtení skriptu.
    var fieldIds = Array.prototype.map.call(
        document.querySelectorAll('.form-panel input[id], .form-panel textarea[id], .form-panel select[id]'),
        function (el) { return el.id; }
    ).filter(function (id) {
        var el = document.getElementById(id);
        return el && el.type !== 'file';
    });

    // Cíle nahrávaných obrázků – z onchange="handleUpload(this,'p-…')" / loadGisImage(this, '…').
    var imageTargets = [];
    document.querySelectorAll('.form-panel input[type="file"]').forEach(function (inp) {
        var m = (inp.getAttribute('onchange') || '').match(/(?:handleUpload|loadGisImage)\(\s*this\s*,\s*'([^']+)'/);
        if (m && imageTargets.indexOf(m[1]) === -1) imageTargets.push(m[1]);
    });

    function quillFor(id) {
        var q = C.getGlobal('quillEditors');
        return q && q[id] ? q[id] : null;
    }

    // ---------- SBĚR DAT ----------
    function collect() {
        var fields = {};
        fieldIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox' || el.type === 'radio') fields[id] = { checked: el.checked };
            else {
                var q = quillFor(id);
                fields[id] = { value: q ? q.root.innerHTML : el.value };
            }
        });

        var images = {};
        imageTargets.forEach(function (id) {
            var el = document.getElementById(id);
            if (el && el.querySelector('img[src^="data:"]')) images[id] = el.innerHTML;
        });

        var state = {};
        STATE_VARS.forEach(function (name) {
            var v = C.getGlobal(name);
            if (v !== undefined) state[name] = C.clone(v);
        });
        var tc = C.getGlobal('tableConfig');
        if (tc) {
            state.tableConfig = {};
            Object.keys(tc).forEach(function (k) { state.tableConfig[k] = C.clone(tc[k].data); });
        }

        var map = null;
        var layer = C.getGlobal('markerLayer');
        var mapInstance = C.getGlobal('mapInstance');
        if (layer && typeof layer.getLatLngs === 'function') {
            var o = layer.options || {};
            map = {
                polygon: JSON.parse(JSON.stringify(layer.getLatLngs(), function (k, v) {
                    return (v && typeof v.lat === 'number') ? [v.lat, v.lng] : v;
                })),
                style: { color: o.color, weight: o.weight, fillColor: o.fillColor, fillOpacity: o.fillOpacity }
            };
        }
        if (mapInstance && typeof mapInstance.getCenter === 'function') {
            var c = mapInstance.getCenter();
            map = map || {};
            map.view = { lat: c.lat, lng: c.lng, zoom: mapInstance.getZoom() };
        }

        return { fields: fields, images: images, state: state, map: map };
    }

    // Otisk obsahu pro porovnání (bez pohledu mapy – posun mapy není změna obsahu).
    function keyOf(data) {
        var copy = { fields: data.fields, images: data.images, state: data.state,
                     polygon: data.map && data.map.polygon ? data.map.polygon : null };
        return JSON.stringify(copy);
    }

    // ---------- OBNOVA DAT ----------
    function apply(data) {
        var fields = data.fields || {};

        // 1) Pole formuláře
        Object.keys(fields).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el || el.type === 'file') return;
            var f = fields[id];
            if ('checked' in f) el.checked = !!f.checked;
            else el.value = f.value == null ? '' : f.value;
        });

        // 2) Navázané akce checkboxů / selectů (např. „Začít na nové stránce“)
        Object.keys(fields).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            if (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT' || el.type === 'color') {
                if (el.getAttribute('onchange')) el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // 3) Quill editory – setContents(convert) nemění výběr → editor nezíská fokus, panel neodskočí
        Object.keys(fields).forEach(function (id) {
            var q = quillFor(id);
            if (!q) return;
            q.setContents(q.clipboard.convert(fields[id].value || ''), 'silent');
            var ta = document.getElementById(id);
            if (ta) ta.value = q.root.innerHTML;
        });

        // 4) Obrázky
        imageTargets.forEach(function (id) {
            var el = document.getElementById(id);
            if (el && data.images && data.images[id]) el.innerHTML = data.images[id];
        });

        // 5) Data tabulek a další stav (až po change eventech, aby je nepřepsaly)
        var state = data.state || {};
        STATE_VARS.forEach(function (name) {
            if (name in state && C.getGlobal(name) !== undefined) C.setGlobal(name, C.clone(state[name]));
        });
        var tc = C.getGlobal('tableConfig');
        if (tc && state.tableConfig) {
            Object.keys(state.tableConfig).forEach(function (k) {
                if (tc[k] && Array.isArray(state.tableConfig[k])) tc[k].data = C.clone(state.tableConfig[k]);
            });
        }

        // 6) Mapa
        var m = data.map;
        var mapInstance = C.getGlobal('mapInstance');
        if (m && mapInstance && window.L) {
            var old = C.getGlobal('markerLayer');
            if (old) { mapInstance.removeLayer(old); C.setGlobal('markerLayer', null); }
            if (m.polygon) {
                var layer = L.polygon(m.polygon, m.style || {}).addTo(mapInstance);
                C.setGlobal('markerLayer', layer);
                mapInstance.fitBounds(layer.getBounds());
            } else if (m.view) {
                mapInstance.setView([m.view.lat, m.view.lng], m.view.zoom);
            }
        }

        // 7) Překreslení formuláře a náhledu
        RENDERERS.forEach(function (fn) {
            var f = C.getGlobal(fn);
            if (typeof f === 'function') { try { f(); } catch (e) { console.warn('Obnova: ' + fn + ' selhalo', e); } }
        });
        if (typeof window.updatePreview === 'function') window.updatePreview();
    }

    // Obnova se zachováním pozice scrollu (překreslení může stránku posunout).
    function applyKeepingScroll(data) {
        var formPanel = document.querySelector('.form-panel');
        var scrollY = window.scrollY, formScroll = formPanel ? formPanel.scrollTop : 0;
        try {
            apply(data);
        } finally {
            var restore = function () {
                window.scrollTo(0, scrollY);
                if (formPanel) formPanel.scrollTop = formScroll;
            };
            restore();
            requestAnimationFrame(restore);
            setTimeout(restore, 150);
        }
    }

    // ---------- SOUBOROVÁ ZÁLOHA ----------
    var lastFileKey = null;   // obsah posledního uloženého / načteného záložního souboru

    function exportBackup() {
        var data = collect();
        var payload = {
            format: FORMAT,
            version: VERSION,
            pasport: C.type,
            title: document.title,
            savedAt: new Date().toISOString(),
            data: data
        };
        var d = new Date();
        var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var name = ['Pasport-' + C.type, C.slug(C.obecName()), stamp].filter(Boolean).join('_') + '.json';

        var blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        lastFileKey = keyOf(data);
        C.toast('Záloha uložena: ' + name);
    }

    function importBackup(file) {
        var reader = new FileReader();
        reader.onload = function () {
            var payload;
            try { payload = JSON.parse(reader.result); } catch (e) { payload = null; }
            if (!payload || payload.format !== FORMAT || !payload.data) {
                C.modal({ title: 'Nelze načíst', html: '<p>Soubor není platná záloha pasportu.</p>' });
                return;
            }
            var go = Promise.resolve(true);
            if (payload.pasport !== C.type) {
                go = C.modal({
                    title: 'Záloha z jiného pasportu',
                    html: '<p>Záloha je z pasportu <b>' + C.esc(payload.pasport) + '</b>, tento je <b>' + C.esc(C.type) + '</b>.</p>' +
                          '<p>Vyplní se jen pole, která mají oba pasporty společná (obec, adresa, kontakty…).</p>',
                    buttons: [{ label: 'Zrušit', value: false, kind: 'ghost' }, { label: 'Přesto načíst', value: true, kind: 'primary' }]
                });
            }
            go.then(function (ok) {
                if (!ok) return;
                try {
                    applyKeepingScroll(payload.data);
                    lastFileKey = keyOf(collect());
                    scheduleAutosave();
                    C.toast('Záloha načtena' + (payload.savedAt ? ' (uložena ' + new Date(payload.savedAt).toLocaleString('cs-CZ') + ')' : ''));
                } catch (e) {
                    console.error(e);
                    C.modal({ title: 'Chyba', html: '<p>Zálohu se nepodařilo načíst celou: ' + C.esc(e.message) + '</p>' });
                }
            });
        };
        reader.readAsText(file);
    }

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) importBackup(fileInput.files[0]);
        fileInput.value = '';
    });
    document.body.appendChild(fileInput);

    // ---------- AUTOMATICKÉ UKLÁDÁNÍ (IndexedDB) ----------
    var DB_NAME = 'atomicon-pasporty', STORE = 'drafts';
    var dbPromise = null;
    function db() {
        if (!dbPromise) {
            dbPromise = new Promise(function (resolve, reject) {
                if (!window.indexedDB) { reject(new Error('IndexedDB není k dispozici')); return; }
                var req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function () { reject(req.error); };
            });
        }
        return dbPromise;
    }
    function idb(mode, fn) {
        return db().then(function (d) {
            return new Promise(function (resolve, reject) {
                var tx = d.transaction(STORE, mode);
                var req = fn(tx.objectStore(STORE));
                tx.oncomplete = function () { resolve(req && req.result); };
                tx.onerror = function () { reject(tx.error); };
                tx.onabort = function () { reject(tx.error); };
            });
        });
    }
    var draftGet = function () { return idb('readonly', function (s) { return s.get(C.type); }); };
    var draftPut = function (rec) { return idb('readwrite', function (s) { return s.put(rec, C.type); }); };
    var draftDel = function () { return idb('readwrite', function (s) { return s.delete(C.type); }); };

    var baselineKey = null;   // stav čistého formuláře po načtení stránky
    var lastSavedKey = null;  // co je aktuálně v konceptu
    var autosaveOn = false;
    var autosaveTimer = null;
    var autosaveFailed = false;
    var leaving = false;

    function saveDraftNow() {
        if (!autosaveOn) return Promise.resolve();
        var data = collect();
        var k = keyOf(data);
        if (k === lastSavedKey) return Promise.resolve();
        lastSavedKey = k;
        var op = (k === baselineKey)
            ? draftDel()
            : draftPut({ savedAt: new Date().toISOString(), obec: C.obecName(), data: data });
        return op.then(function () { autosaveFailed = false; }, function (e) {
            autosaveFailed = true;
            lastSavedKey = null;
            console.warn('Automatické uložení selhalo', e);
        });
    }
    function scheduleAutosave() {
        if (!autosaveOn) return;
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(saveDraftNow, 800);
    }

    function startAutosave() {
        autosaveOn = true;
        ['input', 'change', 'click', 'keyup', 'drop', 'paste'].forEach(function (ev) {
            document.addEventListener(ev, scheduleAutosave, true);
        });
        // Pojistka pro změny bez události (asynchronně dokreslená hranice obce, import XLSX…)
        setInterval(saveDraftNow, 5000);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') saveDraftNow();
        });
    }

    function offerDraft(draft) {
        var when = draft.savedAt ? new Date(draft.savedAt).toLocaleString('cs-CZ') : '';
        return C.modal({
            title: 'Rozpracovaný pasport',
            dismissable: false,
            html: '<p>V tomto prohlížeči je uložená rozpracovaná verze pasportu ' + C.esc(C.type) +
                  (draft.obec ? ' pro obec <b>' + C.esc(draft.obec) + '</b>' : '') +
                  (when ? ' z <b>' + C.esc(when) + '</b>' : '') + '.</p>' +
                  '<p>Chcete v ní pokračovat?</p>',
            buttons: [
                { label: 'Začít nový', value: 'discard', kind: 'ghost' },
                { label: 'Pokračovat v rozpracovaném', value: 'restore', kind: 'primary' }
            ]
        });
    }

    C.ready(function () {
        baselineKey = keyOf(collect());
        lastFileKey = baselineKey;
        lastSavedKey = baselineKey;
        draftGet().then(function (draft) {
            if (!draft || !draft.data || keyOf(draft.data) === baselineKey) { startAutosave(); return; }
            return offerDraft(draft).then(function (choice) {
                if (choice === 'restore') {
                    applyKeepingScroll(draft.data);
                    lastSavedKey = keyOf(collect());
                } else {
                    return draftDel();
                }
            }).then(startAutosave);
        }).catch(function (e) {
            console.warn('Koncepty nejsou dostupné (IndexedDB):', e);
            autosaveFailed = true;
        });
    });

    // ---------- VYMAZAT FORMULÁŘ ----------
    window.resetForm = function () {
        C.modal({
            title: 'Vymazat formulář?',
            html: '<p>Všechna vyplněná data se smažou a formulář se vrátí do výchozího stavu.</p>' +
                  '<p>Pokud se k pasportu budete chtít vrátit, uložte si nejdřív zálohu.</p>',
            buttons: [
                { label: 'Zrušit', value: null, kind: 'ghost' },
                { label: 'Zálohovat a vymazat', value: 'backup', kind: 'secondary' },
                { label: 'Vymazat', value: 'clear', kind: 'danger' }
            ]
        }).then(function (choice) {
            if (!choice) return;
            if (choice === 'backup') exportBackup();
            autosaveOn = false;
            clearTimeout(autosaveTimer);
            leaving = true;
            var reload = function () { setTimeout(function () { location.reload(); }, choice === 'backup' ? 400 : 0); };
            draftDel().then(reload, reload);
        });
    };

    // ---------- VAROVÁNÍ PŘI ZAVŘENÍ ----------
    window.addEventListener('beforeunload', function (e) {
        if (leaving || baselineKey === null) return;
        saveDraftNow();
        var k = keyOf(collect());
        if (k !== lastFileKey && k !== baselineKey) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    window.PasportBackup = {
        export: exportBackup,
        import: function () { fileInput.click(); },
        collect: collect,
        isAutosaveWorking: function () { return autosaveOn && !autosaveFailed; }
    };
})();
