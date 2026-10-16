import * as THREE from "three";
import { POI } from "../layout";
import { Baker, shuffler, type Ctx } from "./kit";
import { S } from "./spots";

// A small family of low-poly ducks paddling around the pond. Feed them from the
// north shore and they gather around the crumbs.

interface Duck {
  mesh: THREE.Mesh;
  pos: THREE.Vector2;
  target: THREE.Vector2;
  heading: number;
  wait: number;
  speed: number;
  dip: number;
  eating: boolean;
  follow?: Duck;
}

function bakeDuck(body: number, head: number, ring = false): THREE.Mesh {
  const b = new Baker();
  b.blob(0.22, body, 0, 0.12, 0, 0.85, 0.6, 1.25, 1);
  b.blob(0.13, body, -0.13, 0.18, -0.02, 0.5, 0.45, 1.05);
  b.blob(0.13, body, 0.13, 0.18, -0.02, 0.5, 0.45, 1.05);
  b.cone(0.08, 0.16, 4, body, 0, 0.2, -0.27, -1.1);
  b.blob(0.12, head, 0, 0.36, 0.2, 1, 1, 1.05, 1);
  if (ring) b.cyl(0.075, 0.08, 0.03, 8, 0xf4f0e8, 0, 0.27, 0.19);
  b.box(0.09, 0.035, 0.13, 0xf0a030, 0, 0.34, 0.33);
  for (const sx of [-0.065, 0.065]) b.sphere(0.022, 0x1a1a1a, sx, 0.39, 0.28);
  const m = b.build(false);
  m.rotation.order = "YXZ";
  return m;
}

