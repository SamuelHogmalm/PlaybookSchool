import type { CourtPalette } from "@/lib/court/palette";
import { collegeThreePointD, courtGeometry, COURT_HEIGHT, COURT_WIDTH } from "@/lib/court/courtLines";

type Props = {
  palette: CourtPalette;
};

/** Half-court chalkboard lines — geometry only, no players or actions. */
export function CourtSurface({ palette }: Props) {
  const { cx, cy, r3, leftCornerX, rightCornerX, keyL, keyR, keyH, ftR, boardY } =
    courtGeometry();
  const stroke = palette.courtLine;

  return (
    <g>
      <rect x="0" y="0" width={COURT_WIDTH} height={COURT_HEIGHT} fill={palette.wood} />
      <rect
        x="1"
        y="1"
        width={COURT_WIDTH - 2}
        height={COURT_HEIGHT - 2}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />

      <rect
        x={keyL}
        y="0"
        width={keyR - keyL}
        height={keyH}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />

      <path
        d={`M ${cx - ftR} ${keyH} A ${ftR} ${ftR} 0 0 1 ${cx + ftR} ${keyH}`}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeDasharray="7 5"
      />
      <path
        d={`M ${cx - ftR} ${keyH} A ${ftR} ${ftR} 0 0 0 ${cx + ftR} ${keyH}`}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />

      <path
        d={collegeThreePointD(cx, cy, r3, leftCornerX, rightCornerX)}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />

      <line x1={cx} y1={boardY} x2={cx} y2="0" stroke={stroke} strokeWidth="2" />
      <line x1={cx - 60} y1={boardY} x2={cx + 60} y2={boardY} stroke={stroke} strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r="9" fill="none" stroke={stroke} strokeWidth="2" />

      <line x1="0" y1={COURT_HEIGHT} x2={COURT_WIDTH} y2={COURT_HEIGHT} stroke={stroke} strokeWidth="2" />
      <path
        d={`M ${cx - ftR} ${COURT_HEIGHT} A ${ftR} ${ftR} 0 0 0 ${cx + ftR} ${COURT_HEIGHT}`}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />
    </g>
  );
}
