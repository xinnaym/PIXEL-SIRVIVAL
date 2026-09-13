import { mk } from "./sprites";

export const TILE = 16;
export const CHUNK = 8; // tiles per chunk side

export const T = {
  Deep: 0,
  Water: 1,
  Sand: 2,
  Grass: 3,
  Forest: 4,
  Rock: 5,
  Snow: 6,
} as const;
export type TileId = (typeof T)[keyof typeof T];

export type ObjKind =
  | "tree"
  | "pine"
  | "snowtree"
  | "dead"
  | "rock"
  | "iron"
  | "bush"
  | "tuft"
  | "flower"
  | "campfire"
  | "wall";

export interface WObj {
  tx: number;
  ty: number;
  x: number;
  y: number;
  kind: ObjKind;
  variant: number;
  hp: number;
  maxHp: number;
  solid: boolean;
  r: number; // collision radius
  hit: number; // hit flash timer
  fuel?: number;
  berries?: number;
}

/* --------------------------------------------------------- noise */

function hash2(x: number, y: number, seed: number) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function vnoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf);
  const v = smooth(yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, y: number, seed: number, oct = 4) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += vnoise(x * freq, y * freq, seed + i * 77) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/* --------------------------------------------------------- tiles */

const TILE_COLORS: Record<number, [string, string, string]> = {
  [T.Deep]: ["#173359", "#1b3b64", "#132b4c"],
  [T.Water]: ["#2a6299", "#3272ad", "#245685"],
  [T.Sand]: ["#d8c489", "#e2d09a", "#c9b47c"],
  [T.Grass]: ["#59a04e", "#63ad56", "#4e9147"],
  [T.Forest]: ["#3f8443", "#47924a", "#36743c"],
  [T.Rock]: ["#7b8090", "#868c9c", "#6c7180"],
  [T.Snow]: ["#e2ecf3", "#eef5fa", "#d2dfea"],
};

export class World {
  seed: number;
  W: number;
  H: number;
  tiles: Uint8Array;
  objects = new Map<number, WObj>();
  private chunks = new Map<string, HTMLCanvasElement>();

  constructor(seed: number, size = 200) {
    this.seed = seed;
    this.W = size;
    this.H = size;
    this.tiles = new Uint8Array(size * size);
    this.generate();
  }

  idx(tx: number, ty: number) {
    return ty * this.W + tx;
  }

  inside(tx: number, ty: number) {
    return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H;
  }

  tile(tx: number, ty: number): number {
    if (!this.inside(tx, ty)) return T.Deep;
    return this.tiles[this.idx(tx, ty)];
  }

  tileAtPx(x: number, y: number) {
    return this.tile(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  isLiquid(t: number) {
    return t === T.Deep || t === T.Water;
  }

  walkablePx(x: number, y: number) {
    return !this.isLiquid(this.tileAtPx(x, y));
  }

  private generate() {
    const s = this.seed;
    const cx = this.W / 2;
    const cy = this.H / 2;
    const maxD = Math.min(cx, cy);
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const nx = x / 34;
        const ny = y / 34;
        let e = fbm(nx, ny, s, 5);
        const m = fbm(x / 26 + 100, y / 26 + 100, s + 999, 3);
        // island falloff so the map is a continent surrounded by ocean
        const d = Math.hypot(x - cx, y - cy) / maxD;
        e = e * 1.12 - Math.pow(Math.max(0, d - 0.42) * 1.75, 2) * 1.5;

        let t: number;
        if (e < 0.24) t = T.Deep;
        else if (e < 0.32) t = T.Water;
        else if (e < 0.36) t = T.Sand;
        else if (e < 0.56) t = m > 0.56 ? T.Forest : T.Grass;
        else if (e < 0.68) t = m > 0.62 ? T.Forest : T.Grass;
        else if (e < 0.78) t = T.Rock;
        else t = T.Snow;
        this.tiles[this.idx(x, y)] = t;
      }
    }
    this.populate();
  }

