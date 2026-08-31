import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './modal';

/**
 * A dialog with a form inside, wired the way every real call site is: an inline
 * arrow for `onClose`, and state that changes on every keystroke.
 */
function DialogWithForm() {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState('');

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Tell us why">
      <label htmlFor="reason">Reason</label>
      <input id="reason" value={value} onChange={(event) => setValue(event.target.value)} />
    </Modal>
  );
}

describe('Modal', () => {
  it('lets a shopper type a whole sentence into a field inside it', async () => {
    // REGRESSION: the effect that focuses the panel depended on `onClose`,
    // which is a new function on every render at every call site. It therefore
    // re-ran after each keystroke and yanked focus back to the panel — so only
    // the first character ever landed, in this dialog and in the address form.
    render(<DialogWithForm />);

    const field = screen.getByLabelText('Reason');
    await userEvent.type(field, 'Ordered by mistake');

    expect(field).toHaveValue('Ordered by mistake');
  });

  it('moves focus into the panel when it opens', () => {
    render(
      <Modal open onClose={vi.fn()} title="Confirm">
        <p>Body</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();

    render(
      <Modal open onClose={onClose} title="Confirm">
        <p>Body</p>
      </Modal>,
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('locks background scrolling while open, and restores it on close', () => {
    const { rerender } = render(
      <Modal open onClose={vi.fn()} title="Confirm">
        <p>Body</p>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal open={false} onClose={vi.fn()} title="Confirm">
        <p>Body</p>
      </Modal>,
    );

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Confirm">
        <p>Body</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is announced as a modal dialog with its title', () => {
    render(
      <Modal open onClose={vi.fn()} title="Cancel this order?">
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Cancel this order?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
