import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import { Input } from '@/components/ui/input';

describe('AccessibleFormField', () => {
  afterEach(() => {
    cleanup();
  });

  it('merges hint and error ids with child accessibility attributes', () => {
    render(
      <AccessibleFormField
        id="customAlias"
        label="Custom alias"
        hint="Keep it short and readable"
        error="Alias is already taken"
        required
      >
        <Input aria-describedby="existing-description" />
      </AccessibleFormField>
    );

    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const label = screen.getByText('Custom alias').closest('label');
    const alert = screen.getByRole('alert');

    expect(input.getAttribute('id')).toBe('customAlias');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(describedBy).toContain('customAlias-hint');
    expect(describedBy).toContain('customAlias-error');
    expect(describedBy).toContain('existing-description');
    expect(label?.textContent).toContain('*');
    expect(screen.getByText('Keep it short and readable')).toBeDefined();
    expect(alert.textContent).toContain('Alias is already taken');
  });

  it('renders a fallback input when no child field is provided', () => {
    render(
      <AccessibleFormField
        id="url"
        label="Destination URL"
        hint="Use a full https URL"
        error="Destination URL is invalid"
      />
    );

    const input = screen.getByRole('textbox');

    expect(input.getAttribute('id')).toBe('url');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('url-hint url-error');
    expect(screen.getByText('Destination URL')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain(
      'Destination URL is invalid'
    );
  });
});
