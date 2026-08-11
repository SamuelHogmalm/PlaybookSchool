/** Chalkboard-on-paper court palette (Playbook School default). */
export type CourtPalette = {
  wood: string;
  courtLine: string;
  panel2: string;
  text: string;
  muted: string;
  line: string;
  ball: string;
  screen: string;
  cut: string;
  ok: string;
  highlight: string;
};

export const PAPER_PALETTE: CourtPalette = {
  wood: "#16181c",
  courtLine: "#6b7280",
  panel2: "#343840",
  text: "#edeae4",
  muted: "#a8a29e",
  line: "#5c6474",
  ball: "#e8560f",
  screen: "#3e82c4",
  cut: "#c9a227",
  ok: "#2e8b57",
  highlight: "#ff2d55",
};

export const DARK_PALETTE: CourtPalette = {
  wood: "#0E1116",
  courtLine: "#3D4A5C",
  panel2: "#1C232D",
  text: "#E6EAF0",
  muted: "#8B95A5",
  line: "#2A323E",
  ball: "#FF7A2F",
  screen: "#4CC2FF",
  cut: "#C9A227",
  ok: "#3FD68C",
  highlight: "#ff2d55",
};

export function courtPalette(theme: "paper" | "dark" = "paper"): CourtPalette {
  return theme === "dark" ? DARK_PALETTE : PAPER_PALETTE;
}
