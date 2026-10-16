import type { Game } from "../../core/game";
import type { TownStage } from "../../world/town";
import { TavernStage } from "./tavern";

/** Registers the deduction mini-game: the Tavern Whodunit interior (stage "tavern"). */
export function install(game: Game, _town: TownStage) {
  game.register(new TavernStage());
}
