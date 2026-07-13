import { useEffect, useMemo } from 'react';

const COLORS = ['#d4af6a', '#e8a49e', '#8fb98f', '#7fa8d4', '#efe6cf', '#c9a0dc'];

// A small one-shot confetti burst played from the centre of the screen when a
// new memory is added. Purely decorative and non-interactive; it removes itself
// after the animation via onDone.
export default function Salute({ onDone }) {
  const pieces = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const angle = Math.random() * 2 * Math.PI;
    const dist = 80 + Math.random() * 130;
    return {
      id: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.2,
      rot: (Math.random() * 2 - 1) * 360,
      size: 6 + Math.random() * 6,
    };
  }), []);

  useEffect(() => {
    const t = setTimeout(() => onDone && onDone(), 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="salute" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="salute-piece"
          style={{
            '--x': `${p.x}px`,
            '--y': `${p.y}px`,
            '--delay': `${p.delay}s`,
            '--rot': `${p.rot}deg`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
