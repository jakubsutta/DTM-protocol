/**
 * Generátor map – vykreslení obsahu prvků rozvržení
 * (nadpis, text, legenda, grafické měřítko, tiráž, severka).
 * Rozměry v mm, písmo v pt – tisk odpovídá náhledu 1:1.
 */

window.MapApp = window.MapApp || {};

const pt = (v) => (+v || 0) + 'pt';

MapApp.renderers = {
    title(it) {
        const accent = it.accentLine ? ' accent' : '';
        return `<div class="li-pad">
            <div class="li-title${accent}" style="font-size:${pt(it.size)}">${escapeHtml(it.text)}</div>
            ${it.subtitle ? `<div class="li-subtitle" style="font-size:${pt(it.subSize)}">${escapeHtml(it.subtitle)}</div>` : ''}
        </div>`;
    },

    text(it) {
        return `<div class="li-pad li-text" style="font-size:${pt(it.size)};font-weight:${it.weight || 400};text-align:${it.align || 'left'}">${escapeHtml(it.text)}</div>`;
    },

    imprint(it) {
        const rows = (it.lines || []).filter(l => l.label || l.value).map(l =>
            `<div>${l.label ? `<span class="li-imp-label">${escapeHtml(l.label)}</span> ` : ''}${escapeHtml(l.value)}</div>`
        ).join('');
        return `<div class="li-pad li-imprint" style="font-size:${pt(it.size)};text-align:${it.align || 'right'}">${rows}</div>`;
    },

    legend(it) {
        const L = MapApp.legend;
        const rows = (it.legendItems || []).map((li, i) => {
            if (li.kind === 'header') {
                return `<div class="li-leg-header" style="font-size:${pt(it.headerSize)}${i ? `;margin-top:${(it.rowGap * 0.6).toFixed(2)}mm` : ''}">${escapeHtml(li.text)}</div>`;
            }
            return `<div class="li-leg-row" style="margin-top:${(+it.rowGap).toFixed(2)}mm">
                <span class="li-leg-patch" style="width:${it.patchW}mm;height:${it.patchH}mm;margin-right:${it.colGap}mm">${L.patchSvg(li, it.patchW, it.patchH)}</span>
                <span class="li-leg-label" style="font-size:${pt(it.size)}">${escapeHtml(li.text)}</span>
            </div>`;
        }).join('');
        return `<div class="li-pad li-legend">
            ${it.title ? `<div class="li-leg-title" style="font-size:${pt(it.titleSize)}">${escapeHtml(it.title)}</div>` : ''}
            ${rows}
            ${it.footer ? `<div class="li-leg-footer" style="font-size:${pt(it.headerSize)};margin-top:${(+it.rowGap).toFixed(2)}mm">${escapeHtml(it.footer)}</div>` : ''}
        </div>`;
    },

    scale(it) {
        const scale = MapApp.doc.map.scale;
        const segs = Math.max(1, Math.min(8, parseInt(it.segments, 10) || 2));
        // Délka segmentu v metrech: ruční, nebo automaticky „hezké“ číslo
        let segM = +it.segLen;
        if (!segM) {
            const target = (+it.targetWidth || 50) * scale / 1000 / segs;
            const mag = Math.pow(10, Math.floor(Math.log10(target)));
            const steps = [1, 2, 2.5, 4, 5, 10].map(s => s * mag);
            segM = steps.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
        }
        const totalM = segM * segs;
        const useKm = it.units === 'km' || (it.units !== 'm' && totalM >= 2000);
        const unit = useKm ? 'km' : 'm';
        const fmt = (m) => {
            const v = useKm ? m / 1000 : m;
            return (Math.round(v * 1000) / 1000).toString().replace('.', ',');
        };

        const segMm = segM * 1000 / scale;
        const barW = segMm * segs;
        const fs = MapApp.ptToMm(+it.size || 7.5);          // výška písma v mm
        const charW = fs * 0.55;
        const lastLabel = fmt(totalM);
        const padL = Math.max(1, fmt(0).length * charW / 2 + 0.3);
        const unitW = (unit.length + 1) * charW;
        const padR = lastLabel.length * charW / 2 + unitW + 0.5;
        const tickH = 1.6;
        const yLine = fs + 1.2 + tickH;
        const height = yLine + (it.barStyle === 'bar' ? 1.2 : 0.3);
        const width = padL + barW + padR;
        const stroke = 0.25;

        let g = '';
        if (it.barStyle === 'bar') {
            for (let i = 0; i < segs; i++) {
                g += `<rect x="${padL + i * segMm}" y="${yLine - 1.2}" width="${segMm}" height="1.2" fill="${i % 2 ? '#fff' : '#000'}" stroke="#000" stroke-width="${stroke}"/>`;
            }
        } else {
            g += `<line x1="${padL}" y1="${yLine}" x2="${padL + barW}" y2="${yLine}" stroke="#000" stroke-width="${stroke}"/>`;
            for (let i = 0; i <= segs; i++) {
                const x = padL + i * segMm;
                g += `<line x1="${x}" y1="${yLine + stroke / 2}" x2="${x}" y2="${yLine - tickH}" stroke="#000" stroke-width="${stroke}"/>`;
            }
        }
        for (let i = 0; i <= segs; i++) {
            const x = padL + i * segMm;
            g += `<text x="${x}" y="${fs}" text-anchor="middle">${fmt(segM * i)}</text>`;
        }
        g += `<text x="${padL + barW + lastLabel.length * charW / 2 + charW * 0.6}" y="${fs}" text-anchor="start">${unit}</text>`;

        const svg = `<svg class="li-scale-svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" style="font-size:${fs}px">${g}</svg>`;
        const ratio = it.showRatio
            ? `<div class="li-scale-ratio" style="font-size:${pt(it.ratioSize)};padding-left:${padL}mm;padding-right:${padR}mm">${MapApp.fmtScale(scale)}</div>`
            : '';
        return `<div class="li-pad li-scale">${svg}${ratio}</div>`;
    },

    north(it) {
        const s = +it.sizeMm || 12;
        return `<div class="li-pad li-north"><svg width="${s * 0.7}mm" height="${s}mm" viewBox="0 0 14 20">
            <text x="7" y="5.2" text-anchor="middle" font-size="5.6" font-weight="700" fill="#000">S</text>
            <polygon points="7,6.5 11.5,19 7,16 2.5,19" fill="#fff" stroke="#000" stroke-width="0.6" stroke-linejoin="round"/>
            <polygon points="7,6.5 7,16 2.5,19" fill="#000"/>
        </svg></div>`;
    }
};
