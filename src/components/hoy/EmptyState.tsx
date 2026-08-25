export default function EmptyState({
  icon,
  text,
  actionLabel,
  onAction,
}: {
  icon: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={`empty-state${actionLabel ? "" : " win"}`}>
      <span className="es-icon">{icon}</span>
      <span className="es-txt">{text}</span>
      {actionLabel && (
        <span className="es-act" onClick={onAction}>
          {actionLabel}
        </span>
      )}
    </div>
  );
}
