'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Mirrors the API's own allowlist. The server checks the bytes regardless. */
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

export interface ImagePickerProps {
  onSelect: (file: File) => void;
  /** Bytes. Checked here so an obviously oversized photo is refused instantly. */
  maxBytes: number;
  onReject: (message: string) => void;
  /**
   * Why the last choice was refused.
   *
   * Rendered on the screen rather than left to the toast alone: a toast is
   * gone in four seconds, and a shopper who looked away is left with a button
   * that appears to do nothing.
   */
  rejection?: string | null;
}

/**
 * The entry screen: "Turn your grocery list into a cart" (§3).
 *
 * Two ways in, because they are genuinely different actions on a phone.
 * `capture="environment"` opens the camera directly; the other opens the photo
 * library. Both are ordinary file inputs underneath, so keyboard users and
 * screen readers get the native control they already know.
 *
 * The wording is deliberately plain. Someone with limited digital literacy
 * should understand this screen without knowing what OCR is (§2, §79).
 */
export function ImagePicker({ onSelect, maxBytes, onReject, rejection }: ImagePickerProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;

    // A first, friendly check. The server repeats both of these on the bytes,
    // because everything here is under the shopper's control.
    if (!ACCEPTED_TYPES.split(',').includes(file.type)) {
      onReject('Please choose a photo — a JPG, PNG or WEBP image.');
      return;
    }

    if (file.size > maxBytes) {
      onReject(
        'That photo is larger than ' +
          Math.round(maxBytes / (1024 * 1024)) +
          ' MB. Try taking it again at a smaller size.',
      );
      return;
    }

    onSelect(file);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
    // Cleared so choosing the same file twice still fires a change event —
    // otherwise "retake, pick the same photo" silently does nothing.
    event.target.value = '';
  }

  return (
    <section aria-labelledby="scan-intro-heading" className="gap-loose flex flex-col">
      <header className="gap-snug flex flex-col text-center">
        <span
          className="bg-peach/50 text-attention ring-apricot/40 mx-auto flex size-16 items-center justify-center rounded-2xl ring-1"
          aria-hidden="true"
        >
          <ScanLine className="size-8" />
        </span>

        <h1 id="scan-intro-heading" className="text-display text-primary">
          Turn your grocery list into a basket
        </h1>

        <p className="text-text-muted mx-auto max-w-md text-base leading-relaxed">
          Take a photo of your list, or upload one. We will find each item in the shop and show you
          what we found before anything is added.
        </p>
      </header>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingOver(false);
          handleFile(event.dataTransfer.files?.[0]);
        }}
        className={
          'gap-gutter p-wide flex flex-col items-center rounded-2xl border-2 border-dashed transition-colors duration-200 ' +
          (isDraggingOver ? 'border-primary bg-primary/6' : 'border-sand bg-surface')
        }
      >
        {/*
          Two inputs rather than one: `capture` is what makes the button open
          the camera instead of the gallery, and a single input cannot do both.
          Hidden, but real — the visible buttons only forward a click.
        */}
        <input
          ref={cameraInput}
          type="file"
          accept={ACCEPTED_TYPES}
          capture="environment"
          onChange={onInputChange}
          className="sr-only"
          aria-label="Take a photo of your grocery list"
        />
        <input
          ref={libraryInput}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={onInputChange}
          className="sr-only"
          aria-label="Upload an image of your grocery list"
        />

        <Button
          size="lg"
          fullWidth
          onClick={() => cameraInput.current?.click()}
          leadingIcon={<Camera className="size-5" />}
        >
          Take Photo
        </Button>

        <Button
          size="lg"
          variant="outline"
          fullWidth
          onClick={() => libraryInput.current?.click()}
          leadingIcon={<ImagePlus className="size-5" />}
        >
          Upload Image
        </Button>

        <p className="text-text-muted text-center text-xs font-medium">
          Handwritten or printed, in English or Urdu. JPG, PNG or WEBP.
        </p>

        {rejection ? (
          <p
            role="alert"
            className="text-danger bg-danger/8 rounded-lg px-3 py-2 text-center text-sm font-medium"
          >
            {rejection}
          </p>
        ) : null}
      </div>
    </section>
  );
}
