/**
 * Helpers für Forms.
 */
import * as React from "react";

/**
 * Verhindert, dass Enter in einem Single-Line-Input/Select das gesamte Form
 * submittet. Textareas bleiben unberührt (dort ist Enter ein Zeilenumbruch).
 *
 * Verwendung: `<form onKeyDown={preventEnterSubmit}>...</form>`
 */
export function preventEnterSubmit(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;
  const target = e.target as HTMLElement;
  if (target.tagName === "TEXTAREA") return;
  // <button type="submit"> bewusst nicht ausgeschlossen — wenn der Fokus dort
  // ist, ist Enter ein expliziter Submit-Wunsch.
  if (target instanceof HTMLButtonElement && target.type === "submit") return;
  e.preventDefault();
  if (typeof target.blur === "function") target.blur();
}
