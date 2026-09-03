'use client';

import { Camera, Check, ScanLine, ShoppingBasket, Sparkle } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { ButtonLink } from '@/components/ui/button-link';
import { useScanAvailability } from '@/features/scan/scan.hooks';
import { cn } from '@/lib/cn';

/**
 * What the scanner does, in the shopper's words.
 *
 * No implementation detail anywhere in this section (§77): no OCR, no model
 * names, no service names. "We read it" is what happens as far as anyone
 * outside this repository is concerned.
 */
const STEPS = [
  { icon: Camera, label: 'Photograph your list', detail: 'Handwritten or printed. English or Urdu.' },
  { icon: ScanLine, label: 'We read it', detail: 'Line by line, the way you wrote it.' },
  { icon: Sparkle, label: 'We find the products', detail: 'Matched against what the shop has today.' },
  { icon: ShoppingBasket, label: 'You check and confirm', detail: 'Nothing is added without your say.' },
];

/**
 * THE GROCERY-LIST FEATURE, AS A FEATURE (§31)
 *
 * This is the thing FreshCarts does that a shopping app normally does not, and
 * it used to be a button. Here it gets a band of its own, in the warm peach
 * zone that is reserved for something being offered rather than sold — so it
 * reads as part of the shop's service, not as another shelf.
 *
 * It removes itself entirely when the service is unavailable. Inviting someone
 * to photograph their handwriting and only then telling them we cannot read it
 * is worse than never offering (§30, §71) — and while the availability probe is
 * in flight nothing is rendered either, so the section never appears and then
 * vanishes under a thumb.
 */
export function ScanFeature() {
  const { data } = useScanAvailability();

  if (!data?.available) return null;

  return (
    <section
      className="bg-peach/35 relative overflow-hidden py-wide md:py-section"
      aria-labelledby="scan-feature-heading"
    >
      <Container>
        <div className="items-center gap-8 lg:grid lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-4">
            <p className="text-eyebrow text-attention uppercase">The list scanner</p>

            <h2 id="scan-feature-heading" className="text-display text-primary max-w-md">
              Have a grocery list? Take a photo of it.
            </h2>

            <p className="text-text-muted max-w-md text-base leading-relaxed">
              Send us the list on the back of your envelope and we will find every item in the shop
              and put it in your basket. You check it before anything is ordered.
            </p>

            <ol className="gap-snug mt-1 grid sm:grid-cols-2">
              {STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <li key={step.label} className="gap-snug flex items-start">
                    <span
                      aria-hidden="true"
                      className="bg-surface/80 text-attention ring-apricot/40 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1"
                    >
                      <Icon className="size-4.5" />
                    </span>

                    <span className="flex min-w-0 flex-col">
                      <span className="text-text text-sm font-bold">
                        <span className="text-attention tabular-nums">{index + 1}. </span>
                        {step.label}
                      </span>
                      <span className="text-text-muted text-xs leading-snug">{step.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="mt-2">
              <ButtonLink
                href="/scan"
                size="lg"
                leadingIcon={<Camera className="size-5" aria-hidden="true" />}
              >
                Scan your list
              </ButtonLink>
            </div>
          </div>

          <div className="mt-10 flex justify-center lg:mt-0">
            <ScanIllustration />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The example list. Not catalogue data — a depiction of the shopper's own note. */
const EXAMPLE_LINES = [
  { text: 'atta 10kg', found: true },
  { text: 'doodh 2', found: true },
  { text: 'cheeni 1kg', found: true },
  { text: 'anday darzan', found: false },
  { text: 'sabzi — pyaz, tamatar', found: false },
];

/**
 * A paper list with a reading line travelling down it (§32).
 *
 * The animation communicates the one thing a still picture cannot: that
 * something goes down the page and recognises the lines as it passes. So the
 * ticks are staggered to land as the line reaches them, and the whole thing
 * runs on ONE looping keyframe rather than a timeline of five — which keeps it
 * to a couple of composited layers and off the main thread entirely.
 *
 * `prefers-reduced-motion` stops it dead, at which point the illustration is
 * simply a list with ticks on it: still the right idea, minus the movement.
 */
function ScanIllustration() {
  return (
    <div className="relative w-full max-w-sm">
      {/* A second sheet behind, very slightly rotated: a stack of paper rather
          than a floating card. */}
      <div
        aria-hidden="true"
        className="bg-surface/60 ring-sand absolute inset-0 -rotate-3 rounded-2xl ring-1"
      />

      <div
        aria-hidden="true"
        className="bg-surface shadow-raised ring-sand relative overflow-hidden rounded-2xl p-5 ring-1"
      >
        <div className="border-outline-variant mb-4 flex items-center justify-between border-b pb-3">
          <span className="text-text text-sm font-extrabold tracking-[-0.01em]">
            Grocery list
          </span>
          <span className="bg-leaf/12 text-success rounded-full px-2 py-0.5 text-[0.625rem] font-bold">
            Reading…
          </span>
        </div>

        <ul className="flex flex-col gap-3">
          {EXAMPLE_LINES.map((line) => (
            <li key={line.text} className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full',
                  line.found ? 'bg-leaf text-cream' : 'ring-outline-variant ring-2',
                )}
              >
                {line.found ? <Check className="size-3" strokeWidth={3.5} /> : null}
              </span>

              <span
                className={cn(
                  'text-sm',
                  line.found ? 'text-text font-semibold' : 'text-text-muted',
                )}
              >
                {line.text}
              </span>
            </li>
          ))}
        </ul>

        {/* The reading line. A soft leaf-green band with a bright edge, so it
            reads as light passing over paper rather than as a border. */}
        <span
          className="animate-sweep pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--color-leaf) 16%, transparent))',
            borderBottom: '2px solid var(--color-leaf)',
          }}
        />
      </div>

      {/* The outcome, as a small card clipped to the corner: the list becomes a
          basket, which is the whole promise of the feature. */}
      <div
        aria-hidden="true"
        className="bg-primary text-cream shadow-raised absolute -end-2 -bottom-4 flex items-center gap-2 rounded-xl px-3 py-2 sm:-end-6"
      >
        <ShoppingBasket className="size-4 shrink-0" />
        <span className="text-xs font-bold">Added to your basket</span>
      </div>
    </div>
  );
}