  private populate() {
    const s = this.seed;
    for (let y = 1; y < this.H - 1; y++) {
      for (let x = 1; x < this.W - 1; x++) {
        const t = this.tile(x, y);
        const r = hash2(x, y, s + 4242);
        const v = Math.floor(hash2(x, y, s + 31) * 3);
        let kind: ObjKind | null = null;
        if (t === T.Forest) {
          if (r < 0.34) kind = "tree";
          else if (r < 0.4) kind = "pine";
          else if (r < 0.45) kind = "bush";
          else if (r < 0.58) kind = "tuft";
          else if (r < 0.6) kind = "rock";
        } else if (t === T.Grass) {
          if (r < 0.07) kind = "tree";
          else if (r < 0.1) kind = "bush";
          else if (r < 0.12) kind = "rock";
          else if (r < 0.24) kind = "tuft";
          else if (r < 0.29) kind = "flower";
        } else if (t === T.Rock) {
          if (r < 0.2) kind = "rock";
          else if (r < 0.235) kind = "iron";
          else if (r < 0.26) kind = "dead";
        } else if (t === T.Snow) {
          if (r < 0.13) kind = "snowtree";
          else if (r < 0.19) kind = "rock";
          else if (r < 0.205) kind = "iron";
        } else if (t === T.Sand) {
          if (r < 0.015) kind = "dead";
          else if (r < 0.035) kind = "tuft";
        }
        if (kind) this.addObject(x, y, kind, v);
      }
    }
  }

  makeObject(tx: number, ty: number, kind: ObjKind, variant = 0): WObj {
    const base: WObj = {
      tx,
      ty,
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE,
      kind,
      variant,
      hp: 100,
      maxHp: 100,
      solid: true,
      r: 6,
      hit: 0,
    };
    switch (kind) {
      case "tree":
      case "snowtree":
        base.hp = base.maxHp = 110;
        base.r = 5;
        break;
      case "pine":
        base.hp = base.maxHp = 130;
        base.r = 5;
        break;
      case "dead":
        base.hp = base.maxHp = 60;
        base.r = 4;
        break;
      case "rock":
        base.hp = base.maxHp = 130;
        base.r = 7;
        break;
      case "iron":
        base.hp = base.maxHp = 190;
        base.r = 7;
        break;
      case "bush":
        base.hp = base.maxHp = 30;
        base.solid = false;
        base.berries = 3;
        break;
      case "tuft":
      case "flower":
        base.hp = base.maxHp = 10;
        base.solid = false;
        break;
      case "campfire":
        base.hp = base.maxHp = 60;
        base.solid = false;
        base.fuel = 70;
        base.r = 6;
        break;
      case "wall":
        base.hp = base.maxHp = 180;
        base.r = 8;
        break;
    }
    return base;
  }

  /** quick access list of all placed campfires */
  fires: WObj[] = [];

  addObject(tx: number, ty: number, kind: ObjKind, variant = 0) {
    const o = this.makeObject(tx, ty, kind, variant);
    this.objects.set(this.idx(tx, ty), o);
    if (kind === "campfire") this.fires.push(o);
    return o;
  }

  objAt(tx: number, ty: number): WObj | undefined {
    if (!this.inside(tx, ty)) return undefined;
    return this.objects.get(this.idx(tx, ty));
  }

  remove(o: WObj) {
    this.objects.delete(this.idx(o.tx, o.ty));
    if (o.kind === "campfire") {
      const i = this.fires.indexOf(o);
      if (i >= 0) this.fires.splice(i, 1);
    }
  }

  /** all objects in a tile-radius around a world position */
  near(x: number, y: number, tileRad = 2): WObj[] {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const out: WObj[] = [];
    for (let j = ty - tileRad; j <= ty + tileRad; j++) {
      for (let i = tx - tileRad; i <= tx + tileRad; i++) {
        const o = this.objAt(i, j);
        if (o) out.push(o);
      }
    }
    return out;
  }

