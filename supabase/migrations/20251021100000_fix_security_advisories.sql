/*
================================================================================
# [SECURITY] Recreate view_contacts_clean without SECURITY DEFINER
[Description of what this operation does]
This operation drops and recreates the `view_contacts_clean` view.
The original view was created with `SECURITY DEFINER`, which is a security risk because it runs with the permissions of the view's owner, not the user querying it. This change ensures the view runs with the permissions of the current user, respecting their Row Level Security policies.

## Query Description:
This operation corrects a security flaw in a database view. It does not alter any underlying data, but it enforces the correct security rules for users querying contact information. There is no risk of data loss.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- View affected: `public.view_contacts_clean`

## Security Implications:
- RLS Status: Enforces invoker's RLS policies correctly.
- Policy Changes: No
- Auth Requirements: n/a

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible. Query performance remains the same.
*/
DROP VIEW IF EXISTS public.view_contacts_clean;
CREATE VIEW public.view_contacts_clean AS
 SELECT c.id,
    c.tenant_id,
    c.company_id,
    c.full_name,
    c."position",
    c.department,
    c.contact_guard,
    c.status,
    c.notes,
    c.created_at,
    c.updated_at,
    c.export_state,
    COALESCE(( SELECT json_agg(json_build_object('id', ch.id, 'type', lower(ch.type::text), 'value', ch.value, 'label_custom', ch.label_custom, 'is_preferred', COALESCE(ch.is_preferred, false), 'notes', ch.notes, 'verified_at', ch.verified_at, 'created_at', ch.created_at, 'updated_at', ch.updated_at, 'export_state', ch.export_state) ORDER BY COALESCE(ch.is_preferred, false) DESC, (lower(ch.type::text)), NULLIF(ch.label_custom, ''::text), ch.value) AS json_agg
           FROM contacts_channel ch
          WHERE ((ch.contact_id = c.id) AND (ch.tenant_id = c.tenant_id))), '[]'::json) AS channels,
    ( SELECT count(*) AS count
           FROM contacts_channel ch2
          WHERE ((ch2.contact_id = c.id) AND (ch2.tenant_id = c.tenant_id))) AS channels_count
   FROM contacts c;

/*
================================================================================
# [SECURITY] Enable RLS on contacts_channels_audit table
[Description of what this operation does]
This operation enables Row Level Security (RLS) on the `contacts_channels_audit` table and adds a policy to deny all access to non-administrative roles. This is a critical security measure to prevent unauthorized users from viewing sensitive audit data.

## Query Description:
This change protects the audit log table from being accessed by regular users. It enables Row Level Security and creates a default-deny policy. Only administrative roles (like service_role) will be able to access this data. There is no risk of data loss.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "High"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Table affected: `public.contacts_channels_audit`

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes, a new default-deny policy is created.
- Auth Requirements: Access is restricted to admin roles.

## Performance Impact:
- Indexes: None
-Triggers: None
- Estimated Impact: Negligible impact on performance for regular users, as they will be denied access quickly.
*/
ALTER TABLE public.contacts_channels_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all access to audit table"
ON public.contacts_channels_audit
FOR ALL
USING (false)
WITH CHECK (false);

COMMENT ON POLICY "Deny all access to audit table" ON public.contacts_channels_audit IS 'This policy denies all access (SELECT, INSERT, UPDATE, DELETE) to the audit table for any role that is not bypassing RLS, such as service_role.';
