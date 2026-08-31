import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { FulfillmentSelector } from './fulfillment-selector';
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card';

/**
 * Selects by `value` rather than by accessible name.
 *
 * Both options legitimately mention "delivery" — the pickup card's description
 * is "No delivery charge" — so a name match would be ambiguous. The value is
 * what the component actually reports back, which is the thing under test.
 */
function radioFor(value: string): HTMLInputElement {
  const radio = screen
    .getAllByRole('radio')
    .find((element) => (element as HTMLInputElement).value === value);

  if (!radio) throw new Error('No radio with value ' + value);
  return radio as HTMLInputElement;
}

describe('FulfillmentSelector', () => {
  it('offers delivery and pickup as real radio buttons', () => {
    // Not divs with click handlers: arrow-key navigation, the "1 of 2"
    // announcement and form semantics all depend on these being real radios.
    renderWithProviders(<FulfillmentSelector value="DELIVERY" onChange={vi.fn()} />);

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(radioFor('DELIVERY')).toBeInTheDocument();
    expect(radioFor('PICKUP')).toBeInTheDocument();
  });

  it('marks the current choice as checked', () => {
    renderWithProviders(<FulfillmentSelector value="PICKUP" onChange={vi.fn()} />);

    expect(radioFor('PICKUP')).toBeChecked();
    expect(radioFor('DELIVERY')).not.toBeChecked();
  });

  it('reports the new choice when one is picked', async () => {
    const onChange = vi.fn();
    renderWithProviders(<FulfillmentSelector value="DELIVERY" onChange={onChange} />);

    await userEvent.click(radioFor('PICKUP'));

    expect(onChange).toHaveBeenCalledWith('PICKUP');
  });

  it('explains each option in plain language, not jargon', () => {
    renderWithProviders(<FulfillmentSelector value="DELIVERY" onChange={vi.fn()} />);

    expect(screen.getByText(/we bring it to your address/i)).toBeInTheDocument();
    expect(screen.getByText(/collect it from the store yourself/i)).toBeInTheDocument();
    // "Fulfilment method" is a developer's word, not a shopper's.
    expect(screen.queryByText(/fulfilment method/i)).not.toBeInTheDocument();
  });

  it('groups the options under a question, for screen readers', () => {
    renderWithProviders(<FulfillmentSelector value="DELIVERY" onChange={vi.fn()} />);

    expect(
      screen.getByRole('group', { name: /how would you like to receive your order/i }),
    ).toBeInTheDocument();
  });
});

describe('RadioCardGroup', () => {
  it('moves between options with the arrow keys', async () => {
    const onChange = vi.fn();

    renderWithProviders(
      <RadioCardGroup label="Pick one" value="a" onChange={onChange}>
        <RadioCard value="a" title="First" />
        <RadioCard value="b" title="Second" />
      </RadioCardGroup>,
    );

    screen.getByRole('radio', { name: /first/i }).focus();
    await userEvent.keyboard('{ArrowDown}');

    // Native radio-group behaviour, which a div-with-onClick would have lost.
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not let a disabled option be chosen', async () => {
    const onChange = vi.fn();

    renderWithProviders(
      <RadioCardGroup label="Pick one" value="a" onChange={onChange}>
        <RadioCard value="a" title="First" />
        <RadioCard value="b" title="Second" disabled disabledReason="Needs a map location" />
      </RadioCardGroup>,
    );

    await userEvent.click(screen.getByRole('radio', { name: /second/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Needs a map location')).toBeInTheDocument();
  });

  it('surfaces a group-level error to assistive technology', () => {
    renderWithProviders(
      <RadioCardGroup label="Pick one" value={null} onChange={vi.fn()} error="Choose an option">
        <RadioCard value="a" title="First" />
      </RadioCardGroup>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Choose an option');
  });
});
