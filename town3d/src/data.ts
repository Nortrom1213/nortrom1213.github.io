// Site content exported by Hugo at /town-data/index.json (see layouts/_default/town-data.json).

export interface Publication {
  id: string;
  year: number;
  title: string;
  authors: string;
  venue: string;
  venueFull: string;
  link: string;
  detail: string;
  featured: boolean;
  award: string;
  status: string;
  /** Plain-text abstract from the paper's Hugo page; paragraphs separated by "\n". */
  abstract?: string;
  /** Keywords from the paper page's front-matter `tags`. */
  tags?: string[];
  /** Site path of one representative figure (e.g. "/papers/<slug>.webp"); may be empty. */
  figure?: string;
  figureCaption?: string;
}

export interface NewsItem {
  year: number;
  html: string;
  text: string;
  link: string;
}

export interface NotebookGroup {
  title: string;
  items: { name: string; url: string; desc: string }[];
}

export interface NotebookSection {
  title: string;
  groups: NotebookGroup[];
}

export interface Game {
  id: string;
  title: string;
  tagline?: string;
  status: string;
  tags: string[];
  video?: string;
  poster?: string;
  description: string;
}

export interface TownData {
  generated: string;
  about: { name: string; title: string; bioHtml: string; bio: string; image: string };
  publications: Publication[];
  news: NewsItem[];
  notebook: NotebookSection[];
  games: Game[];
  links: { label: string; url: string }[];
}

export async function loadTownData(): Promise<TownData> {
  const res = await fetch("/town-data/index.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`town data: HTTP ${res.status}`);
  return (await res.json()) as TownData;
}

/** Strip the leading emoji Hugo headings carry ("📚 Conferences" -> "Conferences"). */
export function plainTitle(s: string): string {
  return s.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
