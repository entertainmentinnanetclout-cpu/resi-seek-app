import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getReferralPublic, captureReferralClick } from "@/lib/referrals/referralApi";
import { saveReferral, getVisitorId } from "@/lib/referrals/referralStorage";

export default function ReferralRedirect() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const upper = code.toUpperCase();
      const info = await getReferralPublic(upper);
      // Only process if it's a student_recruitment code
      if (info && (info as any).program_key === 'student_recruitment') {
        const landing = `/find?ref=${upper}`;
        const sessionId = await captureReferralClick(upper, getVisitorId(), landing);
        saveReferral(info.code, sessionId, info.agent_name, landing, 'student_recruitment');
        navigate(`/find?ref=${upper}`, { replace: true });
      } else {
        // If it's a different program or invalid, just go to find without applying recruitment logic
        navigate("/find", { replace: true });
        if (info) {
          toast.error("Invalid recruitment code.");
        }
      }
    })();
  }, [code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}