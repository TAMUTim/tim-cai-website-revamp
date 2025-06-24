<script lang="ts">
    import P5 from 'p5-svelte';

    let body = document.body;
    let html = document.documentElement;

    let w = window.innerWidth;
    let h = Math.max(
      body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight
    );

    const offsetY = window.scrollY;

    let canvas: any;

    const SCALE = 300;
    const LENGTH = 12;
    const SPACING = 20;

    const existingPoints = new Set<string>();
    const points: { x: number, y: number, opacity: number }[] = [];

    let sketch = (p5: any) => {
        p5.setup = () => {
            canvas = p5.createCanvas(w, h);
            p5.background('#FFFFFF');
            p5.stroke('#ccc');
            p5.noFill();

            p5.colorMode(p5.HSL, 360, 100, 100, 255);

            p5.noiseSeed(+new Date());

            addPoints();
        }

        p5.draw = () => {
            p5.background('#ffffff');
            const t = +new Date() / 10000;

            for (const p of points) {
                const { x, y } = p;
                const rad = getForceOnPoint(x, y, t);
                const cosRad = p5.cos(rad);
                const length = (p5.noise(x / SCALE, y / SCALE, t * 2) + 0.5) * LENGTH;
                const nx = x + cosRad * length;
                const ny = y + p5.sin(rad) * length;
                const hue = (t * 100 + x + y) % 360;

                p5.stroke(hue, 80, 50, (Math.abs(cosRad) * 0.8 + 0.2) * p.opacity * 255);
                p5.circle(nx, ny - offsetY, 1);
            }
        }

        function getForceOnPoint(x: number, y: number, z: number) {
            return (p5.noise(x / SCALE, y / SCALE, z) - 0.5) * 2 * p5.TWO_PI;
        }
    }

    function addPoints() {
        for (let x = -SPACING / 2; x < w + SPACING; x += SPACING) {
            for (let y = -SPACING / 2; y < h + offsetY + SPACING; y += SPACING) {
                const id = `${x}-${y}`;
                if (existingPoints.has(id)) {
                    continue;
                }
                existingPoints.add(id);
                points.push({ x, y, opacity: Math.random() * 0.5 + 0.5 });
            }
        }
    }

    window.addEventListener('resize', () => {
        body = document.body;
        html = document.documentElement;

        w = window.outerWidth;
        h = Math.max(
          body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight
        );

        canvas.resize(w, h);
        addPoints();
    });
</script>

<div class="absolute bg-fixed pointer-events-none invert">
    <P5 {sketch}/>
</div>