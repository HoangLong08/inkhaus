export type GarmentType = "tee" | "hoodie" | "longsleeve" | "tank" | "cap" | "tote" | "crewneck";

export type Colorway = { name: string; hex: string; dark?: boolean };

export type Product = {
  slug: string;
  name: string;
  type: GarmentType;
  blurb: string;
  fabric: string;
  price: number;      // 1 unit
  bulkPrice: number;  // 50+ units
  method: string[];
  colors: Colorway[];
  tag?: string;
  /** print area in garment-svg viewBox units */
  printArea: { x: number; y: number; w: number; h: number };
  /** real world size of that print area, inches */
  printInches: { w: number; h: number };
};

export const COLORS = {
  white: { name: "White", hex: "#F7F5F0" },
  black: { name: "Black", hex: "#151517", dark: true },
  bone: { name: "Bone", hex: "#E4DDCB" },
  sand: { name: "Sand", hex: "#C9B79A" },
  forest: { name: "Forest", hex: "#22392C", dark: true },
  navy: { name: "Navy", hex: "#1D2A44", dark: true },
  maroon: { name: "Maroon", hex: "#5A1F26", dark: true },
  acid: { name: "Acid", hex: "#D8FF3E" },
  flame: { name: "Flame", hex: "#FF4A1C", dark: true },
  slate: { name: "Slate", hex: "#6C737B", dark: true },
  butter: { name: "Butter", hex: "#F2DC94" },
  sky: { name: "Sky", hex: "#A9C9F0" },
} satisfies Record<string, Colorway> as Record<string, Colorway>;

const C = COLORS;

export const PRODUCTS: Product[] = [
  {
    slug: "heavyweight-tee",
    name: "Heavyweight Tee",
    type: "tee",
    blurb: "7.1 oz ringspun cotton with a boxy drop-shoulder cut. The one everybody reorders.",
    fabric: "100% ringspun cotton · 7.1 oz",
    price: 24,
    bulkPrice: 11.4,
    method: ["DTG", "Screen print", "Puff"],
    colors: [C.white, C.black, C.bone, C.sand, C.forest, C.navy, C.maroon, C.butter],
    tag: "Best seller",
    printArea: { x: 204, y: 242, w: 192, h: 256 },
    printInches: { w: 12, h: 16 },
  },
  {
    slug: "classic-tee",
    name: "Classic Tee",
    type: "tee",
    blurb: "4.2 oz softstyle. Light, cheap, perfect for events and giveaways at volume.",
    fabric: "Ringspun cotton · 4.2 oz",
    price: 17,
    bulkPrice: 6.9,
    method: ["DTG", "Screen print"],
    colors: [C.white, C.black, C.sky, C.acid, C.flame, C.slate, C.maroon],
    tag: "Cheapest bulk",
    printArea: { x: 204, y: 242, w: 192, h: 256 },
    printInches: { w: 12, h: 16 },
  },
  {
    slug: "heavy-hoodie",
    name: "Heavy Fleece Hoodie",
    type: "hoodie",
    blurb: "Brushed 400 gsm fleece, double-lined hood, no side seams. Built for embroidery.",
    fabric: "Cotton/poly fleece · 400 gsm",
    price: 52,
    bulkPrice: 28.5,
    method: ["DTG", "Screen print", "Embroidery", "Puff"],
    colors: [C.black, C.bone, C.forest, C.navy, C.slate, C.maroon],
    tag: "Premium",
    printArea: { x: 212, y: 282, w: 176, h: 176 },
    printInches: { w: 11, h: 11 },
  },
  {
    slug: "crewneck",
    name: "Boxy Crewneck",
    type: "crewneck",
    blurb: "Vintage-washed loopback terry with a cropped body and ribbed cuffs.",
    fabric: "Loopback terry · 380 gsm",
    price: 46,
    bulkPrice: 25,
    method: ["DTG", "Screen print", "Embroidery"],
    colors: [C.bone, C.black, C.sand, C.navy, C.forest],
    printArea: { x: 204, y: 240, w: 192, h: 208 },
    printInches: { w: 12, h: 13 },
  },
  {
    slug: "long-sleeve",
    name: "Long Sleeve Tee",
    type: "longsleeve",
    blurb: "Sleeve prints included free — the classic skate-shop layout.",
    fabric: "Ringspun cotton · 6 oz",
    price: 29,
    bulkPrice: 15.2,
    method: ["DTG", "Screen print"],
    colors: [C.white, C.black, C.bone, C.navy, C.maroon],
    tag: "Free sleeve print",
    printArea: { x: 204, y: 242, w: 192, h: 256 },
    printInches: { w: 12, h: 16 },
  },
  {
    slug: "tank",
    name: "Muscle Tank",
    type: "tank",
    blurb: "Raw-edge armholes, gym-ready. Great for bachelorette and race merch.",
    fabric: "Combed cotton · 5.3 oz",
    price: 21,
    bulkPrice: 10.4,
    method: ["DTG", "Screen print"],
    colors: [C.white, C.black, C.acid, C.flame, C.sky],
    printArea: { x: 216, y: 272, w: 168, h: 235 },
    printInches: { w: 10, h: 14 },
  },
  {
    slug: "dad-cap",
    name: "Unstructured Dad Cap",
    type: "cap",
    blurb: "Low-profile 6-panel with a brass slider. Embroidery only — 12 thread colors.",
    fabric: "Washed chino twill",
    price: 27,
    bulkPrice: 14.8,
    method: ["Embroidery", "Leather patch"],
    colors: [C.black, C.bone, C.forest, C.navy, C.flame],
    tag: "Embroidery",
    printArea: { x: 222, y: 254, w: 156, h: 86 },
    printInches: { w: 4.5, h: 2.5 },
  },
  {
    slug: "canvas-tote",
    name: "Canvas Tote",
    type: "tote",
    blurb: "16 oz natural canvas, boxed bottom, 24\" webbed handles.",
    fabric: "Natural canvas · 16 oz",
    price: 22,
    bulkPrice: 11.9,
    method: ["Screen print", "DTG"],
    colors: [C.bone, C.black, C.sand],
    printArea: { x: 206, y: 320, w: 188, h: 222 },
    printInches: { w: 11, h: 13 },
  },
];

export const getProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
