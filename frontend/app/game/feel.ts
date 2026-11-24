// app/game/feel.ts — "game feel" after each physics step, shared by every screen with a playable arena:
// jump / landing dust and sounds, footsteps, a bump on the ceiling. Purely cosmetic.
import { dust } from "~/components/game/fx";
import { sfx } from "~/lib/sfx";
import { CHAR_W, type PlayerState, type StepResult } from "~/game/physics";

export interface FeelMemory {
  /** distance walked since the last footstep */
  walked: number;
  /** frames since the last bump sound, so holding jump under a ceiling doesn't buzz */
  sinceBump: number;
}

export const newFeel = (): FeelMemory => ({ walked: 0, sinceBump: 99 });

/** What the player looked like just before `stepPlayer`. */
export interface Before {
  grounded: boolean;
  vy: number;
  x: number;
}

export const before = (p: PlayerState): Before => ({ grounded: p.isGrounded, vy: p.vy, x: p.x });

const STEP_EVERY = 4.2; // arena units between footsteps

export function feel(arena: HTMLElement | null, p: PlayerState, b: Before, res: StepResult, m: FeelMemory, dt = 1) {
  const feetX = p.x + CHAR_W / 2;
  if (b.grounded && !p.isGrounded && p.vy > 0.5) {
    sfx.jump();
    dust(arena, feetX, p.y, "jump");
  }
  const fall = -b.vy;
  if (!b.grounded && p.isGrounded && fall > 0.45) {
    const strength = Math.min(1, (fall - 0.45) / 1.2);
    dust(arena, feetX, p.y, "land", strength);
    sfx.land(strength);
    m.walked = 0;
  }
  m.sinceBump += dt;
  if (res.bumpedHead && m.sinceBump > 12) {
    sfx.bump();
    m.sinceBump = 0;
  }
  if (p.isGrounded) {
    m.walked += Math.abs(p.x - b.x);
    if (m.walked >= STEP_EVERY) {
      m.walked = 0;
      sfx.step(p.surface?.kind);
    }
  }
}
