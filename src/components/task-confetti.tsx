import { useEffect } from "react";

const colors = [
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-cyan-500",
  "bg-violet-500",
];
const shapes = ["h-3 w-1", "size-2 rounded-full", "h-2 w-3"];

export function TaskConfetti({ burst }: { burst: number }) {
  useEffect(() => {
    if (!burst || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const container = document.createElement("div");
    container.className =
      "pointer-events-none fixed inset-0 z-50 overflow-hidden";
    container.setAttribute("aria-hidden", "true");
    document.body.append(container);

    for (let index = 0; index < 42; index++) {
      const piece = document.createElement("i");
      piece.className = `absolute left-1/2 top-3/5 rounded-xs ${colors[index % colors.length]} ${shapes[index % shapes.length]}`;
      container.append(piece);
      const x = (Math.random() - 0.5) * 640;
      const apex = 180 + Math.random() * 220;
      const spin = (Math.random() > 0.5 ? 1 : -1) * (540 + Math.random() * 540);
      const animation = piece.animate(
        [
          {
            transform: "translate(-50%, -50%) rotate(0deg) scale(.6)",
            opacity: 0,
            offset: 0,
          },
          {
            transform: `translate(calc(-50% + ${x * 0.12}px), calc(-50% - ${apex * 0.45}px)) rotate(${spin * 0.2}deg) scale(1)`,
            opacity: 1,
            offset: 0.12,
          },
          {
            transform: `translate(calc(-50% + ${x * 0.62}px), calc(-50% - ${apex}px)) rotate(${spin * 0.58}deg)`,
            opacity: 1,
            offset: 0.48,
            easing: "cubic-bezier(.45,0,1,1)",
          },
          {
            transform: `translate(calc(-50% + ${x}px), calc(-50% + 45vh)) rotate(${spin}deg)`,
            opacity: 0,
            offset: 1,
          },
        ],
        {
          delay: Math.random() * 120,
          duration: 1250 + Math.random() * 450,
          easing: "cubic-bezier(.2,.7,.3,1)",
          fill: "forwards",
        },
      );
      animation.onfinish = () => piece.remove();
    }

    const cleanup = setTimeout(() => container.remove(), 1900);
    return () => {
      clearTimeout(cleanup);
      container.remove();
    };
  }, [burst]);

  return null;
}
