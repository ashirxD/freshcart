import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, signIn } from '@/test/render';
import { testAdmin } from '@/test/admin-fixtures';
import { CategoryCombobox, type CategorySelection } from '@/components/admin/category-combobox';
import { resolveImageUrl } from '@/lib/image';

const CATEGORIES = [
  { id: 'cat-bakery', name: 'Bakery' },
  { id: 'cat-dairy', name: 'Dairy & Eggs' },
];

beforeEach(() => {
  signIn(testAdmin);
});

/**
 * THE CATEGORY COMBOBOX
 *
 * The behaviour that matters is the guard rail: an unmatched name must never
 * become a category implicitly, because a typo would then appear to shoppers
 * beside the correctly-spelled one and quietly scatter products across both.
 */
describe('CategoryCombobox', () => {
  function Harness({ onPick }: { onPick?: (value: CategorySelection) => void }) {
    return (
      <CategoryCombobox
        label="Category"
        options={CATEGORIES}
        value={{ id: '' }}
        onChange={(next) => onPick?.(next)}
      />
    );
  }

  it('lists the existing categories when opened', async () => {
    renderWithProviders(<Harness />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));

    expect(screen.getByRole('option', { name: /Bakery/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Dairy & Eggs/ })).toBeInTheDocument();
  });

  it('selects an existing category by id', async () => {
    const onPick = vi.fn();
    renderWithProviders(<Harness onPick={onPick} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    await userEvent.click(screen.getByRole('option', { name: /Bakery/ }));

    expect(onPick).toHaveBeenCalledWith({ id: 'cat-bakery' });
  });

  it('matches case-insensitively, so an existing category is never duplicated', async () => {
    renderWithProviders(<Harness />);

    const input = screen.getByRole('combobox', { name: 'Category' });
    await userEvent.click(input);
    await userEvent.type(input, 'bakery');

    // The existing one is offered...
    expect(screen.getByRole('option', { name: /Bakery/ })).toBeInTheDocument();
    // ...and creating a second "bakery" is not.
    expect(screen.queryByRole('option', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('offers creation only as an explicit choice for an unmatched name', async () => {
    const onPick = vi.fn();
    renderWithProviders(<Harness onPick={onPick} />);

    const input = screen.getByRole('combobox', { name: 'Category' });
    await userEvent.click(input);
    await userEvent.type(input, 'Frozen Foods');

    // Typing alone changes nothing — this is the guard against typos.
    expect(onPick).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('option', { name: /Create/ }));
    expect(onPick).toHaveBeenCalledWith({ createName: 'Frozen Foods' });
  });

  it('does not offer to create a one-character name', async () => {
    renderWithProviders(<Harness />);

    const input = screen.getByRole('combobox', { name: 'Category' });
    await userEvent.click(input);
    await userEvent.type(input, 'F');

    expect(screen.queryByRole('option', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('warns before saving that a new category will be visible to shoppers', () => {
    renderWithProviders(
      <CategoryCombobox
        label="Category"
        options={CATEGORIES}
        value={{ createName: 'Frozen Foods' }}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText(/will be created when you save/i)).toHaveTextContent(
      /appear to shoppers/i,
    );
  });

  it('can be disabled, for a subcategory with no parent chosen yet', () => {
    renderWithProviders(
      <CategoryCombobox
        label="Subcategory"
        options={[]}
        value={{ id: '' }}
        onChange={() => {}}
        disabled
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Subcategory' })).toBeDisabled();
  });

  it('explains an empty subcategory list rather than showing nothing', async () => {
    renderWithProviders(
      <CategoryCombobox
        label="Subcategory"
        options={[]}
        value={{ id: '' }}
        onChange={() => {}}
        emptyHint="This category has no subcategories yet."
      />,
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Subcategory' }));
    expect(screen.getByText(/no subcategories yet/i)).toBeInTheDocument();
  });
});

/**
 * URL RESOLUTION
 *
 * Uploaded images are stored as a rooted path, so the web app has to resolve
 * them against the API's origin. Getting this wrong produces a broken image on
 * every product card, and it fails silently.
 */
describe('resolveImageUrl', () => {
  const API = 'http://localhost:4000';

  it('resolves an uploaded path against the API origin, not the web app', () => {
    expect(resolveImageUrl('/media/abc123.jpg', API)).toBe(
      'http://localhost:4000/media/abc123.jpg',
    );
  });

  it('leaves an absolute URL alone', () => {
    const external = 'https://cdn.example.com/milk.jpg';
    expect(resolveImageUrl(external, API)).toBe(external);
  });

  it('does not double up on slashes', () => {
    expect(resolveImageUrl('/media/a.jpg', 'http://localhost:4000/')).toBe(
      'http://localhost:4000/media/a.jpg',
    );
  });

  it('passes through anything that is neither, rather than mangling it', () => {
    expect(resolveImageUrl('data:image/png;base64,AAA', API)).toBe('data:image/png;base64,AAA');
  });
});
