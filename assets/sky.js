// Oil-pastel toolkit, light/dark theme, and the sun / waxing-waning moon sky.
// Loaded on every page.
(function () {
    var root = document.documentElement;
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) {}
    root.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');

    var font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;400;500;600&display=swap';
    document.head.appendChild(font);

    var style = document.createElement('style');
    style.textContent =
        '*{font-family:"Roboto Mono",ui-monospace,monospace!important}' +
        'h1.page-title{font-size:clamp(30px,6vw,44px)!important}' +
        'html{background:var(--peach)}body{background:transparent!important}' +
        ':root[data-theme="light"]{--peach:#ffffff;--text-dark:#8E1B34;--deep-red:#D6203A;' +
        '--medium-red:#F0508C;--warm-yellow:#FF8DB5}' +
        ':root[data-theme="dark"]{--peach:#14161f;--light-cream:#14161f;--text-dark:#CFE3FF;' +
        '--deep-red:#6FB1FF;--medium-red:#8CC4FF;--warm-yellow:#B5DCFF}' +
                '#sky{position:fixed;top:0;left:0;width:100%;height:100%;z-index:-2;pointer-events:none}' +
        '.theme-toggle{background:none;border:1px solid var(--medium-red);color:var(--medium-red);' +
        'width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;line-height:1;padding:0;' +
        'display:inline-flex;align-items:center;justify-content:center;transition:background .2s,color .2s}' +
        '.theme-toggle:hover{background:var(--medium-red);color:var(--peach)}' +
        '.header-social{align-items:center}';
    document.head.appendChild(style);

    // ───────────── Oil pastel primitives ─────────────
    function rng(seed) {
        var s = seed >>> 0;
        return function () {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    function resample(pts, step) {
        var out = [pts[0]], carry = 0;
        for (var i = 1; i < pts.length; i++) {
            var a = pts[i - 1], b = pts[i];
            var d = Math.hypot(b[0] - a[0], b[1] - a[1]);
            var pos = step - carry;
            while (pos <= d) {
                var u = pos / d;
                out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
                pos += step;
            }
            carry = d - (pos - step);
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    // o: { color, width, seed, passes, alpha }
    function stroke(c, pts, o) {
        pts = resample(pts, 2.5);
        var r = rng(o.seed || 1), w = o.width || 4, passes = o.passes || 3;
        c.save();
        c.lineCap = 'round';
        c.lineJoin = 'round';
        for (var p = 0; p < passes; p++) {
            var ph1 = r() * 6.28, ph2 = r() * 6.28;
            var f1 = 0.06 + r() * 0.05, f2 = 0.17 + r() * 0.08;
            var amp = w * 0.4;
            c.beginPath();
            for (var i = 0; i < pts.length; i++) {
                var x = pts[i][0] + Math.sin(i * f1 + ph1) * amp + Math.sin(i * f2 + ph2) * amp * 0.4;
                var y = pts[i][1] + Math.cos(i * f1 + ph2) * amp + Math.cos(i * f2 + ph1) * amp * 0.4;
                if (i) c.lineTo(x, y); else c.moveTo(x, y);
            }
            c.strokeStyle = o.color;
            c.globalAlpha = (o.alpha || 0.65) * (0.7 + 0.3 * r());
            c.lineWidth = w * (0.6 + 0.5 * r());
            c.stroke();
        }
        // waxy grain: scratch tiny gaps so the paper shows through
        c.globalCompositeOperation = 'destination-out';
        var n = Math.min(500, pts.length * 3);
        for (var k = 0; k < n; k++) {
            var q = pts[Math.floor(r() * pts.length)];
            c.globalAlpha = 0.35 + r() * 0.4;
            c.fillRect(q[0] + (r() - 0.5) * w * 1.3, q[1] + (r() - 0.5) * w * 1.3, 0.8 + r() * 1.4, 0.8 + r() * 1.4);
        }
        c.restore();
    }

    function bez(a, b, c, d, n) {
        n = n || 24;
        var out = [];
        for (var i = 0; i <= n; i++) {
            var t = i / n, u = 1 - t;
            out.push([
                u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
                u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]
            ]);
        }
        return out;
    }

    function arc(cx, cy, rx, ry, a0, a1, n) {
        n = n || 48;
        var out = [];
        for (var i = 0; i <= n; i++) {
            var a = a0 + (a1 - a0) * (i / n);
            out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
        }
        return out;
    }

    function join() {
        var out = [];
        for (var i = 0; i < arguments.length; i++) out = out.concat(arguments[i]);
        return out;
    }

    // Scribbly diagonal hatching clipped to a region (clip must already be set)
    function hatch(c, x0, y0, x1, y1, spacing, o) {
        var r = rng(o.seed || 3), k = 0;
        for (var d = x0 - (y1 - y0); d < x1; d += spacing) {
            var j = (r() - 0.5) * 2;
            stroke(c, [[d + j, y1], [d + (y1 - y0) * 0.9 + j, y0]], {
                color: o.color, width: o.width || 5, passes: 1, alpha: o.alpha || 0.7, seed: (o.seed || 3) + (k++)
            });
        }
    }

    window.Pastel = { rng: rng, stroke: stroke, bez: bez, arc: arc, join: join, hatch: hatch };

    // ───────────── Sky: sunlight by day, moon + stars + fireflies by night ─────────────
    function offscreen(w, h, dpr) {
        var cv = document.createElement('canvas');
        cv.width = Math.ceil(w * dpr);
        cv.height = Math.ceil(h * dpr);
        var c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { cv: cv, c: c };
    }

    function ready() {
        var isDark = function () { return root.getAttribute('data-theme') === 'dark'; };

        // toggle button
        var btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Toggle dark mode');
        var glyph = function () { btn.textContent = isDark() ? '☀' : '☾'; };
        glyph();
        var slot = document.querySelector('.header-social') || document.querySelector('header');
        if (slot) slot.appendChild(btn);

        // Set the colours directly as well as through the CSS variables, so the
        // switch shows instantly in every browser
        function paint() {
            var d = isDark();
            root.style.colorScheme = d ? 'dark' : 'light';
            root.style.backgroundColor = d ? '#14161f' : '#ffffff';
            void document.body.offsetHeight;
        }
        paint();

        var canvas = document.createElement('canvas');
        canvas.id = 'sky';
        document.body.insertBefore(canvas, document.body.firstChild);
        var ctx = canvas.getContext('2d');

        var W, H, dpr, R, cx, cy, size, moonLayer, beams = [], stars = [], starSprites = [], motes = [], flies = [];
        var mode = isDark() ? 'night' : 'day', alpha = 1, fadeDir = 0;

        // Slanting shafts of sunlight, drawn as pastel strokes along the light's direction
        function makeBeams() {
            var ang = 0.5, dx = Math.sin(ang), dy = Math.cos(ang), px = dy, py = -dx;
            var L = H * 1.5, r = rng(11), layers = [];
            for (var k = 0; k < 3; k++) layers.push(offscreen(W, H, 1));
            for (var i = 0; i < 4; i++) {
                var c = layers[i % 3].c, sx = -40 + i * (W * 0.34), sy = -60;
                for (var n = 0; n < 26; n++) {
                    var u = r() * 2 - 1, t0 = r() * 0.12, t1 = 0.55 + r() * 0.45;
                    var w0 = (60 + 200 * t0) / 2 * u, w1 = (60 + 200 * t1) / 2 * u;
                    stroke(c, [
                        [sx + dx * L * t0 + px * w0, sy + dy * L * t0 + py * w0],
                        [sx + dx * L * t1 + px * w1, sy + dy * L * t1 + py * w1]
                    ], { color: '#FFC93C', width: 7, passes: 1, alpha: 0.1 + r() * 0.1, seed: 100 + i * 50 + n });
                }
            }
            layers.forEach(function (l) {
                var g = l.c.createLinearGradient(0, 0, 0, H);
                g.addColorStop(0, 'rgba(0,0,0,1)');
                g.addColorStop(1, 'rgba(0,0,0,0.05)');
                l.c.globalCompositeOperation = 'destination-in';
                l.c.fillStyle = g;
                l.c.fillRect(0, 0, W, H);
            });
            return layers.map(function (l) { return l.cv; });
        }

        function makeStar(seed) {
            var L = offscreen(22, 22, dpr), c = L.c, m = 11;
            stroke(c, [[m, 2], [m, 20]], { color: '#EAF2FF', width: 2.4, passes: 2, seed: seed });
            stroke(c, [[2, m], [20, m]], { color: '#EAF2FF', width: 2.4, passes: 2, seed: seed + 1 });
            stroke(c, [[6, 6], [16, 16]], { color: '#BFD9FF', width: 1.6, passes: 1, seed: seed + 2 });
            stroke(c, [[16, 6], [6, 16]], { color: '#BFD9FF', width: 1.6, passes: 1, seed: seed + 3 });
            return L.cv;
        }

        function drawMoon(p) {
            var L = moonLayer, c = L.c, m = size / 2;
            c.clearRect(0, 0, size, size);
            var th = p * Math.PI * 2, side = p < 0.5 ? 1 : -1, k = Math.cos(th) * side;
            // faint earthshine ring
            stroke(c, arc(m, m, R, R, 0, Math.PI * 2.04), { color: '#d9d2b8', width: 2.5, passes: 1, alpha: 0.35, seed: 5 });
            if (Math.abs(Math.sin(th)) < 0.02 && Math.cos(th) > 0) return; // new moon
            var limb = arc(m, m, R, R, -Math.PI / 2, Math.PI / 2, 40);
            if (side < 0) limb = limb.map(function (q) { return [2 * m - q[0], q[1]]; });
            var term = [];
            for (var i = 0; i <= 40; i++) {
                var f = Math.PI / 2 - (i / 40) * Math.PI;
                term.push([m + k * R * Math.cos(f), m + R * Math.sin(f)]);
            }
            var shape = limb.concat(term);
            c.save();
            c.beginPath();
            shape.forEach(function (q, i) { i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); });
            c.closePath();
            c.clip();
            hatch(c, m - R, m - R, m + R, m + R, 7, { color: '#F4E4A6', width: 6, alpha: 0.8, seed: 9 });
            c.restore();
            stroke(c, shape.concat([shape[0]]), { color: '#FFF1BC', width: 4.5, passes: 3, seed: 21 });
        }

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = window.innerWidth; H = window.innerHeight;
            canvas.width = W * dpr; canvas.height = H * dpr;
            var narrow = W < 700;
            R = narrow ? 24 : 34;
            size = R * 2.8;
            cx = W - (narrow ? 56 : 110);
            cy = narrow ? 130 : 150;
            moonLayer = offscreen(size, size, dpr);
            beams = makeBeams();
            starSprites = [makeStar(1), makeStar(9), makeStar(17)];
            var r = rng(5);
            stars = []; motes = []; flies = [];
            for (var i = 0; i < 55; i++) stars.push({ x: r() * W, y: r() * H, s: 7 + r() * 9, f: 0.6 + r() * 1.6, p: r() * 6.28, k: i % 3 });
            for (i = 0; i < 28; i++) motes.push({ x: r() * W, y: r() * H, r: 1.2 + r() * 2, p: r() * 6.28, v: 0.1 + r() * 0.25 });
            for (i = 0; i < 14; i++) flies.push({ x: r() * W, y: H * 0.35 + r() * H * 0.6, a: 0.2 + r() * 0.3, b: 0.15 + r() * 0.3, p: r() * 6.28, q: r() * 6.28, c: 0.5 + r() * 0.8 });
        }
        resize();
        window.addEventListener('resize', resize);

        btn.addEventListener('click', function () {
            var next = isDark() ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) {}
            glyph();
            paint();
            fadeDir = -1;
        });

        // Keep every page/tab in step: back button (bfcache) and other tabs
        function syncTheme() {
            var t = null;
            try { t = localStorage.getItem('theme'); } catch (e) {}
            if (t !== 'dark' && t !== 'light') return; // nothing saved (or storage blocked): keep what's on screen
            if (root.getAttribute('data-theme') !== t) {
                root.setAttribute('data-theme', t);
                glyph();
                paint();
                fadeDir = -1;
            }
        }
        window.addEventListener('pageshow', syncTheme);
        window.addEventListener('storage', function (e) { if (e.key === 'theme') syncTheme(); });
        document.addEventListener('visibilitychange', function () { if (!document.hidden) syncTheme(); });

        var lastMoon = 0;
        var CYCLE = 50; // seconds for a full new → full → new swing
        function frame(now) {
            var t = now / 1000;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);

            if (fadeDir) {
                alpha += fadeDir * 0.16;
                if (alpha <= 0) { alpha = 0; mode = isDark() ? 'night' : 'day'; fadeDir = 1; }
                if (alpha >= 1 && fadeDir > 0) { alpha = 1; fadeDir = 0; }
            }

            if (mode === 'day') {
                beams.forEach(function (img, k) {
                    ctx.globalAlpha = alpha * (0.65 + 0.35 * Math.sin(t * 0.45 + k * 2.1));
                    ctx.drawImage(img, 0, 0, W, H);
                });
                // dust motes drifting down the light
                motes.forEach(function (m) {
                    m.x += m.v * 0.6; m.y += m.v;
                    if (m.x > W + 10) m.x = -10;
                    if (m.y > H + 10) m.y = -10;
                    ctx.globalAlpha = alpha * (0.35 + 0.3 * Math.sin(t * 1.2 + m.p));
                    ctx.fillStyle = '#FFB81F';
                    ctx.beginPath();
                    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
                    ctx.fill();
                });
            } else {
                if (now - lastMoon > 90) {
                    lastMoon = now;
                    drawMoon(((t / CYCLE) + 0.12) % 1);
                }
                ctx.globalAlpha = alpha;
                ctx.drawImage(moonLayer.cv, cx - size / 2, cy - size / 2, size, size);

                stars.forEach(function (s) {
                    ctx.globalAlpha = alpha * (0.35 + 0.55 * Math.max(0, Math.sin(t * s.f + s.p)));
                    ctx.drawImage(starSprites[s.k], s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
                });

                flies.forEach(function (f) {
                    var x = f.x + Math.sin(t * f.a + f.p) * 50, y = f.y + Math.cos(t * f.b + f.q) * 36;
                    var glow = Math.pow(Math.max(0, Math.sin(t * f.c + f.p)), 2);
                    if (glow < 0.02) return;
                    var g = ctx.createRadialGradient(x, y, 0, x, y, 16);
                    g.addColorStop(0, 'rgba(236,248,140,' + (0.9 * glow) + ')');
                    g.addColorStop(1, 'rgba(236,248,140,0)');
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.arc(x, y, 16, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(255,255,220,' + glow + ')';
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
    else ready();
})();
