/**
 * The CombatX wordmark: chunky arcade type with the brand gradient, matching
 * the "CODE BATTLE" hero treatment at a smaller size.
 */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const scale = size === "lg" ? 1.6 : size === "sm" ? 0.8 : 1;
  return (
    <span
      className="display grad-text inline-flex select-none items-baseline"
      style={{ fontSize: `${scale * 1.1}rem` }}
    >
      CombatX
    </span>
  );
}
