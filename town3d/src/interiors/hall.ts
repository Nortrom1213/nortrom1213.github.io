import * as THREE from "three";
import { Stage } from "../core/stage";
import type { Kit } from "../core/assets";
import { centered } from "../core/assets";
import { buildRoom, labelPlane, type Room } from "./room";
import { flatMat } from "../actors/chibi";
import * as panels from "../ui/panels";

// Games Hall: a cinema screen playing the Night Shift trailer, plus an arcade
// cabinet for each research mini-game that explains it and offers a shortcut.

const FURN = ["loungeSofa", "pottedPlant", "speaker", "rugRectangle", "lampSquareFloor"];

interface Cabinet {
  id: string;
  title: string;
  color: number;
  stage: string;
  spawn: string;
  blurb: string;
  paper: string;
}

const CABINETS: Cabinet[] = [
  { id: "archive", title: "The Archive", color: 0x3a5a8a, stage: "town", spawn: "from-archive", paper: "Generic Guard AI in Stealth Games with Composite Potential Fields", blurb: "Sneak through a museum at night. The guards patrol with composite potential fields: they remember where they've looked and get suspicious where they haven't." },
  { id: "tower", title: "PCG Tower", color: 0x8a3a6a, stage: "town", spawn: "from-tower", paper: "From Experience to 3D Platformer Levels via Topological Graphs", blurb: "Every climb is generated from an experience graph (rest, challenge, reward) and checked for reachability. Change the seed and climb again." },
  { id: "whodunit", title: "Tavern Whodunit", color: 0xb0602a, stage: "town", spawn: "from-tavern", paper: "CSP4SDG: Constraint and Information-Theory Based Role Identification in Social Deduction Games with LLM-Enhanced Inference", blurb: "One of the regulars is a werewolf, and some of them lie. Constraint propagation shows which suspects remain possible." },
  { id: "fireflies", title: "Firefly Meadow", color: 0x2f7d5a, stage: "town", spawn: "meadow", paper: "(Perlin) Noise as AI coordinator", blurb: "At night the fireflies by the pond follow one shared Perlin field: coordinated without talking. Switch the noise off to compare, then catch some." },
];

export class HallStage extends Stage {
  readonly id = "hall";
  readonly title = "Games Hall";
  private room!: Room;
  private video: HTMLVideoElement | null = null;
  private screens: THREE.MeshStandardMaterial[] = [];

  requiredModels(): [Kit, string][] {
    return FURN.map((n) => ["furniture", n]);
  }

  protected build() {
    const W = 18;
    const D = 13;
    this.room = buildRoom(this, { w: W, d: D, h: 5, floor: "carpet", wall: 0x2e2a40, trim: 0x1e1a2a, exit: { stage: "town", spawn: "from-hall" }, windows: 1, lightColor: 0xd8c8ff });
    const game = this.game.data.games[0];

    // Cinema screen.
    const screenW = 8;
    const screenH = 4.5;
    let screenMat: THREE.Material;
    if (game?.video) {
      const v = document.createElement("video");
      v.crossOrigin = "anonymous";
      v.src = game.video;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = "auto";
      this.video = v;
      const tex = new THREE.VideoTexture(v);
      tex.colorSpace = THREE.SRGBColorSpace;
      screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    } else {
      screenMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    }
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
    screen.position.set(0, 2.9, -D / 2 + 0.1);
    this.scene.add(screen);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(screenW + 0.4, screenH + 0.4, 0.1), flatMat(0x111118));
    frame.position.set(0, 2.9, -D / 2 + 0.04);
    this.scene.add(frame);
    const glow = new THREE.PointLight(0x9ab0ff, 6, 10, 1.6);
    glow.position.set(0, 2.6, -D / 2 + 2.5);
    this.scene.add(glow);
    // Curtains.
    for (const sx of [-1, 1]) {
      const curtain = new THREE.Mesh(new THREE.BoxGeometry(1.1, 5, 0.3), flatMat(0x8a1e2e));
      curtain.position.set(sx * (screenW / 2 + 0.75), 2.5, -D / 2 + 0.25);
      this.scene.add(curtain);
    }
    const title = labelPlane([{ text: game ? game.title : "Indie Games", size: 46 }], 900, 110, "#1e1a2a", 5);
    title.position.set(0, 0.42, -D / 2 + 0.12);
    this.scene.add(title);
    this.addInteractable({
      id: "screen",
      pos: new THREE.Vector3(0, 0, -D / 2 + 2.6),
      radius: 2.6,
      label: "Watch the Night Shift trailer (with sound)",
      markerHeight: 1.6,
      onInteract: () => panels.gamesPanel(this.game.ui, this.game.data),
    });

