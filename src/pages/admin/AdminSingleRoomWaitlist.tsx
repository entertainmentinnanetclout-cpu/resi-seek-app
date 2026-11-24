import SEO from "@/components/SEO";
import AdminLayout from "@/components/admin/AdminLayout";
import SingleRoomWaitlistQueue from "@/components/admin/SingleRoomWaitlistQueue";

/** Standalone direct link with only the single-room data dependency. */
export default function AdminSingleRoomWaitlist(){
  return <AdminLayout>
    <SEO noIndex title="Single-Room Waiting List | ResKonnect Admin"
      description="Private administration of student requests for single-occupancy accommodation at any suitable residence."/>
    <div className="mx-auto max-w-7xl"><SingleRoomWaitlistQueue/></div>
  </AdminLayout>;
}
