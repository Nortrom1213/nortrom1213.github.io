import * as THREE from "three";
import { Stage } from "../core/stage";
import type { Kit } from "../core/assets";
import { centered } from "../core/assets";
import { buildRoom, labelPlane, type Room } from "./room";
import { flatMat } from "../actors/chibi";
import * as panels from "../ui/panels";
import { escapeHtml, type Publication } from "../data";

// Library: one book per publication on year shelves; featured papers glow on
// lecterns; award trophies in a case; a catalogue desk for the full list.

const FURN = ["bookcaseClosedWide", "bookcaseOpen", "tableCloth", "chairCushion", "lampRoundFloor", "rugRectangle", "pottedPlant", "desk", "books", "lampRoundTable"];

export class LibraryStage extends Stage {
  readonly id = "library";
  readonly title = "Library";
  private room!: Room;
  private glowBooks: THREE.Mesh[] = [];

  requiredModels(): [Kit, string][] {
    return FURN.map((n) => ["furniture", n]);
  }

  protected build() {
    const W = 18;
    const D = 13;
    this.room = buildRoom(this, { w: W, d: D, h: 4.6, floor: "wood", wall: 0xe8dcc0, trim: 0x5e3a20, exit: { stage: "town", spawn: "from-library" }, windows: 2 });
    const pubs = this.game.data.publications;
    const years = [...new Set(pubs.map((p) => p.year))].sort((a, b) => b - a);

    // Year shelves: north wall holds the newest year; others along the side walls.
    const walls: { x: number; z: number; rot: number; len: number }[] = [
      { x: 0, z: -D / 2 + 0.45, rot: 0, len: 12 },
      { x: -W / 2 + 0.45, z: -1, rot: Math.PI / 2, len: 8 },
      { x: W / 2 - 0.45, z: -1, rot: -Math.PI / 2, len: 8 },
    ];
    years.forEach((year, i) => {
      const spot = walls[i % walls.length];
      const list = pubs.filter((p) => p.year === year);
      this.addShelf(year, list, spot.x, spot.z, spot.rot, spot.len);
    });

    // Featured lecterns in the middle aisle.
    const featured = pubs.filter((p) => p.featured);
    featured.forEach((p, i) => {
      const x = (i - (featured.length - 1) / 2) * 3.2;
      this.addLectern(p, x, 0.6);
    });

    // Trophy case for awards.
    const awarded = pubs.filter((p) => p.award);
    if (awarded.length) this.addTrophyCase(awarded, W / 2 - 2.2, D / 2 - 2.4);

    // Catalogue desk by the door.
    const desk = centered("furniture", "desk", 2.4);
    desk.position.set(-W / 2 + 2.6, 0, D / 2 - 2.4);
    this.scene.add(desk);
    const lamp = centered("furniture", "lampRoundTable", 2.4);
    lamp.position.set(-W / 2 + 2.0, 0.9, D / 2 - 2.5);
    this.scene.add(lamp);
    this.world.addBox(-W / 2 + 2.6, D / 2 - 2.4, 1.8, 1.4, 0, 1);
    const plaque = labelPlane([{ text: "Catalogue", size: 54 }, { text: `${pubs.length} papers`, size: 30, font: "600 30px Nunito, sans-serif" }], 512, 200, "#5e3a20", 1.4);
    plaque.position.set(-W / 2 + 2.6, 1.6, D / 2 - 3.1);
    this.scene.add(plaque);
    this.addInteractable({
      id: "catalogue",
      pos: new THREE.Vector3(-W / 2 + 2.6, 0, D / 2 - 2.4),
      radius: 2.2,
      label: "Browse the catalogue (all publications)",
      markerHeight: 2.2,
      onInteract: () => panels.publicationsPanel(this.game.ui, this.game.data, "all"),
    });

    // Rugs, reading tables, plants, decorative bookcases.
    const rug = centered("furniture", "rugRectangle", 4.2);
    rug.position.set(0, 0.01, 1.2);
    this.scene.add(rug);
    // Reading tables sit between the lecterns and the door, clear of the
    // catalogue desk (west) and the award case (east).
    for (const [x, z] of [[-3.3, 4.0], [3.3, 4.0]]) {
      const t = centered("furniture", "tableCloth", 2.3);
      t.position.set(x, 0, z);
      this.scene.add(t);
      this.world.addBox(x, z, 2, 1.1, 0, 0.8);
      for (const sz of [-1, 1]) {
        const c = centered("furniture", "chairCushion", 2.3);
        c.position.set(x, 0, z + sz * 1.05);
        c.rotation.y = sz > 0 ? Math.PI : 0;
        this.scene.add(c);
      }
    }
    for (const [x, z] of [[W / 2 - 0.7, D / 2 - 0.7], [-W / 2 + 0.7, D / 2 - 0.7]]) {
      const p = centered("furniture", "pottedPlant", 2.6);
      p.position.set(x, 0, z);
      this.scene.add(p);
    }
    for (const x of [-7.5, 7.5]) {
      const l = centered("furniture", "lampRoundFloor", 2.6);
      l.position.set(x * 0.9, 0, -D / 2 + 1.6);
      this.scene.add(l);
    }
    // Narrow open bookcases fill the north corners beside the main shelf.
    for (const side of [-1, 1]) {
      const bc = centered("furniture", "bookcaseOpen", 2.5);
      bc.position.set(side * (W / 2 - 1.3), 0, -D / 2 + 0.4);
      this.scene.add(bc);
      this.world.addBox(side * (W / 2 - 1.3), -D / 2 + 0.4, 1.0, 0.7, 0, 2.2);
    }
    const sign = labelPlane([{ text: "The Library", size: 70 }, { text: "papers by year · featured on lecterns", size: 28, font: "600 28px Nunito, sans-serif", color: "#f0d8a8" }], 900, 220, "#3f2a18", 4.6);
    sign.position.set(0, 4.0, -D / 2 + 0.02);
    this.scene.add(sign);
  }

