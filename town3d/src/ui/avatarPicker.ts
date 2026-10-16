import type { Game } from "../core/game";
import { save } from "../core/save";
import { VISITORS, HAIR_COLORS, TOP_COLORS } from "../actors/visitors";
import { el } from "./ui";

// Pick a visitor look: presets plus hair / outfit colour swatches. Changes apply live.

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

export function avatarPicker(game: Game): HTMLElement {
  const wrap = el("div", "avatar-picker");
  const cur = () => save.get().avatar ?? { preset: VISITORS[0].id };
  const presets = el("div", "ap-row");
  const hairRow = el("div", "ap-row ap-swatches", "<span>Hair</span>");
  const topRow = el("div", "ap-row ap-swatches", "<span>Outfit</span>");
  const refresh = () => {
    const c = cur();
    presets.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === c.preset));
    hairRow.querySelectorAll("button").forEach((b) => b.classList.toggle("on", Number(b.dataset.c) === c.hair));
    topRow.querySelectorAll("button").forEach((b) => b.classList.toggle("on", Number(b.dataset.c) === c.top));
  };
  for (const v of VISITORS) {
    const b = el("button", "ap-preset", v.name);
    b.type = "button";
    b.dataset.id = v.id;
    b.addEventListener("click", () => {
      game.setAvatar(v.id);
      game.audio.sfx("click");
      refresh();
    });
    presets.append(b);
  }
  const swatches = (row: HTMLElement, colors: number[], key: "hair" | "top") => {
    for (const c of colors) {
      const b = el("button", "ap-swatch");
      b.type = "button";
      b.style.background = hex(c);
      b.dataset.c = String(c);
      b.setAttribute("aria-label", `${key} colour ${hex(c)}`);
      b.addEventListener("click", () => {
        const a = cur();
        game.setAvatar(a.preset, key === "hair" ? c : a.hair, key === "top" ? c : a.top);
        game.audio.sfx("click");
        refresh();
      });
      row.append(b);
    }
  };
  swatches(hairRow, HAIR_COLORS, "hair");
  swatches(topRow, TOP_COLORS, "top");
  wrap.append(el("div", "ap-title", "Choose your look"), presets, hairRow, topRow);
  refresh();
  return wrap;
}
