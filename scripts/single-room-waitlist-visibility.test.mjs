import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const app=read("src/App.tsx");
const landing=read("src/pages/Landing.tsx");
const landingCare=read("src/components/landing/StudentCareLinks.tsx");
const student=read("src/pages/StudentCare.tsx");
const mobile=read("src/components/NativeSafeDashboard.tsx");
const admin=read("src/components/admin/SingleRoomWaitlistQueue.tsx");
const adminRoute=read("src/pages/admin/AdminSingleRoomWaitlist.tsx");
const adminSidebar=read("src/components/admin/AdminLayout.tsx");
const operations=read("src/pages/admin/AdminOperationsHub.tsx");
const adminApplications=read("src/pages/admin/AdminApplications.tsx");
const legacyCare=read("src/pages/admin/AdminStudentCare.tsx");
const existingMigration=read("supabase/migrations/20260917075707_student_care_and_partner_workspace.sql");
const yearFix=read("supabase/migrations/20260919151000_residence_feedback_full_year_semester_scope.sql");

test("the student landing and mobile home keep public single-room entry points",()=>{
 assert.match(landing,/student-care/);
 assert.match(landing,/<StudentCareLinks/);
 assert.match(landingCare,/rk_single_room_waitlist_count/);
 assert.match(landingCare,/\/single-room-waiting-list/);
 assert.match(landingCare,/NOT required/);
 assert.match(mobile,/\/single-room-waiting-list/);
 assert.match(app,/path="\/single-room-waiting-list"/);
 assert.match(student,/const waiting = location\.pathname === '\/single-room-waiting-list'/);
 assert.match(student,/room_type:'single'/);
 assert.match(student,/Preferred residence \(optional/);
 assert.match(student,/rk_join_single_room_waitlist/);
 assert.match(student,/rk_withdraw_single_room/);
 assert.match(student,/\\[user\\?\\.id,waiting\\]/);
});

test("the student waitlist does not depend on unrelated feedback campaigns",()=>{
 const waitIndex=student.indexOf("if(waiting) {");
 const campaignsIndex=student.indexOf("db.from('residence_feedback_campaigns')");
 assert.ok(waitIndex>0&&campaignsIndex>waitIndex);
 const waitingBranch=student.slice(waitIndex,campaignsIndex);
 assert.match(waitingBranch,/db\.from\('single_room_waitlist'\)/);
 assert.doesNotMatch(waitingBranch,/residence_stay_feedback|creator_partners|residence_feedback_campaigns/);
 assert.match(waitingBranch,/setRequests\(r\.data\|\|\[\]\)/);
});

test("the same standalone waitlist is accessible from every admin discovery path",()=>{
 assert.match(app,/path="\/admin\/single-room-waiting-list"/);
 assert.match(app,/AdminSingleRoomWaitlist/);
 assert.match(app,/path="\\/admin\\/single-room-waiting-list"[\\s\\S]*?<DepartmentRoute department="accommodation">/);
 assert.match(adminRoute,/AdminLayout/);
 assert.match(adminRoute,/SingleRoomWaitlistQueue/);
 assert.match(adminSidebar,/\/admin\/single-room-waiting-list/);
 assert.doesNotMatch(adminSidebar,/!isGodMode&&<SidebarMenuItem><SidebarMenuButton asChild tooltip="Single-room waiting list"/);
 assert.match(operations,/value="single-rooms"/);
 assert.match(operations,/SingleRoomWaitlistQueue/);
 assert.match(adminApplications,/\/admin\/single-room-waiting-list/);
 assert.match(legacyCare,/tab === 'rooms' && <SingleRoomWaitlistQueue/);
});

test("admin loads only the private waitlist and does not silently show 0 after denied RLS",()=>{
 assert.match(admin,/rpc\("adminos_is_staff"\)/);
 assert.match(admin,/AAL2/);
 assert.match(admin,/GodModeMfaGate mode="care"/);
 assert.match(admin,/isGodMode/);
 assert.match(admin,/setAuthorized\(access\.data===true\)/);
 assert.match(admin,/readAllPages<WaitlistRecord>/);
 assert.match(admin,/from\("single_room_waitlist"\)/);
 assert.doesNotMatch(admin,/residence_stay_feedback|residence_feedback_campaigns|creator_partners|assistance_call_requests/);
 assert.match(admin,/role="alert"/);
 assert.match(admin,/isActive/);
 assert.match(admin,/semester!==/);
 assert.match(admin,/any suitable residence/i);
 assert.match(admin,/csvCell|toCsv\(shown\.map/);
});

test("status changes are authorized per row; no fake room allocations or public contact exposure",()=>{
 assert.match(admin,/\.update\(payload\)\.eq\("id",record\.id\)/);
 assert.match(admin,/single-occupancy room/);
 assert.match(admin,/single-occupancy option/);
 assert.match(admin,/matched/);
 assert.match(admin,/placed/);
 assert.match(admin,/staff_response:response\.trim\(\)/);
 assert.match(admin,/exportCsv=\(\)=>/);
 assert.match(existingMigration,/create table public\.single_room_waitlist/);
 assert.match(existingMigration,/create policy "staff manages single room requests"/);
 assert.match(existingMigration,/adminos_is_staff\(\)/);
 assert.match(yearFix,/single_room_waitlist/);
});
