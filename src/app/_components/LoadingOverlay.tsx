type Props = {
  show: boolean;
};

export function LoadingOverlay({ show }: Props) {
  if (!show) return null;

  return (
    <div
      className="loading-overlay"
      aria-live="polite"
      aria-busy="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/flower.png"
        alt=""
        width={819}
        height={1024}
        className="loading-flower"
        role="status"
        aria-label="Загрузка"
        draggable={false}
      />
    </div>
  );
}
