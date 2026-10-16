import type { Game } from "../core/game";
import type { TownStage } from "../world/town";
import { install as stealth } from "./stealth";
import { install as tower } from "./tower";
import { install as deduction } from "./deduction";
import { install as fireflies } from "./fireflies";

// Each research mini-game registers its stage(s) or town systems here.
export function installMinigames(game: Game, town: TownStage) {
  stealth(game, town);
  tower(game, town);
  deduction(game, town);
  fireflies(game, town);
}