  private addShelf(year: number, list: Publication[], x: number, z: number, rot: number, maxLen: number) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    const wood = flatMat(0x6a4428);
    const dark = flatMat(0x4a2e18);
    const len = Math.min(maxLen, Math.max(3.2, list.length * 0.62 + 1.2));
    const rows = list.length > 9 ? 2 : 1;
    const perRow = Math.ceil(list.length / rows);
    const H = 2.6;
    const back = new THREE.Mesh(new THREE.BoxGeometry(len, H, 0.1), dark);
    back.position.set(0, H / 2, -0.32);
    g.add(back);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.7), wood);
      side.position.set((sx * len) / 2, H / 2, 0);
      g.add(side);
    }
    const shelfYs = [0.15, 0.95, 1.75, 2.55];
    for (const y of shelfYs) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.7), wood);
      s.position.set(0, y, 0);
      g.add(s);
    }
    // Paper books on the middle shelves, filler books elsewhere.
    list.forEach((p, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const y = shelfYs[row + 1] + 0.04;
      const span = len - 0.6;
      const bx = -span / 2 + (col + 0.5) * (span / perRow);
      const hgt = 0.55 + ((p.title.length * 7) % 13) / 100;
      const color = panels.venueColor(p.venue);
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, hgt, 0.44),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7, emissive: p.featured ? 0xffc860 : 0x000000, emissiveIntensity: p.featured ? 0.25 : 0 }),
      );
      book.position.set(bx, y + hgt / 2, 0.02);
      book.rotation.z = ((i * 37) % 7) * 0.012 - 0.03;
      book.castShadow = true;
      g.add(book);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.04, 0.445), flatMat(p.award ? 0xe8c060 : 0xf0e6d0));
      band.position.set(bx, y + hgt * 0.78, 0.02);
      g.add(band);
      if (p.featured) this.glowBooks.push(book);
    });
    const fillerColors = [0x5a3a32, 0x3a4250, 0x4a5038, 0x5e4a30, 0x463a48, 0x34484a];
    for (const y of [shelfYs[0] + 0.04, shelfYs[3] - 0.78]) {
      let bx = -len / 2 + 0.3;
      while (bx < len / 2 - 0.4) {
        const w = 0.1 + Math.random() * 0.08;
        const hh = 0.42 + Math.random() * 0.2;
        if (Math.random() < 0.85) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.36), flatMat(fillerColors[Math.floor(Math.random() * fillerColors.length)]));
          b.position.set(bx, y + hh / 2, 0);
          g.add(b);
        }
        bx += w + 0.02;
      }
    }
    const plaque = labelPlane([{ text: String(year), size: 64 }], 256, 110, "#2a1a10", 0.9);
    plaque.position.set(0, H + 0.35, 0.05);
    g.add(plaque);
    g.traverse((o) => ((o as THREE.Mesh).receiveShadow = true));
    this.scene.add(g);
    const ax = Math.abs(Math.sin(rot)) > 0.5;
    this.world.addBox(x, z, ax ? 0.8 : len, ax ? len : 0.8, 0, H);
    const front = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    this.addInteractable({
      id: `shelf-${year}`,
      pos: new THREE.Vector3(x, 0, z).addScaledVector(front, 0.6),
      radius: Math.max(2.4, len / 2 + 0.6),
      label: `Browse the ${year} shelf (${list.length} paper${list.length === 1 ? "" : "s"})`,
      markerHeight: 3.3,
      onInteract: () => panels.publicationsPanel(this.game.ui, this.game.data, year),
    });
  }

  private addLectern(p: Publication, x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const wood = flatMat(0x5e3a20);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.05, 6), wood);
    post.position.y = 0.52;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.1, 8), wood);
    foot.position.y = 0.05;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.6), wood);
    top.position.y = 1.1;
    top.rotation.x = -0.35;
    const color = panels.venueColor(p.venue);
    const book = new THREE.Group();
    for (const s of [-1, 1]) {
      const page = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.46), new THREE.MeshStandardMaterial({ color: 0xfaf3e0, emissive: 0xffd890, emissiveIntensity: 0.35 }));
      page.position.set(s * 0.18, 0, 0);
      page.rotation.z = s * -0.08;
      book.add(page);
    }
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.02, 0.5), new THREE.MeshStandardMaterial({ color }));
    cover.position.y = -0.025;
    book.add(cover);
    book.position.set(0, 1.16, 0);
    book.rotation.x = -0.35;
    const light = new THREE.PointLight(0xffd080, 1.8, 3, 2);
    light.position.set(0, 1.6, 0.2);
    g.add(post, foot, top, book, light);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.scene.add(g);
    this.glowBooks.push(book.children[0] as THREE.Mesh);
    this.world.addCylinder(x, z, 0.45, 0, 1.2);
    const short = p.title.split(":")[0];
    this.addInteractable({
      id: `lectern-${p.id}`,
      pos: new THREE.Vector3(x, 0, z),
      radius: 1.6,
      label: `Read “${short.length > 38 ? short.slice(0, 36) + "…" : short}”`,
      markerHeight: 1.9,
      onInteract: () => panels.publicationPanel(this.game.ui, p, "Featured · on the lectern"),
    });
  }

  private addTrophyCase(list: Publication[], x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = -Math.PI / 2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.8), flatMat(0x5e3a20));
    base.position.y = 0.45;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 0.7), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.2, roughness: 0.05 }));
    glass.position.y = 1.4;
    g.add(base, glass);
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8b830, metalness: 0.7, roughness: 0.3, emissive: 0x402800 });
    list.forEach((_, i) => {
      const tx = (i - (list.length - 1) / 2) * 0.9;
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.08, 0.3, 10), gold);
      cup.position.set(tx, 1.32, 0);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6), gold);
      stem.position.set(tx, 1.1, 0);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.06, 8), gold);
      foot.position.set(tx, 0.97, 0);
      g.add(cup, stem, foot);
    });
    this.scene.add(g);
    this.world.addBox(x, z, 0.8, 2.2, 0, 1.9);
    this.addInteractable({
      id: "trophies",
      pos: new THREE.Vector3(x - 0.6, 0, z),
      radius: 2,
      label: "Look at the award case",
      markerHeight: 2.3,
      onInteract: () => {
        const body = list
          .map((p) => `<p><b>🏆 ${escapeHtml(p.award)}</b><br/>${escapeHtml(p.title)}<br/><span style="color:var(--ink-soft)">${escapeHtml(p.venueFull)}</span></p>`)
          .join("");
        this.game.ui.openPanel({ title: "Award Case", kicker: "Library", body });
      },
    });
  }

  update(_dt: number, t: number) {
    this.room.update(this.game.sky.night);
    for (const b of this.glowBooks) {
      const m = b.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.25 + Math.sin(t * 2 + b.position.x) * 0.12;
    }
  }
}
