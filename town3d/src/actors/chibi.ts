import * as THREE from "three";

// Code-built low-poly chibi characters with simple procedural animation.
// Proportions: ~1.55 m tall, big head, short legs.

export interface ChibiOptions {
  skin?: number;
  hair?: "short" | "spiky" | "bun" | "long" | "bald" | "none";
  hairColor?: number;
  top?: number;
  /** Hoodie adds a hood behind the neck and a front pocket. */
  hoodie?: boolean;
  pants?: number;
  shoes?: number;
  glasses?: { frame: number; lens: number; lensOpacity?: number };
  hat?: "wizard" | "feather" | "cap" | "beret" | "none";
  hatColor?: number;
  hatAccent?: number;
  robe?: number;
  beard?: number;
  apron?: number;
  scarf?: number;
  prop?: "staff" | "lute" | "scroll" | "lantern" | "tray" | "none";
  /** Slight per-character scale. */
  scale?: number;
}

export interface Chibi {
  root: THREE.Group;
  /** Advance animation. speed = horizontal speed in m/s; air = true when airborne. */
  animate(dt: number, speed: number, air: boolean): void;
  /** Make the character briefly wave / talk. */
  emote(kind: "wave" | "talk" | "jump" | "none"): void;
  setVisible(v: boolean): void;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function flatMat(color: number, opts: { rough?: number; emissive?: number; opacity?: number } = {}) {
  const key = `${color}|${opts.rough ?? 0.85}|${opts.emissive ?? 0}|${opts.opacity ?? 1}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.85,
      metalness: 0,
      flatShading: true,
      emissive: opts.emissive ?? 0,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
    });
    m.userData.cached = true;
    matCache.set(key, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

export function buildChibi(o: ChibiOptions = {}): Chibi {
  const skin = flatMat(o.skin ?? 0xf2c9a0);
  const top = flatMat(o.top ?? 0x3b6a8e);
  const pants = flatMat(o.pants ?? 0x2d2f3a);
  const shoes = flatMat(o.shoes ?? 0x3a2a20);
  const hairMat = flatMat(o.hairColor ?? 0x1b1b20, { rough: 0.7 });

  const root = new THREE.Group();
  const cords: THREE.Object3D[] = [];
  const body = new THREE.Group(); // bobs while walking
  root.add(body);

  // Legs (pivot at hip).
  const legGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.38, 8);
  legGeo.translate(0, -0.19, 0);
  const shoeGeo = new THREE.BoxGeometry(0.15, 0.09, 0.22);
  const mkLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.46, 0);
    pivot.add(mesh(legGeo, pants));
    pivot.add(mesh(shoeGeo, shoes, 0, -0.41, 0.03));
    body.add(pivot);
    return pivot;
  };
  const legL = mkLeg(-0.1);
  const legR = mkLeg(0.1);

  // Torso.
  const torsoGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.46, 14);
  const torso = mesh(torsoGeo, top, 0, 0.68, 0);
  body.add(torso);
  if (o.robe !== undefined) {
    const robe = mesh(new THREE.CylinderGeometry(0.24, 0.36, 0.62, 8), flatMat(o.robe), 0, 0.42, 0);
    body.add(robe);
    legL.visible = false;
    legR.visible = false;
    const feet = mesh(new THREE.BoxGeometry(0.34, 0.08, 0.24), shoes, 0, 0.06, 0.04);
    body.add(feet);
  }
  if (o.apron !== undefined) {
    body.add(mesh(new THREE.BoxGeometry(0.34, 0.5, 0.04), flatMat(o.apron), 0, 0.58, 0.22));
  }
  if (o.hoodie) {
    // Hood resting behind the neck and a kangaroo pocket.
    const hood = mesh(new THREE.TorusGeometry(0.17, 0.075, 6, 10), top, 0, 0.92, -0.06);
    hood.rotation.x = Math.PI / 2.3;
    body.add(hood);
    body.add(mesh(new THREE.BoxGeometry(0.26, 0.12, 0.05), flatMat(darken(o.top ?? 0x222222, 0.75)), 0, 0.58, 0.215));
    const cordMat = flatMat(0xe8e2d6);
    for (const cx of [-0.05, 0.05]) {
      const cord = new THREE.Group();
      cord.position.set(cx, 0.91, 0.2);
      cord.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), cordMat, 0, -0.07, 0));
      body.add(cord);
      cords.push(cord);
    }
  }
  if (o.scarf !== undefined) {
    const sc = mesh(new THREE.TorusGeometry(0.17, 0.06, 6, 10), flatMat(o.scarf), 0, 0.92, 0);
    sc.rotation.x = Math.PI / 2;
    body.add(sc);
  }

  // Arms (pivot at shoulder).
  const armGeo = new THREE.CylinderGeometry(0.065, 0.06, 0.36, 8);
  armGeo.translate(0, -0.18, 0);
  const handGeo = new THREE.SphereGeometry(0.07, 10, 8);
  const sleeve = o.robe !== undefined ? flatMat(o.robe) : top;
  const mkArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.27 * side, 0.86, 0);
    pivot.rotation.z = side * 0.12;
    pivot.add(mesh(armGeo, sleeve));
    pivot.add(mesh(handGeo, skin, 0, -0.39, 0));
    body.add(pivot);
    return pivot;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // Head.
  const head = new THREE.Group();
  head.position.set(0, 1.15, 0);
  body.add(head);
  const headGeo = new THREE.SphereGeometry(0.3, 20, 14);
  const skull = mesh(headGeo, skin);
  skull.scale.set(1, 0.95, 0.95);
  head.add(skull);
  // Eyes and a small mouth.
  const eyeMat = flatMat(0x1a1a22, { rough: 0.4 });
  const eyeGeo = new THREE.SphereGeometry(0.032, 6, 6);
  const eyeL = mesh(eyeGeo, eyeMat, -0.1, 0.01, 0.265);
  const eyeR = mesh(eyeGeo, eyeMat, 0.1, 0.01, 0.265);
  eyeL.scale.y = 1.35;
  eyeR.scale.y = 1.35;
  // Catch-light highlights make the eyes read as alive (they blink with the eye).
  const glint = new THREE.SphereGeometry(0.011, 6, 4);
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const e of [eyeL, eyeR]) {
    const g1 = new THREE.Mesh(glint, glintMat);
    g1.position.set(0.012, 0.012, 0.026);
    e.add(g1);
  }
  head.add(eyeL, eyeR);
  const blush = flatMat(0xf0a0a0, { opacity: 0.6 });
  head.add(mesh(new THREE.CircleGeometry(0.035, 8), blush, -0.17, -0.06, 0.245));
  head.add(mesh(new THREE.CircleGeometry(0.035, 8), blush, 0.17, -0.06, 0.245));
  const mouth = mesh(new THREE.BoxGeometry(0.06, 0.014, 0.01), flatMat(0x8a4a3a), 0, -0.1, 0.27);
  head.add(mouth);
  // Ears.
  head.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), skin, -0.29, -0.01, 0));
  head.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), skin, 0.29, -0.01, 0));

  // Hair lives in its own group so it can lag behind the head (secondary motion).
  const hairGroup = new THREE.Group();
  head.add(hairGroup);
  const hair = o.hair ?? "short";
  if (hair !== "bald" && hair !== "none") {
    const cap = mesh(new THREE.SphereGeometry(0.315, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat, 0, 0.03, -0.015);
    cap.scale.set(1.02, 1, 1.02);
    hairGroup.add(cap);
    // Fringe across the forehead.
    const fringe = mesh(new THREE.BoxGeometry(0.46, 0.09, 0.08), hairMat, 0, 0.16, 0.23);
    fringe.rotation.x = -0.35;
    hairGroup.add(fringe);
    if (hair === "spiky" || hair === "short") {
      const tuftGeo = new THREE.ConeGeometry(0.07, 0.16, 4);
      const tufts: [number, number, number, number, number][] = hair === "spiky"
        ? [[0, 0.32, 0.05, -0.3, 0], [-0.12, 0.29, 0.08, -0.3, 0.4], [0.12, 0.3, 0.06, -0.4, -0.4], [0.05, 0.31, -0.1, 0.3, -0.2], [-0.08, 0.3, -0.12, 0.4, 0.3]]
        : [[0, 0.31, 0.06, -0.5, 0], [-0.1, 0.29, 0.1, -0.6, 0.3], [0.11, 0.29, 0.09, -0.6, -0.3]];
      for (const [x, y, z, rx, rz] of tufts) {
        const t = mesh(tuftGeo, hairMat, x, y, z);
        t.rotation.set(rx, 0, rz);
        hairGroup.add(t);
      }
      // Short sides.
      hairGroup.add(mesh(new THREE.BoxGeometry(0.05, 0.16, 0.2), hairMat, -0.29, 0.07, -0.02));
      hairGroup.add(mesh(new THREE.BoxGeometry(0.05, 0.16, 0.2), hairMat, 0.29, 0.07, -0.02));
    }
    if (hair === "bun") hairGroup.add(mesh(new THREE.IcosahedronGeometry(0.11, 0), hairMat, 0, 0.3, -0.2));
    if (hair === "long") {
      const back = mesh(new THREE.BoxGeometry(0.5, 0.45, 0.12), hairMat, 0, -0.08, -0.22);
      hairGroup.add(back);
    }
  }
  if (o.beard !== undefined) {
    const bm = flatMat(o.beard);
    const beard = mesh(new THREE.ConeGeometry(0.2, 0.36, 6), bm, 0, -0.27, 0.13);
    beard.rotation.x = Math.PI + 0.25;
    head.add(beard);
    head.add(mesh(new THREE.BoxGeometry(0.22, 0.05, 0.06), bm, 0, -0.08, 0.27));
    mouth.visible = false;
  }

  // Glasses: two thin round rims with tinted lenses.
  if (o.glasses) {
    const frame = new THREE.MeshStandardMaterial({ color: o.glasses.frame, roughness: 0.3, metalness: 0.6 });
    const lens = new THREE.MeshStandardMaterial({
      color: o.glasses.lens,
      roughness: 0.15,
      metalness: 0,
      transparent: true,
      opacity: o.glasses.lensOpacity ?? 0.55,
      emissive: o.glasses.lens,
      emissiveIntensity: 0.15,
    });
    const rimGeo = new THREE.TorusGeometry(0.075, 0.009, 4, 14);
    const lensGeo = new THREE.CircleGeometry(0.072, 14);
    for (const x of [-0.1, 0.1]) {
      const rim = mesh(rimGeo, frame, x, 0.015, 0.29);
      head.add(rim);
      const l = mesh(lensGeo, lens, x, 0.015, 0.288);
      l.castShadow = false;
      head.add(l);
    }
    head.add(mesh(new THREE.BoxGeometry(0.06, 0.01, 0.01), frame, 0, 0.03, 0.29));
    for (const x of [-0.175, 0.175]) {
      const arm = mesh(new THREE.BoxGeometry(0.01, 0.01, 0.26), frame, x, 0.02, 0.16);
      arm.rotation.y = x > 0 ? -0.12 : 0.12;
      head.add(arm);
    }
  }

  // Hats.
  const hatMat = flatMat(o.hatColor ?? 0x5a3a6a);
  const accent = flatMat(o.hatAccent ?? 0xe8c060);
  if (o.hat === "wizard") {
    const brim = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), hatMat, 0, 0.22, 0);
    const cone = mesh(new THREE.ConeGeometry(0.27, 0.62, 8), hatMat, 0, 0.53, -0.03);
    cone.rotation.x = -0.18;
    const band = mesh(new THREE.CylinderGeometry(0.265, 0.27, 0.06, 10), accent, 0, 0.27, 0);
    const star = mesh(new THREE.OctahedronGeometry(0.05, 0), flatMat(0xffe27a, { emissive: 0x806010 }), 0.1, 0.45, 0.19);
    head.add(brim, cone, band, star);
  } else if (o.hat === "feather") {
    const crown = mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.16, 10), hatMat, 0, 0.3, 0);
    const brim = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 12), hatMat, 0, 0.23, 0);
    const feather = mesh(new THREE.ConeGeometry(0.035, 0.42, 4), accent, 0.2, 0.42, -0.08);
    feather.rotation.z = -0.6;
    head.add(crown, brim, feather);
  } else if (o.hat === "cap") {
    const crown = mesh(new THREE.SphereGeometry(0.31, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), hatMat, 0, 0.06, 0);
    const bill = mesh(new THREE.BoxGeometry(0.3, 0.025, 0.2), hatMat, 0, 0.13, 0.3);
    head.add(crown, bill);
  } else if (o.hat === "beret") {
    const b = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.08, 10), hatMat, 0.04, 0.3, -0.02);
    b.rotation.z = 0.2;
    head.add(b);
  }

  // Props held in the right hand.
  if (o.prop === "staff") {
    const staff = new THREE.Group();
    staff.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 6), flatMat(0x6a4a2a), 0, 0.2, 0));
    staff.add(mesh(new THREE.OctahedronGeometry(0.08, 0), flatMat(0x9fe8ff, { emissive: 0x3088aa }), 0, 0.98, 0));
    staff.position.set(0, -0.38, 0.06);
    armR.add(staff);
  } else if (o.prop === "lute") {
    const lute = new THREE.Group();
    lute.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), flatMat(0xb07a3a), 0, 0, 0));
    lute.add(mesh(new THREE.BoxGeometry(0.05, 0.36, 0.03), flatMat(0x5a3a1a), 0, 0.24, 0));
    lute.scale.z = 0.5;
    lute.position.set(0.05, 0.62, 0.24);
    lute.rotation.z = -0.9;
    body.add(lute);
  } else if (o.prop === "scroll") {
    const s = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8), flatMat(0xf0e2c0), 0, -0.4, 0.06);
    s.rotation.z = Math.PI / 2;
    armR.add(s);
  } else if (o.prop === "lantern") {
    const lan = new THREE.Group();
    lan.add(mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), flatMat(0xffd27a, { emissive: 0xffaa33 }), 0, -0.52, 0));
    lan.add(mesh(new THREE.ConeGeometry(0.1, 0.07, 4), flatMat(0x2a2a2a), 0, -0.41, 0));
    armR.add(lan);
  } else if (o.prop === "tray") {
    const tray = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 10), flatMat(0xb0b0b8, { rough: 0.4 }), 0, -0.42, 0.12);
    armR.add(tray);
  }

  const k = o.scale ?? 1;
  root.scale.setScalar(k);

  // ---- Animation --------------------------------------------------------------
  let phase = Math.random() * 10;
  let idleT = Math.random() * 10;
  let emoteKind: "wave" | "talk" | "jump" | "none" = "none";
  let emoteT = 0;
  let blinkT = 2 + Math.random() * 3;
  let hairAngle = 0;
  let hairVel = 0;
  let prevBodyY = 0;

  const animate = (dt: number, speed: number, air: boolean) => {
    idleT += dt;
    const walk = Math.min(1, speed / 4);
    phase += dt * (4 + speed * 2.2);
    const swing = Math.sin(phase) * 0.75 * walk;
    if (air) {
      legL.rotation.x = -0.6;
      legR.rotation.x = 0.35;
      armL.rotation.x = -2.3;
      armR.rotation.x = -2.3;
      body.position.y = 0;
    } else {
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8;
      body.position.y = Math.abs(Math.sin(phase)) * 0.06 * walk + Math.sin(idleT * 2) * 0.008 * (1 - walk);
    }
    torso.scale.y = 1 + Math.sin(idleT * 2) * 0.015 * (1 - walk);
    head.rotation.z = Math.sin(idleT * 0.9) * 0.04 * (1 - walk);
    body.rotation.x = walk * 0.08;

    if (emoteKind !== "none") {
      emoteT -= dt;
      if (emoteKind === "wave") {
        armR.rotation.x = -2.6;
        armR.rotation.z = 0.3 + Math.sin(emoteT * 14) * 0.35;
      } else if (emoteKind === "talk") {
        head.rotation.x = Math.sin(emoteT * 9) * 0.06;
        mouth.scale.y = 1 + Math.abs(Math.sin(emoteT * 16)) * 3;
      } else if (emoteKind === "jump") {
        body.position.y = Math.abs(Math.sin(emoteT * 8)) * 0.25;
        armL.rotation.x = armR.rotation.x = -2.5;
      }
      if (emoteT <= 0) {
        emoteKind = "none";
        armR.rotation.z = 0.12;
        head.rotation.x = 0;
        mouth.scale.y = 1;
      }
    }

    // Hair and cords trail the motion on a damped spring.
    const bodyVy = dt > 0 ? (body.position.y - prevBodyY) / dt : 0;
    prevBodyY = body.position.y;
    const target = -walk * 0.16 - THREE.MathUtils.clamp(bodyVy, -2, 2) * 0.05 + (air ? 0.25 : 0);
    hairVel += ((target - hairAngle) * 90 - hairVel * 9) * dt;
    hairAngle += hairVel * dt;
    hairGroup.rotation.x = hairAngle * 0.35;
    hairGroup.position.z = -Math.max(0, -hairAngle) * 0.02;
    for (const c of cords) c.rotation.x = -hairAngle * 0.9 + Math.sin(phase * 2) * 0.15 * walk;

    blinkT -= dt;
    const closed = blinkT < 0.12;
    eyeL.scale.y = eyeR.scale.y = closed ? 0.2 : 1.35;
    if (blinkT < 0) blinkT = 2 + Math.random() * 4;
  };

  return {
    root,
    animate,
    emote(kind) {
      emoteKind = kind;
      emoteT = kind === "talk" ? 2.2 : 1.4;
    },
    setVisible(v) {
      root.visible = v;
    },
  };
}

export function darken(hex: number, k: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
}

/** Kaijie's avatar: short black hair, thin round metal glasses with pale pink lenses, black hoodie. */
export function buildKaijie(): Chibi {
  return buildChibi({
    skin: 0xf3cfa8,
    hair: "spiky",
    hairColor: 0x15151a,
    top: 0x1d1d22,
    hoodie: true,
    pants: 0x2b2e3a,
    shoes: 0xe8e4dc,
    glasses: { frame: 0xb8b8c0, lens: 0xf4a6b8, lensOpacity: 0.5 },
  });
}

/** Low-poly cat (Perlin). */
export function buildCat(fur = 0xe8a04a, stripe = 0xb8702a): Chibi {
  const root = new THREE.Group();
  const furM = flatMat(fur);
  const strM = flatMat(stripe);
  const body = new THREE.Group();
  root.add(body);
  const torso = mesh(new THREE.CapsuleGeometry(0.13, 0.32, 3, 8), furM, 0, 0.24, 0);
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  body.add(mesh(new THREE.BoxGeometry(0.2, 0.04, 0.08), strM, 0, 0.36, -0.05));
  body.add(mesh(new THREE.BoxGeometry(0.2, 0.04, 0.08), strM, 0, 0.36, 0.08));
  const head = new THREE.Group();
  head.position.set(0, 0.38, 0.27);
  body.add(head);
  head.add(mesh(new THREE.IcosahedronGeometry(0.14, 1), furM));
  const earGeo = new THREE.ConeGeometry(0.05, 0.1, 4);
  head.add(mesh(earGeo, furM, -0.08, 0.13, 0), mesh(earGeo, furM, 0.08, 0.13, 0));
  const eye = flatMat(0x2a6a2a, { rough: 0.3 });
  head.add(mesh(new THREE.SphereGeometry(0.022, 6, 5), eye, -0.05, 0.02, 0.125));
  head.add(mesh(new THREE.SphereGeometry(0.022, 6, 5), eye, 0.05, 0.02, 0.125));
  head.add(mesh(new THREE.SphereGeometry(0.018, 5, 4), flatMat(0xe07a8a), 0, -0.03, 0.14));
  const legs: THREE.Object3D[] = [];
  const legGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.18, 5);
  legGeo.translate(0, -0.09, 0);
  for (const [x, z] of [[-0.07, 0.15], [0.07, 0.15], [-0.07, -0.15], [0.07, -0.15]]) {
    const l = new THREE.Group();
    l.position.set(x, 0.18, z);
    l.add(mesh(legGeo, furM));
    body.add(l);
    legs.push(l);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.3, -0.27);
  const tailMesh = mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 5), furM, 0, 0.16, 0);
  tail.add(tailMesh);
  tail.rotation.x = -0.6;
  body.add(tail);
  let phase = 0;
  let t = 0;
  let emoteKind = "none";
  let emoteT = 0;
  return {
    root,
    animate(dt, speed) {
      t += dt;
      phase += dt * (3 + speed * 5);
      const w = Math.min(1, speed / 2);
      legs.forEach((l, i) => (l.rotation.x = Math.sin(phase + (i % 2 === 0 ? 0 : Math.PI) + (i > 1 ? Math.PI : 0)) * 0.6 * w));
      tail.rotation.z = Math.sin(t * 2.2) * 0.4;
      body.position.y = Math.abs(Math.sin(phase)) * 0.02 * w;
      if (emoteKind !== "none") {
        emoteT -= dt;
        head.rotation.z = Math.sin(emoteT * 10) * 0.15;
        if (emoteT <= 0) {
          emoteKind = "none";
          head.rotation.z = 0;
        }
      }
    },
    emote(kind) {
      emoteKind = kind;
      emoteT = 1.5;
    },
    setVisible(v) {
      root.visible = v;
    },
  };
}
