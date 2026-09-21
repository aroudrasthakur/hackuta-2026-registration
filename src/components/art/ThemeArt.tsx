const ART = {
  cave: {
    src: "/images/cyclops-cave-clear.webp",
    width: 1800,
    height: 1113,
  },
  horse: {
    src: "/images/trojan-horse.webp",
    width: 2792,
    height: 5249,
  },
  feast: {
    src: "/images/feast.webp",
    width: 1400,
    height: 980,
  },
  temple: {
    src: "/images/temple-clear.webp",
    width: 1800,
    height: 1229,
  },
  pillars: {
    src: "/images/pillars-clear.webp",
    width: 1053,
    height: 1800,
  },
} as const;

type ThemeArtName = "cave" | "horse" | "feast" | "temple" | "pillars";

export function ThemeArt({
  name,
  className = "",
}: {
  name: ThemeArtName;
  className?: string;
}) {
  const art = ART[name];

  return (
    <div
      className={`theme-art theme-art-${name} ${className}`.trim()}
      aria-hidden="true"
    >
      <img
        src={art.src}
        alt=""
        width={art.width}
        height={art.height}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
