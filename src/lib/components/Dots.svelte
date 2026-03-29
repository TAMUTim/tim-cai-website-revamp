<script lang="ts">
    import type p5 from 'p5';

    let container: HTMLDivElement;

    const SCALE = 300;
    const LENGTH = 12;
    const SPACING = 20;

    $effect(() => {
        let instance: p5;

        (async () => {
        const { default: p5 } = await import('p5');

        const body = document.body;
        const html = document.documentElement;

        let w = window.innerWidth;
        let h = Math.max(
            body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight
        );

        const offsetY = window.scrollY;

        const existingPoints = new Set<string>();
        const points: { x: number; y: number; opacity: number }[] = [];

        function addPoints() {
            for (let x = -SPACING / 2; x < w + SPACING; x += SPACING) {
                for (let y = -SPACING / 2; y < h + offsetY + SPACING; y += SPACING) {
                    const id = `${x}-${y}`;
                    if (existingPoints.has(id)) continue;
                    existingPoints.add(id);
                    points.push({ x, y, opacity: Math.random() * 0.5 + 0.5 });
                }
            }
        }

        function getForceOnPoint(sketch: p5, x: number, y: number, z: number) {
            return (sketch.noise(x / SCALE, y / SCALE, z) - 0.5) * 2 * sketch.TWO_PI;
        }

        instance = new p5((sketch: p5) => {
            sketch.setup = () => {
                sketch.createCanvas(w, h);
                sketch.background('#FFFFFF');
                sketch.stroke('#ccc');
                sketch.noFill();
                sketch.colorMode(sketch.HSL, 360, 100, 100, 255);
                sketch.noiseSeed(+new Date());
                addPoints();
            };

            sketch.draw = () => {
                sketch.background('#ffffff');
                const t = +new Date() / 10000;

                for (const p of points) {
                    const { x, y } = p;
                    const rad = getForceOnPoint(sketch, x, y, t);
                    const cosRad = sketch.cos(rad);
                    const length = (sketch.noise(x / SCALE, y / SCALE, t * 2) + 0.5) * LENGTH;
                    const nx = x + cosRad * length;
                    const ny = y + sketch.sin(rad) * length;
                    const hue = (t * 100 + x + y) % 360;

                    sketch.stroke(hue, 80, 50, (Math.abs(cosRad) * 0.8 + 0.2) * p.opacity * 255);
                    sketch.circle(nx, ny - offsetY, 1);
                }
            };

            sketch.windowResized = () => {
                w = window.outerWidth;
                h = Math.max(
                    document.body.scrollHeight, document.body.offsetHeight,
                    document.documentElement.clientHeight, document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                );
                sketch.resizeCanvas(w, h);
                addPoints();
            };
        }, container);

        })();

        return () => {
            instance?.remove();
        };
    });
</script>

<div class="absolute top-0 left-0 -z-10 pointer-events-none invert" bind:this={container}></div>
