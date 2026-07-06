/** mm:ss from a millisecond duration, clamped at zero. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Human label for a language enum. */
export function languageLabel(lang: string): string {
  switch (lang) {
    case "PYTHON":
      return "Python";
    case "JAVASCRIPT":
      return "JavaScript";
    case "CPP":
      return "C++";
    case "JAVA":
      return "Java";
    default:
      return lang;
  }
}

/** Human label for a mode enum. */
export function modeLabel(mode: string): string {
  switch (mode) {
    case "ONE_V_ONE":
      return "1 v 1";
    case "TWO_V_TWO":
      return "2 v 2";
    case "THREE_V_THREE":
      return "3 v 3";
    case "FOUR_V_FOUR":
      return "4 v 4";
    default:
      return mode;
  }
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
