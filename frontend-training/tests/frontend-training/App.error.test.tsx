import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PredictionControls } from '../../src/components/PredictionControls';

describe('PredictionControls error handling', () => {
  const baseProps = {
    itemCodes: ['ITEM-001'],
    onChangeItemCodes: vi.fn(),
    topK: 5,
    onChangeTopK: vi.fn(),
    threshold: 0.5,
    onChangeThreshold: vi.fn(),
    loading: false,
    onSubmit: vi.fn(),
  } as const;

  it('renders error message when provided', () => {
    render(<PredictionControls {...baseProps} errorMessage="예측 요청이 실패했습니다." />);
    expect(screen.getByRole('alert')).toHaveTextContent('예측 요청이 실패했습니다.');
  });

  it('submits updated item codes and triggers callback', async () => {
    const onChangeItemCodes = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <PredictionControls
        {...baseProps}
        onChangeItemCodes={onChangeItemCodes}
        onSubmit={onSubmit}
      />,
    );

    const textArea = screen.getByRole('textbox');
    await user.clear(textArea);
    await user.type(textArea, 'ITEM-100
ITEM-200');
    await user.click(screen.getByRole('button'));

    expect(onChangeItemCodes).toHaveBeenCalledWith(['ITEM-100', 'ITEM-200']);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
