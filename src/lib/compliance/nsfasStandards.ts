export type ComplianceRequirement = {
  code: string;
  title: string;
  summary: string;
  coreGate: boolean;
};

export type InspectionReference = {
  category: string;
  checks: string[];
};

/**
 * Public-safe reference material derived from the NSFAS/DHET documents held in the
 * ResKonnect controlled document set. This is deliberately requirements guidance,
 * not ResKonnect's internal scoring, fraud detection or case-strategy logic.
 */
export const COMPLIANCE_REQUIREMENTS: ComplianceRequirement[] = [
  { code: "zoning", title: "Zoning / consent-use evidence", summary: "Municipal zoning certificate or acceptable consent-use evidence for the property.", coreGate: true },
  { code: "ownership", title: "Proof of ownership", summary: "Current ownership evidence and, where relevant, finance/bank authority supporting use of the property.", coreGate: true },
  { code: "building_plans", title: "Approved building plans", summary: "Approved municipal building plans that correspond with the accommodation being offered.", coreGate: true },
  { code: "occupancy", title: "Occupancy certificate", summary: "Applicable occupancy evidence for the building and its approved use.", coreGate: true },
  { code: "fire_coc", title: "Fire compliance certificate", summary: "Current fire-compliance evidence and serviced firefighting equipment where applicable.", coreGate: true },
  { code: "electrical_coc", title: "Electrical Certificate of Compliance", summary: "Valid electrical compliance evidence for the property.", coreGate: true },
  { code: "bank_confirmation", title: "Bank confirmation / corporate linkage", summary: "Bank confirmation and company-linkage evidence for the account used in the accommodation process.", coreGate: true },
  { code: "security_plan", title: "Security Management Plan", summary: "Documented site security, access control, visitor control and incident-response arrangements.", coreGate: false },
  { code: "pest_control", title: "Pest Control Certificate", summary: "Evidence of current pest-control services for the accommodation.", coreGate: false },
  { code: "waste_plan", title: "Waste Management Plan", summary: "Documented waste storage, collection and site-cleanliness arrangements.", coreGate: false },
  { code: "psira", title: "PSIRA evidence", summary: "Applicable PSIRA evidence for security personnel or the contracted armed-response/security provider.", coreGate: false },
  { code: "health_safety", title: "Health, Safety & Emergency Readiness Plan", summary: "Emergency contacts, evacuation, first-aid, fire and other safety-readiness arrangements.", coreGate: false },
  { code: "cleaning", title: "Cleaning contracts & registers", summary: "Cleaning arrangements plus operating registers demonstrating ongoing execution.", coreGate: false },
];

export const INSPECTION_REFERENCES: InspectionReference[] = [
  {
    category: "Rooms",
    checks: [
      "Room-size references: single 8 m², double 14 m², triple 19 m².",
      "Reliable Wi-Fi with a strong usable signal.",
      "Per-student furniture: bed, mattress, study table, desk chair, waste bin, bedside table, lockable clothes cupboard, bookshelf and 15A socket.",
      "Portable heaters are treated as a high-risk condition in the supplied inspection criteria.",
    ],
  },
  {
    category: "Ablutions",
    checks: [
      "Sufficient hot water, lighting, ventilation and privacy.",
      "Reference ratios: 1 lavatory per 5 students, 1 shower per 7, 1 wash basin per 4.",
    ],
  },
  {
    category: "Kitchen",
    checks: [
      "Reference ratios: 1 four-plate stove per 8 students, 1 microwave per 15, 1 x 320 L fridge per 8 and 1 sink per 15.",
      "Preparation space for 25% of students and one lockable cupboard per student.",
    ],
  },
  {
    category: "Power, study & recreation",
    checks: [
      "Back-up energy provision is assessed, including generator/solar arrangements where present.",
      "Study areas, common areas and recreation facilities are assessed; common-area reference capacity is 25% of students.",
    ],
  },
  {
    category: "Laundry",
    checks: [
      "Reference ratios: double wash trough per 40 students, industrial washing machine per 25 and industrial tumble dryer per 25.",
    ],
  },
  {
    category: "Security & access",
    checks: [
      "Secure perimeter reference of at least 2 m with lockable gates.",
      "24-hour guard at the main entrance, access control, visitor controls, functional CCTV and applicable burglar bars.",
    ],
  },
  {
    category: "Safety & emergencies",
    checks: [
      "Serviced fire equipment, fire doors, alarms/smoke detection, evacuation signs/maps, assembly point and unobstructed routes.",
      "First-aid provision, emergency lighting/numbers and an annual evacuation drill are part of the supplied criteria.",
    ],
  },
  {
    category: "Hygiene & building condition",
    checks: [
      "Clean common areas, pest-control evidence, waste area and cleaning-equipment storage.",
      "No material leaks/cracks, safe wiring, adequate ventilation/natural light, sound roof/ceilings and evidence of executed maintenance.",
      "The as-built structure and compliance evidence should align with approved municipal plans.",
    ],
  },
];

export const READINESS_STAGES = [
  { key: "not_yet_prepared", label: "Not Yet Prepared", description: "Important evidence or property basics are not yet ready for detailed progression." },
  { key: "preparation_in_progress", label: "Preparation in Progress", description: "Core items exist, but material gaps remain." },
  { key: "ready_for_preinspection", label: "Ready for ResKonnect Pre-Inspection", description: "Document preparation is sufficient to move to a detailed site-readiness review." },
  { key: "remediation_required", label: "Remediation Required", description: "Review identified items that should be corrected before the next stage." },
  { key: "ready_for_submission_support", label: "ResKonnect Ready for Submission Support", description: "Internal readiness gates are satisfied for the supported pathway. This is not official accreditation." },
] as const;

export const EXTERNAL_STATUS_LABELS: Record<string, string> = {
  unknown: "Not verified",
  not_submitted: "Not submitted",
  submitted: "Submitted",
  document_review: "Document review",
  inspection_pending: "Inspection pending",
  directive_or_remediation: "Directive / remediation",
  evaluation: "Evaluation",
  approved: "Approved",
  declined: "Declined",
  graded: "Graded",
  accredited_active: "Accredited active",
  suspended: "Suspended",
  revoked: "Revoked",
  expired: "Expired",
};

export const GOVERNANCE_NOTICES = {
  authority:
    "ResKonnect provides accreditation-readiness, document organisation, pre-inspection and case-support services. Official accreditation, grading, permits and funding decisions remain with NSFAS, the relevant institution, municipality or other authorised body.",
  grade:
    "An official grade must be supported by authority evidence and its validity period. ResKonnect quality standards are separate from official accreditation and grading.",
  funding:
    "A property accepting NSFAS-funded students is not automatically proof that it is currently accredited for a particular student, institution or funding pathway.",
};
