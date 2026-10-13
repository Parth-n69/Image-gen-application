import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// ── TEST MODE: Set to true to skip email confirmation / OTP ──
export const SKIP_EMAIL_CONFIRM = true;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('guest_mode') === 'true';
  });

  useEffect(() => {
    let mounted = true;

    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session) {
          setIsGuest(false);
          sessionStorage.removeItem('guest_mode');
        }
        setLoading(false);
      }
    });

    // Listen to Supabase auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session) {
          setIsGuest(false);
          sessionStorage.removeItem('guest_mode');
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // When SKIP_EMAIL_CONFIRM is on, don't redirect to OTP
      const isUnconfirmed = SKIP_EMAIL_CONFIRM
        ? false
        : error.code === 'email_not_confirmed' ||
          error.message?.toLowerCase().includes('email not confirmed') ||
          error.message?.toLowerCase().includes('email address is not confirmed');

      if (isUnconfirmed) {
        try {
          await supabase.auth.resend({ type: 'signup', email });
        } catch {
          // ignore background resend error
        }
      }
      return { data, error, isUnconfirmed };
    }

    setIsGuest(false);
    sessionStorage.removeItem('guest_mode');
    return { data, error: null, isUnconfirmed: false };
  };

  const signUp = async ({ email, password, full_name, username }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          username,
        },
      },
    });

    if (error) {
      return { data, error };
    }

    // Check for existing user with empty identities array (Supabase email confirmation behavior)
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        data,
        error: {
          message: 'An account with this email already exists. Try signing in.',
          code: 'user_already_exists',
        },
      };
    }

    // TEST MODE: Auto sign-in right after signup to skip email verification
    if (SKIP_EMAIL_CONFIRM && !data?.session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!signInError && signInData?.session) {
        setIsGuest(false);
        sessionStorage.removeItem('guest_mode');
        return { data: signInData, error: null };
      }
      // If auto sign-in fails (e.g. Supabase still requires confirmation),
      // fall through to the normal flow
    }

    if (data?.session) {
      setIsGuest(false);
      sessionStorage.removeItem('guest_mode');
    }

    return { data, error: null };
  };

  const verifyOtp = async ({ email, token }) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (!error) {
      setIsGuest(false);
      sessionStorage.removeItem('guest_mode');
    }

    return { data, error };
  };

  const resend = async ({ email }) => {
    return supabase.auth.resend({
      type: 'signup',
      email,
    });
  };

  const signOut = async ({ scope = 'local' } = {}) => {
    setIsGuest(false);
    sessionStorage.removeItem('guest_mode');
    return supabase.auth.signOut({ scope });
  };

  const enterGuestMode = () => {
    setIsGuest(true);
    sessionStorage.setItem('guest_mode', 'true');
  };

  const exitGuestMode = () => {
    setIsGuest(false);
    sessionStorage.removeItem('guest_mode');
  };

  const value = {
    session,
    user,
    loading,
    isGuest,
    signIn,
    signUp,
    verifyOtp,
    resend,
    signOut,
    enterGuestMode,
    exitGuestMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
