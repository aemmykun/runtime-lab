import { DEFAULT_PRICE_TABLE } from '@runtime-lab/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PriceTableEditor } from '~/features/settings/PriceTableEditor';
import { useSettingsStore } from '~/stores/settings-store';
import { freshDb } from './helpers';

async function resetPrices() {
  await freshDb();
  useSettingsStore.setState({ priceTable: DEFAULT_PRICE_TABLE, loaded: true });
}

describe('PriceTableEditor', () => {
  beforeEach(resetPrices);
  afterEach(cleanup);

  it('renders the default table with gpt-5-mini at 0.25 / 2, grouped by provider', () => {
    render(<PriceTableEditor />);
    expect(screen.getByRole('columnheader', { name: 'Provider' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Model' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Input $/1M tokens' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Output $/1M tokens' })).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Model for OpenAI gpt-5-mini' }) as HTMLInputElement).value).toBe('gpt-5-mini');
    expect((screen.getByRole('spinbutton', { name: 'Input $/1M tokens for OpenAI gpt-5-mini' }) as HTMLInputElement).value).toBe('0.25');
    expect((screen.getByRole('spinbutton', { name: 'Output $/1M tokens for OpenAI gpt-5-mini' }) as HTMLInputElement).value).toBe('2');
    expect(screen.getByText(/guide only/)).toBeTruthy();
    expect(screen.getByText(/no affiliation/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'OpenAI pricing page' }).getAttribute('href')).toBe('https://developers.openai.com/api/docs/pricing');
    expect(screen.getByRole('link', { name: 'Anthropic pricing page' }).getAttribute('href')).toBe('https://platform.claude.com/docs/en/about-claude/pricing');
    const headers = screen.getAllByRole('columnheader', { name: /OpenAI|Anthropic/ });
    expect(headers[0]!.textContent).toMatch(/OpenAI/);
    expect(headers[1]!.textContent).toMatch(/Anthropic/);
  });

  it('saves an edited price and rejects a negative number with an inline error', async () => {
    render(<PriceTableEditor />);
    const input = screen.getByRole('spinbutton', { name: 'Input $/1M tokens for OpenAI gpt-5-mini' });
    fireEvent.change(input, { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save prices' }));
    await waitFor(() => expect(useSettingsStore.getState().priceTable.prices['openai:gpt-5-mini']?.inputPerMTok).toBe(0.5));
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(useSettingsStore.getState().priceTable.prices['openai:gpt-5-mini']?.outputPerMTok).toBe(2);
    expect(useSettingsStore.getState().priceTable.checkedAt).toBe('2026-11-18');

    const inputAfterSave = screen.getByRole('spinbutton', { name: 'Input $/1M tokens for OpenAI gpt-5-mini' });
    fireEvent.change(inputAfterSave, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save prices' }));
    expect(screen.getByRole('alert').textContent).toMatch(/non-negative/);
    expect(useSettingsStore.getState().priceTable.prices['openai:gpt-5-mini']?.inputPerMTok).toBe(0.5);
  });

  it('adds a model, removes a row, and resets to the default values', async () => {
    render(<PriceTableEditor />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Provider for new model' }), { target: { value: 'groq' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Model for new model' }), { target: { value: 'llama-3.1-8b-instant' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Input $/1M tokens for new model' }), { target: { value: '0.1' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Output $/1M tokens for new model' }), { target: { value: '0.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }));
    expect((screen.getByRole('textbox', { name: 'Model for Groq llama-3.1-8b-instant' }) as HTMLInputElement).value).toBe('llama-3.1-8b-instant');
    fireEvent.click(screen.getByRole('button', { name: 'Save prices' }));
    await waitFor(() => expect(useSettingsStore.getState().priceTable.prices['groq:llama-3.1-8b-instant']).toEqual({ inputPerMTok: 0.1, outputPerMTok: 0.2 }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove OpenAI gpt-5-nano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save prices' }));
    await waitFor(() => expect(useSettingsStore.getState().priceTable.prices['openai:gpt-5-nano']).toBeUndefined());
    expect(useSettingsStore.getState().priceTable.prices['openai:gpt-5-mini']).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    await waitFor(() => expect(useSettingsStore.getState().priceTable.prices['openai:gpt-5-nano']?.inputPerMTok).toBe(0.05));
    expect(useSettingsStore.getState().priceTable.prices['groq:llama-3.1-8b-instant']).toBeUndefined();
    expect(useSettingsStore.getState().priceTable.prices['openai:gpt-5-mini']).toEqual({ inputPerMTok: 0.25, outputPerMTok: 2 });
  });
});
