import { useEffect, useRef } from "react";

/**
 * Minimal SVG word cloud (already in your project); kept lightweight.
 * props: data: [{ text, count }], height?: number
 */
export default function WordCloud({ data = [], height = 360 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Simple layout: biggest at center, spiral outwards
    const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 80);
    const max = Math.max(1, ...sorted.map((d) => d.count));
    const minSize = 12;
    const maxSize = 42;

    const sizeFor = (c) =>
      Math.round(minSize + (maxSize - minSize) * (c / max));

    const cx = el.viewBox.baseVal.width / 2;
    const cy = el.viewBox.baseVal.height / 2;

    const positions = [];
    const place = (w, h) => {
      const rStep = 8;
      const angleStep = 0.35;
      for (let r = 0; r < 800; r += rStep) {
        for (let a = 0; a < Math.PI * 4; a += angleStep) {
          const x = cx + r * Math.cos(a) - w / 2;
          const y = cy + r * Math.sin(a) + h / 2;
          const rect = { x, y: y - h, w, h };
          if (!positions.some((p) => intersects(p, rect))) {
            positions.push(rect);
            return { x, y };
          }
        }
      }
      return { x: Math.random() * (cx * 2), y: Math.random() * (cy * 2) };
    };

    const intersects = (a, b) =>
      !(
        a.x + a.w < b.x ||
        a.x > b.x + b.w ||
        a.y + a.h < b.y ||
        a.y > b.y + b.h
      );

    const frag = document.createDocumentFragment();
    sorted.forEach((d, i) => {
      const fontSize = sizeFor(d.count);
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("font-size", String(fontSize));
      text.setAttribute("font-weight", "700");
      text.setAttribute("fill", "#0b1020");
      text.textContent = d.text;

      // temporary measure for width/height
      el.appendChild(text);
      const bbox = text.getBBox();
      el.removeChild(text);

      const { x, y } = place(bbox.width, bbox.height);
      text.setAttribute("x", String(x));
      text.setAttribute("y", String(y));
      text.setAttribute("opacity", String(0.95 - i * 0.004));
      frag.appendChild(text);
    });

    el.replaceChildren(frag);
  }, [data]);

  return (
    <svg
      ref={ref}
      viewBox="0 0 800 400"
      style={{
        display: "block",
        width: "100%",
        height,
        background: "linear-gradient(180deg,#fff, #f9fbff)",
        border: "1px solid var(--ring)",
        borderRadius: 12,
      }}
      role="img"
      aria-label="Live word cloud"
    />
  );
}
