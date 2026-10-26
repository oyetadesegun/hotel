import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

/** Supabase client for Client Components. */
export const createClient = () => createBrowserClient(supabaseUrl, supabaseKey);
