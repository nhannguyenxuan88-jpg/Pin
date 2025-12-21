
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
    try {
        const envPath = path.resolve('d:\\Pin\\Pin\\.env.local');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env: Record<string, string> = {};
        envFile.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                env[key] = value;
            }
        });
        return env;
    } catch (error) {
        console.error('Error loading .env.local file:', error);
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    const { data, error } = await supabase
        .from('pin_repair_orders')
        .select('*')
        .limit(1)
        .single();

    if (error) {
        console.error('Error fetching one row:', error);
        return;
    }

    console.log('Table Columns:', Object.keys(data));
    console.log('Sample Data:', JSON.stringify(data, null, 2));
}

checkSchema();
