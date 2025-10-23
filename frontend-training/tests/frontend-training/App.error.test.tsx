import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PredictionControls } from '../../src/components/PredictionControls';

describe('PredictionControls error handling', () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    itemCodes: ['ITEM-001'],
    onChangeItemCodes: vi.fn(),
    topK: 5,
    onChangeTopK: vi.fn(),
    threshold: 0.5,
    onChangeThreshold: vi.fn(),
    loading: false,
    onSubmit: vi.fn(),
  };

  it('renders error message when provided', () => {
    render(<PredictionControls {...baseProps} errorMessage="예측 요청에 실패했습니다." />);
    expect(screen.getByRole('alert')).toHaveTextContent('예측 요청에 실패했습니다.');
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

    const textAreas = screen.getAllByRole('textbox');
    await user.clear(textAreas[0]!);
    await user.type(textAreas[0]!, 'ITEM-100\nITEM-200');
    const submitButton = screen.getAllByRole('button', { name: /추천 실행/ })[0]!;
    await user.click(submitButton);

    await waitFor(() => {
      expect(onChangeItemCodes).toHaveBeenCalledWith(['ITEM-100', 'ITEM-200']);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
