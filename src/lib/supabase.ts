import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zvuutnextpujrlbaukfw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2dXV0bmV4dHB1anJsYmF1a2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNDkxMjMsImV4cCI6MjEwNTYyNTEyM30.j4AEh0MjSeJb95fNkSStiQstky1wVKU6n0bTag0q5mw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
