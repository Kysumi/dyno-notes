import { useEffect } from "react";

const colors = ["#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  flutter: number;
  phase: number;
  gravity: number;
  age: number;
  life: number;
  color: string;
}

export function TaskConfetti({ burst }: { burst: number }) {
  useEffect(() => {
    if (!burst || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;

    const width = innerWidth;
    const height = innerHeight;
    const pixelRatio = Math.min(devicePixelRatio, 2);
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.className = "pointer-events-none fixed inset-0 z-50 h-full w-full";
    canvas.setAttribute("aria-hidden", "true");
    context.scale(pixelRatio, pixelRatio);
    document.body.append(canvas);

    const particles: Particle[] = Array.from({ length: 80 }, (_, index) => {
      const fromLeft = index % 2 === 0;
      return {
        x: width * (fromLeft ? 0.12 : 0.88),
        y: height * 0.82,
        vx:
          (fromLeft ? 1 : -1) * (130 + Math.random() * 250) +
          (Math.random() - 0.5) * 80,
        vy: -(520 + Math.random() * 380),
        size: 6 + Math.random() * 7,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 14,
        flutter: 7 + Math.random() * 8,
        phase: Math.random() * Math.PI * 2,
        gravity: 650 + Math.random() * 180,
        age: -Math.random() * 0.12,
        life: 3 + Math.random(),
        color: colors[index % colors.length],
      };
    });

    let frame = 0;
    let previous = performance.now();
    const draw = (now: number) => {
      const delta = Math.min((now - previous) / 1000, 0.032);
      previous = now;
      context.clearRect(0, 0, width, height);
      let active = false;

      for (const particle of particles) {
        particle.age += delta;
        if (particle.age < 0) {
          active = true;
          continue;
        }
        if (particle.age >= particle.life || particle.y > height + 30) continue;
        active = true;

        const drag = Math.pow(0.985, delta * 60);
        particle.vx *= drag;
        particle.vy =
          particle.vy * Math.pow(0.997, delta * 60) + particle.gravity * delta;
        particle.x +=
          (particle.vx +
            Math.sin(particle.age * particle.flutter + particle.phase) * 35) *
          delta;
        particle.y += particle.vy * delta;
        particle.rotation += particle.spin * delta;

        const opacity =
          Math.min(1, particle.age * 8) *
          Math.min(1, (particle.life - particle.age) / 0.6);
        const flip = Math.cos(particle.age * particle.flutter + particle.phase);
        context.save();
        context.globalAlpha = opacity;
        context.fillStyle = particle.color;
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.scale(1, flip);
        context.fillRect(
          -particle.size / 2,
          -particle.size / 3,
          particle.size,
          particle.size * 0.66,
        );
        context.restore();
      }

      if (active) frame = requestAnimationFrame(draw);
      else canvas.remove();
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      canvas.remove();
    };
  }, [burst]);

  return null;
}
