import * as THREE from "three";
import { Stage } from "../core/stage";
import type { Kit } from "../core/assets";
import { centered } from "../core/assets";
import { buildRoom, labelPlane, type Room } from "./room";
import { flatMat } from "../actors/chibi";
import * as panels from "../ui/panels";
import { plainTitle } from "../data";

// Notebook Café: each notebook group is a cork board on the wall.

const FURN = ["tableRound", "chair", "kitchenBar", "kitchenBarEnd", "stoolBar", "kitchenCoffeeMachine", "pottedPlant", "plantSmall1", "rugRound", "lampWall", "radio"];

export class CafeStage extends Stage {
  readonly id = "cafe";
  readonly title = "Notebook Café";
  private room!: Room;
  private steam: THREE.Mesh[] = [];

  requiredModels(): [Kit, string][] {
    return FURN.map((n) => ["furniture", n]);
  }

  protected build() {
    const W = 15;
    const D = 11;
    this.room = buildRoom(this, { w: W, d: D, h: 4.2, floor: "wood", wall: 0xf0dcc0, trim: 0x7a4a2a, exit: { stage: "town", spawn: "from-cafe" }, windows: 1, lightColor: 0xffd0a0 });
    const groups = panels.notebookGroups(this.game.data);

    // Cork boards: conference groups across the north wall, journals on the side
    // walls either side of the single window (z = 0).
    const indexed = groups.map((g, i) => ({ g, i }));
    const north = indexed.filter(({ g }) => /conference|workshop/i.test(g.section + g.title));
    const rest = indexed.filter(({ i }) => !north.some((n) => n.i === i));
    const spacing = Math.min(3.3, (W - 1.2) / Math.max(1, north.length));
    north.forEach(({ g, i }, k) => {
      const x = (k - (north.length - 1) / 2) * spacing;
      this.addBoard(plainTitle(g.title), g.items.map((it) => it.name), i, x, -D / 2 + 0.08, 0, spacing - 0.25);
    });
    // Side slots avoid the window at z = 0 and the menu board on the east wall.
    const slots: [number, number, number][] = [
      [-W / 2 + 0.08, -3.3, Math.PI / 2],
      [W / 2 - 0.08, -3.3, -Math.PI / 2],
      [-W / 2 + 0.08, 3.0, Math.PI / 2],
    ];
    rest.slice(0, slots.length).forEach(({ g, i }, k) => {
      const [x, z, rot] = slots[k];
      this.addBoard(plainTitle(g.title), g.items.map((it) => it.name), i, x, z, rot, 2.8);
    });

    // Counter with coffee machine along the east side near the door.
    const counterZ = D / 2 - 2.6;
    for (let i = 0; i < 3; i++) {
      const bar = centered("furniture", i === 2 ? "kitchenBarEnd" : "kitchenBar", 2.4);
      bar.position.set(W / 2 - 3.8 + i * 1.0, 0, counterZ);
      this.scene.add(bar);
    }
    this.world.addBox(W / 2 - 2.8, counterZ, 3.2, 0.7, 0, 1.1);
    const machine = centered("furniture", "kitchenCoffeeMachine", 2.4);
    machine.position.set(W / 2 - 3.6, 1.0, counterZ);
    this.scene.add(machine);
    const radio = centered("furniture", "radio", 2.4);
    radio.position.set(W / 2 - 2.2, 1.0, counterZ);
    this.scene.add(radio);
    for (let i = 0; i < 3; i++) {
      const s = centered("furniture", "stoolBar", 2.4);
      s.position.set(W / 2 - 3.8 + i * 1.0, 0, counterZ - 0.9);
      this.scene.add(s);
    }
    const menu = labelPlane(
      [{ text: "Notebook Café", size: 58 }, { text: "conferences · workshops · journals", size: 26, font: "600 26px Nunito, sans-serif", color: "#f0d8a8" }, { text: "free coffee for PhDs", size: 24, font: "italic 600 24px Nunito, sans-serif", color: "#c8e0c0" }],
      700, 260, "#2a3a2e", 2.8);
    menu.position.set(W / 2 - 0.08, 2.9, counterZ);
    menu.rotation.y = -Math.PI / 2;
    this.scene.add(menu);
    this.addInteractable({
      id: "menu",
      pos: new THREE.Vector3(W / 2 - 2.8, 0, counterZ - 1.2),
      radius: 1.8,
      label: "Read the whole notebook",
      markerHeight: 2.4,
      onInteract: () => panels.notebookPanel(this.game.ui, this.game.data),
    });

    // Tables with cups.
    const cupMat = flatMat(0xf4efe6);
    for (const [x, z] of [[-3.5, 0.5], [0.5, 1.8], [-4.5, 3.4], [3.5, 0.2]]) {
      const t = centered("furniture", "tableRound", 2.4);
      t.position.set(x, 0, z);
      this.scene.add(t);
      this.world.addCylinder(x, z, 0.8, 0, 0.9);
      for (let k = 0; k < 2; k++) {
        const a = k * Math.PI + 0.4;
        const c = centered("furniture", "chair", 2.4);
        c.position.set(x + Math.sin(a) * 1.3, 0, z + Math.cos(a) * 1.3);
        c.rotation.y = a + Math.PI;
        this.scene.add(c);
      }
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 8), cupMat);
      cup.position.set(x + 0.15, 0.95, z);
      this.scene.add(cup);
      const steam = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }));
      steam.position.set(x + 0.15, 1.18, z);
      this.scene.add(steam);
      this.steam.push(steam);
    }
    const rug = centered("furniture", "rugRound", 3.4);
    rug.position.set(-1.5, 0.01, 1.5);
    this.scene.add(rug);
    for (const [x, z] of [[-W / 2 + 0.7, D / 2 - 0.8], [W / 2 - 0.7, -D / 2 + 0.7]]) {
      const p = centered("furniture", "pottedPlant", 2.6);
      p.position.set(x, 0, z);
      this.scene.add(p);
    }
  }

  private addBoard(title: string, names: string[], index: number, x: number, z: number, rot: number, width = 2.8) {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 520;
    const g = c.getContext("2d")!;
    g.fillStyle = "#b9875a";
    g.fillRect(0, 0, 640, 520);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(90,50,20,0.25)" : "rgba(255,220,170,0.2)";
      g.fillRect(Math.random() * 640, Math.random() * 520, 3, 3);
    }
    g.fillStyle = "#3a2a1e";
    g.fillRect(0, 0, 640, 84);
    g.fillStyle = "#fbf0d8";
    g.font = "700 40px Fraunces, Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(title.length > 26 ? title.slice(0, 25) + "…" : title, 320, 44);
    const colors = ["#fff7dc", "#fdeaea", "#e8f3ff", "#eaffe0", "#fff0cc", "#f6e8ff"];
    names.slice(0, 8).forEach((n, i) => {
      const cx = 30 + (i % 2) * 300;
      const cy = 104 + Math.floor(i / 2) * 102;
      g.save();
      g.translate(cx + 135, cy + 42);
      g.rotate(((i * 13) % 7) * 0.012 - 0.04);
      g.fillStyle = colors[(i + index) % colors.length];
      g.fillRect(-135, -40, 270, 84);
      g.fillStyle = "#c0503a";
      g.beginPath();
      g.arc(0, -32, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#3a2a1e";
      g.font = "700 30px Nunito, sans-serif";
      g.fillText(n.length > 16 ? n.slice(0, 15) + "…" : n, 0, 8);
      g.restore();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const bw = Math.min(2.8, width - 0.2);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bw * 0.8125), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.2, bw * 0.8125 + 0.18, 0.08), flatMat(0x5e3a20));
    const grp = new THREE.Group();
    frame.position.z = -0.03;
    board.position.z = 0.02;
    grp.add(frame, board);
    grp.position.set(x, 2.15, z);
    grp.rotation.y = rot;
    this.scene.add(grp);
    const front = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    this.addInteractable({
      id: `board-${index}`,
      pos: new THREE.Vector3(x, 0, z).addScaledVector(front, 0.9),
      radius: 1.9,
      label: `Read “${title}”`,
      markerHeight: 3.7,
      onInteract: () => panels.notebookPanel(this.game.ui, this.game.data, index),
    });
  }

  update(_dt: number, t: number) {
    this.room.update(this.game.sky.night);
    this.steam.forEach((s, i) => {
      s.position.y = 1.18 + ((t * 0.3 + i * 0.25) % 0.3);
      (s.material as THREE.MeshBasicMaterial).opacity = 0.35 - ((t * 0.3 + i * 0.25) % 0.3);
    });
  }
}
