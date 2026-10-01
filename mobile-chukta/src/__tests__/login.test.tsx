jest.mock('../app/services', () => ({ authService: { loginOwner: jest.fn(), loginStaff: jest.fn() }, staffApi: {} }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { authService } from '../app/services';
import { AuthError } from '../auth/authService';
import { initI18n } from '../i18n';
import { LoginScreen } from '../screens/LoginScreen';

const mocked = authService as jest.Mocked<typeof authService>;
beforeAll(() => initI18n('en'));
beforeEach(() => jest.clearAllMocks());

test('owner login hands the identity up', async () => {
  const identity = { kind: 'owner' as const, userId: 'u', shopId: 's', phone: '+919800000001' };
  mocked.loginOwner.mockResolvedValue(identity);
  const onLoggedIn = jest.fn();
  render(<LoginScreen notice={null} onLoggedIn={onLoggedIn} />);
  fireEvent.changeText(screen.getByTestId('phone'), '98000 00001');
  fireEvent.changeText(screen.getByTestId('secret'), 'secret1');
  fireEvent.press(screen.getByTestId('submit'));
  await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith(identity));
  expect(mocked.loginOwner).toHaveBeenCalledWith('9800000001', 'secret1');
});

test('staff mode sends the owner phone + digits-only PIN and shows the mapped error', async () => {
  mocked.loginStaff.mockRejectedValue(new AuthError('auth.error.tooManyAttempts'));
  render(<LoginScreen notice={null} onLoggedIn={jest.fn()} />);
  fireEvent.press(screen.getByTestId('mode-staff'));
  fireEvent.changeText(screen.getByTestId('phone'), '9800000001');
  fireEvent.changeText(screen.getByTestId('secret'), '48a2159');
  fireEvent.press(screen.getByTestId('submit'));
  expect(await screen.findByText(/ask the owner to unlock it in Settings/)).toBeTruthy();
  expect(mocked.loginStaff).toHaveBeenCalledWith('9800000001', '4821');
  expect(screen.queryByTestId('register')).toBeNull();
});

test('shows the logout notice; submit disabled until the phone has 10 digits', () => {
  render(<LoginScreen notice="auth.login.sessionEnded" onLoggedIn={jest.fn()} />);
  expect(screen.getByText('You were logged out. Please log in again.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('phone'), '98000');
  fireEvent.changeText(screen.getByTestId('secret'), 'x');
  expect(screen.getByTestId('submit').props.accessibilityState.disabled).toBe(true);
});
