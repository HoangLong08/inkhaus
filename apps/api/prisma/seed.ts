/**
 * Seeds PostgreSQL from the data the storefront used to hard-code.
 * `packages/shared` stays the source of truth for the demo catalog, so re-running
 * this after editing a price there brings the database back in line.
 *
 *   npm run db:seed -w @inkhaus/api
 */
// first, and before @prisma/client: DATABASE_URL comes from the repo-root .env
import '../src/load-env';

import { AdminRole, PrismaClient, Prisma } from '@prisma/client';
import {
  ALL_SIZE_CODES,
  CLIPART,
  COLORS,
  FONTS,
  INK_COLORS,
  PRODUCTS,
  SIZE_LABEL,
  SIZE_UPCHARGE,
  TIERS,
} from '@inkhaus/shared';

import {
  LABEL_TO_METHOD,
  SLUG_TO_GARMENT_TYPE,
} from '../src/modules/catalog/catalog.mapper';

const prisma = new PrismaClient();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** hex -> colour slug, so a product's colour array can be looked up by value */
const COLOR_SLUG_BY_HEX = new Map(
  Object.entries(COLORS).map(([slug, c]) => [c.hex.toLowerCase(), slug]),
);

const INK_NAMES: Record<string, string> = {
  '#F7F5F0': 'Paper white',
  '#151517': 'Jet black',
  '#D8FF3E': 'Acid',
  '#FF4A1C': 'Flame',
  '#6EA8FF': 'Sky',
  '#22392C': 'Forest',
  '#1D2A44': 'Navy',
  '#5A1F26': 'Maroon',
  '#F2DC94': 'Butter',
  '#C9B79A': 'Sand',
  '#E23B7B': 'Magenta',
  '#8B5CF6': 'Violet',
};

const REVIEWS = [
  { body: 'Uploaded our logo at 9pm, had a proof by 11pm, 60 hoodies landed Thursday.', author: 'Marcus D.', handle: 'Ridgeline FC, Denver', productSlug: 'heavy-hoodie' },
  { body: 'The design tool is the only one my mom could use without calling me.', author: 'Priya S.', handle: 'Family reunion, Houston', productSlug: 'classic-tee' },
  { body: 'Cheaper than Custom Ink at 24 pieces and the print is thicker.', author: 'Jordan L.', handle: 'Coffee shop, Portland', productSlug: 'heavyweight-tee' },
  { body: 'Reprinted 8 shirts free when our sizing chart was wrong. No arguing.', author: 'Elena V.', handle: 'Nonprofit, Miami', productSlug: 'classic-tee' },
  { body: 'Sleeve print included free sold me instantly.', author: 'Tyler K.', handle: 'Skate brand, Phoenix', productSlug: 'long-sleeve' },
  { body: 'Ordered one shirt for a gag gift. Same quality as our team order.', author: 'Sam R.', handle: 'Brooklyn', productSlug: null },
];

async function seedColors() {
  const entries = Object.entries(COLORS);
  for (const [slug, c] of entries) {
    await prisma.color.upsert({
      where: { slug },
      update: { name: c.name, hex: c.hex, dark: c.dark ?? false, sortOrder: entries.findIndex(([s]) => s === slug) },
      create: {
        slug,
        name: c.name,
        hex: c.hex,
        dark: c.dark ?? false,
        sortOrder: entries.findIndex(([s]) => s === slug),
      },
    });
  }
  return entries.length;
}

async function seedSizes() {
  // ALL_SIZE_CODES, not SIZES: `PricingService` builds its upcharge map from this
  // table and `OrdersService` rejects any line whose size is missing from it, so
  // a one-size blank that never gets an "OS" row here 400s at checkout.
  for (const [i, code] of ALL_SIZE_CODES.entries()) {
    await prisma.size.upsert({
      where: { code },
      update: {
        label: SIZE_LABEL[code] ?? code,
        upcharge: new Prisma.Decimal(SIZE_UPCHARGE[code] ?? 0),
        sortOrder: i,
      },
      create: {
        code,
        label: SIZE_LABEL[code] ?? code,
        upcharge: new Prisma.Decimal(SIZE_UPCHARGE[code] ?? 0),
        sortOrder: i,
      },
    });
  }
  return ALL_SIZE_CODES.length;
}

async function seedTiers() {
  for (const t of TIERS) {
    await prisma.priceTier.upsert({
      where: { minQty: t.min },
      update: { discount: new Prisma.Decimal(t.off) },
      create: { minQty: t.min, discount: new Prisma.Decimal(t.off) },
    });
  }
  return TIERS.length;
}

