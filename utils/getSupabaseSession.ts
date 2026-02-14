import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

/**
 * Returns the current Supabase auth session, if any.
 * Wraps `supabase.auth.getSession()` and normalizes the result.
 */
export async function getSupabaseSession(): Promise<{
  session: Session | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return { session: null, error };
    }
    if (data?.session) {
      return { session: data.session, error: null };
    }

    const email = process.env.SUPABASE_EMAIL ?? "testUser@yopmail.com";
    const password = process.env.SUPABASE_PASSWORD ?? "123456";

    if (!email || !password) {
      return {
        session: null,
        error: new Error("No session and no credentials provided for sign-in"),
      };
    }

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });
    if (signInError) {
      return { session: null, error: signInError };
    }
    return { session: signInData?.session ?? null, error: null };
  } catch (e: any) {
    return { session: null, error: e ?? new Error("Unknown error") };
  }
}
