# 25. Release Checklist

## 1. Code Quality
- [ ] `npm run lint` passes without errors.
- [ ] No hardcoded API keys or secrets in the commit.
- [ ] All new components are added to `12_COMPONENT_REGISTRY.md`.

## 2. Database & RLS
- [ ] SQL migration is idempotent and includes a verification block.
- [ ] RLS policies tested against student and admin roles.
- [ ] Indexes added for any new high-volume search columns.

## 3. UI/UX Verification
- [ ] Verified on Desktop (Chrome/Safari).
- [ ] Verified on Mobile (iOS/Android).
- [ ] Loading states (Skeletons) implemented.
- [ ] Error boundary handles unexpected data failure.

## 4. Documentation
- [ ] `CHANGELOG.md` updated with the new version.
- [ ] System map updated if navigation changed.
- [ ] Relevant manuals (Admin/Student) updated if features changed.
