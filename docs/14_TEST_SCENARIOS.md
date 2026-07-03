# 14. Test Scenarios

## 1. Student Application E2E
1. **Discovery**: User searches for "Arcadia" res.
2. **Apply**: User clicks Apply -> Logs in -> Submits.
3. **Docs**: User uploads ID and Proof of Registration.
4. **Validation**: Check `applications` status is `submitted`.
5. **Notification**: Residence Admin sees "New Application" badge.

## 2. Referral Conversion
1. **Capture**: User lands via `?ref=RK001`.
2. **Signup**: User registers.
3. **Verification**: `referral_earnings` has a `signup` record for `RK001`.
4. **Sale**: User pays for a hamper.
5. **Verification**: `referral_earnings` has a `sale` record for `RK001`.

## 3. Role-Based Access (Security)
1. **Student**: Attempts to access `/admin/operations`. Result: **Redirect to /dashboard**.
2. **Residence Admin**: Attempts to view applications for a different `residence_id`. Result: **RLS Deny (0 records returned)**.
3. **Specialist**: Tries to delete a user. Result: **Bypassed by has_role('admin') check only**.

## 4. Export Verification
1. **Action**: Residence Admin clicks "Export Handover Pack".
2. **Result**: CSV generated with correct student names, IDs, and move-in dates.
3. **Data Integrity**: Verify no fields are `null` that are required by TUT/Institution.
