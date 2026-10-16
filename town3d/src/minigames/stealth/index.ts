import type { Game } from "../../core/game";
import type { TownStage } from "../../world/town";
import { ArchiveStage } from "./archive";

/** Registers the stealth mini-game: The Archive (stage id "archive"). */
export function install(game: Game, _town: TownStage) {
  game.register(new ArchiveStage());
}
