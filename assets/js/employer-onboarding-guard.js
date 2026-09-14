import { supabase } from './supabase.js';

const onOnboardingPage = location.pathname.endsWith('/employer/onboarding.html');

if (!onOnboardingPage) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      const { data, error } = await supabase.functions.invoke('workforce-customer-onboarding', {
        body: { action: 'status', portal: 'employer' }
      });

      if (error) {
        console.error('Employer onboarding status check failed:', error);
      } else if (data && data.completed === false) {
        location.replace(new URL('/employer/onboarding.html', location.origin).href);
      }
    }
  } catch (error) {
    console.error('Employer onboarding guard failed:', error);
  }
}
