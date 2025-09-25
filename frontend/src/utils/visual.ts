// Shared visual helpers used by CourseListPage and CourseDetailPage

// Lots of pleasant gradient pairs (light → rich)
export const PALETTES = [
  ["#8EC5FF", "#A78BFA"], // blue → violet
  ["#FBD38D", "#FCA5A5"], // peach → salmon
  ["#6EE7B7", "#93C5FD"], // green → blue
  ["#67E8F9", "#C4B5FD"], // cyan → soft violet
  ["#86EFAC", "#60A5FA"], // green → sky
  ["#A7F3D0", "#FDE68A"], // mint → yellow
  ["#FCA5A5", "#F0ABFC"], // rose → fuchsia
  ["#818CF8", "#06B6D4"], // indigo → cyan
  ["#FBBF24", "#FB7185"], // amber → pink
  ["#A3E635", "#14B8A6"], // lime → teal
  ["#FB923C", "#FB7185"], // orange → rose
  ["#38BDF8", "#A78BFA"], // sky → purple
  ["#34D399", "#22D3EE"], // emerald → cyan
  ["#14B8A6", "#6366F1"], // teal → indigo
  ["#8B5CF6", "#EC4899"], // violet → pink
  ["#94A3B8", "#60A5FA"], // slate → sky
  ["#A855F7", "#F59E0B"], // purple → amber
  ["#F472B6", "#38BDF8"], // pink → sky
  ["#7DD3FC", "#F0ABFC"], // light sky → light fuchsia
  ["#B4F5BD", "#7AA9FF"], // mint → periwinkle
];

// A safe set of emojis; always fall back to 📚
export const EMOJIS = [
  "🚀", "🧠", "🧪", "🛠️", "📐", "🔬", "📊", "💡",
  "🧩", "🧭", "🛰️", "🖥️", "📚", "🧵", "🪄", "⚙️", "📎", "🗂️",
];

// FNV-1a 32-bit hash (unsigned)
export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic visual from any seed
export function pickVisual(seed, salt = 0) {
  const h0 = hashStr(String(seed));
  const h  = (h0 ^ (h0 >>> 16) ^ (salt >>> 0)) >>> 0; // fully unsigned

  const paletteIndex = h % PALETTES.length;
  const emojiIndex   = ((h >>> 7) + 31) % EMOJIS.length; // zero-fill; never negative

  const [a, b] = PALETTES[paletteIndex];
  const emoji  = EMOJIS[emojiIndex] ?? "📚";
  return { a, b, emoji, paletteIndex, emojiIndex };
}

// Stable key used to seed visuals per course
export function visualKeyFromCourse(c) {
  return c?._id || c?.id || c?.courseCode || c?.courseName || JSON.stringify(c);
}
