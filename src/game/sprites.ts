/* ---------------------------------------------------------------
 *  PIXEL SPRITE FACTORY
 *  Hand authored string-sprites + procedural pixel generators.
 * ------------------------------------------------------------- */

export type Px = HTMLCanvasElement;

export function mk(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fromRows(rows: string[], pal: Record<string, string>): Px {
  const w = Math.max(...rows.map((r) => r.length));
  const { c, x } = mk(w, rows.length);
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(i, y, 1, 1);
    }
  });
  return c;
}

export function flipH(src: Px): Px {
  const { c, x } = mk(src.width, src.height);
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

/** adds a 1px outline around every non transparent pixel */
export function outline(src: Px, color: string): Px {
  const { c, x } = mk(src.width + 2, src.height + 2);
  const s = src.getContext("2d")!.getImageData(0, 0, src.width, src.height).data;
  const at = (px: number, py: number) => {
    if (px < 0 || py < 0 || px >= src.width || py >= src.height) return 0;
    return s[(py * src.width + px) * 4 + 3];
  };
  x.fillStyle = color;
  for (let y = 0; y < src.height; y++) {
    for (let px = 0; px < src.width; px++) {
      if (at(px, y) > 0) continue;
      if (at(px - 1, y) > 0 || at(px + 1, y) > 0 || at(px, y - 1) > 0 || at(px, y + 1) > 0) {
        x.fillRect(px + 1, y + 1, 1, 1);
      }
    }
  }
  // border ring for pixels at the very edge
  for (let y = 0; y < src.height; y++) {
    for (let px = 0; px < src.width; px++) {
      if (at(px, y) === 0) continue;
      if (px === 0) x.fillRect(0, y + 1, 1, 1);
      if (px === src.width - 1) x.fillRect(src.width + 1, y + 1, 1, 1);
      if (y === 0) x.fillRect(px + 1, 0, 1, 1);
      if (y === src.height - 1) x.fillRect(px + 1, src.height + 1, 1, 1);
    }
  }
  x.drawImage(src, 1, 1);
  return c;
}

export function recolor(src: Px, map: Record<string, string>): Px {
  const { c, x } = mk(src.width, src.height);
  x.drawImage(src, 0, 0);
  const img = x.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  const table: Record<string, [number, number, number]> = {};
  for (const k in map) {
    const to = hex(map[k]);
    table[hex(k).join(",")] = to;
  }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const key = `${d[i]},${d[i + 1]},${d[i + 2]}`;
    const to = table[key];
    if (to) {
      d[i] = to[0];
      d[i + 1] = to[1];
      d[i + 2] = to[2];
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

function hex(h: string): [number, number, number] {
  const v = parseInt(h.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function pcirc(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string) {
  x.fillStyle = col;
  const rr = r * r + r * 0.55;
  for (let y = -r - 1; y <= r + 1; y++) {
    for (let px = -r - 1; px <= r + 1; px++) {
      if (px * px + y * y <= rr) x.fillRect(Math.round(cx + px), Math.round(cy + y), 1, 1);
    }
  }
}

/* -------------------------------------------------- CHARACTERS */

const HERO_PAL: Record<string, string> = {
  "1": "#2b1b2e",
  "2": "#f7c99b",
  "3": "#d79a6b",
  "4": "#7b4a22",
  "5": "#a1672f",
  "6": "#4e9d55",
  "7": "#2f6b3a",
  "8": "#3f4f7a",
  "9": "#2c3a5c",
  b: "#6b4227",
  "0": "#221a2b",
};

const HEAD_DOWN = [
  "................",
  ".....444444.....",
  "....44444444....",
  "...4455555544...",
  "...4222222224...",
  "...4202222024...",
  "...4222332224...",
  "...4322222234...",
  "....42333324....",
];

const HEAD_UP = [
  "................",
  ".....444444.....",
  "....44444444....",
  "...4455555544...",
  "...4444444444...",
  "...4444444444...",
  "...4444444444...",
  "...4544444454...",
  "....43333334....",
];

const HEAD_SIDE = [
  "................",
  "....444444......",
  "...44444444.....",
  "...4442222222...",
  "...4442220222...",
  "...4442222332...",
  "...4442222222...",
  "....43222223....",
  ".....3333333....",
];

const BODY_A = [
  "...6666666666...",
  "..666666666666..",
  "..266666666662..",
  "...7777777777...",
  "....88888888....",
  "....888..888....",
  "....bbb..bbb....",
];

const BODY_B = [
  "...6666666666...",
  "..666666666666..",
  "..26666666662...",
  "...7777777777...",
  "....88888888....",
  "...888....888...",
  "..bbb......bbb..",
];

const BODY_SIDE_A = [
  "....66666666....",
  "...666666666....",
  "....666666662...",
  "....77777777....",
  "....88888888....",
  ".....888888.....",
  "....bbbbbb......",
];

const BODY_SIDE_B = [
  "....66666666....",
  "...666666666....",
  "....666666662...",
  "....77777777....",
  "....88888888....",
  "...888...888....",
  "..bbb.....bbbb..",
];

function hero(head: string[], body: string[], pal: Record<string, string>) {
  return outline(fromRows([...head, ...body], pal), "#1a1020");
}

/* -------------------------------------------------- ITEM ICONS */

const I = {
  wood: [
    "............",
    "............",
    "...111111...",
    "..1DDDDDD1..",
    ".1DkDDkDDD1.",
    ".1DDDDDDDD1.",
    ".1dddddddd1.",
    "..11111111..",
    "............",
    "............",
  ],
  stone: [
    "............",
    "....1111....",
    "...1GGGG1...",
    "..1GGGGGG1..",
    ".1GGGGGGGG1.",
    ".1gGGGGGGg1.",
    ".1gggggggg1.",
    "..11111111..",
    "............",
    "............",
  ],
  iron: [
    "............",
    "....1111....",
    "...1GGoG1...",
    "..1GoGGGG1..",
    ".1GGGGoGG1..",
    ".1gGoGGGg1..",
    ".1ggggoGg1..",
    "..11111111..",
    "............",
    "............",
  ],
  fiber: [
    "............",
    "....f...f...",
    "...f...f.f..",
    "...f..ff.f..",
    "..f.fff..f..",
    "..f.ff..ff..",
    "...ffffff...",
    "....FFFF....",
    "............",
    "............",
  ],
  berry: [
    "............",
    "......FF....",
    ".....FF.....",
    "...rr..rr...",
    "..rRrrrRr...",
    "..rrrrrrr...",
    "...rr.rr....",
    "............",
    "............",
    "............",
  ],
  meat: [
    "............",
    "...mmmm.....",
    "..mMMMMmm...",
    ".mMMMMMMMm..",
    ".mMMMMMMMm..",
    "..mMMMMMm...",
    "...wwmmm....",
    "..www.......",
    "............",
    "............",
  ],
  cookedMeat: [
    "............",
    "...cccc.....",
    "..cCCCCcc...",
    ".cCCCCCCCc..",
    ".cCCCCCCCc..",
    "..cCCCCCc...",
    "...wwccc....",
    "..www.......",
    "............",
    "............",
  ],
  leather: [
    "............",
    "..LL....LL..",
    ".LllllllllL.",
    ".LllllllllL.",
    ".LlllllllL..",
    "..LlllllL...",
    "...LllllL...",
    "....LLLL....",
    "............",
    "............",
  ],
  bone: [
    "............",
    "..ww....ww..",
    ".wWWw..wWWw.",
    "..wWWwwWWw..",
    "...wWWWWw...",
    "...wWWWWw...",
    "..wWWwwWWw..",
    ".wWWw..wWWw.",
    "..ww....ww..",
    "............",
  ],
  axe: [
    "....1111....",
    "...1AAAA1...",
    "..1AAAAAA1..",
    "..1AAAAAA1..",
    "...1AAhA1...",
    "....11h1....",
    "......h.....",
    ".....h......",
    ".....h......",
    "....hh......",
  ],
  pickaxe: [
    "..1......1..",
    ".1A1....1A1.",
    ".1AA1111AA1.",
    "..1AAAhAAA1.",
    "...111h111..",
    "......h.....",
    "......h.....",
    ".....h......",
    ".....h......",
    "....hh......",
  ],
  sword: [
    "........11..",
    ".......1AA1.",
    "......1AA1..",
    ".....1AA1...",
    "....1AA1....",
    "...1AA1.....",
    "..1yyyyy1...",
    "...1hA1.....",
    "..1hhh1.....",
    "...111......",
  ],
  torch: [
    ".....o......",
    "....oyo.....",
    "...oyYyo....",
    "....oyo.....",
    ".....o......",
    ".....h......",
    ".....h......",
    "....h.......",
    "....h.......",
    "...h........",
  ],
  bandage: [
    "............",
    "...wwwwww...",
    "..w111111w..",
    "..w11rr11w..",
    "..wrrrrrrw..",
    "..w11rr11w..",
    "..w111111w..",
    "...wwwwww...",
    "............",
    "............",
  ],
};

const ICON_PAL: Record<string, string> = {
  "1": "#241a22",
  D: "#a9733f",
  d: "#7a4f28",
  k: "#5c3a1e",
  G: "#9aa0ad",
  g: "#6d7480",
  o: "#e08a3c",
  f: "#83b35a",
  F: "#5c7f3c",
  r: "#cf3b46",
  R: "#f2707a",
  m: "#c0505f",
  M: "#e8798a",
  c: "#7d4426",
  C: "#a9663a",
  w: "#f1ece1",
  W: "#cfc7b5",
  L: "#8a6033",
  l: "#b98b4e",
  A: "#c3cad6",
  y: "#e8c65a",
  Y: "#fff3b0",
  h: "#8a5a30",
};

/* ------------------------------------------------ PROCEDURAL PROPS */

function makeTree(seed: number, kind: "oak" | "pine" | "dead" | "snow") {
  const W = 28;
  const H = 34;
  const { c, x } = mk(W, H);
  const r = mulberry32(seed * 7919 + 13);
  const cx = W / 2;

  // trunk
  const tw = kind === "pine" ? 4 : 5;
  const th = kind === "pine" ? 9 : 12;
  const tx = Math.floor(cx - tw / 2);
  const ty = H - th - 1;
  x.fillStyle = "#6d4526";
  x.fillRect(tx, ty, tw, th);
  x.fillStyle = "#4b2d17";
  x.fillRect(tx + tw - 2, ty, 2, th);
  x.fillStyle = "#8b5c33";
  x.fillRect(tx, ty, 1, th);
  x.fillStyle = "#4b2d17";
  x.fillRect(tx - 1, H - 2, tw + 2, 2);

  if (kind === "dead") {
    x.fillStyle = "#6d4526";
    x.fillRect(tx - 4, ty - 6, 5, 2);
    x.fillRect(tx + tw - 1, ty - 10, 5, 2);
    x.fillRect(tx - 4, ty - 6, 2, 5);
    x.fillRect(tx + tw + 2, ty - 10, 2, 6);
    return outline(c, "#241a20");
  }

  if (kind === "pine") {
    const dark = "#1f5137";
    const base = "#2c7046";
    const light = "#3d8f56";
    for (let i = 0; i < 4; i++) {
      const w = 5 + i * 4;
      const yy = 6 + i * 6;
      x.fillStyle = i % 2 ? base : dark;
      for (let row = 0; row < 7; row++) {
        const ww = Math.round((w * (row + 2)) / 8);
        x.fillRect(Math.round(cx - ww), yy + row, ww * 2, 1);
      }
      x.fillStyle = light;
      x.fillRect(Math.round(cx - 1), yy, 2, 3);
    }
    return outline(c, "#16321f");
  }

  const snow = kind === "snow";
  const dark = snow ? "#2c5b4a" : "#2f6b35";
  const base = snow ? "#3d7a63" : "#44913f";
  const light = snow ? "#57997f" : "#63b551";
  const blobs: [number, number, number][] = [
    [cx, 13, 9],
    [cx - 7, 16, 6],
    [cx + 7, 16, 6],
    [cx - 4, 9, 6],
    [cx + 4, 9, 6],
  ];
  for (const [bx, by, br] of blobs) {
    pcirc(x, bx + (r() * 2 - 1), by + (r() * 2 - 1), br, dark);
  }
  for (const [bx, by, br] of blobs) {
    pcirc(x, bx, by - 1, br - 1, base);
  }
  pcirc(x, cx - 4, 10, 4, light);
  pcirc(x, cx + 5, 13, 2, light);
  if (snow) {
    pcirc(x, cx - 3, 7, 3, "#e8f1f6");
    pcirc(x, cx + 6, 11, 2, "#e8f1f6");
  }
  // little fruits
  if (r() > 0.6) {
    x.fillStyle = "#d8483f";
    for (let i = 0; i < 3; i++) {
      x.fillRect(Math.round(cx - 6 + r() * 12), Math.round(10 + r() * 10), 1, 1);
    }
  }
  return outline(c, "#1b3a20");
}

function makeRock(seed: number, ore: null | "iron" | "gold") {
  const W = 22;
  const H = 20;
  const { c, x } = mk(W, H);
  const r = mulberry32(seed * 104729 + 7);
  const cx = W / 2;
  pcirc(x, cx, 13, 7, "#5d6470");
  pcirc(x, cx - 5, 14, 4, "#5d6470");
  pcirc(x, cx + 5, 14, 4, "#5d6470");
  pcirc(x, cx, 11, 6, "#858d9b");
  pcirc(x, cx - 4, 12, 3, "#858d9b");
  pcirc(x, cx - 3, 9, 3, "#a7aebb");
  x.fillStyle = "#454b57";
  for (let i = 0; i < 5; i++) x.fillRect(Math.round(cx - 5 + r() * 10), Math.round(11 + r() * 5), 2, 1);
  if (ore) {
    x.fillStyle = ore === "iron" ? "#d98b4a" : "#f2d24a";
    for (let i = 0; i < 6; i++) {
      const px = Math.round(cx - 5 + r() * 10);
      const py = Math.round(8 + r() * 7);
      x.fillRect(px, py, 2, 2);
    }
  }
  return outline(c, "#23262e");
}

function makeBush(seed: number, berries: boolean) {
  const W = 18;
  const H = 16;
  const { c, x } = mk(W, H);
  const r = mulberry32(seed * 31 + 5);
  pcirc(x, 9, 10, 6, "#2c6b33");
  pcirc(x, 5, 11, 4, "#2c6b33");
  pcirc(x, 13, 11, 4, "#2c6b33");
  pcirc(x, 8, 9, 5, "#3d8c3f");
  pcirc(x, 6, 8, 3, "#54a74c");
  if (berries) {
    x.fillStyle = "#d2333f";
    for (let i = 0; i < 5; i++) {
      x.fillRect(Math.round(3 + r() * 12), Math.round(7 + r() * 6), 2, 2);
    }
    x.fillStyle = "#f0737a";
    x.fillRect(5, 8, 1, 1);
  }
  return outline(c, "#18351d");
}

function makeTuft(seed: number, col: string[]) {
  const W = 14;
  const H = 10;
  const { c, x } = mk(W, H);
  const r = mulberry32(seed * 17 + 3);
  for (let i = 0; i < 7; i++) {
    const bx = Math.round(2 + r() * 10);
    const hgt = 3 + Math.round(r() * 4);
    x.fillStyle = col[i % col.length];
    for (let k = 0; k < hgt; k++) x.fillRect(bx + (k > hgt - 2 ? 1 : 0), H - 1 - k, 1, 1);
  }
  return c;
}

function makeFlower(seed: number) {
  const c = makeTuft(seed, ["#4e8f47", "#3f7a3b"]);
  const x = c.getContext("2d")!;
  const r = mulberry32(seed * 91 + 11);
  const cols = ["#e5c04a", "#e0657f", "#9a7ad6", "#e8f1f6"];
  const col = cols[Math.floor(r() * cols.length)];
  x.fillStyle = col;
  const bx = 4 + Math.floor(r() * 5);
  x.fillRect(bx, 1, 2, 2);
  x.fillRect(bx - 1, 2, 4, 1);
  return c;
}

function makeCampfire(frame: number, lit: boolean) {
  const W = 18;
  const H = 18;
  const { c, x } = mk(W, H);
  // stones
  const stones: [number, number][] = [
    [3, 13],
    [8, 15],
    [14, 13],
    [2, 10],
    [15, 10],
  ];
  for (const [sx, sy] of stones) {
    pcirc(x, sx, sy, 2, "#7a808d");
    pcirc(x, sx, sy - 1, 1, "#a2a9b6");
  }
  // logs
  x.fillStyle = "#6b4426";
  x.fillRect(4, 11, 10, 2);
  x.fillRect(5, 13, 9, 2);
  x.fillStyle = "#4a2c16";
  x.fillRect(4, 12, 10, 1);
  if (lit) {
    const f = frame % 3;
    x.fillStyle = "#e8541f";
    x.fillRect(7, 6 - f, 4, 6);
    x.fillRect(6, 8, 6, 4);
    x.fillRect(5, 10, 8, 2);
    x.fillStyle = "#f59a1e";
    x.fillRect(8, 7 - f, 2, 5);
    x.fillRect(7, 9, 4, 3);
    x.fillStyle = "#ffe07a";
    x.fillRect(8, 9 + (f === 1 ? 1 : 0), 2, 2);
    x.fillStyle = "#e8541f";
    if (f === 2) x.fillRect(9, 2, 1, 2);
    if (f === 1) x.fillRect(7, 3, 1, 2);
  } else {
    x.fillStyle = "#3a3a42";
    x.fillRect(6, 10, 6, 2);
  }
  return c;
}

function makeWall() {
  const W = 16;
  const H = 20;
  const { c, x } = mk(W, H);
  x.fillStyle = "#8a5c30";
  x.fillRect(0, 2, W, H - 2);
  x.fillStyle = "#6b4426";
  for (let i = 0; i < W; i += 4) x.fillRect(i, 2, 1, H - 2);
  x.fillStyle = "#a9743f";
  for (let i = 1; i < W; i += 4) x.fillRect(i, 2, 1, H - 2);
  x.fillStyle = "#5b381c";
  x.fillRect(0, 6, W, 2);
  x.fillRect(0, 14, W, 2);
  x.fillStyle = "#c08a4a";
  x.fillRect(0, 2, W, 1);
  return outline(c, "#2b1c10");
}

function makeChest() {
  const rows = [
    "..111111111...",
    ".1LLLLLLLLL1..",
    ".1LlllllllL1..",
    ".1LLLLLLLLL1..",
    ".1kkkkkkkkk1..",
    ".1LllLyyLllL1.",
    ".1LllLyyLllL1.",
    ".1LLLLLLLLLL1.",
    "..1111111111..",
  ];
  return fromRows(rows, { "1": "#2b1c10", L: "#8a5c30", l: "#b07a44", k: "#5b381c", y: "#e8c65a" });
}

/* ------------------------------------------------ MONSTERS */

const SLIME_PAL: Record<string, string> = {
  g: "#5fc46a",
  d: "#36903f",
  w: "#cdf5cf",
  "0": "#1d2a1f",
};

const SLIME_A = [
  "................",
  "................",
  "................",
  "......gggg......",
  "....gggggggg....",
  "...gwgggggggg...",
  "...ggg0gggg0g...",
  "..gggggggggggg..",
  "..gggggggggggg..",
  ".gggggggggggggg.",
  ".gddddddddddddg.",
  "..dddddddddddd..",
  "...dddddddddd...",
  "................",
  "................",
  "................",
];

const SLIME_B = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "....gggggggg....",
  "..gwggggggggggg.",
  "..ggg0gggg0gggg.",
  ".gggggggggggggg.",
  ".gggggggggggggg.",
  "gddddddddddddddg",
  "gdddddddddddddd.",
  ".dddddddddddddd.",
  "..dddddddddddd..",
  "................",
  "................",
];

const BAT_PAL: Record<string, string> = {
  "1": "#1a1020",
  b: "#5b3b6b",
  d: "#3c2549",
  "0": "#ff5a5a",
  w: "#c9a7e0",
};

const BAT_A = [
  "..............",
  "1............1",
  "11..dddddd..11",
  "1b1dbbbbbbd1b1",
  ".1bbb0bb0bbb1.",
  "..1bbbwwbbb1..",
  "...1bdddddb1..",
  "....11dd11....",
  "..............",
];

const BAT_B = [
  "..............",
  "....dddddd....",
  "1..dbbbbbbd..1",
  "11bbb0bb0bbb11",
  "1b1bbbwwbbb1b1",
  ".1.1bdddddb1..",
  "......dd......",
  "..............",
  "..............",
];

const CHICKEN_PAL: Record<string, string> = {
  "1": "#2b2420",
  w: "#f6f2e8",
  W: "#d5cec0",
  r: "#d94b3a",
  y: "#f2b23a",
  "0": "#241a22",
};

const CHICKEN = [
  "............",
  ".....r......",
  "....1r1.....",
  "...1www1....",
  "...1w0w1y...",
  "...1wwww1...",
  "..1wwwwww1..",
  ".1wwwwwwww1.",
  ".1wWWwwwWw1.",
  "..1WWWWWW1..",
  "...1y11y1...",
  "....y..y....",
];

/* ------------------------------------------------ REGISTRY */

export const SP: Record<string, Px> = {};
export const ITEM_ICON: Record<string, Px> = {};
let ready = false;

export function initSprites() {
  if (ready) return;
  ready = true;

  // hero
  SP.heroDown0 = hero(HEAD_DOWN, BODY_A, HERO_PAL);
  SP.heroDown1 = hero(HEAD_DOWN, BODY_B, HERO_PAL);
  SP.heroUp0 = hero(HEAD_UP, BODY_A, HERO_PAL);
  SP.heroUp1 = hero(HEAD_UP, BODY_B, HERO_PAL);
  SP.heroRight0 = hero(HEAD_SIDE, BODY_SIDE_A, HERO_PAL);
  SP.heroRight1 = hero(HEAD_SIDE, BODY_SIDE_B, HERO_PAL);
  SP.heroLeft0 = flipH(SP.heroRight0);
  SP.heroLeft1 = flipH(SP.heroRight1);

  // zombie = recolored hero
  const zMap: Record<string, string> = {
    "#f7c99b": "#8fb96a",
    "#d79a6b": "#6a9350",
    "#7b4a22": "#3a3040",
    "#a1672f": "#4d4155",
    "#4e9d55": "#6b5a7a",
    "#2f6b3a": "#4a3d59",
    "#3f4f7a": "#3a3346",
    "#221a2b": "#ff4d4d",
    "#6b4227": "#33262c",
  };
  for (const dir of ["Down", "Up", "Right", "Left"]) {
    for (const f of [0, 1]) {
      SP[`zombie${dir}${f}`] = recolor(SP[`hero${dir}${f}`], zMap);
    }
  }
  // brute = bigger, darker zombie
  const bMap: Record<string, string> = {
    "#8fb96a": "#a0739b",
    "#6a9350": "#7d5578",
    "#6b5a7a": "#4a2f42",
    "#4a3d59": "#35202f",
  };
  for (const dir of ["Down", "Up", "Right", "Left"]) {
    for (const f of [0, 1]) {
      SP[`brute${dir}${f}`] = recolor(SP[`zombie${dir}${f}`], bMap);
    }
  }

  SP.slime0 = outline(fromRows(SLIME_A, SLIME_PAL), "#17301b");
  SP.slime1 = outline(fromRows(SLIME_B, SLIME_PAL), "#17301b");
  SP.bat0 = fromRows(BAT_A, BAT_PAL);
  SP.bat1 = fromRows(BAT_B, BAT_PAL);
  SP.chicken0 = fromRows(CHICKEN, CHICKEN_PAL);
  SP.chicken1 = flipH(SP.chicken0);

  // props (several variants each)
  for (let v = 0; v < 3; v++) {
    SP[`tree${v}`] = makeTree(v + 1, "oak");
    SP[`pine${v}`] = makeTree(v + 21, "pine");
    SP[`snowtree${v}`] = makeTree(v + 41, "snow");
    SP[`rock${v}`] = makeRock(v + 3, null);
    SP[`bush${v}`] = makeBush(v + 9, true);
    SP[`bushEmpty${v}`] = makeBush(v + 9, false);
    SP[`tuft${v}`] = makeTuft(v + 31, ["#4f9349", "#3f7a3b", "#67ab53"]);
    SP[`flower${v}`] = makeFlower(v + 51);
  }
  SP.dead0 = makeTree(5, "dead");
  SP.iron0 = makeRock(11, "iron");
  SP.gold0 = makeRock(12, "gold");
  SP.wall = makeWall();
  SP.chest = makeChest();
  for (let f = 0; f < 3; f++) SP[`fire${f}`] = makeCampfire(f, true);
  SP.fireOut = makeCampfire(0, false);

  // item icons
  for (const key in I) {
    ITEM_ICON[key] = fromRows((I as Record<string, string[]>)[key], ICON_PAL);
  }
  ITEM_ICON.campfire = scaleDown(SP.fire0, 12);
  ITEM_ICON.wall = scaleDown(SP.wall, 12);
}

function scaleDown(src: Px, size: number): Px {
  const { c, x } = mk(size, size);
  const s = Math.min(size / src.width, size / src.height);
  const w = Math.max(1, Math.round(src.width * s));
  const h = Math.max(1, Math.round(src.height * s));
  x.imageSmoothingEnabled = false;
  x.drawImage(src, Math.floor((size - w) / 2), Math.floor((size - h) / 2), w, h);
  return c;
}

const urlCache: Record<string, string> = {};
/** data-url of an item icon, upscaled, for use inside React <img> */
export function iconUrl(key: string, scale = 3): string {
  const ck = `${key}@${scale}`;
  if (urlCache[ck]) return urlCache[ck];
  initSprites();
  const src = ITEM_ICON[key] ?? ITEM_ICON.stone;
  if (!src) return "";
  const { c, x } = mk(src.width * scale, src.height * scale);
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, c.width, c.height);
  urlCache[ck] = c.toDataURL();
  return urlCache[ck];
}
