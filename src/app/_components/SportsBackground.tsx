import type { CSSProperties } from "react";

export function SportsBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-orange-500/[0.07] blur-3xl" />
      <div className="absolute top-1/3 -left-32 h-[24rem] w-[24rem] rounded-full bg-sky-400/[0.05] blur-3xl" />
      <div className="absolute -bottom-32 right-1/4 h-[32rem] w-[32rem] rounded-full bg-emerald-400/[0.04] blur-3xl" />

      <Football className="absolute left-[6%] top-[14%] h-16 w-16 opacity-[0.06] rotate-12" />
      <Trophy className="absolute right-[8%] top-[20%] h-14 w-14 opacity-[0.07] -rotate-6" />
      <Football className="absolute right-[15%] bottom-[18%] h-20 w-20 opacity-[0.05] rotate-[-20deg]" />
      <Trophy className="absolute left-[12%] bottom-[22%] h-12 w-12 opacity-[0.06] rotate-6" />
      <Football className="absolute left-1/2 top-[8%] h-10 w-10 opacity-[0.04] -translate-x-1/2 rotate-45" />
      <Whistle className="absolute right-[28%] bottom-[12%] h-11 w-11 opacity-[0.05] rotate-[-12deg]" />
    </div>
  );
}

function Football({
  className,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="32"
        cy="32"
        r="30"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white"
      />
      <path
        d="M32 8 L38 18 L32 22 L26 18 Z M32 56 L38 46 L32 42 L26 46 Z M8 32 L18 26 L22 32 L18 38 Z M56 32 L46 38 L42 32 L46 26 Z"
        fill="currentColor"
        className="text-white"
      />
      <path
        d="M32 22 L42 28 L38 38 L32 42 L26 38 L22 28 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-white"
      />
    </svg>
  );
}

function Trophy({ className }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 12 H48 V22 C48 30 42 36 32 36 C22 36 16 30 16 22 Z"
        stroke="currentColor"
        strokeWidth="2"
        className="text-amber-200"
      />
      <path
        d="M12 14 H16 V20 C16 24 14 26 10 26 H8 V14 Z M52 14 H48 V20 C48 24 50 26 54 26 H56 V14 Z"
        stroke="currentColor"
        strokeWidth="2"
        className="text-amber-200"
      />
      <path
        d="M28 36 H36 V44 H28 Z M24 44 H40 V48 H24 Z"
        stroke="currentColor"
        strokeWidth="2"
        className="text-amber-200"
      />
      <path
        d="M20 48 H44 V52 H20 Z"
        stroke="currentColor"
        strokeWidth="2"
        className="text-amber-200"
      />
    </svg>
  );
}

function Whistle({ className }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse
        cx="28"
        cy="32"
        rx="14"
        ry="10"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white"
      />
      <path
        d="M42 28 H54 C56 28 58 30 58 32 C58 34 56 36 54 36 H42"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white"
      />
      <circle cx="22" cy="32" r="3" fill="currentColor" className="text-white" />
    </svg>
  );
}
