import { fireEvent, render, screen } from '@testing-library/react';
import { Button, EmptyState, QtyStepper } from './index';

describe('common components', () => {
  it('QtyStepper calls onChange and respects min', () => {
    const onChange = vi.fn();
    render(<QtyStepper value={1} onChange={onChange} />);
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Increase quantity'));
    expect(onChange).toHaveBeenCalledWith(2);
  });
  it('Button shows a busy state and blocks clicks while loading', () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Pay</Button>);
    const b = screen.getByRole('button');
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });
  it('EmptyState renders title and action', () => {
    render(<EmptyState title="Nothing here" action={<button>Go</button>} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
  });
});
