import type { Tok } from "./CodePanel";

/**
 * The two snippets shown duelling in the hero. Deliberately mid-function and
 * mid-scroll — the panels are meant to read as a battle already in progress,
 * not as a tidy tutorial listing.
 */

export const JS_LINES: Tok[][] = [
  [["pl", "    "], ["kw", "let"], ["pl", " "], ["id", "tempCount"], ["pl", " "], ["op", "="], ["pl", " "], ["num", "0"], ["pl", ";"]],
  [],
  [["pl", "    "], ["kw", "for"], ["pl", " ("], ["kw", "let"], ["pl", " i "], ["op", "="], ["pl", " "], ["num", "0"], ["pl", "; i "], ["op", "<"], ["pl", " "], ["id", "actions"], ["pl", "."], ["fn", "length"], ["pl", "; i"], ["op", "++"], ["pl", ") {"]],
  [["pl", "        "], ["kw", "if"], ["pl", " ("], ["id", "actions"], ["pl", "[i] "], ["op", "==="], ["pl", " "], ["str", '"start"'], ["pl", " "], ["op", "||"], ["pl", " "], ["id", "actions"], ["pl", "[i] "], ["op", "==="]],
  [["pl", "    "], ["str", '"connect"'], ["pl", ") {"]],
  [["pl", "            "], ["id", "tempCount"], ["pl", " "], ["op", "="], ["pl", " "], ["num", "0"], ["pl", ";"]],
  [["pl", "        } "], ["kw", "else if"], ["pl", " ("], ["id", "actions"], ["pl", "[i] "], ["op", "==="], ["pl", " "], ["str", '"message"'], ["pl", ") {"]],
  [["pl", "            "], ["id", "tempCount"], ["op", "++"], ["pl", ";"]],
  [["pl", "        } "], ["kw", "else if"], ["pl", " ("], ["id", "actions"], ["pl", "[i] "], ["op", "==="], ["pl", " "], ["str", '"end"'], ["pl", ") {"]],
  [["pl", "            "], ["id", "messageCount"], ["pl", " "], ["op", "+="], ["pl", " "], ["id", "tempCount"], ["pl", ";"]],
  [["pl", "        }"]],
  [["pl", "    }"]],
];

export const GO_LINES: Tok[][] = [
  [["pl", "        }"]],
  [["pl", "        "], ["id", "isCorrectSession"], ["pl", " "], ["op", ":="], ["pl", " "], ["id", "stack"], ["pl", "["], ["num", "0"], ["pl", "] "], ["op", "=="], ["pl", " "], ["str", '"start"'], ["pl", " "], ["op", "&&"]],
  [["pl", "                "], ["id", "stack"], ["pl", "["], ["num", "1"], ["pl", "] "], ["op", "=="], ["pl", " "], ["str", '"connect"'], ["pl", " "], ["op", "&&"]],
  [["pl", "  "], ["id", "stack"], ["pl", "["], ["fn", "len"], ["pl", "("], ["id", "stack"], ["pl", ")"], ["op", "-"], ["num", "1"], ["pl", "] "], ["op", "=="], ["pl", " "], ["str", '"end"']],
  [],
  [["pl", "        "], ["kw", "if"], ["pl", " "], ["id", "isCorrectSession"], ["pl", " {"]],
  [["pl", "            "], ["id", "maxMessages"], ["pl", " "], ["op", "+="], ["pl", " "], ["fn", "len"], ["pl", "("], ["id", "stack"], ["pl", ") "], ["op", "-"], ["pl", " "], ["num", "3"]],
  [["pl", "        }"]],
  [["pl", "        "], ["id", "stack"], ["pl", " "], ["op", "="], ["pl", " "], ["id", "stack"], ["pl", "[:"], ["num", "0"], ["pl", "]"]],
  [["pl", "    }"]],
  [["pl", "}"]],
  [["pl", "    "], ["kw", "return"], ["pl", " "], ["id", "maxMessages"]],
];
