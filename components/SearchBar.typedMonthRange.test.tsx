import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import SearchBar from '@/components/SearchBar';
import { currentMonth } from '@/lib/dateRange';
import { renderWithProviders } from '@/test/render';

vi.mock('@/lib/postcodeSuggestions', () => ({
  suggestPostcodes: vi.fn().mockResolvedValue([]),
}));

const FUTURE_MESSAGE = /can't be a future month/i;
const BEFORE_FROM_MESSAGE = /must be on or after from/i;

function renderSearchBar({ from, to }: { from: string; to: string }) {
  const onFromChange = vi.fn();
  const onToChange = vi.fn();

  function Harness() {
    const [fromValue, setFromValue] = useState(from);
    const [toValue, setToValue] = useState(to);
    return (
      <SearchBar
        postcodes={[]}
        onPostcodesChange={() => {}}
        postcodeOptions={[]}
        from={fromValue}
        onFromChange={(value) => {
          onFromChange(value);
          setFromValue(value);
        }}
        to={toValue}
        onToChange={(value) => {
          onToChange(value);
          setToValue(value);
        }}
        onSubmit={() => {}}
        onReset={() => {}}
        loading={false}
      />
    );
  }

  renderWithProviders(<Harness />);
  return { onFromChange, onToChange };
}

// The From and To pickers render as labelled groups of Month / Year sections.
function field(label: 'From' | 'To') {
  return screen.getByRole('group', { name: label });
}

function section(label: 'From' | 'To', part: 'Month' | 'Year') {
  return within(field(label)).getByRole('spinbutton', { name: part });
}

const thisYear = Number(currentMonth().slice(0, 4));

describe('SearchBar typed month range', () => {
  it('rejects a future From month entered from the keyboard and explains why', async () => {
    const user = userEvent.setup();
    const today = currentMonth();
    const { onFromChange, onToChange } = renderSearchBar({ from: today, to: today });

    await user.click(section('From', 'Year'));
    await user.keyboard('{ArrowUp}');

    expect(section('From', 'Year')).toHaveTextContent(String(thisYear + 1));
    expect(field('From')).toHaveAttribute('aria-invalid', 'true');
    expect(field('From')).toHaveAccessibleDescription(FUTURE_MESSAGE);
    expect(onFromChange).not.toHaveBeenCalled();
    expect(onToChange).not.toHaveBeenCalled();
  });

  it('does not accept a typed future From month or drag To forward with it', async () => {
    const user = userEvent.setup();
    const { onFromChange, onToChange } = renderSearchBar({ from: '2024-03', to: '2024-06' });
    const futureYear = String(thisYear + 1);

    await user.click(section('From', 'Month'));
    await user.keyboard('Dec');
    await user.keyboard(futureYear);

    expect(section('From', 'Month')).toHaveTextContent('Dec');
    expect(section('From', 'Year')).toHaveTextContent(futureYear);
    expect(field('From')).toHaveAccessibleDescription(FUTURE_MESSAGE);
    expect(onFromChange).not.toHaveBeenCalledWith(`${futureYear}-12`);
    expect(onToChange).not.toHaveBeenCalledWith(`${futureYear}-12`);
    expect(section('To', 'Year')).not.toHaveTextContent(futureYear);
  });

  it('rejects a future To month entered from the keyboard and explains why', async () => {
    const user = userEvent.setup();
    const today = currentMonth();
    const { onFromChange, onToChange } = renderSearchBar({ from: today, to: today });

    await user.click(section('To', 'Year'));
    await user.keyboard('{ArrowUp}');

    expect(section('To', 'Year')).toHaveTextContent(String(thisYear + 1));
    expect(field('To')).toHaveAttribute('aria-invalid', 'true');
    expect(field('To')).toHaveAccessibleDescription(FUTURE_MESSAGE);
    expect(onToChange).not.toHaveBeenCalled();
    expect(onFromChange).not.toHaveBeenCalled();
  });

  it('rejects a typed To month before From and explains why', async () => {
    const user = userEvent.setup();
    const { onFromChange, onToChange } = renderSearchBar({ from: '2024-03', to: '2024-06' });

    await user.click(section('To', 'Year'));
    await user.keyboard('{ArrowDown}');

    expect(section('To', 'Year')).toHaveTextContent('2023');
    expect(field('To')).toHaveAttribute('aria-invalid', 'true');
    expect(field('To')).toHaveAccessibleDescription(BEFORE_FROM_MESSAGE);
    expect(onToChange).not.toHaveBeenCalled();
    expect(onFromChange).not.toHaveBeenCalled();
  });

  it('clears the message and accepts the month once the entry is corrected', async () => {
    const user = userEvent.setup();
    const { onToChange } = renderSearchBar({ from: '2024-03', to: '2024-06' });

    await user.click(section('To', 'Year'));
    await user.keyboard('{ArrowDown}');
    expect(field('To')).toHaveAccessibleDescription(BEFORE_FROM_MESSAGE);

    await user.keyboard('{ArrowUp}{ArrowUp}');

    expect(section('To', 'Year')).toHaveTextContent('2025');
    expect(field('To')).toHaveAttribute('aria-invalid', 'false');
    expect(field('To')).not.toHaveAccessibleDescription(BEFORE_FROM_MESSAGE);
    expect(screen.queryByText(BEFORE_FROM_MESSAGE)).not.toBeInTheDocument();
    expect(onToChange).toHaveBeenLastCalledWith('2025-06');
    expect(onToChange).not.toHaveBeenCalledWith('2023-06');
  });

  it('accepts a held-back To month once From moves early enough to allow it', async () => {
    const user = userEvent.setup();
    const { onFromChange, onToChange } = renderSearchBar({ from: '2024-03', to: '2024-06' });

    await user.click(section('To', 'Year'));
    await user.keyboard('{ArrowDown}');
    expect(field('To')).toHaveAccessibleDescription(BEFORE_FROM_MESSAGE);

    await user.click(section('From', 'Year'));
    await user.keyboard('{ArrowDown}{ArrowDown}');

    expect(onFromChange).toHaveBeenLastCalledWith('2022-03');
    expect(onToChange).toHaveBeenLastCalledWith('2023-06');
    expect(field('To')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText(BEFORE_FROM_MESSAGE)).not.toBeInTheDocument();
  });
});
