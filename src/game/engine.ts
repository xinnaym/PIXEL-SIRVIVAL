import { sfx } from "./audio";
import { ITEMS, MOBS, RECIPES, type ItemId, type MobDef, type MobKind } from "./data";
import { ITEM_ICON, SP, initSprites, mk } from "./sprites";
import { T, TILE, World, type ObjKind, type WObj } from "./world";

/* ------------------------------------------------------------------ types */

export type Phase = "menu" | "play" | "dead";

export interface Slot {
  id: ItemId;
  n: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "good" | "bad";
}

export interface Snapshot {
  phase: Phase;
  paused: boolean;
  hp: number;
  maxHp: number;
  hunger: number;
  warmth: number;
  stamina: number;
  day: number;
  clock: number;
  light: number;
  isNight: boolean;
  inv: (Slot | null)[];
  hotbar: number;
  toasts: Toast[];
  kills: number;
  wood: number;
  nearFire: boolean;
  best: number;
  muted: boolean;
  tip: string;
  biome: string;
}

interface Mob {
  kind: MobKind;
  def: MobDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  t: number;
  hit: number;
  atkCd: number;
  flee: number;
  face: 1 | -1;
  dir: "down" | "up" | "left" | "right";
  wanderT: number;
  wx: number;
  wy: number;
  hpShow: number;
}

interface Drop {
  id: ItemId;
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  life: number;
}

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  size: number;
  grav: number;
}

interface FText {
  x: number;
  y: number;
  text: string;
  col: string;
  life: number;
}

/* ------------------------------------------------------------ constants */

const INV_SIZE = 24;
const HOT = 6;
const CYCLE = 170; // seconds for one full day
const PLAYER_SPEED = 62;
const BEST_KEY = "pixelsurvival.best";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function lightLevel(c: number) {
  if (c < 0.05) return lerp(0.16, 1, c / 0.05);
  if (c < 0.6) return 1;
  if (c < 0.72) return lerp(1, 0.16, (c - 0.6) / 0.12);
  return 0.16;
}

const BIOME_NAME: Record<number, string> = {
  [T.Deep]: "Океан",
  [T.Water]: "Мелководье",
  [T.Sand]: "Пляж",
  [T.Grass]: "Равнина",
  [T.Forest]: "Лес",
  [T.Rock]: "Горы",
  [T.Snow]: "Снега",
};

const LOOT: Record<ObjKind, { id: ItemId; min: number; max: number }[]> = {
  tree: [
    { id: "wood", min: 3, max: 5 },
    { id: "fiber", min: 0, max: 1 },
  ],
  pine: [{ id: "wood", min: 4, max: 6 }],
  snowtree: [{ id: "wood", min: 3, max: 5 }],
  dead: [{ id: "wood", min: 2, max: 3 }],
  rock: [
    { id: "stone", min: 3, max: 5 },
    { id: "fiber", min: 0, max: 0 },
  ],
  iron: [
    { id: "iron", min: 2, max: 3 },
    { id: "stone", min: 1, max: 2 },
  ],
  bush: [
    { id: "berry", min: 1, max: 2 },
    { id: "fiber", min: 1, max: 2 },
  ],
  tuft: [{ id: "fiber", min: 1, max: 2 }],
  flower: [{ id: "fiber", min: 1, max: 1 }],
  campfire: [{ id: "campfire", min: 1, max: 1 }],
  wall: [{ id: "wood", min: 2, max: 2 }],
};

const WOODY: ObjKind[] = ["tree", "pine", "snowtree", "dead", "wall"];
const STONY: ObjKind[] = ["rock", "iron"];

/* ------------------------------------------------------------------ engine */

export class Engine {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  world: World;
  phase: Phase = "menu";
  paused = false;
  uiPause = false;
  onSync: (s: Snapshot) => void = () => {};

  // player
  px = 0;
  py = 0;
  pvx = 0;
  pvy = 0;
  dir: "down" | "up" | "left" | "right" = "down";
  walkT = 0;
  hp = 100;
  maxHp = 100;
  hunger = 100;
  warmth = 100;
  stamina = 100;
  invul = 0;
  attackT = 0;
  attackCd = 0;
  hurtFlash = 0;
  regenT = 0;

  // world state
  inv: (Slot | null)[] = new Array(INV_SIZE).fill(null);
  hotbar = 0;
  mobs: Mob[] = [];
  drops: Drop[] = [];
  parts: Part[] = [];
  texts: FText[] = [];
  toasts: Toast[] = [];
  time = CYCLE * 0.08;
  day = 1;
  kills = 0;
  nearFire = false;
  best = 0;
  private wasNight = false;
  private spawnT = 0;
  private regrowT = 3;
  private hitObjs: WObj[] = [];
  private toastId = 1;