  findSpawn(): { x: number; y: number } {
    const cx = Math.floor(this.W / 2);
    const cy = Math.floor(this.H / 2);
    for (let r = 0; r < 60; r++) {
      for (let a = 0; a < 32; a++) {
        const ang = (a / 32) * Math.PI * 2;
        const tx = Math.round(cx + Math.cos(ang) * r);
        const ty = Math.round(cy + Math.sin(ang) * r);
        if (!this.inside(tx, ty)) continue;
        const t = this.tile(tx, ty);
        if (t === T.Grass || t === T.Forest) {
          // clear a small camp area
          for (let j = -2; j <= 2; j++) {
            for (let i = -2; i <= 2; i++) {
              const o = this.objAt(tx + i, ty + j);
              if (o && o.solid) this.remove(o);
            }
          }
          return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
        }
      }
    }
    return { x: cx * TILE, y: cy * TILE };
  }

  /* ------------------------------------------------ chunk render */

  chunkCanvas(cx: number, cy: number): HTMLCanvasElement {
    const key = `${cx},${cy}`;
    const cached = this.chunks.get(key);
    if (cached) return cached;
    const size = CHUNK * TILE;
    const { c, x } = mk(size, size);
    for (let j = 0; j < CHUNK; j++) {
      for (let i = 0; i < CHUNK; i++) {
        const tx = cx * CHUNK + i;
        const ty = cy * CHUNK + j;
        this.paintTile(x, i * TILE, j * TILE, tx, ty);
      }
    }
    if (this.chunks.size > 320) {
      const first = this.chunks.keys().next().value;
      if (first !== undefined) this.chunks.delete(first);
    }
    this.chunks.set(key, c);
    return c;
  }

  private paintTile(x: CanvasRenderingContext2D, px: number, py: number, tx: number, ty: number) {
    const t = this.tile(tx, ty);
    const [base, light, dark] = TILE_COLORS[t];
    x.fillStyle = base;
    x.fillRect(px, py, TILE, TILE);

    // deterministic dithering for texture
    const seed = this.seed + 7;
    for (let j = 0; j < TILE; j += 2) {
      for (let i = 0; i < TILE; i += 2) {
        const h = hash2(tx * 16 + i, ty * 16 + j, seed);
        if (h > 0.86) {
          x.fillStyle = light;
          x.fillRect(px + i, py + j, 2, 1);
        } else if (h < 0.13) {
          x.fillStyle = dark;
          x.fillRect(px + i, py + j, 1, 2);
        }
      }
    }

    if (t === T.Grass || t === T.Forest) {
      const h = hash2(tx, ty, seed + 3);
      if (h > 0.7) {
        x.fillStyle = dark;
        const ox = Math.floor(h * 10) % 10;
        x.fillRect(px + ox, py + 5, 1, 3);
        x.fillRect(px + ox + 3, py + 9, 1, 2);
      }
    }

    // shorelines: foam on water tiles that touch land
    if (this.isLiquid(t)) {
      const nb: [number, number, number, number][] = [
        [0, -1, 0, 0],
        [0, 1, 0, TILE - 1],
        [-1, 0, 0, 0],
        [1, 0, TILE - 1, 0],
      ];
      for (const [dx, dy, ox, oy] of nb) {
        const nt = this.tile(tx + dx, ty + dy);
        if (!this.isLiquid(nt)) {
          x.fillStyle = "#a9d8e8";
          if (dy !== 0) x.fillRect(px, py + oy, TILE, 1);
          else x.fillRect(px + ox, py, 1, TILE);
        }
      }
      if (t === T.Water) {
        const h = hash2(tx, ty, seed + 9);
        if (h > 0.8) {
          x.fillStyle = "#9cc9e0";
          x.fillRect(px + 3, py + 6, 4, 1);
          x.fillRect(px + 8, py + 10, 3, 1);
        }
      }
    } else {
      // darker edge next to water
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        if (this.isLiquid(this.tile(tx + dx, ty + dy))) {
          x.fillStyle = "#cdb984";
          if (dy === -1) x.fillRect(px, py, TILE, 2);
          if (dy === 1) x.fillRect(px, py + TILE - 2, TILE, 2);
          if (dx === -1) x.fillRect(px, py, 2, TILE);
          if (dx === 1) x.fillRect(px + TILE - 2, py, 2, TILE);
        }
      }
    }
  }
}
