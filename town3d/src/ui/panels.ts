import type { Publication, TownData, NotebookGroup } from "../data";
import { escapeHtml as h, plainTitle } from "../data";
import { el, type UI } from "./ui";
import "./paper.css";

// Content panels built from the Hugo-exported town data.

export const VENUE_COLORS: Record<string, number> = {
  "IEEE ToG": 0x2a5a8a,
  "arXiv 2026": 0x7a7a82,
  "AIIDE 2026": 0xb06a2a,
  "CHI 2026": 0x7d3a8a,
  "AAAI 2026": 0x3a4d8a,
  "PCG Workshop 2026": 0x8a6a2a,
  "CoG 2026": 0x2f7d6a,
  "FDG 2026": 0x8a3a4d,
  "AIIDE 2025": 0xa0582a,
  "CoG 2025": 0x3a7a5a,
  "FDG 2025": 0x5a3a8a,
  "MIDL 2024": 0x3a8a8a,
};

export function venueColor(venue: string): number {
  return VENUE_COLORS[venue] ?? 0x6a5040;
}

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

function pubTags(p: Publication): string[] {
  const tags: string[] = [];
  tags.push(`<span class="tag">${h(p.venue || String(p.year))}</span>`);
  if (p.award) tags.push(`<span class="tag award">🏆 ${h(p.award)}</span>`);
  if (p.status) tags.push(`<span class="tag status">${h(p.status)}</span>`);
  if (p.featured) tags.push(`<span class="tag">✦ Featured</span>`);
  return tags;
}

function pubLinks(p: Publication): string[] {
  const links: string[] = [];
  if (p.link) links.push(`<a class="linkbtn" href="${h(p.link)}" target="_blank" rel="noopener">Paper ↗</a>`);
  if (p.detail) links.push(`<a class="linkbtn alt" href="${h(p.detail)}" target="_blank" rel="noopener">Details</a>`);
  return links;
}

function pubCard(p: Publication, openable = false): string {
  const attrs = openable
    ? ` role="button" tabindex="0" data-pub="${h(p.id)}" aria-label="Open ${h(p.title)}"`
    : "";
  const hint = openable ? `<span class="pub-open">${p.abstract || p.figure ? "Open book →" : "Open →"}</span>` : "";
  return `<div class="pub${openable ? " openable" : ""}"${attrs}>
    <div class="spine" style="background:${hex(venueColor(p.venue))}"></div>
    <div>
      <div class="t">${h(p.title)}</div>
      <div class="a">${h(p.authors)}</div>
      <div class="v">${h(p.venueFull)}</div>
      <div class="meta">${pubTags(p).join("")}${pubLinks(p).join("")}${hint}</div>
    </div>
  </div>`;
}

