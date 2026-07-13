import { supabase } from './supabaseClient';

// Login by a chosen username + password — no email, no phone, nothing is ever sent.
// Supabase only supports email/password under the hood, so we turn the username into
// an internal address like "dasha@ostrov.local". That address is never emailed; it's
// just how Supabase stores the account. Requires "Confirm email" to be OFF in the
// Supabase dashboard (Authentication → Sign In / Providers → Email), otherwise sign-up
// would wait for a confirmation email that can never arrive.
// Supabase persists the session in localStorage, so people stay logged in.

const INTERNAL_DOMAIN = 'ostrov.local';

function loginToEmail(login) {
  return `${login.trim().toLowerCase()}@${INTERNAL_DOMAIN}`;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Fires whenever the user signs in or out (including when a magic link is opened).
// Returns an unsubscribe function.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

// Create a brand-new account from a username + password. Returns the sign-up data;
// data.session is null when the project still requires email confirmation (which
// can never arrive for our internal addresses), so callers must check for it.
export async function signUpWithLogin(login, password) {
  const { data, error } = await supabase.auth.signUp({ email: loginToEmail(login), password });
  if (error) throw error;
  return data;
}

// Sign in to an existing account. On success the session is set and the auth
// listener in App lets the app through.
export async function signInWithLogin(login, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Permanently delete the current account (server-side RPC). Islands and memories
// stay for the partner; only this account and its membership are removed.
export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}
