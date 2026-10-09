// Shared top-level tab for page headers (Dashboard, ProjectDetail), so every
// view in the extension navigates the same way.
export default function TabButton({ label, description, badge, active, onClick }: {
  label: string;
  description?: string;
  badge?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={description}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border-b-2 transition-all whitespace-nowrap ${active
          ? 'border-[var(--vscode-button-background)]'
          : 'border-transparent opacity-60 hover:opacity-100'
        }`}
    >
      <span>{label}</span>
      {badge && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">{badge}</span>
      )}
    </button>
  );
}