    // Seats.
    for (let row = 0; row < 2; row++) {
      for (const sx of [-1, 1]) {
        const s = centered("furniture", "loungeSofa", 2.6);
        s.position.set(sx * 2.4, 0, -0.6 + row * 2.4);
        this.scene.add(s);
        this.world.addBox(sx * 2.4, -0.6 + row * 2.4, 2.6, 1.1, 0, 0.9);
      }
    }
    for (const sx of [-1, 1]) {
      const sp = centered("furniture", "speaker", 3);
      sp.position.set(sx * (screenW / 2 + 1.7), 0, -D / 2 + 0.7);
      this.scene.add(sp);
    }

    // Arcade cabinets along the side walls.
    CABINETS.forEach((cab, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -1.5 + Math.floor(i / 2) * 3.4;
      this.addCabinet(cab, side * (W / 2 - 0.9), z, side > 0 ? -Math.PI / 2 : Math.PI / 2);
    });

    const p = centered("furniture", "pottedPlant", 2.6);
    p.position.set(W / 2 - 0.8, 0, D / 2 - 0.8);
    this.scene.add(p);
    const neon = labelPlane([{ text: "GAMES HALL", size: 80, color: "#ff9ad8", font: "900 80px Nunito, sans-serif" }], 800, 140, "#1e1a2a", 4);
    neon.position.set(0, 4.2, D / 2 - 0.05);
    neon.rotation.y = Math.PI;
    this.scene.add(neon);
  }

  private addCabinet(cab: Cabinet, x: number, z: number, rot: number) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.9), flatMat(cab.color));
    body.position.y = 1.0;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.35, 0.95), flatMat(0x1a1a22));
    top.position.y = 2.15;
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: cab.color, emissiveIntensity: 1.2 });
    this.screens.push(screenMat);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), screenMat);
    screen.position.set(0, 1.45, 0.46);
    screen.rotation.x = -0.15;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.4), flatMat(0x22222a));
    panel.position.set(0, 1.0, 0.55);
    panel.rotation.x = 0.4;
    const stick = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), flatMat(0xe04040));
    stick.position.set(-0.2, 1.1, 0.58);
    const marquee = labelPlane([{ text: cab.title, size: 44, font: "900 44px Nunito, sans-serif" }], 512, 96, "#1a1a22", 1.05);
    marquee.position.set(0, 2.15, 0.48);
    g.add(body, top, screen, panel, stick, marquee);
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    this.scene.add(g);
    this.world.addBox(x, z, 0.9, 1.1, 0, 2.3);
    const front = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    this.addInteractable({
      id: `cab-${cab.id}`,
      pos: new THREE.Vector3(x, 0, z).addScaledVector(front, 0.9),
      radius: 1.6,
      label: `Play the ${cab.title} cabinet`,
      markerHeight: 2.7,
      onInteract: () => {
        this.game.ui.dialogue(cab.title, "Arcade cabinet", [
          cab.blurb,
          {
            text: `Based on the paper “${cab.paper}”. Head there now?`,
            choices: [
              { label: "Take me there", action: () => void this.game.goTo(cab.stage, cab.spawn) },
              { label: "Maybe later", action: () => {} },
            ],
          },
        ]);
      },
    });
  }

  onEnter() {
    void this.video?.play().catch(() => {});
  }

  onExit() {
    this.video?.pause();
  }

  update(_dt: number, t: number) {
    this.room.update(this.game.sky.night);
    this.screens.forEach((m, i) => (m.emissiveIntensity = 0.9 + Math.sin(t * 3 + i * 1.7) * 0.3));
  }
}
