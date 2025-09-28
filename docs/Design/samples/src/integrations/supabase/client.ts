import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://etdnhtyjcaqmkwmbwxrw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZG5odHlqY2FxbWt3bWJ3eHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjg2MzAsImV4cCI6MjA3NDYwNDYzMH0.yZrv-uGyfMYwj-vEVHMQPi0vFtaU7EHxQ7MBZcrbVNE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