export function ducks(ctx: Ctx) {
  const P = POI.pond;
  const inside = (x: number, z: number, k: number) => ((x - P.x) / (P.rx * k)) ** 2 + ((z - P.z) / (P.rz * k)) ** 2 < 1;
  const randomSpot = () => {
    for (;;) {
      const x = P.x + (Math.random() * 2 - 1) * P.rx * 0.7;
      const z = P.z + (Math.random() * 2 - 1) * P.rz * 0.7;
      if (inside(x, z, 0.7)) return new THREE.Vector2(x, z);
    }
  };
  const specs: [number, number, boolean, number][] = [
    [0x9a8a78, 0x2f7a4a, true, 1.35],
    [0x8a6a48, 0x7a5a3a, false, 1.3],
    [0xf4f0e8, 0xf4f0e8, false, 1.35],
    [0xf0d050, 0xf0d050, false, 0.8],
  ];
  const list: Duck[] = specs.map(([body, head, ring, scale], i) => {
    const mesh = bakeDuck(body, head, ring);
    mesh.scale.setScalar(scale);
    const pos = randomSpot();
    ctx.root.add(mesh);
    return { mesh, pos, target: pos.clone(), heading: Math.random() * 6, wait: i, speed: 0.55, dip: 0, eating: false };
  });
  // The duckling trails its mum.
  list[3].follow = list[1];

  // Breadcrumbs.
  const N = 10;
  const crumbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.04, 0.07), new THREE.MeshStandardMaterial({ color: 0xe8c890, roughness: 0.9 }), N);
  crumbs.visible = false;
  crumbs.frustumCulled = false;
  ctx.root.add(crumbs);
  const land = new THREE.Vector2(S.duckFeed.x, 32.4);
  const crumbState = Array.from({ length: N }, () => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, alive: false }));
  let feeding = 0;
  let cooldown = 0;
  let quackTimer = 6;
  const dummy = new THREE.Object3D();

  const feedLines = shuffler([
    "You toss some breadcrumbs. Quack-quack-quack-accepted!",
    "Crumbs away! The ducks hold an emergency committee meeting.",
    "The ducks converge. Gradient descent, but make it feathery.",
    "Breadcrumbs scattered. The duckling gets there last, but with enthusiasm.",
  ]);

  ctx.spot({
    id: "ducks",
    x: S.duckFeed.x,
    z: S.duckFeed.z,
    radius: 2.6,
    marker: 1.4,
    label: () => (cooldown > 0 ? "The ducks are still busy" : "Feed the ducks"),
    discovery: "Fed the ducks",
    onInteract: () => {
      if (cooldown > 0) {
        ctx.say("The ducks are still working through the last batch.");
        return;
      }
      cooldown = 9;
      feeding = 12;
      const hand = ctx.player().clone().add(new THREE.Vector3(0, 1.1, 0));
      crumbState.forEach((c, i) => {
        c.from.copy(hand);
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.1;
        c.to.set(land.x + Math.cos(a) * r, 0.1, land.y + Math.sin(a) * r * 0.7);
        c.t = -i * 0.05;
        c.alive = true;
      });
      crumbs.visible = true;
      ctx.synth.splash(0.6);
      list.forEach((d, i) => {
        const a = (i / list.length) * Math.PI * 2;
        d.target.set(land.x + Math.cos(a) * 0.9, land.y + 0.4 + Math.sin(a) * 0.6);
        d.wait = 0.2 + i * 0.25;
        d.speed = 1.5;
        d.eating = true;
        ctx.synth.quack(0.5 + i * 0.22);
      });
      ctx.say(`🦆 ${feedLines()}`);
    },
  });

  ctx.every((dt, t) => {
    cooldown = Math.max(0, cooldown - dt);
    if (feeding > 0) {
      feeding -= dt;
      if (feeding <= 0) {
        crumbs.visible = false;
        for (const d of list) {
          d.eating = false;
          d.speed = 0.55;
          d.target = randomSpot();
        }
      }
    }
    // Crumb arcs, then bobbing on the water.
    if (crumbs.visible) {
      crumbState.forEach((c, i) => {
        c.t += dt;
        const k = THREE.MathUtils.clamp(c.t / 0.8, 0, 1);
        if (k <= 0 || !c.alive) {
          dummy.scale.setScalar(0);
        } else {
          dummy.position.lerpVectors(c.from, c.to, k);
          dummy.position.y = THREE.MathUtils.lerp(c.from.y, c.to.y, k) + Math.sin(k * Math.PI) * 1.2 + (k >= 1 ? Math.sin(t * 2 + i) * 0.02 : 0);
          dummy.rotation.set(c.t * 3, c.t * 2, 0);
          // Fade out as the ducks eat.
          dummy.scale.setScalar(feeding < 5 ? Math.max(0, feeding / 5) : 1);
        }
        dummy.updateMatrix();
        crumbs.setMatrixAt(i, dummy.matrix);
      });
      crumbs.instanceMatrix.needsUpdate = true;
    }

    const player = ctx.player();
    const near = Math.hypot(player.x - P.x, player.z - P.z) < 16;
    quackTimer -= dt;
    if (near && quackTimer <= 0) {
      quackTimer = 7 + Math.random() * 10;
      ctx.synth.quack();
    }

    list.forEach((d, i) => {
      if (d.follow && !d.eating) {
        const f = d.follow;
        d.target.set(f.pos.x - Math.sin(f.heading) * 0.7, f.pos.y - Math.cos(f.heading) * 0.7);
        d.wait = 0;
        d.speed = f.speed + 0.15;
      }
      const dx = d.target.x - d.pos.x;
      const dz = d.target.y - d.pos.y;
      const dist = Math.hypot(dx, dz);
      let moving = false;
      if (d.wait > 0) d.wait -= dt;
      else if (dist > 0.12) {
        const want = Math.atan2(dx, dz);
        let dh = want - d.heading;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        d.heading += dh * Math.min(1, dt * 3);
        const step = Math.min(dist, d.speed * dt * (Math.abs(dh) < 1.2 ? 1 : 0.3));
        const nx = d.pos.x + Math.sin(d.heading) * step;
        const nz = d.pos.y + Math.cos(d.heading) * step;
        if (inside(nx, nz, 0.88)) d.pos.set(nx, nz);
        else d.target = randomSpot();
        moving = true;
      } else if (d.eating) {
        if (d.dip <= 0 && Math.random() < dt * 0.8) d.dip = 1;
      } else if (!d.follow) {
        d.wait = 2 + Math.random() * 5;
        d.target = randomSpot();
      }
      d.dip = Math.max(0, d.dip - dt * 1.6);
      const m = d.mesh;
      m.position.set(d.pos.x, 0.05 + Math.sin(t * 2.2 + i * 1.7) * 0.02, d.pos.y);
      m.rotation.set(Math.sin(d.dip * Math.PI) * 0.7, d.heading, moving ? Math.sin(t * 6 + i) * 0.06 : 0);
    });
  });
}
