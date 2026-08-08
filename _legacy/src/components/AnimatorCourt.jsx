"use client";

import { CourtSurface, Token, FlyingBall, IDS } from "@/app/court/Court";
import ActiveRouteLayer from "@/app/play/ActiveRouteLayer";

/** Display layer — chess-schematic arrows + tokens + ball. */
export default function AnimatorCourt({
  state,
  hidePlayer = null,
  theme = "paper",
  suffix = "-anim",
  highlightPlayer = null,
}) {
  if (!state) return null;

  const routes = state.activeRoutes?.length
    ? state.activeRoutes
    : state.activeRoute
      ? [state.activeRoute]
      : [];

  return (
    <CourtSurface suffix={suffix} theme={theme}>
      <ActiveRouteLayer activeRoutes={routes} suffix={suffix} />
      {state.ballInAir && <FlyingBall x={state.ballInAir.x} y={state.ballInAir.y} />}
      {IDS.map((id) => {
        if (hidePlayer === id) return null;
        const p = state.pos[id];
        if (!p) return null;
        const hasBall =
          !state.ballInAir && (state.ballCarrier ?? state.ball) === id;
        return (
          <Token
            key={id}
            id={id}
            p={p}
            hasBall={hasBall}
            focus={highlightPlayer === id}
          />
        );
      })}
    </CourtSurface>
  );
}
