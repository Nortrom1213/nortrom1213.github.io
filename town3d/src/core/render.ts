import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Post-processing for the stylised look:
//   MSAA scene render → ambient occlusion → stylise (ink outlines from depth +
//   normals, colour grading, tilt-shift "miniature" blur, vignette) → bloom →
//   tone mapping. Low quality skips AO/outlines and renders far fewer pixels.

const StylizeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    tNormal: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 600 },
    outline: { value: 1 },
    outlineColor: { value: new THREE.Color(0x2a1c14) },
    tilt: { value: 1 },
    focusY: { value: 0.5 },
    saturation: { value: 1.12 },
    warmth: { value: 0.035 },
    vignette: { value: 0.32 },
    night: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform sampler2D tNormal;
    uniform vec2 resolution; uniform float cameraNear; uniform float cameraFar;
    uniform float outline; uniform vec3 outlineColor; uniform float tilt; uniform float focusY;
    uniform float saturation; uniform float warmth; uniform float vignette; uniform float night;
    varying vec2 vUv;

    float viewZ(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
    }
    vec3 nrm(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }

    void main() {
      vec2 px = 1.0 / resolution;
      // Tilt-shift: blur grows away from the focus band (miniature diorama feel).
      float band = abs(vUv.y - focusY);
      float blur = tilt * smoothstep(0.18, 0.55, band) * 2.6;
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (blur > 0.05) {
        vec3 acc = col; float w = 1.0;
        for (int i = 1; i <= 4; i++) {
          float o = float(i) * blur;
          acc += texture2D(tDiffuse, vUv + vec2(o, 0.0) * px).rgb;
          acc += texture2D(tDiffuse, vUv - vec2(o, 0.0) * px).rgb;
          acc += texture2D(tDiffuse, vUv + vec2(0.0, o) * px).rgb;
          acc += texture2D(tDiffuse, vUv - vec2(0.0, o) * px).rgb;
          w += 4.0;
        }
        col = acc / w;
      }

      // Ink outlines: depth discontinuities (relative) + normal creases.
      if (outline > 0.0) {
        float z = viewZ(vUv);
        if (z < cameraFar * 0.35) {
          float zl = viewZ(vUv - vec2(px.x, 0.0));
          float zr = viewZ(vUv + vec2(px.x, 0.0));
          float zu = viewZ(vUv + vec2(0.0, px.y));
          float zd = viewZ(vUv - vec2(0.0, px.y));
          float dz = (abs(zl + zr - 2.0 * z) + abs(zu + zd - 2.0 * z)) / max(z, 0.5);
          vec3 n = nrm(vUv);
          float dn = 0.0;
          dn += 1.0 - dot(n, nrm(vUv + vec2(px.x, 0.0)));
          dn += 1.0 - dot(n, nrm(vUv + vec2(0.0, px.y)));
          float e = smoothstep(0.035, 0.09, dz) + smoothstep(0.35, 0.8, dn) * 0.6;
          e = clamp(e, 0.0, 1.0) * outline * (1.0 - smoothstep(30.0, 120.0, z));
          col = mix(col, outlineColor * (0.35 + 0.4 * (1.0 - night)), e * 0.75);
        }
      }

      // Grade: gentle saturation, warm highlights, cool shadows, vignette.
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col += vec3(warmth, warmth * 0.45, -warmth * 0.6) * smoothstep(0.15, 1.0, l);
      col += vec3(-0.01, 0.0, 0.025) * (1.0 - smoothstep(0.0, 0.25, l)) * (1.0 + night);
      vec2 c = vUv - 0.5;
      col *= 1.0 - vignette * dot(c, c) * 1.6;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class PostFX {
  readonly composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private gtao: GTAOPass | null = null;
  private stylize: ShaderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  enabled: boolean;

  constructor(private renderer: THREE.WebGLRenderer, readonly level: "high" | "medium" | "low") {
    this.enabled = level !== "low";
    if (!this.enabled) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: level === "high" ? 4 : 2 });
    const composer = new EffectComposer(renderer, rt);
    this.composer = composer;
    const dummyScene = new THREE.Scene();
    const dummyCam = new THREE.PerspectiveCamera();
    this.renderPass = new RenderPass(dummyScene, dummyCam);
    composer.addPass(this.renderPass);
    this.gtao = new GTAOPass(dummyScene, dummyCam, w, h);
    this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: level === "high" ? 16 : 8 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.gtao.blendIntensity = 0.75;
    composer.addPass(this.gtao);
    this.stylize = new ShaderPass(StylizeShader);
    this.stylize.uniforms.tDepth.value = this.gtao.depthTexture;
    this.stylize.uniforms.tNormal.value = (this.gtao as unknown as { normalRenderTarget: THREE.WebGLRenderTarget }).normalRenderTarget.texture;
    composer.addPass(this.stylize);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.32, 0.5, 0.86);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.setSize(w, h);
  }

  /** Point every pass at the current stage scene and camera. */
  setScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (!this.enabled) return;
    this.renderPass!.scene = scene;
    this.renderPass!.camera = camera;
    this.gtao!.scene = scene;
    this.gtao!.camera = camera;
    this.stylize!.uniforms.cameraNear.value = camera.near;
    this.stylize!.uniforms.cameraFar.value = camera.far;
  }

  /** Per-stage look: interiors want less tilt-shift and softer outlines. */
  configure(opts: { tilt?: number; outline?: number; night?: number; bloom?: number }) {
    if (!this.enabled) return;
    const u = this.stylize!.uniforms;
    if (opts.tilt !== undefined) u.tilt.value = opts.tilt;
    if (opts.outline !== undefined) u.outline.value = opts.outline;
    if (opts.night !== undefined) u.night.value = opts.night;
    if (opts.bloom !== undefined) this.bloom!.strength = opts.bloom;
  }

  setSize(w: number, h: number) {
    if (!this.enabled) return;
    const pr = this.renderer.getPixelRatio();
    this.composer!.setPixelRatio(pr);
    this.composer!.setSize(w, h);
    this.stylize!.uniforms.resolution.value.set(w * pr, h * pr);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.enabled) this.composer!.render();
    else this.renderer.render(scene, camera);
  }
}
