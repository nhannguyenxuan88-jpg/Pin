-- =====================================================
-- FIX: Convert materials_used from JSON STRING to JSON ARRAY
-- =====================================================
-- Run this in Supabase SQL Editor
-- Purpose: Fix data that was incorrectly saved as JSON string in JSONB column
-- =====================================================

-- Check current format (should show strings starting with '["')
-- SELECT id, pg_typeof(materials_used), left(materials_used::text, 50)
-- FROM pin_repair_orders
-- WHERE materials_used::text LIKE '"%';

-- Fix: Convert JSON strings to actual JSON arrays
UPDATE pin_repair_orders
SET materials_used = (materials_used #>> '{}')::jsonb
WHERE jsonb_typeof(materials_used) = 'string'
AND materials_used::text LIKE '"%';

-- Verify fix worked
-- SELECT id, pg_typeof(materials_used), jsonb_typeof(materials_used), left(materials_used::text, 50)
-- FROM pin_repair_orders;
