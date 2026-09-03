import { cn } from '@/lib/cn';

/**
 * THE HERO VISUAL (§16)
 *
 * There is no product photography in this catalogue yet — a shopkeeper adds
 * photos as they go — so the storefront cannot open on a picture of real
 * groceries, and it must not open on stock imagery of somebody else's shop.
 * This is the alternative §16 asks for: one drawn focal point, art-directed
 * rather than assembled.
 *
 * It is a filled paper bag with the shopping showing above the rim. Flat
 * shapes, every fill a palette token, no gradients and no drop shadows — so it
 * sits on the cream hero as part of the same design rather than as a picture
 * pasted onto it, and it will not clash when real photography arrives beside it.
 *
 * The items are drawn BEFORE the bag, so the bag occludes them: that overlap is
 * what makes the drawing read as depth instead of as a row of icons.
 *
 * Entirely decorative. The hero's meaning is in its heading, and this carries
 * `aria-hidden`, so nothing is lost with images off or a screen reader on.
 */
export function HeroBasket({
  tone = 'light',
  className,
}: {
  /**
   * The backdrop disc only. `dark` is for the deep-green auth panel, where a
   * sand disc turns olive against the green; a low-opacity cream reads as a
   * pool of light instead.
   */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 420 360"
      fill="none"
      aria-hidden="true"
      className={cn('h-auto w-full max-w-md', className)}
    >
      {/* Backdrop disc: gives the composition an edge so it is a picture and
          not a floating object. */}
      <circle
        cx="210"
        cy="168"
        r="152"
        fill={tone === 'dark' ? 'var(--color-cream)' : 'var(--color-sand)'}
        opacity={tone === 'dark' ? 0.12 : 0.5}
      />

      {/* --- The shopping, drawn behind the bag ------------------------- */}

      {/* Bottle: the tallest thing, so it sets the composition's height. */}
      <rect x="292" y="92" width="16" height="26" rx="6" fill="var(--color-teal)" />
      <rect x="278" y="112" width="44" height="104" rx="16" fill="var(--color-teal)" />
      <rect
        x="284"
        y="140"
        width="32"
        height="30"
        rx="6"
        fill="var(--color-cream)"
        opacity="0.9"
      />

      {/* Loaf: a soft rounded form on the left, tilted so nothing is square on. */}
      <g transform="rotate(-12 132 178)">
        <rect x="88" y="150" width="92" height="62" rx="28" fill="var(--color-apricot)" />
        <path
          d="M108 166h52M104 182h60M110 198h48"
          stroke="var(--color-on-apricot)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.28"
        />
      </g>

      {/* Tomato — the one saturated shape in the picture. */}
      <circle cx="248" cy="186" r="32" fill="var(--color-tomato)" />
      <path
        d="M248 156c-6-8-16-11-25-9 2 8 9 14 18 15M248 156c6-8 16-11 25-9-2 8-9 14-18 15"
        fill="var(--color-leaf)"
      />

      {/* Citrus, tucked in to fill the gap on the right. */}
      <circle cx="288" cy="198" r="22" fill="var(--color-apricot)" />

      {/*
        Leafy greens LAST of the shopping, so they sit in front of the tomato
        and the citrus rather than behind them. Drawn behind them, the freshness
        cue — the whole point of the picture — disappeared entirely.
      */}
      <path
        d="M186 212c-26-8-42-32-39-62 29 4 46 27 46 62Z"
        fill="var(--color-leaf)"
      />
      <path
        d="M194 212c1-36 22-62 56-66 1 36-21 61-56 66Z"
        fill="var(--color-herbal)"
      />
      <path
        d="M190 214v-62"
        stroke="var(--color-primary)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* --- The bag ---------------------------------------------------- */}
      <path
        d="M100 196h220a10 10 0 0 1 9.94 11.24l-13.3 108A22 22 0 0 1 294.8 334H125.2a22 22 0 0 1-21.84-18.76l-13.3-108A10 10 0 0 1 100 196Z"
        fill="var(--color-cream)"
      />
      {/* The crease across the top of a folded paper bag. */}
      <path
        d="M94 220h232"
        stroke="var(--color-sand)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Side crease: one line, and the bag reads as three-dimensional. */}
      <path
        d="M266 222l-10 112"
        stroke="var(--color-sand)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* The shop's stamp on the bag — the mark from the logo, at bag scale. */}
      <circle cx="176" cy="278" r="30" fill="var(--color-primary)" />
      <path
        d="M170 272c.04-2.1 1.44-3.78 3.7-4.12.23 2.44-1.26 4.04-3.7 4.12Z"
        fill="var(--color-cream)"
      />
      <path
        d="M176.6 288.5h-1.2a5.4 5.4 0 0 1-5.36-4.6l-1.3-8.6a1.2 1.2 0 0 1 1.19-1.38h13.34a1.2 1.2 0 0 1 1.19 1.38l-1.3 8.6a5.4 5.4 0 0 1-5.36 4.6Z"
        fill="var(--color-cream)"
      />
      <path
        d="M180.4 272.6c1.6-3 4.4-4.6 8-4.4-.2 3.4-3 5.4-8 4.4Z"
        fill="var(--color-apricot)"
      />
      <path
        d="M176 274v-4"
        stroke="var(--color-cream)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* The shelf the bag stands on. Not a shadow — a line, like a price rail. */}
      <path
        d="M64 336h292"
        stroke="var(--color-sand)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity={tone === 'dark' ? 0.4 : 1}
      />
    </svg>
  );
}
