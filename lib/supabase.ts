import "react-native-url-polyfill/auto";

import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

const extra = (Constants.expoConfig?.extra || {}) as {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

const supabaseUrl = extra.SUPABASE_URL;
const supabaseAnonKey = extra.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env (see .env.example) and restart Expo.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