  // camera / render
  camX = 0;
  camY = 0;
  shake = 0;
  scale = 3;
  private raf = 0;
  private last = 0;
  private syncT = 0;
  private lightCv: HTMLCanvasElement | null = null;
  private silCache = new Map<HTMLCanvasElement, HTMLCanvasElement>();
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0 };
  private touchAttack = false;

  constructor() {
    this.world = new World((Math.random() * 1e9) | 0);
    this.best = Number(localStorage.getItem(BEST_KEY) ?? 0);
    const sp = this.world.findSpawn();
    this.px = sp.x;
    this.py = sp.y;
  }

  /* ------------------------------------------------------------- lifecycle */

  mount(canvas: HTMLCanvasElement) {
    initSprites();
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointer);
    canvas.addEventListener("pointerup", this.onPointerUp);
    this.resize();
    window.addEventListener("resize", this.resize);
    this.last = performance.now();
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  unmount() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.resize);
    this.canvas?.removeEventListener("pointerdown", this.onPointer);
    this.canvas?.removeEventListener("pointerup", this.onPointerUp);
  }

  resize = () => {
    const c = this.canvas;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    const m = Math.min(w, h);
    this.scale = w < 640 ? 2 : m < 760 ? 3 : m < 1100 ? 4 : 5;
    const ctx = c.getContext("2d");
    if (ctx) ctx.imageSmoothingEnabled = false;
    this.lightCv = null;
  };

  /* ---------------------------------------------------------------- input */

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright", "tab"].includes(k)) e.preventDefault();
    if (this.keys.has(k)) return;
    this.keys.add(k);
    sfx.resume();
    if (this.phase !== "play" || this.paused || this.uiPause) return;
    if (k >= "1" && k <= "6") this.hotbar = Number(k) - 1;
    if (k === "e") this.interact();
    if (k === "f") this.eatSelected();
    if (k === "q") this.dropSelected();
    if (k === " ") this.attack();
    if (k === "m") this.toggleMute();
    this.sync();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onPointer = (e: PointerEvent) => {
    sfx.resume();
    if (this.phase !== "play" || this.paused) return;
    // face the click direction then swing
    const c = this.canvas!;
    const rect = c.getBoundingClientRect();
    const wx = this.camX + (e.clientX - rect.left) / this.scale;
    const wy = this.camY + (e.clientY - rect.top) / this.scale;
    const dx = wx - this.px;
    const dy = wy - (this.py - 8);
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? "right" : "left";
    else this.dir = dy > 0 ? "down" : "up";
    this.touchAttack = true;
    this.attack();
  };

  private onPointerUp = () => {
    this.touchAttack = false;
  };

  /** virtual joystick from mobile UI */
  setMove(x: number, y: number) {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }
  setAttackHeld(v: boolean) {
    this.touchAttack = v;
    if (v) this.attack();
  }
  interactPublic() {
    if (this.phase !== "play" || this.paused) return;
    this.interact();
    this.sync();
  }
  eatPublic() {
    if (this.phase !== "play" || this.paused) return;
    this.eatSelected();
    this.sync();
  }
  setUiPause(v: boolean) {
    this.uiPause = v;
    this.sync();
  }

  /* ------------------------------------------------------------- commands */

  start() {
    this.phase = "play";
    this.paused = false;
    sfx.resume();
    this.toast("Ты очнулся на диком острове. Выживи как можно дольше!", "info");
    this.sync();
  }

  togglePause() {
    if (this.phase !== "play") return;
    this.paused = !this.paused;
    this.sync();
  }

  toggleMute() {
    sfx.muted = !sfx.muted;
    this.sync();
  }

  restart() {
    this.world = new World((Math.random() * 1e9) | 0);
    const sp = this.world.findSpawn();
    this.px = sp.x;
    this.py = sp.y;
    this.pvx = this.pvy = 0;
    this.inv = new Array(INV_SIZE).fill(null);
    this.mobs = [];
    this.drops = [];
    this.parts = [];
    this.texts = [];
    this.toasts = [];
    this.hitObjs = [];
    this.hp = this.maxHp;
    this.hunger = 100;
    this.warmth = 100;
    this.stamina = 100;
    this.time = CYCLE * 0.08;
    this.day = 1;
    this.kills = 0;
    this.hotbar = 0;
    this.phase = "play";
    this.paused = false;
    this.hints.clear();
    this.wasNight = false;
    this.toast("Новый остров, новая попытка!", "info");
    this.sync();
  }

  selectHotbar(i: number) {
    this.hotbar = clamp(i, 0, HOT - 1);
    this.sync();
  }

  /** click on an inventory slot: use / equip */
  useSlot(i: number) {
    const s = this.inv[i];
    if (!s) return;
    const def = ITEMS[s.id];
    if (def.kind === "food" || def.kind === "use") {
      this.consume(i);
    } else if (i >= HOT) {
      // move to hotbar
      const free = this.inv.findIndex((v, k) => k < HOT && !v);
      const target = free >= 0 ? free : this.hotbar;
      const tmp = this.inv[target];
      this.inv[target] = s;
      this.inv[i] = tmp;
      this.hotbar = target;
    } else {
      this.hotbar = i;
    }
    this.sync();
  }

  craft(index: number) {
    const r = RECIPES[index];
    if (!r) return;
    if (r.needFire && !this.nearFire) {
      this.toast("Нужен горящий костёр рядом", "bad");
      this.sync();
      return;
    }
    for (const k in r.cost) {
      const id = k as ItemId;
      if (this.count(id) < (r.cost[id] ?? 0)) {
        this.toast("Не хватает ресурсов", "bad");
        this.sync();
        return;
      }
    }
    for (const k in r.cost) this.take(k as ItemId, r.cost[k as ItemId] ?? 0);
    this.addItem(r.out, r.count);
    sfx.craft();
    this.toast(`Создано: ${ITEMS[r.out].name}`, "good");
    this.sync();
  }

  /* ----------------------------------------------------------- inventory */

  count(id: ItemId) {
    let n = 0;
    for (const s of this.inv) if (s && s.id === id) n += s.n;
    return n;
  }

  take(id: ItemId, n: number) {
    for (let i = 0; i < this.inv.length && n > 0; i++) {
      const s = this.inv[i];
      if (!s || s.id !== id) continue;
      const d = Math.min(s.n, n);
      s.n -= d;
      n -= d;
      if (s.n <= 0) this.inv[i] = null;
    }
  }

  addItem(id: ItemId, n: number): number {
    const max = ITEMS[id].stack;
    for (let i = 0; i < this.inv.length && n > 0; i++) {
      const s = this.inv[i];
      if (s && s.id === id && s.n < max) {
        const add = Math.min(max - s.n, n);
        s.n += add;
        n -= add;
      }
    }
    for (let i = 0; i < this.inv.length && n > 0; i++) {
      if (!this.inv[i]) {
        const add = Math.min(max, n);
        this.inv[i] = { id, n: add };
        n -= add;
      }
    }
    return n;
  }

  private consume(i: number) {
    const s = this.inv[i];
    if (!s) return;
    const def = ITEMS[s.id];
    if (def.kind !== "food" && def.kind !== "use") return;
    if (def.food) this.hunger = clamp(this.hunger + def.food, 0, 100);
    if (def.heal) this.hp = clamp(this.hp + def.heal, 0, this.maxHp);
    if (s.id === "meat" && Math.random() < 0.5) this.toast("Сырое мясо... живот крутит", "bad");
    s.n--;
    if (s.n <= 0) this.inv[i] = null;
    sfx.eat();
    this.float(this.px, this.py - 20, def.food ? `+${def.food} еды` : `+${def.heal} HP`, "#8ef08e");
  }

  private eatSelected() {
    const s = this.inv[this.hotbar];
    if (s && (ITEMS[s.id].kind === "food" || ITEMS[s.id].kind === "use")) this.consume(this.hotbar);
    else {
      // eat best food available
      const order: ItemId[] = ["cookedMeat", "berry", "meat", "bandage"];
      for (const id of order) {
        const i = this.inv.findIndex((v) => v && v.id === id);
        if (i >= 0) {
          this.consume(i);
          return;
        }
      }
      this.toast("Нечего есть", "bad");
    }
  }

  private dropSelected() {
    const s = this.inv[this.hotbar];
    if (!s) return;
    const d = this.dirVec();
    this.spawnDrop(s.id, s.n, this.px + d.x * 12, this.py + d.y * 8);
    this.inv[this.hotbar] = null;
  }

  /* ------------------------------------------------------------- actions */

  private dirVec() {
    switch (this.dir) {
      case "up":
        return { x: 0, y: -1 };
      case "down":
        return { x: 0, y: 1 };
      case "left":
        return { x: -1, y: 0 };
      default:
        return { x: 1, y: 0 };
    }
  }

  private heldTool() {
    const s = this.inv[this.hotbar];
    if (!s) return null;
    const d = ITEMS[s.id];
    return d.kind === "tool" ? d : null;
  }

  attack() {
    if (this.phase !== "play" || this.paused || this.uiPause || this.attackCd > 0) return;
    this.attackCd = 0.4;
    this.attackT = 0.22;
    sfx.swing();
    const tool = this.heldTool();
    const dmg = tool?.damage ?? 6;
    const chop = tool?.chop ?? 9;
    const mine = tool?.mine ?? 5;
    const d = this.dirVec();
    const ax = this.px + d.x * 13;
    const ay = this.py - 8 + d.y * 13;

    // hit mobs (copy: the list can shrink when something dies)
    for (const m of [...this.mobs]) {
      const dx = m.x - ax;
      const dy = m.y - 6 - ay;
      if (dx * dx + dy * dy > 20 * 20) continue;
      this.damageMob(m, dmg, d.x, d.y);
    }

    // hit world objects
    for (const o of this.world.near(ax, ay, 1)) {
      const dx = o.x - ax;
      const dy = o.y - 6 - ay;
      if (dx * dx + dy * dy > 18 * 18) continue;
      const power = WOODY.includes(o.kind) ? chop : STONY.includes(o.kind) ? mine : Math.max(chop, dmg);
      this.damageObject(o, power);
    }
  }

  private damageObject(o: WObj, power: number) {
    o.hp -= power;
    if (o.hit <= 0) this.hitObjs.push(o);
    o.hit = 0.9;
    const woody = WOODY.includes(o.kind);
    if (woody) sfx.chop();
    else if (STONY.includes(o.kind)) sfx.mine();
    else sfx.swing();
    const col = woody ? "#a9733f" : STONY.includes(o.kind) ? "#9aa0ad" : "#5fae4c";
    for (let i = 0; i < 6; i++) {
      this.parts.push({
        x: o.x + (Math.random() * 10 - 5),
        y: o.y - 10 - Math.random() * 8,
        vx: (Math.random() * 2 - 1) * 40,
        vy: -Math.random() * 50,
        life: 0.5,
        max: 0.5,
        col,
        size: 1 + Math.round(Math.random()),
        grav: 190,
      });
    }
    if (o.kind === "bush" && (o.berries ?? 0) > 0) {
      o.berries = 0;
      this.spawnDrop("berry", 1 + Math.floor(Math.random() * 2), o.x, o.y - 4);
    }
    if (o.hp <= 0) {
      this.world.remove(o);
      const table = LOOT[o.kind] ?? [];
      for (const l of table) {
        const n = l.min + Math.floor(Math.random() * (l.max - l.min + 1));
        if (n > 0) this.spawnDrop(l.id, n, o.x + (Math.random() * 8 - 4), o.y - 4);
      }
      for (let i = 0; i < 10; i++) {
        this.parts.push({
          x: o.x + (Math.random() * 12 - 6),
          y: o.y - 8 - Math.random() * 12,
          vx: (Math.random() * 2 - 1) * 60,
          vy: -Math.random() * 80,
          life: 0.7,
          max: 0.7,
          col,
          size: 2,
          grav: 220,
        });
      }
    }
  }

  private damageMob(m: Mob, dmg: number, kx: number, ky: number) {
    m.hp -= dmg;
    m.hit = 0.2;
    m.hpShow = 2.5;
    m.vx += kx * 130;
    m.vy += ky * 130;
    m.flee = m.def.passive ? 4 : 0;
    sfx.hit();
    this.float(m.x, m.y - 16, `${Math.round(dmg)}`, "#ffe07a");
    const col = m.kind === "slime" ? "#5fc46a" : "#c23b4a";
    for (let i = 0; i < 7; i++) {
      this.parts.push({
        x: m.x,
        y: m.y - 7,
        vx: (Math.random() * 2 - 1) * 70 + kx * 40,
        vy: -Math.random() * 70,
        life: 0.5,
        max: 0.5,
        col,
        size: 1 + Math.round(Math.random()),
        grav: 200,
      });
    }
    if (m.hp <= 0) this.killMob(m);
  }

  private killMob(m: Mob) {
    const i = this.mobs.indexOf(m);
    if (i >= 0) this.mobs.splice(i, 1);
    if (!m.def.passive) this.kills++;
    for (const l of m.def.loot) {
      if (Math.random() > l.chance) continue;
      const n = l.min + Math.floor(Math.random() * (l.max - l.min + 1));
      if (n > 0) this.spawnDrop(l.id, n, m.x + (Math.random() * 8 - 4), m.y);
    }
    for (let i2 = 0; i2 < 12; i2++) {
      this.parts.push({
        x: m.x,
        y: m.y - 6,
        vx: (Math.random() * 2 - 1) * 90,
        vy: -Math.random() * 100,
        life: 0.7,
        max: 0.7,
        col: m.kind === "slime" ? "#5fc46a" : m.kind === "chicken" ? "#f6f2e8" : "#8a3b4a",
        size: 2,
        grav: 220,
      });
    }
  }

  private interact() {
    // campfire nearby? feed it wood
    let fire: WObj | null = null;
    let bestD = 30 * 30;
    for (const o of this.world.fires) {
      const d = (o.x - this.px) ** 2 + (o.y - this.py) ** 2;
      if (d < bestD) {
        bestD = d;
        fire = o;
      }
    }
    if (fire) {
      if (this.count("wood") > 0) {
        this.take("wood", 1);
        fire.fuel = Math.min(180, (fire.fuel ?? 0) + 45);
        sfx.place();
        this.float(fire.x, fire.y - 16, "+дрова", "#ffb65a");
      } else {
        this.toast("Нет дров для костра", "bad");
      }
      this.sync();
      return;
    }
    this.placeSelected();
  }

  private placeSelected() {
    const s = this.inv[this.hotbar];
    if (!s || ITEMS[s.id].kind !== "place") {
      this.toast("Выбери предмет для установки (1-6)", "info");
      return;
    }
    const d = this.dirVec();
    const tx = Math.floor((this.px + d.x * TILE) / TILE);
    const ty = Math.floor((this.py - 4 + d.y * TILE) / TILE);
    if (!this.world.inside(tx, ty) || this.world.isLiquid(this.world.tile(tx, ty))) {
      this.toast("Здесь не поставить", "bad");
      return;
    }
    if (this.world.objAt(tx, ty)) {
      this.toast("Место занято", "bad");
      return;
    }
    const kind: ObjKind = s.id === "campfire" ? "campfire" : "wall";
    this.world.addObject(tx, ty, kind, 0);
    s.n--;
    if (s.n <= 0) this.inv[this.hotbar] = null;
    sfx.place();
    this.toast(`${ITEMS[s.id].name} установлен`, "good");
  }

  /* ------------------------------------------------------------- helpers */

  private spawnDrop(id: ItemId, n: number, x: number, y: number) {
    if (n <= 0) return;
    const a = Math.random() * Math.PI * 2;
    this.drops.push({
      id,
      n,
      x,
      y,
      vx: Math.cos(a) * 24,
      vy: Math.sin(a) * 24,
      z: 6,
      vz: 40,
      life: 120,
    });
  }

  private float(x: number, y: number, text: string, col: string) {
    this.texts.push({ x, y, text, col, life: 0.9 });
    if (this.texts.length > 40) this.texts.shift();
  }

  private hints = new Set<string>();

  private hint(key: string, text: string, kind: Toast["kind"] = "info") {
    if (this.hints.has(key)) return;
    this.hints.add(key);
    this.toast(text, kind);
  }

  private checkHints(id: ItemId) {
    if (id === "wood") this.hint("wood", "Древесина есть! Открой крафт (C) и сделай топор", "info");
    if (id === "stone") this.hint("stone", "Камень! Из него выйдет кирка и костёр", "info");
    if (this.count("wood") >= 6 && this.count("stone") >= 4)
      this.hint("fire", "Хватит на костёр: C → Костёр, потом E — поставить", "good");
    if (id === "meat") this.hint("meat", "Мясо лучше пожарить у костра (крафт рядом с огнём)", "info");
  }

  toast(text: string, kind: Toast["kind"] = "info") {
    this.toasts.push({ id: this.toastId++, text, kind });
    if (this.toasts.length > 4) this.toasts.shift();
    window.setTimeout(() => {
      this.toasts.shift();
      this.sync();
    }, 4000);
  }

  /* ---------------------------------------------------------------- frame */

  private frame(dt: number) {
    if (this.phase === "play" && !this.paused && !this.uiPause) this.update(dt);
    this.render();
    this.syncT += dt;
    if (this.syncT > 0.1) {
      this.syncT = 0;
      this.sync();
    }
  }

  sync() {
    this.onSync(this.snapshot());
  }

  snapshot(): Snapshot {
    const clock = (this.time % CYCLE) / CYCLE;
    const light = lightLevel(clock);
    return {
      phase: this.phase,
      paused: this.paused,
      hp: this.hp,
      maxHp: this.maxHp,
      hunger: this.hunger,
      warmth: this.warmth,
      stamina: this.stamina,
      day: this.day,
      clock,
      light,
      isNight: light < 0.55,
      inv: this.inv,
      hotbar: this.hotbar,
      toasts: this.toasts,
      kills: this.kills,
      wood: this.count("wood"),
      nearFire: this.nearFire,
      best: this.best,
      muted: sfx.muted,
      tip: this.tip(),
      biome: BIOME_NAME[this.world.tileAtPx(this.px, this.py)] ?? "",
    };
  }

  private tip(): string {
    if (this.phase !== "play") return "";
    if (this.nearFire) return "E — подбросить дров · костёр греет и жарит мясо";
    const s = this.inv[this.hotbar];
    if (s && ITEMS[s.id].kind === "place") return `E — поставить: ${ITEMS[s.id].name}`;
    if (s && ITEMS[s.id].kind === "food") return `F — съесть: ${ITEMS[s.id].name}`;
    const near = this.world.near(this.px, this.py, 1);
    if (near.some((o) => WOODY.includes(o.kind))) return "Пробел — рубить дерево (топором быстрее)";
    if (near.some((o) => STONY.includes(o.kind))) return "Пробел — добыть камень (нужна кирка)";
    if (this.hunger < 40) return "Ты голоден — поохоться на кур или собери ягоды";
    return "C — крафт · I — инвентарь · Shift — бег";
  }

  /* --------------------------------------------------------------- update */

  private update(dt: number) {
    this.time += dt;
    const clock = (this.time % CYCLE) / CYCLE;
    const light = lightLevel(clock);
    const isNight = light < 0.55;
    const newDay = Math.floor(this.time / CYCLE) + 1;
    if (newDay !== this.day) {
      this.day = newDay;
      sfx.dawn();
      this.toast(`Рассвет. День ${this.day}. Ты выжил!`, "good");
      this.best = Math.max(this.best, this.day - 1);
      localStorage.setItem(BEST_KEY, String(this.best));
    }
    if (isNight !== this.wasNight) {
      this.wasNight = isNight;
      if (isNight) {
        sfx.night();
        this.toast("Наступает ночь. Из тьмы лезут твари!", "bad");
      }
    }

    this.updatePlayer(dt, isNight);
    this.updateMobs(dt);
    this.updateDrops(dt);
    this.updateObjects(dt);
    this.spawnLogic(dt, isNight);

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      if (p.life <= 0) this.parts.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 16 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.hitObjs.length - 1; i >= 0; i--) {
      const o = this.hitObjs[i];
      o.hit -= dt;
      if (o.hit <= 0) {
        o.hit = 0;
        this.hitObjs.splice(i, 1);
      }
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
  }

  private updatePlayer(dt: number, isNight: boolean) {
    let mx = this.touchMove.x;
    let my = this.touchMove.y;
    if (this.keys.has("a") || this.keys.has("arrowleft") || this.keys.has("ф")) mx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright") || this.keys.has("в")) mx += 1;
    if (this.keys.has("w") || this.keys.has("arrowup") || this.keys.has("ц")) my -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown") || this.keys.has("ы")) my += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const moving = Math.hypot(mx, my) > 0.05;
    const wantRun = (this.keys.has("shift") || this.keys.has("control")) && this.stamina > 1 && moving;
    const speedMul = wantRun ? 1.55 : 1;
    if (wantRun) this.stamina = clamp(this.stamina - 26 * dt, 0, 100);
    else this.stamina = clamp(this.stamina + 16 * dt, 0, 100);

    const tile = this.world.tileAtPx(this.px, this.py);
    const terrainMul = tile === T.Sand ? 0.86 : tile === T.Snow ? 0.78 : tile === T.Rock ? 0.92 : 1;
    const sp = PLAYER_SPEED * speedMul * terrainMul;
    this.pvx = lerp(this.pvx, mx * sp, 0.35);
    this.pvy = lerp(this.pvy, my * sp, 0.35);

    if (moving) {
      this.walkT += dt * (wantRun ? 10 : 7);
      if (Math.abs(mx) > Math.abs(my)) this.dir = mx > 0 ? "right" : "left";
      else if (my !== 0) this.dir = my > 0 ? "down" : "up";
    } else this.walkT = 0;

    this.moveEntity(this, dt, 5);

    if (this.attackT > 0) this.attackT -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.invul > 0) this.invul -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.touchAttack && this.attackCd <= 0) this.attack();

    // survival stats
    this.hunger = clamp(this.hunger - (0.4 + (Math.abs(this.pvx) + Math.abs(this.pvy) > 10 ? 0.12 : 0)) * dt, 0, 100);
    const tileNow = this.world.tileAtPx(this.px, this.py);
    let warmthRate = isNight ? -1.35 : 2.5;
    if (tileNow === T.Snow) warmthRate -= 2.2;
    if (tileNow === T.Rock) warmthRate -= 0.4;

    // campfire warmth
    this.nearFire = false;
    for (const o of this.world.fires) {
      if ((o.fuel ?? 0) <= 0) continue;
      if (Math.hypot(o.x - this.px, o.y - this.py) < 48) {
        this.nearFire = true;
        warmthRate = 14;
        break;
      }
    }
    this.warmth = clamp(this.warmth + warmthRate * dt, 0, 100);

    let dmg = 0;
    if (this.hunger <= 0) dmg += 2.4;
    if (this.warmth <= 0) dmg += 2.8;
    if (dmg > 0) {
      this.hp -= dmg * dt;
      if (Math.random() < dt * 1.2) this.float(this.px, this.py - 22, this.hunger <= 0 ? "голод!" : "холод!", "#ff8a8a");
    } else if (this.hunger > 55 && this.hp < this.maxHp) {
      this.regenT += dt;
      if (this.regenT > 1) {
        this.regenT = 0;
        this.hp = clamp(this.hp + 1.2, 0, this.maxHp);
        this.hunger = clamp(this.hunger - 0.4, 0, 100);
      }
    }
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.phase = "dead";
    this.hp = 0;
    sfx.die();
    this.best = Math.max(this.best, this.day - 1);
    localStorage.setItem(BEST_KEY, String(this.best));
    this.sync();
  }

  /** generic circle-vs-world movement with sliding */
  private moveEntity(e: { px?: number; py?: number; x?: number; y?: number; pvx?: number; pvy?: number; vx?: number; vy?: number }, dt: number, rad: number) {
    const isPlayer = e.px !== undefined;
    let x = isPlayer ? (e.px as number) : (e.x as number);
    let y = isPlayer ? (e.py as number) : (e.y as number);
    const vx = isPlayer ? (e.pvx as number) : (e.vx as number);
    const vy = isPlayer ? (e.pvy as number) : (e.vy as number);

    const canStand = (nx: number, ny: number) => {
      if (!this.world.walkablePx(nx - rad * 0.6, ny - 1)) return false;
      if (!this.world.walkablePx(nx + rad * 0.6, ny - 1)) return false;
      if (!this.world.walkablePx(nx, ny - 5)) return false;
      for (const o of this.world.near(nx, ny, 2)) {
        if (!o.solid) continue;
        const dx = nx - o.x;
        const dy = (ny - 3) - (o.y - 5);
        const rr = o.r + rad * 0.8;
        if (dx * dx + dy * dy * 1.6 < rr * rr) return false;
      }
      return true;
    };

    const nx = x + vx * dt;
    if (canStand(nx, y)) x = nx;
    const ny = y + vy * dt;
    if (canStand(x, ny)) y = ny;

    // soft push-out so nothing can get permanently stuck inside a prop
    for (const o of this.world.near(x, y, 2)) {
      if (!o.solid) continue;
      const dx = x - o.x;
      const dy = y - 3 - (o.y - 5);
      const rr = o.r + rad * 0.8;
      const d = Math.hypot(dx, dy * 1.25);
      if (d < rr && d > 0.001) {
        const push = (rr - d) * Math.min(1, dt * 12);
        x += (dx / d) * push;
        y += (dy / d) * push * 0.7;
      }
    }

    x = clamp(x, 8, this.world.W * TILE - 8);
    y = clamp(y, 8, this.world.H * TILE - 8);
    if (isPlayer) {
      this.px = x;
      this.py = y;
    } else {
      e.x = x;
      e.y = y;
    }
  }

  private updateMobs(dt: number) {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      m.t += dt;
      if (m.hit > 0) m.hit -= dt;
      if (m.atkCd > 0) m.atkCd -= dt;
      if (m.flee > 0) m.flee -= dt;
      if (m.hpShow > 0) m.hpShow -= dt;

      const dx = this.px - m.x;
      const dy = this.py - m.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist > 760) {
        this.mobs.splice(i, 1);
        continue;
      }

      let tx = 0;
      let ty = 0;
      if (m.def.passive) {
        if (m.flee > 0 || dist < 34) {
          tx = -dx / dist;
          ty = -dy / dist;
        } else {
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            m.wanderT = 1.4 + Math.random() * 2.4;
            const a = Math.random() * Math.PI * 2;
            m.wx = Math.cos(a);
            m.wy = Math.sin(a);
            if (Math.random() < 0.4) {
              m.wx = 0;
              m.wy = 0;
            }
          }
          tx = m.wx;
          ty = m.wy;
        }
      } else if (dist < 300) {
        tx = dx / dist;
        ty = dy / dist;
        if (m.kind === "bat") {
          tx += Math.cos(m.t * 4) * 0.55;
          ty += Math.sin(m.t * 5) * 0.55;
        }
        if (m.kind === "slime") {
          const hop = Math.sin(m.t * 4);
          if (hop < 0.2) {
            tx *= 0.25;
            ty *= 0.25;
          }
        }
      } else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = 2 + Math.random() * 2;
          const a = Math.random() * Math.PI * 2;
          m.wx = Math.cos(a);
          m.wy = Math.sin(a);
        }
        tx = m.wx * 0.6;
        ty = m.wy * 0.6;
      }

      const sp = m.def.speed * (m.flee > 0 ? 1.5 : 1);
      m.vx = lerp(m.vx, tx * sp, 0.18);
      m.vy = lerp(m.vy, ty * sp, 0.18);
      if (Math.abs(m.vx) > 2) m.face = m.vx > 0 ? 1 : -1;
      m.dir = Math.abs(m.vx) > Math.abs(m.vy) ? (m.vx > 0 ? "right" : "left") : m.vy > 0 ? "down" : "up";
      this.moveEntity(m, dt, m.def.radius);

      // attack player
      if (!m.def.passive && dist < m.def.radius + 11 && m.atkCd <= 0 && this.invul <= 0) {
        m.atkCd = 1.0;
        const dmg = m.def.damage * (1 + (this.day - 1) * 0.06);
        this.hp -= dmg;
        this.invul = 0.45;
        this.hurtFlash = 0.35;
        this.shake = 1;
        sfx.hurt();
        this.float(this.px, this.py - 24, `-${Math.round(dmg)}`, "#ff6b6b");
        this.pvx = (-dx / dist) * 150;
        this.pvy = (-dy / dist) * 150;
        if (this.hp <= 0) this.die();
      }

      // burn near campfire
      if (!m.def.passive && m.t % 1 < dt) {
        for (const o of this.world.fires) {
          if ((o.fuel ?? 0) > 0 && Math.hypot(o.x - m.x, o.y - m.y) < 22) {
            this.damageMob(m, 6, 0, 0);
            break;
          }
        }
      }
    }
  }

  private updateDrops(dt: number) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.vz -= 240 * dt;
      d.z += d.vz * dt;
      if (d.z < 0) {
        d.z = 0;
        d.vz = -d.vz * 0.35;
        if (Math.abs(d.vz) < 12) d.vz = 0;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.9;
      d.vy *= 0.9;

      const dx = this.px - d.x;
      const dy = this.py - 6 - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 40) {
        const pull = 240 / Math.max(8, dist);
        d.vx += (dx / dist) * pull;
        d.vy += (dy / dist) * pull;
      }
      if (dist < 9) {
        const left = this.addItem(d.id, d.n);
        if (left === 0) {
          this.drops.splice(i, 1);
          sfx.pickup();
          this.float(d.x, d.y - 10, `+${d.n} ${ITEMS[d.id].name}`, "#d9f2a0");
          this.checkHints(d.id);
          continue;
        } else {
          d.n = left;
          if (Math.random() < 0.02) this.toast("Инвентарь переполнен", "bad");
        }
      }
      if (d.life <= 0) this.drops.splice(i, 1);
    }
  }

  private updateObjects(dt: number) {
    for (const o of this.world.fires) {
      if ((o.fuel ?? 0) > 0) {
        o.fuel = Math.max(0, (o.fuel ?? 0) - dt);
        const visible = Math.abs(o.x - this.px) < 400 && Math.abs(o.y - this.py) < 300;
        if (visible && Math.random() < dt * 8) {
          this.parts.push({
            x: o.x + (Math.random() * 6 - 3),
            y: o.y - 12,
            vx: (Math.random() * 2 - 1) * 8,
            vy: -22 - Math.random() * 20,
            life: 0.8,
            max: 0.8,
            col: Math.random() < 0.5 ? "#f59a1e" : "#ffd76a",
            size: 1,
            grav: -12,
          });
        }
        if (o.fuel === 0) this.toast("Костёр погас", "bad");
      }
    }
    // berries slowly grow back on nearby bushes
    this.regrowT -= dt;
    if (this.regrowT <= 0) {
      this.regrowT = 3;
      for (const o of this.world.near(this.px, this.py, 12)) {
        if (o.kind === "bush" && (o.berries ?? 0) === 0 && Math.random() < 0.25) o.berries = 3;
      }
    }
  }

  private spawnLogic(dt: number, isNight: boolean) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 1.2;

    const hostiles = this.mobs.filter((m) => !m.def.passive).length;
    const passives = this.mobs.filter((m) => m.def.passive).length;
    const wave = Math.min(this.day, 8);
    const targetHostile = isNight ? Math.round(2 + wave * 1.6) : 2;
    const targetPassive = 5;

    if (passives < targetPassive) this.spawnMob("chicken");
    if (hostiles < targetHostile) {
      let kind: MobKind = "slime";
      if (isNight) {
        const r = Math.random();
        if (this.day >= 3 && r < 0.12) kind = "brute";
        else if (r < 0.45) kind = "zombie";
        else if (r < 0.75) kind = "bat";
        else kind = "slime";
      }
      this.spawnMob(kind);
    }
  }

  private spawnMob(kind: MobKind) {
    const def = MOBS[kind];
    for (let tries = 0; tries < 24; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 170 + Math.random() * 180;
      const x = this.px + Math.cos(a) * r;
      const y = this.py + Math.sin(a) * r;
      if (!this.world.walkablePx(x, y)) continue;
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      const o = this.world.objAt(tx, ty);
      if (o && o.solid) continue;
      let nearFire = false;
      for (const f of this.world.fires) {
        if ((f.fuel ?? 0) > 0 && Math.hypot(f.x - x, f.y - y) < 90) {
          nearFire = true;
          break;
        }
      }
      if (nearFire && !def.passive) continue;
      this.mobs.push({
        kind,
        def,
        x,
        y,
        vx: 0,
        vy: 0,
        hp: def.hp,
        maxHp: def.hp,
        t: Math.random() * 10,
        hit: 0,
        atkCd: 0,
        flee: 0,
        face: 1,
        dir: "down",
        wanderT: Math.random() * 2,
        wx: 0,
        wy: 0,
        hpShow: 0,
      });
      return;
    }
  }

  /* --------------------------------------------------------------- render */

  private silhouette(src: HTMLCanvasElement) {
    const c = this.silCache.get(src);
    if (c) return c;
    const { c: nc, x } = mk(src.width, src.height);
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = "source-atop";
    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, src.width, src.height);
    this.silCache.set(src, nc);
    return nc;
  }

  private objSprite(o: WObj): HTMLCanvasElement {
    switch (o.kind) {
      case "tree":
        return SP[`tree${o.variant}`];
      case "pine":
        return SP[`pine${o.variant}`];
      case "snowtree":
        return SP[`snowtree${o.variant}`];
      case "dead":
        return SP.dead0;
      case "rock":
        return SP[`rock${o.variant}`];
      case "iron":
        return SP.iron0;
      case "bush":
        return (o.berries ?? 0) > 0 ? SP[`bush${o.variant}`] : SP[`bushEmpty${o.variant}`];
      case "tuft":
        return SP[`tuft${o.variant}`];
      case "flower":
        return SP[`flower${o.variant}`];
      case "wall":
        return SP.wall;
      case "campfire":
        return (o.fuel ?? 0) > 0 ? SP[`fire${Math.floor(performance.now() / 110) % 3}`] : SP.fireOut;
      default:
        return SP.rock0;
    }
  }

  private mobSprite(m: Mob): HTMLCanvasElement {
    const f = Math.floor(m.t * 6) % 2;
    switch (m.kind) {
      case "slime":
        return SP[`slime${Math.floor(m.t * 4) % 2}`];
      case "bat":
        return SP[`bat${Math.floor(m.t * 10) % 2}`];
      case "chicken":
        return SP[`chicken${m.face > 0 ? 0 : 1}`];
      default: {
        const d = m.dir === "left" ? "Left" : m.dir === "right" ? "Right" : m.dir === "up" ? "Up" : "Down";
        return SP[`${m.kind}${d}${f}`];
      }
    }
  }

  private render() {
    const ctx = this.ctx;
    const cv = this.canvas;
    if (!ctx || !cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = this.scale;
    const vw = Math.ceil(cv.width / dpr / S);
    const vh = Math.ceil(cv.height / dpr / S);

    // camera
    const shakeX = this.shake > 0 ? (Math.random() * 2 - 1) * 3 * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() * 2 - 1) * 3 * this.shake : 0;
    const tcx = this.px - vw / 2 + shakeX;
    const tcy = this.py - vh / 2 + shakeY;
    this.camX = lerp(this.camX, tcx, 0.16);
    this.camY = lerp(this.camY, tcy, 0.16);
    this.camX = clamp(this.camX, 0, Math.max(0, this.world.W * TILE - vw));
    this.camY = clamp(this.camY, 0, Math.max(0, this.world.H * TILE - vh));
    const camX = Math.round(this.camX);
    const camY = Math.round(this.camY);

    ctx.setTransform(S * dpr, 0, 0, S * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0e1420";
    ctx.fillRect(0, 0, vw, vh);
    ctx.translate(-camX, -camY);

    // ---- terrain chunks
    const CH = 8 * TILE;
    const c0 = Math.floor(camX / CH);
    const c1 = Math.floor((camX + vw) / CH);
    const r0 = Math.floor(camY / CH);
    const r1 = Math.floor((camY + vh) / CH);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        if (cx < 0 || cy < 0 || cx * 8 >= this.world.W || cy * 8 >= this.world.H) continue;
        ctx.drawImage(this.world.chunkCanvas(cx, cy), cx * CH, cy * CH);
      }
    }

    // ---- gather renderables
    type R = { y: number; draw: () => void };
    const list: R[] = [];

    const tx0 = Math.floor(camX / TILE) - 2;
    const tx1 = Math.floor((camX + vw) / TILE) + 2;
    const ty0 = Math.floor(camY / TILE) - 2;
    const ty1 = Math.floor((camY + vh) / TILE) + 3;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const o = this.world.objAt(tx, ty);
        if (!o) continue;
        list.push({
          y: o.y,
          draw: () => {
            const s = this.objSprite(o);
            const dx = Math.round(o.x - s.width / 2);
            const dy = Math.round(o.y - s.height + 2);
            if (o.solid && o.kind !== "wall") {
              ctx.fillStyle = "rgba(0,0,0,0.18)";
              ctx.beginPath();
              ctx.ellipse(o.x, o.y - 1, s.width * 0.3, 3, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            const sway = o.hit > 0.7 && o.kind !== "wall" ? Math.sin(o.hit * 60) * 1.5 : 0;
            ctx.drawImage(s, dx + Math.round(sway), dy);
            const fa = clamp((o.hit - 0.72) * 4, 0, 1);
            if (fa > 0) {
              ctx.globalAlpha = fa;
              ctx.drawImage(this.silhouette(s), dx + Math.round(sway), dy);
              ctx.globalAlpha = 1;
            }
            if (o.hp < o.maxHp && o.hit > 0) {
              const w = 16;
              ctx.fillStyle = "rgba(0,0,0,0.6)";
              ctx.fillRect(o.x - w / 2, dy - 5, w, 3);
              ctx.fillStyle = "#8ee06a";
              ctx.fillRect(o.x - w / 2 + 1, dy - 4, (w - 2) * (o.hp / o.maxHp), 1);
            }
          },
        });
      }
    }

    for (const m of this.mobs) {
      if (m.x < camX - 40 || m.x > camX + vw + 40 || m.y < camY - 60 || m.y > camY + vh + 60) continue;
      list.push({
        y: m.y,
        draw: () => {
          const s = this.mobSprite(m);
          const sc = m.def.scale;
          const w = Math.round(s.width * sc);
          const h = Math.round(s.height * sc);
          const bob = m.kind === "bat" ? Math.sin(m.t * 6) * 3 - 8 : 0;
          const dx = Math.round(m.x - w / 2);
          const dy = Math.round(m.y - h + 2 + bob);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.beginPath();
          ctx.ellipse(m.x, m.y - 1, w * 0.28, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.drawImage(s, dx, dy, w, h);
          if (m.hit > 0) {
            ctx.globalAlpha = Math.min(1, m.hit * 4);
            ctx.drawImage(this.silhouette(s), dx, dy, w, h);
            ctx.globalAlpha = 1;
          }
          if (m.hpShow > 0 && m.hp < m.maxHp) {
            const bw = 18;
            ctx.fillStyle = "rgba(0,0,0,0.65)";
            ctx.fillRect(m.x - bw / 2, dy - 6, bw, 4);
            ctx.fillStyle = m.def.passive ? "#e0d76a" : "#e05a5a";
            ctx.fillRect(m.x - bw / 2 + 1, dy - 5, (bw - 2) * clamp(m.hp / m.maxHp, 0, 1), 2);
          }
        },
      });
    }

    // player
    list.push({
      y: this.py,
      draw: () => {
        const f = this.walkT > 0 ? Math.floor(this.walkT) % 2 : 0;
        const d = this.dir === "left" ? "Left" : this.dir === "right" ? "Right" : this.dir === "up" ? "Up" : "Down";
        const s = SP[`hero${d}${f}`];
        const dx = Math.round(this.px - s.width / 2);
        const dy = Math.round(this.py - s.height + 2);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(this.px, this.py - 1, 6, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(s, dx, dy);
        if (this.hurtFlash > 0) {
          ctx.globalAlpha = Math.min(1, this.hurtFlash * 3);
          ctx.drawImage(this.silhouette(s), dx, dy);
          ctx.globalAlpha = 1;
        }
        // swing arc
        if (this.attackT > 0) {
          const p = 1 - this.attackT / 0.22;
          const base = this.dir === "right" ? 0 : this.dir === "left" ? Math.PI : this.dir === "down" ? Math.PI / 2 : -Math.PI / 2;
          const a0 = base - 1.1 + p * 2.2;
          const cxp = this.px;
          const cyp = this.py - 8;
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cxp, cyp, 15, a0 - 0.45, a0 + 0.45);
          ctx.stroke();
          const held = this.inv[this.hotbar];
          if (held && ITEMS[held.id].kind === "tool") {
            const ic = ITEM_ICON[held.id];
            if (ic) ctx.drawImage(ic, Math.round(cxp + Math.cos(a0) * 13 - 6), Math.round(cyp + Math.sin(a0) * 13 - 6));
          }
        }
      },
    });

    // dropped items
    for (const d of this.drops) {
      if (d.x < camX - 20 || d.x > camX + vw + 20 || d.y < camY - 20 || d.y > camY + vh + 20) continue;
      list.push({
        y: d.y,
        draw: () => {
          const ic = ITEM_ICON[d.id];
          if (!ic) return;
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, 4, 1.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.drawImage(ic, Math.round(d.x - 6), Math.round(d.y - 12 - d.z));
        },
      });
    }

    list.sort((a, b) => a.y - b.y);
    for (const r of list) r.draw();

    // particles
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // ---- lighting
    const clock = (this.time % CYCLE) / CYCLE;
    const light = lightLevel(clock);
    const dark = 1 - light;
    if (dark > 0.02) {
      // warm glow around fires (additive)
      ctx.globalCompositeOperation = "lighter";
      for (const o of this.world.fires) {
        if ((o.fuel ?? 0) <= 0) continue;
        if (o.x < camX - 90 || o.x > camX + vw + 90 || o.y < camY - 90 || o.y > camY + vh + 90) continue;
        const fl = 1 + Math.sin(performance.now() / 90) * 0.06;
        const g = ctx.createRadialGradient(o.x, o.y - 8, 0, o.x, o.y - 8, 70 * fl);
        g.addColorStop(0, `rgba(255,170,70,${0.35 * dark})`);
        g.addColorStop(1, "rgba(255,150,50,0)");
        ctx.fillStyle = g;
        ctx.fillRect(o.x - 80, o.y - 88, 160, 160);
      }
      ctx.globalCompositeOperation = "source-over";

      if (!this.lightCv || this.lightCv.width !== vw || this.lightCv.height !== vh) {
        this.lightCv = mk(vw, vh).c;
      }
      const lx = this.lightCv.getContext("2d")!;
      lx.setTransform(1, 0, 0, 1, 0, 0);
      lx.clearRect(0, 0, vw, vh);
      lx.fillStyle = `rgba(10,12,38,${0.9 * dark})`;
      lx.fillRect(0, 0, vw, vh);
      lx.globalCompositeOperation = "destination-out";
      const cut = (wx: number, wy: number, r: number, s: number) => {
        const x = wx - camX;
        const y = wy - camY;
        if (x < -r || y < -r || x > vw + r || y > vh + r) return;
        const g = lx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${s})`);
        g.addColorStop(0.45, `rgba(0,0,0,${s * 0.72})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        lx.fillStyle = g;
        lx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      const held = this.inv[this.hotbar];
      const torch = held && held.id === "torch";
      cut(this.px, this.py - 8, torch ? 96 : 40, torch ? 1 : 0.62);
      for (const o of this.world.fires) {
        if ((o.fuel ?? 0) > 0) {
          const fl = 1 + Math.sin(performance.now() / 80 + o.x) * 0.05;
          cut(o.x, o.y - 8, 92 * fl, 1);
        }
      }
      lx.globalCompositeOperation = "source-over";
      ctx.drawImage(this.lightCv, camX, camY);
    }

    // floating text (above lighting)
    ctx.font = '7px "Pixelify Sans", monospace';
    ctx.textAlign = "center";
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / 0.9, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.col;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // hurt vignette
    if (this.hurtFlash > 0) {
      ctx.setTransform(S * dpr, 0, 0, S * dpr, 0, 0);
      ctx.fillStyle = `rgba(180,20,30,${this.hurtFlash * 0.5})`;
      ctx.fillRect(0, 0, vw, vh);
    }
  }
}
