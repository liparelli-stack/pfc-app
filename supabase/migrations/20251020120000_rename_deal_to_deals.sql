/*
# [STRUCTURAL] Rename table 'deal' to 'deals' and related objects
[This migration renames the 'deal' table to 'deals' to follow plural naming conventions. It also renames all associated types, constraints, policies, and triggers for consistency.]

## Query Description: [This is a non-destructive renaming operation. It changes the name of the table and its dependencies but does not alter data or data structures. No data loss is expected. It is a safe structural change.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true] (by running reverse RENAME operations)

## Structure Details:
- Table: deal -> deals
- Types: deal_pipeline_stage -> deals_pipeline_stage, deal_status -> deals_status
- Constraints: deal_*_fkey -> deals_*_fkey, deal_pkey -> deals_pkey
- Policies: deal_owner_policy_all -> deals_owner_policy_all
- Triggers: on_deal_updated -> on_deals_updated

## Security Implications:
- RLS Status: [Enabled]
- Policy Changes: [No, just renaming]
- Auth Requirements: [None]

## Performance Impact:
- Indexes: [Renamed]
- Triggers: [Renamed]
- Estimated Impact: [None. This is a metadata change.]
*/

-- 1. Rename Table
ALTER TABLE public.deal RENAME TO deals;

-- 2. Rename ENUM Types
ALTER TYPE public.deal_pipeline_stage RENAME TO deals_pipeline_stage;
ALTER TYPE public.deal_status RENAME TO deals_status;

-- 3. Rename Constraints (Primary and Foreign Keys)
ALTER TABLE public.deals RENAME CONSTRAINT deal_pkey TO deals_pkey;
ALTER TABLE public.deals RENAME CONSTRAINT deal_tenant_id_fkey TO deals_tenant_id_fkey;
ALTER TABLE public.deals RENAME CONSTRAINT deal_company_id_fkey TO deals_company_id_fkey;
ALTER TABLE public.deals RENAME CONSTRAINT deal_primary_contact_id_fkey TO deals_primary_contact_id_fkey;
ALTER TABLE public.deals RENAME CONSTRAINT deal_owner_user_id_fkey TO deals_owner_user_id_fkey;
ALTER TABLE public.deals RENAME CONSTRAINT deal_created_by_fkey TO deals_created_by_fkey;
ALTER TABLE public.deals RENAME CONSTRAINT deal_updated_by_fkey TO deals_updated_by_fkey;

-- 4. Rename RLS Policy
-- Note: The policy is attached to the table, so it follows the table rename.
-- We just need to rename the policy object itself for clarity.
ALTER POLICY deal_owner_policy_all ON public.deals RENAME TO deals_owner_policy_all;

-- 5. Rename Trigger
-- The trigger is also attached to the table.
ALTER TRIGGER on_deal_updated ON public.deals RENAME TO on_deals_updated;
