import { useEffect } from "react";

const colors = [
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-cyan-500",
  "bg-violet-500",
];

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

    for (let index = 0; index < 36; index++) {
      const piece = document.createElement("i");
      piece.className = `absolute left-1/2 top-1/3 size-2 rounded-xs ${colors[index % colors.length]}`;
      container.append(piece);
      const angle = (index / 36) * Math.PI * 2;
      const distance = 110 + Math.random() * 260;
      piece.animate(
        [
          { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance + 180}px)) rotate(${360 + Math.random() * 540}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: 900 + Math.random() * 500,
          easing: "cubic-bezier(.15,.8,.3,1)",
        },
      );
    }

    const cleanup = setTimeout(() => container.remove(), 1500);
    return () => {
      clearTimeout(cleanup);
      container.remove();
    };
  }, [burst]);

  return null;
}
