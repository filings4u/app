import { supabase } from './supabase.js';

const form = document.querySelector('#loginForm');
const message = document.querySelector('#message');
const loginButton = document.querySelector('#loginButton');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const passwordToggle = document.querySelector('#passwordToggle');

document.querySelector('#currentYear').textContent = new Date().getFullYear();

function setMessage(text = '', type = '') {
  message.textContent = text;
  message.className = 'login-status' + (type ? ` ${type}` : '');
}
function setBusy(isBusy) {
  loginButton.disabled = isBusy;
  loginButton.textContent = isBusy ? 'SIGNING IN...' : 'SIGN IN TO WORKFORCE COMPLIANCE';
}
function portalFromContext(data) {
  const role = data?.membership?.role_code;
  const audience = data?.subscription?.plan?.audience;
  const orgType = data?.membership?.organization_type;
  if (role === 'platform_admin') return 'admin';
  if (audience === 'owner_operator') return 'owner-operator';
  if (audience === 'ctpa' || orgType === 'ctpa') return 'ctpa';
  return 'employer';
}
async function routeAuthenticatedUser() {
  setMessage('Verifying account access...');
  const { data, error } = await supabase.functions.invoke('workforce-session-context');
  if (error || !data) {
    console.error('Workforce session context failed:', error);
    setMessage('We could not verify your Workforce account. Please try again.', 'error');
    return false;
  }
  if (!data.has_access) {
    window.location.replace('access-required.html');
    return true;
  }
  const portal = portalFromContext(data);
  setMessage('Access verified. Opening your dashboard...', 'success');
  window.location.replace(`${portal}/dashboard.html`);
  return true;
}
passwordToggle.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  passwordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    setMessage('Enter your email address and password.', 'error');
    return;
  }
  try {
    setBusy(true);
    setMessage('Authenticating your account...');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message || 'We could not sign you in. Please verify your credentials.', 'error');
      return;
    }
    if (!data?.user) {
      setMessage('No authenticated account was returned. Please try again.', 'error');
      return;
    }
    await routeAuthenticatedUser();
  } catch (error) {
    console.error('Workforce login failed:', error);
    setMessage('The sign-in service could not be reached. Please try again.', 'error');
  } finally {
    setBusy(false);
  }
});
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  try { await routeAuthenticatedUser(); }
  catch (error) {
    console.error('Existing session routing failed:', error);
    setMessage('');
  }
}
