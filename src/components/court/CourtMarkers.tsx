import type { CourtPalette } from "@/lib/court/palette";

type Props = {
  palette: CourtPalette;
  suffix?: string;
};

export function CourtMarkers({ palette, suffix = "" }: Props) {
  return (
    <defs>
      <marker
        id={`arrowCut${suffix}`}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={palette.cut} />
      </marker>
      <marker
        id={`arrowBall${suffix}`}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={palette.ball} />
      </marker>
    </defs>
  );
}

export function markerUrl(kind: "cut" | "ball", suffix = ""): string {
  return kind === "ball" ? `url(#arrowBall${suffix})` : `url(#arrowCut${suffix})`;
}
