type FlowerPlacement = {
  top: string;
  left?: string;
  right?: string;
  width: number;
  rotate: number;
  opacity: number;
};

const FLOWER_ASPECT = 1024 / 819;

const FLOWERS: FlowerPlacement[] = [
  { top: "5%", left: "3%", width: 72, rotate: -18, opacity: 0.38 },
  { top: "16%", right: "5%", width: 60, rotate: 22, opacity: 0.32 },
  { top: "38%", left: "1%", width: 52, rotate: 12, opacity: 0.28 },
  { top: "52%", right: "3%", width: 80, rotate: -8, opacity: 0.35 },
  { top: "68%", left: "8%", width: 56, rotate: -25, opacity: 0.3 },
  { top: "78%", right: "10%", width: 68, rotate: 15, opacity: 0.32 },
  { top: "28%", left: "82%", width: 48, rotate: 30, opacity: 0.26 },
  { top: "85%", left: "42%", width: 44, rotate: -12, opacity: 0.28 },
];

export function SportsBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg, #0c2548 0%, #0a1e36 42%, #071525 100%)",
        }}
      />

      <div className="absolute -top-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-orange-500/[0.07] blur-3xl" />
      <div className="absolute top-1/3 -left-32 h-[24rem] w-[24rem] rounded-full bg-sky-400/[0.05] blur-3xl" />
      <div className="absolute -bottom-32 right-1/4 h-[32rem] w-[32rem] rounded-full bg-emerald-400/[0.04] blur-3xl" />

      {FLOWERS.map((flower, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src="/flower.png"
          alt=""
          width={819}
          height={1024}
          className="absolute select-none"
          draggable={false}
          style={{
            top: flower.top,
            left: flower.left,
            right: flower.right,
            width: flower.width,
            height: Math.round(flower.width * FLOWER_ASPECT),
            opacity: flower.opacity,
            transform: `rotate(${flower.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
