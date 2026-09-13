# Employer Admin actions to add to workforce-admin-employers

Existing actions remain. Add:
- invite_member
- bulk_invite_members
- import_employees
- run_selection
- create_selection_notice
- save_order_defaults
- save_lab_result_reporting
- save_orderable_services
- save_lab_accounts
- request_support_consent
- revoke_support_consent

`detail` should additionally return:
- selection_events
- selection_members
- support_consent
- support_consent_history
- order_defaults
- lab_result_reporting
- orderable_services
- lab_accounts

Rules:
1. Platform Admin may configure subscription/entitlement/account settings.
2. Operational mutations on behalf of an Employer require current, scoped Employer consent, except security/incident remediation and platform-level administration.
3. Every mutation writes `audit_events.before_data`, `after_data`, and metadata.source.
4. Employee/customer delete operations must archive/soft-delete rather than hard-delete.
5. Selection notices go to Employer/DER contacts; do not directly notify selected employees.
6. Entitlement checks must be enforced server-side, not only hidden in navigation.
