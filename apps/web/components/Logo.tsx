/** The CombatX wordmark. Restrained: an inked mark + a single accent slash. */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const scale = size === "lg" ? 1.5 : size === "sm" ? 0.82 : 1;
  return (
    <span
      className="inline-flex items-baseline font-semibold tracking-tight select-none"
      style={{ fontSize: `${scale * 1.15}rem`, letterSpacing: "-0.02em" }}
    >
      <span style={{ color: "var(--color-ink)" }}>combat</span>
      <span style={{ color: "var(--color-accent)" }}>X</span>
    </span>
  );
}
