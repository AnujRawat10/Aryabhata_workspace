export type DecisionValue = "INCLUDE" | "EXCLUDE" | "MAYBE" | null;

const STYLES: Record<string, { label: string; className: string }> = {
  INCLUDE: { label: "Include", className: "bg-green-100 text-green-800" },
  EXCLUDE: { label: "Exclude", className: "bg-red-100 text-red-800" },
  MAYBE: { label: "Maybe", className: "bg-yellow-100 text-yellow-800" },
  UNREVIEWED: { label: "Unreviewed", className: "bg-gray-100 text-gray-600" },
};

export function DecisionBadge({ decision }: { decision: DecisionValue }) {
  const style = STYLES[decision ?? "UNREVIEWED"]!;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}
