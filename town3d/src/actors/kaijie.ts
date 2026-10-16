import type { Game } from "../core/game";
import * as panels from "../ui/panels";
import type { DialogueLine } from "../ui/ui";

// Branching conversation with Kaijie, the town's resident researcher.

export function kaijieConversation(game: Game) {
  const ui = game.ui;
  const d = game.data;
  const who = "Kaijie (Jay) Xu";
  const role = "PhD candidate · McGill";

  const menu = (text: string): DialogueLine => ({
    text,
    choices: [
      { label: "What do you research?", action: research },
      { label: "What's new?", action: news },
      { label: "How did you get here?", action: path },
      { label: "Show me your papers", action: () => panels.publicationsPanel(ui, d, "featured") },
      { label: "How can I reach you?", action: () => panels.linksPanel(ui, d) },
      { label: "Bye!", action: () => ui.toast("👋 See you around town!") },
    ],
  });

  function research() {
    ui.dialogue(who, role, [
      "I work on game AI and procedural content generation: levels, missions, boss fights, guard behaviour, even whole 3D worlds.",
      "Lately a lot of it mixes in large language models, computer vision for games, and optimisation / evolutionary search.",
      "Every mini-game in this town is one of those projects. The Archive's guards, the PCG Tower, the Tavern werewolf and the fireflies all run the actual ideas.",
      menu("Anything else you'd like to know?"),
    ]);
  }

  function news() {
    const items = d.news.slice(0, 3).map((n) => n.text);
    ui.dialogue(who, role, [...items.map((t, i) => (i === 0 ? `Latest: ${t}` : t)), menu("The full list is on the notice board. What else?")]);
  }

  function path() {
    ui.dialogue(who, role, [
      "I studied Computer Science and Applied Mathematics at UC Berkeley, then did an M.Sc. at Imperial College London on medical imaging.",
      "Now I'm a PhD candidate at McGill, supervised by Clark Verbrugge. He's the wizard by the library, though he'd deny the hat.",
      menu("What else can I tell you?"),
    ]);
  }

  const night = game.sky.night > 0.6;
  ui.dialogue(who, role, [
    night
      ? "Oh, hello! Couldn't sleep either? The fireflies are worth staying up for."
      : "Hi, I'm Kaijie. Welcome to my little town! This is my homepage, only walkable.",
    menu("What would you like to know?"),
  ]);
}
