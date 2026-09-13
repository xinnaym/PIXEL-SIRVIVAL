export type ItemId =
  | "wood"
  | "stone"
  | "iron"
  | "fiber"
  | "berry"
  | "meat"
  | "cookedMeat"
  | "leather"
  | "bone"
  | "axe"
  | "pickaxe"
  | "sword"
  | "torch"
  | "bandage"
  | "campfire"
  | "wall";

export type ItemKind = "material" | "tool" | "food" | "place" | "use";

export interface ItemDef {
  id: ItemId;
  name: string;
  kind: ItemKind;
  stack: number;
  desc: string;
  /** melee damage against creatures */
  damage?: number;
  /** chop power vs wood / mine power vs stone */
  chop?: number;
  mine?: number;
  food?: number;
  heal?: number;
  light?: number;
  tier?: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { id: "wood", name: "Древесина", kind: "material", stack: 99, desc: "Основа всего. Растёт на деревьях." },
  stone: { id: "stone", name: "Камень", kind: "material", stack: 99, desc: "Твёрдый серый друг." },
  iron: { id: "iron", name: "Железо", kind: "material", stack: 99, desc: "Руда из горных пород." },
  fiber: { id: "fiber", name: "Волокно", kind: "material", stack: 99, desc: "Сорвано с кустов и травы." },
  berry: { id: "berry", name: "Ягоды", kind: "food", stack: 99, food: 12, heal: 2, desc: "Съедобно. Немного утоляет голод." },
  meat: { id: "meat", name: "Сырое мясо", kind: "food", stack: 99, food: 14, heal: -6, desc: "Лучше пожарить на костре." },
  cookedMeat: {
    id: "cookedMeat",
    name: "Жареное мясо",
    kind: "food",
    stack: 99,
    food: 42,
    heal: 10,
    desc: "Горячее, сытное, спасает жизнь.",
  },
  leather: { id: "leather", name: "Шкура", kind: "material", stack: 99, desc: "Тёплый материал." },
  bone: { id: "bone", name: "Кость", kind: "material", stack: 99, desc: "Трофей ночной охоты." },
  axe: { id: "axe", name: "Топор", kind: "tool", stack: 1, damage: 14, chop: 36, mine: 6, tier: 1, desc: "Рубит деревья втрое быстрее." },
  pickaxe: {
    id: "pickaxe",
    name: "Кирка",
    kind: "tool",
    stack: 1,
    damage: 12,
    chop: 6,
    mine: 40,
    tier: 1,
    desc: "Дробит камень и руду.",
  },
  sword: { id: "sword", name: "Меч", kind: "tool", stack: 1, damage: 32, chop: 10, mine: 4, tier: 2, desc: "Главный аргумент ночью." },
  torch: { id: "torch", name: "Факел", kind: "tool", stack: 1, damage: 8, light: 88, desc: "Освещает путь во тьме." },
  bandage: { id: "bandage", name: "Бинт", kind: "use", stack: 10, heal: 35, desc: "Восстанавливает здоровье." },
  campfire: { id: "campfire", name: "Костёр", kind: "place", stack: 10, desc: "Свет, тепло и жарка мяса." },
  wall: { id: "wall", name: "Частокол", kind: "place", stack: 50, desc: "Деревянная стена против монстров." },
};

export interface Recipe {
  out: ItemId;
  count: number;
  cost: Partial<Record<ItemId, number>>;
  needFire?: boolean;
}

export const RECIPES: Recipe[] = [
  { out: "axe", count: 1, cost: { wood: 4, fiber: 2 } },
  { out: "pickaxe", count: 1, cost: { wood: 4, stone: 3 } },
  { out: "sword", count: 1, cost: { wood: 3, stone: 4, fiber: 2 } },
  { out: "torch", count: 1, cost: { wood: 2, fiber: 1 } },
  { out: "campfire", count: 1, cost: { wood: 6, stone: 4 } },
  { out: "wall", count: 2, cost: { wood: 5 } },
  { out: "bandage", count: 1, cost: { fiber: 4, leather: 1 } },
  { out: "cookedMeat", count: 1, cost: { meat: 1 }, needFire: true },
];

/* ------------------------------------------------------- MOBS */

export type MobKind = "slime" | "zombie" | "bat" | "brute" | "chicken";

export interface MobDef {
  kind: MobKind;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  scale: number;
  passive?: boolean;
  nightOnly?: boolean;
  minNight?: number;
  loot: { id: ItemId; chance: number; min: number; max: number }[];
}

export const MOBS: Record<MobKind, MobDef> = {
  chicken: {
    kind: "chicken",
    name: "Курица",
    hp: 18,
    speed: 26,
    damage: 0,
    radius: 5,
    scale: 1,
    passive: true,
    loot: [
      { id: "meat", chance: 1, min: 1, max: 2 },
      { id: "fiber", chance: 0.6, min: 1, max: 1 },
    ],
  },
  slime: {
    kind: "slime",
    name: "Слизень",
    hp: 34,
    speed: 22,
    damage: 7,
    radius: 6,
    scale: 1,
    loot: [
      { id: "fiber", chance: 0.8, min: 1, max: 2 },
      { id: "berry", chance: 0.35, min: 1, max: 2 },
    ],
  },
  bat: {
    kind: "bat",
    name: "Летучая мышь",
    hp: 22,
    speed: 52,
    damage: 6,
    radius: 5,
    scale: 1,
    nightOnly: true,
    loot: [
      { id: "bone", chance: 0.6, min: 1, max: 1 },
      { id: "leather", chance: 0.3, min: 1, max: 1 },
    ],
  },
  zombie: {
    kind: "zombie",
    name: "Упырь",
    hp: 58,
    speed: 30,
    damage: 12,
    radius: 6,
    scale: 1,
    nightOnly: true,
    loot: [
      { id: "bone", chance: 0.7, min: 1, max: 2 },
      { id: "leather", chance: 0.5, min: 1, max: 1 },
      { id: "iron", chance: 0.15, min: 1, max: 1 },
    ],
  },
  brute: {
    kind: "brute",
    name: "Громила",
    hp: 140,
    speed: 26,
    damage: 22,
    radius: 8,
    scale: 1.45,
    nightOnly: true,
    minNight: 3,
    loot: [
      { id: "iron", chance: 0.9, min: 1, max: 3 },
      { id: "leather", chance: 0.8, min: 1, max: 2 },
      { id: "bone", chance: 1, min: 1, max: 2 },
    ],
  },
};
