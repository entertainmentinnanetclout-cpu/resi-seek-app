# 07. Deployment & Disaster Recovery

## 1. Deployment Playbook
### Pre-Deployment Checklist
- [ ] SQL Migrations run on Lovable Mirror.
- [ ] UI verified on mobile and desktop previews.
- [ ] Environment variables verified.
- [ ] RLS policies confirmed for the new feature.

### Deployment Flow
1. **Frontend**: Push code to GitHub -> Lovable deploys to mirror.
2. **Database**: Copy SQL from `docs/` and run on External Supabase SQL Editor.
3. **Verification**: Confirm counts and permissions on External DB.

## 2. Disaster Recovery (Resilience)
### Daily Backups
Supabase performs automatic daily backups. In case of failure, a point-in-time recovery (PITR) is the primary restore method.

### Backend Health Monitoring
Managed via the `AdminSystemStatus` page and `health_status` table.
- Pings External Auth and Database every hour.
- Alerts on the God Mode dashboard if status is not `healthy`.

### Service Interruption Protocol
1. **Identify**: Check `AdminSystemStatus`.
2. **Mitigate**: If a provider is down, update `platform_settings` to enable "Maintenance Mode".
3. **Restore**: Re-apply migrations or restore from backup if data corruption is identified.

## 3. Rollback Procedures
1. Revert the git commit.
2. Run the Rollback Block from the relevant SQL migration file in the External Supabase editor.
3. Force a redeploy of the frontend.
