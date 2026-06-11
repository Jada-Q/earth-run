// Toon planet — sphere + custom ShaderMaterial sampling the baked SDF mask
// (R = land SDF, G = vegetation, B = city lights), with REAL terrain:
// vertices are displaced by a NASA-SRTM-derived heightmap (cities baked
// flat), and elevation drives a lowland→rock→snow color ramp. The
// inverted-hull outline displaces identically so the silhouette hugs the
// mountains.
//
// Lighting is a uniform (uLightDir), not a scene light: quantized N·L with
// uSteps bands. The SDF gives resolution-independent coastlines AND the
// coastline ink stroke for free (band around d = 0.5).

import {
  BackSide,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import { INK, PAPER, SEA, VEGETATION, type ToonParams } from "./palette";

/** Max terrain height in world units (planet radius = 1). Everest ends up
 *  ~0.022R — hugely exaggerated, like every globe ever made. The player
 *  controller samples the same map (see elevation.ts). */
export const TERRAIN_SCALE = 0.022;

const DISPLACE = /* glsl */ `
  uniform sampler2D uElev;
  uniform float uTerrain;
  vec3 displaced(vec3 p, vec2 uvIn) {
    float e = texture2D(uElev, uvIn).r;
    return p * (1.0 + e * uTerrain);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vElev;
  varying vec3 vEastW;
  varying vec3 vNorthW;
  varying float vCosLat;
  uniform sampler2D uElev;
  uniform float uTerrain;
  void main() {
    vUv = uv;
    vec3 n0 = normalize(position);
    vNormal = normalize(mat3(modelMatrix) * n0);
    // Geographic tangent basis for fragment-level terrain normals.
    vec3 east = cross(vec3(0.0, 1.0, 0.0), n0);
    vCosLat = length(east);
    east = vCosLat > 0.001 ? east / vCosLat : vec3(1.0, 0.0, 0.0);
    vec3 north = cross(n0, east);
    vEastW = normalize(mat3(modelMatrix) * east);
    vNorthW = normalize(mat3(modelMatrix) * north);
    float e = texture2D(uElev, uv).r;
    vElev = e;
    vec3 p = position * (1.0 + e * uTerrain);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMask;
  uniform sampler2D uElev;
  uniform float uTerrain;
  uniform float uRelief;
  uniform vec3 uSea;
  uniform vec3 uLand;
  uniform vec3 uVegetation;
  uniform vec3 uInk;
  uniform vec3 uCityColor;
  uniform vec3 uLightDir;
  uniform float uInkWidth;
  uniform float uInkStrength;
  uniform float uSteps;
  uniform float uShadeMul;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vElev;
  varying vec3 vEastW;
  varying vec3 vNorthW;
  varying float vCosLat;

  void main() {
    vec4 m = texture2D(uMask, vUv);
    float d = m.r;   // land SDF, 0.5 = coastline
    float veg = m.g;
    float city = m.b;

    float w = fwidth(d) * 1.2;
    float land = smoothstep(0.5 - w, 0.5 + w, d);
    vec3 albedo = mix(uSea, mix(uLand, uVegetation, step(0.5, veg)), land);

    // Elevation ramp: lowland colors → rocky brown → snow caps.
    vec3 rock = vec3(0.62, 0.55, 0.46);
    vec3 snow = vec3(0.95, 0.95, 0.93);
    albedo = mix(albedo, rock, smoothstep(0.14, 0.38, vElev) * land);
    albedo = mix(albedo, snow, smoothstep(0.48, 0.7, vElev) * land);

    // Coastline ink band hugging d = 0.5.
    float ink = 1.0 - smoothstep(uInkWidth, uInkWidth + w, abs(d - 0.5));
    albedo = mix(albedo, uInk, ink * uInkStrength);

    // --- per-pixel terrain normal (central differences on the heightmap).
    // Without this, displaced mountains have sphere-smooth lighting and
    // read as flat blobs — relief lives in the shading, not the silhouette.
    vec2 du = vec2(1.0 / 2048.0, 0.0);
    vec2 dv = vec2(0.0, 1.0 / 1024.0);
    float hE = texture2D(uElev, vUv + du).r;
    float hW = texture2D(uElev, vUv - du).r;
    float hN = texture2D(uElev, vUv - dv).r; // v grows southward
    float hS = texture2D(uElev, vUv + dv).r;
    float arcE = 6.2832 / 2048.0 * max(vCosLat, 0.05);
    float arcN = 3.1416 / 1024.0;
    float slopeE = (hE - hW) * uTerrain / (2.0 * arcE);
    float slopeN = (hN - hS) * uTerrain / (2.0 * arcN);
    vec3 nT = normalize(
      normalize(vNormal)
        - vEastW * slopeE * uRelief
        - vNorthW * slopeN * uRelief
    );

    // Quantized toon shading from the uniform sun, terrain-aware.
    float ndl = dot(nT, uLightDir) * 0.5 + 0.5;
    float band = floor(ndl * uSteps) / max(uSteps - 1.0, 1.0);
    band = clamp(band, 0.0, 1.0);
    vec3 color = albedo * mix(uShadeMul, 1.0, band);

    // Extra soft hillshade on top of the bands so ridge/valley detail
    // survives quantization (subtle, terrain only).
    float slopeShade = clamp(dot(nT, uLightDir) - dot(normalize(vNormal), uLightDir), -0.5, 0.5);
    color *= 1.0 + slopeShade * 0.55 * land;

    // City lights bloom on the night side only (raw ndl, not banded —
    // they should fade in smoothly as a region rolls into darkness).
    float night = smoothstep(0.42, 0.18, ndl);
    color += uCityColor * city * night * land;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface Planet {
  group: Group;
  /** Push current ToonParams + light direction into the shader uniforms. */
  applyParams(params: ToonParams, lightDir: Vector3): void;
  dispose(): void;
}

export function buildPlanet(params: ToonParams): Planet {
  const group = new Group();

  const tex: Texture = new TextureLoader().load("/textures/planet-mask.png");
  tex.anisotropy = 4;
  const elevTex: Texture = new TextureLoader().load("/textures/elevation.png");

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMask: { value: tex },
      uElev: { value: elevTex },
      uTerrain: { value: TERRAIN_SCALE },
      uRelief: { value: 1.0 },
      uSea: { value: new Color(SEA) },
      uLand: { value: new Color(PAPER) },
      uVegetation: { value: new Color(VEGETATION) },
      uInk: { value: new Color(INK) },
      // Pale cream — deliberately NOT the golden accent (reserved for CTA).
      uCityColor: { value: new Color("#efe7cf") },
      uLightDir: { value: new Vector3(0, 0, 1) },
      uInkWidth: { value: params.inkWidth },
      uInkStrength: { value: params.inkStrength },
      uSteps: { value: params.steps },
      uShadeMul: { value: params.shadeMul },
    },
  });

  // Dense enough for mountain silhouettes (49k verts — fine for one mesh).
  const sphere = new Mesh(new SphereGeometry(1, 256, 192), material);
  group.add(sphere);

  // Inverted-hull silhouette: back-face ink shell displaced by the SAME
  // heightmap plus the outline width, so the ink line follows the ridges.
  const hullMat = new ShaderMaterial({
    vertexShader: /* glsl */ `
      ${DISPLACE}
      uniform float uOutline;
      void main() {
        vec3 p = displaced(position, uv) * (1.0 + uOutline);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      void main() { gl_FragColor = vec4(uInk, 1.0); }
    `,
    uniforms: {
      uInk: { value: new Color(INK) },
      uElev: { value: elevTex },
      uTerrain: { value: TERRAIN_SCALE },
      uOutline: { value: params.outlineWidth },
    },
    side: BackSide,
  });
  const hull = new Mesh(new SphereGeometry(1, 256, 192), hullMat);
  group.add(hull);

  return {
    group,
    applyParams(p: ToonParams, lightDir: Vector3) {
      material.uniforms.uInkWidth.value = p.inkWidth;
      material.uniforms.uInkStrength.value = p.inkStrength;
      material.uniforms.uSteps.value = p.steps;
      material.uniforms.uShadeMul.value = p.shadeMul;
      (material.uniforms.uLightDir.value as Vector3).copy(lightDir);
      hullMat.uniforms.uOutline.value = p.outlineWidth;
    },
    dispose() {
      sphere.geometry.dispose();
      hull.geometry.dispose();
      material.dispose();
      hullMat.dispose();
      tex.dispose();
      elevTex.dispose();
    },
  };
}
