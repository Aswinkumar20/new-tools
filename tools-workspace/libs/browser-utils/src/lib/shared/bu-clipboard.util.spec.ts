import type { ToastService } from '@tools-workspace/features-home';
import { buCopyText } from './bu-clipboard.util';

describe('buCopyText', () => {
  const toast = {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  } as unknown as ToastService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no-ops on empty text', () => {
    buCopyText(toast, '', 'Label');
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('toasts success after clipboard write', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    buCopyText(toast, 'hello', 'Sample');
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(toast.info).toHaveBeenCalledWith('Sample copied to clipboard');
  });

  it('toasts an error when clipboard write fails', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    buCopyText(toast, 'hello', 'Sample');
    await Promise.resolve();
    await Promise.resolve();

    expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard');
  });
});