async function seedProducts() {
  for (const [i, p] of PRODUCTS.entries()) {
    const data = {
      name: p.name,
      type: SLUG_TO_GARMENT_TYPE[p.type],
      category: p.category,
      blurb: p.blurb,
      fabric: p.fabric,
      tag: p.tag ?? null,
      sizes: p.sizes ? [...p.sizes] : [],
      price: new Prisma.Decimal(p.price),
      bulkPrice: new Prisma.Decimal(p.bulkPrice),
      methods: p.method.map((m) => {
        const enumValue = LABEL_TO_METHOD[m];
        if (!enumValue) throw new Error(`Unmapped print method "${m}" on ${p.slug}`);
        return enumValue;
      }),
      printAreaX: p.printArea.x,
      printAreaY: p.printArea.y,
      printAreaW: p.printArea.w,
      printAreaH: p.printArea.h,
      printInchesW: new Prisma.Decimal(p.printInches.w),
      printInchesH: new Prisma.Decimal(p.printInches.h),
      active: true,
      sortOrder: i,
    };

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: { slug: p.slug, ...data },
    });

    // colour list is authoritative - drop links that are no longer stocked
    await prisma.productColor.deleteMany({ where: { productId: product.id } });
    for (const [order, c] of p.colors.entries()) {
      const slug = COLOR_SLUG_BY_HEX.get(c.hex.toLowerCase());
      if (!slug) throw new Error(`Colour ${c.hex} on ${p.slug} is not in COLORS`);
      const color = await prisma.color.findUniqueOrThrow({ where: { slug } });
      await prisma.productColor.create({
        data: { productId: product.id, colorId: color.id, sortOrder: order },
      });
    }

    // same shape as the colour rebuild: product-images.ts is generated from what
    // is on disk, so a photo deleted there has to disappear from the table too
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    for (const [order, img] of (p.images ?? []).entries()) {
      const color = img.color
        ? await prisma.color.findUnique({ where: { slug: img.color } })
        : null;
      await prisma.productImage.create({
        data: {
          productId: product.id,
          src: img.src,
          src2x: img.src2x ?? null,
          alt: img.alt,
          width: img.w,
          height: img.h,
          colorId: color?.id ?? null,
          sortOrder: order,
        },
      });
    }
  }
  return PRODUCTS.length;
}

async function seedStudioAssets() {
  for (const [i, clip] of CLIPART.entries()) {
    const slug = slugify(clip.name);
    const data = {
      name: clip.name,
      tags: clip.tags.split(/\s+/).filter(Boolean),
      svg: clip.svg,
      sortOrder: i,
      active: true,
    };
    await prisma.clipart.upsert({ where: { slug }, update: data, create: { slug, ...data } });
  }

  for (const [i, f] of FONTS.entries()) {
    await prisma.font.upsert({
      where: { label: f.label },
      update: { css: f.css, sortOrder: i },
      create: { label: f.label, css: f.css, sortOrder: i },
    });
  }

  for (const [i, hex] of INK_COLORS.entries()) {
    await prisma.inkColor.upsert({
      where: { hex },
      update: { name: INK_NAMES[hex] ?? hex, sortOrder: i },
      create: { hex, name: INK_NAMES[hex] ?? hex, sortOrder: i },
    });
  }

  return { clipart: CLIPART.length, fonts: FONTS.length, inks: INK_COLORS.length };
}

async function seedReviews() {
  // reviews carry no natural key, so only seed them into an empty table
  if ((await prisma.review.count()) > 0) return 0;

  for (const r of REVIEWS) {
    const product = r.productSlug
      ? await prisma.product.findUnique({ where: { slug: r.productSlug } })
      : null;
    await prisma.review.create({
      data: {
        author: r.author,
        handle: r.handle,
        rating: 5,
        body: r.body,
        productId: product?.id,
        published: true,
      },
    });
  }
  return REVIEWS.length;
}

/**
 * The staff allowlist. There is no password to seed - sign-in is Google-only,
 * and this table is what decides whether a Google identity is let in at all.
 * A row here is necessary but not sufficient: the person still has to prove the
 * address to Google.
 *
 * Upsert rather than skip-if-present, so adding an address to
 * ADMIN_BOOTSTRAP_EMAILS and re-seeding actually grants access, and so an
 * account demoted by hand is restored to OWNER on the next run.
 */
async function seedAdmins() {
  const emails = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!emails.length) return 'skipped (no ADMIN_BOOTSTRAP_EMAILS set)';

  for (const email of emails) {
    await prisma.adminUser.upsert({
      where: { email },
      // `name` and `googleSub` are left alone: Google fills them in on first
      // sign-in and re-seeding must not unbind an account
      update: { role: AdminRole.OWNER, isActive: true },
      create: { email, role: AdminRole.OWNER },
    });
  }
  return `${emails.length} owner(s): ${emails.join(', ')}`;
}

async function main() {
  console.log('Seeding INKHAUS...');
  const colors = await seedColors();
  const sizes = await seedSizes();
  const tiers = await seedTiers();
  const products = await seedProducts();
  const assets = await seedStudioAssets();
  const reviews = await seedReviews();
  const admin = await seedAdmins();

  console.log(
    [
      `  colors    ${colors}`,
      `  sizes     ${sizes}`,
      `  tiers     ${tiers}`,
      `  products  ${products}`,
      `  clipart   ${assets.clipart}`,
      `  fonts     ${assets.fonts}`,
      `  inks      ${assets.inks}`,
      `  reviews   ${reviews}`,
      `  admin     ${admin}`,
    ].join('\n'),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
