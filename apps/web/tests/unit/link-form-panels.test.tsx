import { afterEach, describe, expect, it } from 'bun:test';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen
} from '@testing-library/react';
import {
  LinkFormCollapsibleSection,
  LinkSummaryPanel
} from '@/components/forms/link-form-panels';

describe('Link Form Panels', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps collapsible content hidden until the trigger is pressed', async () => {
    render(
      <LinkFormCollapsibleSection
        title="Advanced settings"
        description="Extra routing and protection controls"
      >
        <div>Advanced content</div>
      </LinkFormCollapsibleSection>
    );

    expect(screen.queryByText('Advanced content')).toBeNull();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /advanced settings/i })
      );
    });

    expect(screen.getByText('Advanced content')).toBeDefined();
  });

  it('honors defaultOpen and shows the section summary badge', () => {
    render(
      <LinkFormCollapsibleSection
        title="Tracking"
        description="Attach campaign data"
        summary="3 fields"
        defaultOpen
      >
        <div>Tracking content</div>
      </LinkFormCollapsibleSection>
    );

    expect(screen.getByText('3 fields')).toBeDefined();
    expect(screen.getByText('Tracking content')).toBeDefined();
  });

  it('renders summary items, pills and footer actions', () => {
    render(
      <LinkSummaryPanel
        title="Link summary"
        description="Live preview of the link configuration"
        status="Ready"
        items={[
          {
            label: 'Destination',
            value: 'example.com'
          },
          {
            label: 'Redirect',
            value: '302 - Temporary'
          }
        ]}
        pills={['Password', 'Metadata']}
        footer={<button type="button">Create link</button>}
      />
    );

    expect(screen.getByText('Link summary')).toBeDefined();
    expect(screen.getByText('Ready')).toBeDefined();
    expect(screen.getByText('Destination')).toBeDefined();
    expect(screen.getByText('example.com')).toBeDefined();
    expect(screen.getByText('302 - Temporary')).toBeDefined();
    expect(screen.getByText('Password')).toBeDefined();
    expect(screen.getByText('Metadata')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create link' })).toBeDefined();
  });
});