/** The "opened book" view of one paper: header, figure, abstract, keywords, links. */
function paperView(p: Publication): HTMLElement {
  const root = el("article", "paper-book");
  root.style.setProperty("--paper-spine", hex(venueColor(p.venue)));
  const paras = (p.abstract ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const caption = (p.figureCaption ?? "").trim();
  const capHtml = caption.replace(/^Illustration:\s*/i, "") !== caption
    ? `<b>Illustration.</b> ${h(caption.replace(/^Illustration:\s*/i, ""))}`
    : h(caption);
  const keywords = (p.tags ?? []).filter(Boolean);
  root.innerHTML = `
    <header class="paper-head">
      <h3 class="paper-title">${h(p.title)}</h3>
      <div class="paper-authors">${h(p.authors)}</div>
      <div class="paper-venue">${h(p.venueFull || p.venue)}${p.year && !(p.venueFull || p.venue).includes(String(p.year)) ? ` · ${p.year}` : ""}</div>
      <div class="meta">${pubTags(p).join("")}</div>
    </header>
    ${
      p.figure
        ? `<figure class="paper-fig">
        <a href="${h(p.figure)}" target="_blank" rel="noopener" title="Open full-size figure">
          <img src="${h(p.figure)}" alt="${h(caption || `Figure from ${p.title}`)}" loading="lazy" decoding="async" />
        </a>
        ${caption ? `<figcaption>${capHtml}</figcaption>` : ""}
      </figure>`
        : ""
    }
    <section class="paper-abstract">
      <h4>Abstract</h4>
      ${paras.length ? paras.map((t) => `<p>${h(t)}</p>`).join("") : `<p class="paper-empty">The abstract is on the paper's details page.</p>`}
    </section>
    ${keywords.length ? `<div class="paper-kw" aria-label="Keywords">${keywords.map((k) => `<span>${h(k)}</span>`).join("")}</div>` : ""}
    <div class="paper-links">${pubLinks(p).join("")}</div>`;
  // A missing image should not leave a broken frame behind.
  const img = root.querySelector<HTMLImageElement>(".paper-fig img");
  img?.addEventListener("error", () => img.closest("figure")?.remove(), { once: true });
  return root;
}

export function publicationPanel(ui: UI, p: Publication, kicker = "From the shelves") {
  const venueHasYear = p.venue.includes(String(p.year));
  const title = p.title.length > 70 ? [p.venue, venueHasYear ? "" : p.year].filter(Boolean).join(" · ") || "Publication" : p.title;
  ui.openPanel({ title, kicker, body: paperView(p), wide: true });
}

export function publicationsPanel(ui: UI, data: TownData, initial: "featured" | number | "all" = "all") {
  const years = [...new Set(data.publications.map((p) => p.year))].sort((a, b) => b - a);
  const wrap = el("div");
  const tabs = el("div", "tabs");
  const list = el("div");
  const keys: ("featured" | "all" | number)[] = ["featured", "all", ...years];
  const render = (k: "featured" | "all" | number) => {
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", (t as HTMLElement).dataset.k === String(k)));
    const items = data.publications.filter((p) => (k === "all" ? true : k === "featured" ? p.featured : p.year === k));
    list.innerHTML =
      `<p style="margin:0 0 10px;color:var(--ink-soft)">${items.length} paper${items.length === 1 ? "" : "s"} · tap one to open it</p>` +
      items.map((p) => pubCard(p, true)).join("");
  };
  // Clicking a card (but not one of its links) opens the paper; the panel stack gives a ← Back button.
  const open = (target: EventTarget | null) => {
    const t = target as HTMLElement | null;
    if (!t || t.closest("a")) return;
    const card = t.closest<HTMLElement>(".pub[data-pub]");
    const p = card && data.publications.find((x) => x.id === card.dataset.pub);
    if (p) publicationPanel(ui, p, "Library catalogue");
  };
  list.addEventListener("click", (e) => open(e.target));
  list.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!(e.target as HTMLElement).matches(".pub[data-pub]")) return;
    e.preventDefault();
    open(e.target);
  });
  for (const k of keys) {
    const b = el("button", "tab", k === "featured" ? "✦ Selected" : k === "all" ? "All" : String(k));
    b.dataset.k = String(k);
    b.addEventListener("click", () => render(k));
    tabs.append(b);
  }
  wrap.append(tabs, list);
  render(initial);
  ui.openPanel({ title: "Publications", kicker: "Library catalogue", body: wrap, wide: true });
}

export function newsPanel(ui: UI, data: TownData) {
  const body = data.news
    .map((n) => `<div class="news-item"><div class="yr">${n.year}</div><div>${n.html}</div></div>`)
    .join("");
  ui.openPanel({ title: "News", kicker: "Notice board", body });
}

export function notebookGroups(data: TownData): (NotebookGroup & { section: string })[] {
  return data.notebook.flatMap((s) => s.groups.map((g) => ({ ...g, section: plainTitle(s.title) })));
}

const GROUP_COLORS = ["#2f7d74", "#c0503a", "#5a6ab0", "#b07a2a", "#7d3a8a", "#3a7a5a", "#8a3a4d"];

function groupHtml(g: NotebookGroup, i: number) {
  return `<h3>${h(plainTitle(g.title))}</h3><div class="nb-grid">${g.items
    .map((it) => `<a class="nb-card" style="border-left-color:${GROUP_COLORS[i % GROUP_COLORS.length]}" href="${h(it.url)}" target="_blank" rel="noopener"><b>${h(it.name)}</b><span>${h(it.desc)}</span></a>`)
    .join("")}</div>`;
}

export function notebookPanel(ui: UI, data: TownData, groupIndex?: number) {
  const groups = notebookGroups(data);
  if (groupIndex !== undefined && groups[groupIndex]) {
    const g = groups[groupIndex];
    ui.openPanel({ title: plainTitle(g.title), kicker: `Notebook · ${g.section}`, body: groupHtml(g, groupIndex), wide: true });
    return;
  }
  const body = data.notebook
    .map((s) => `<h3 style="font-size:1.3rem">${h(plainTitle(s.title))}</h3>` + s.groups.map((g) => groupHtml(g, groups.findIndex((x) => x.title === g.title))).join(""))
    .join("");
  ui.openPanel({ title: "Research Notebook", kicker: "Conferences & journals", body, wide: true });
}

const LINK_COLORS: Record<string, string> = {
  GitHub: "#2c2c34",
  "Google Scholar": "#3b74d8",
  LinkedIn: "#0a66c2",
  Email: "#c0503a",
  "Indie Games": "#7a2e2e",
  "Classic Site": "#2f7d5a",
};

export function linksPanel(ui: UI, data: TownData) {
  const body = `<p style="margin-top:0">Step through to anywhere:</p><div class="links-grid">${data.links
    .map((l) => {
      const ext = /^https?:|^mailto:/.test(l.url);
      return `<a href="${h(l.url)}" ${ext ? 'target="_blank" rel="noopener"' : ""} style="background:${LINK_COLORS[l.label] ?? "#5a3a8a"}">${h(l.label)}</a>`;
    })
    .join("")}</div>`;
  ui.openPanel({ title: "Travel Portal", kicker: "Links", body });
}

export function aboutPanel(ui: UI, data: TownData) {
  const a = data.about;
  const body = `<div class="about">
      <img src="${h(a.image)}" alt="Portrait of ${h(a.name)}" />
      <div>
        <h3 style="margin-top:0">${h(a.name)}</h3>
        <div style="color:var(--ink-soft);font-weight:700;margin-bottom:8px">${h(a.title)}</div>
        <div class="bio">${a.bioHtml}</div>
      </div>
    </div>
    <h3>Town guide</h3>
    <ul style="margin:0;padding-left:1.2em">
      <li><b>Library</b> (north-west): every paper on the shelves; featured ones glow on lecterns.</li>
      <li><b>Notice Board</b> (north-east): news.</li>
      <li><b>Notebook Café</b> (south-west): conferences and journals pinned on the walls.</li>
      <li><b>Games Hall</b> (south-east): indie games, plus a cabinet for each mini-game.</li>
      <li><b>Portal</b> (east): GitHub, Scholar, LinkedIn, email, the classic site.</li>
      <li><b>Mini-games</b>: The Archive (north), PCG Tower (north-east hill), the Tavern (west), Firefly Meadow (south, at night).</li>
    </ul>
    <p style="color:var(--ink-soft);font-size:0.9rem">Press <b>M</b> for the Town Menu any time — every page is one click away.</p>`;
  ui.openPanel({ title: "Welcome to Xu Town", kicker: "About", body, wide: true });
}

export function gamesPanel(ui: UI, data: TownData) {
  const body = el("div");
  for (const g of data.games) {
    const card = el("div", "game-card");
    card.innerHTML = `
      <h3>${h(g.title)}</h3>
      <div class="meta" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <span class="tag status">${h(g.status)}</span>${g.tags.map((t) => `<span class="tag">${h(t)}</span>`).join("")}
      </div>
      ${g.video ? `<video controls playsinline preload="metadata" src="${h(g.video)}#t=0.5"></video>` : ""}
      <p>${g.tagline ? `<em>${h(g.tagline)}</em> ` : ""}${h(g.description)}</p>`;
    body.append(card);
  }
  const more = el("p", undefined, `<a href="/games/" target="_blank" rel="noopener">Open the Games page ↗</a>`);
  body.append(more);
  ui.openPanel({ title: "Indie Games", kicker: "Games Hall", body, wide: true });
}
