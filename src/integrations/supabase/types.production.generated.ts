// GENERATED PRODUCTION SCHEMA DELTA — 2026-08-27
// Source: Supabase type generation for production project mefjzkhobkltlbmhusdh.
//
// This file deep-merges the production schema introduced by the latest property
// data-quality / residence portal / partnership migration into the historical
// generated baseline in ./types.ts. Keeping the delta separate avoids hand-editing
// thousands of unrelated generated lines while making the live client type-safe
// against the production schema revision.

import type { Database as LegacyDatabase, Json } from "./types";

type LegacyPublic = LegacyDatabase["public"];
type LegacyTables = LegacyPublic["Tables"];
type LegacyViews = LegacyPublic["Views"];
type LegacyFunctions = LegacyPublic["Functions"];

type ResidenceRow = LegacyTables["residences"]["Row"] & {
  cover_image_url: string | null;
  studio_image_url: string | null;
  brand_badge: string | null;
  brand_headline: string | null;
  brand_subheadline: string | null;
  brand_primary_color: string;
  brand_accent_color: string;
  place_label: string | null;
  city: string | null;
  data_quality_score: number;
  data_quality_status: string;
  data_quality_missing: string[];
  last_quality_check_at: string | null;
  recruiter_opt_in: boolean;
  recruiter_note: string | null;
  public_brand_card_enabled: boolean;
};

type ResidenceInsert = LegacyTables["residences"]["Insert"] & {
  cover_image_url?: string | null;
  studio_image_url?: string | null;
  brand_badge?: string | null;
  brand_headline?: string | null;
  brand_subheadline?: string | null;
  brand_primary_color?: string;
  brand_accent_color?: string;
  place_label?: string | null;
  city?: string | null;
  data_quality_score?: number;
  data_quality_status?: string;
  data_quality_missing?: string[];
  last_quality_check_at?: string | null;
  recruiter_opt_in?: boolean;
  recruiter_note?: string | null;
  public_brand_card_enabled?: boolean;
};

type ResidenceUpdate = LegacyTables["residences"]["Update"] & {
  cover_image_url?: string | null;
  studio_image_url?: string | null;
  brand_badge?: string | null;
  brand_headline?: string | null;
  brand_subheadline?: string | null;
  brand_primary_color?: string;
  brand_accent_color?: string;
  place_label?: string | null;
  city?: string | null;
  data_quality_score?: number;
  data_quality_status?: string;
  data_quality_missing?: string[];
  last_quality_check_at?: string | null;
  recruiter_opt_in?: boolean;
  recruiter_note?: string | null;
  public_brand_card_enabled?: boolean;
};

type ResidenceRoomTypesRow = LegacyTables["residence_room_types"]["Row"] & {
  landlord_confirmed_at: string | null;
  landlord_confirmed_by: string | null;
};

type ResidenceRoomTypesInsert = LegacyTables["residence_room_types"]["Insert"] & {
  landlord_confirmed_at?: string | null;
  landlord_confirmed_by?: string | null;
};

type ResidenceRoomTypesUpdate = LegacyTables["residence_room_types"]["Update"] & {
  landlord_confirmed_at?: string | null;
  landlord_confirmed_by?: string | null;
};

type ResidenceProfileChangeLog = {
  Row: {
    actor_type: string;
    actor_user_id: string | null;
    changed_fields: string[];
    created_at: string;
    id: string;
    patch: Json;
    residence_id: string;
  };
  Insert: {
    actor_type?: string;
    actor_user_id?: string | null;
    changed_fields?: string[];
    created_at?: string;
    id?: string;
    patch?: Json;
    residence_id: string;
  };
  Update: {
    actor_type?: string;
    actor_user_id?: string | null;
    changed_fields?: string[];
    created_at?: string;
    id?: string;
    patch?: Json;
    residence_id?: string;
  };
  Relationships: [
    {
      foreignKeyName: "residence_profile_change_log_residence_id_fkey";
      columns: ["residence_id"];
      isOneToOne: false;
      referencedRelation: "residences";
      referencedColumns: ["id"];
    },
  ];
};

type Partnerships = {
  Row: {
    commercial_model: Json;
    conversion_goal: string | null;
    created_at: string;
    ends_at: string | null;
    id: string;
    name: string;
    notes: string | null;
    partnership_type: string;
    public_path: string | null;
    slug: string;
    source_id: string | null;
    source_table: string | null;
    starts_at: string | null;
    status: string;
    updated_at: string;
    visibility: string;
  };
  Insert: {
    commercial_model?: Json;
    conversion_goal?: string | null;
    created_at?: string;
    ends_at?: string | null;
    id?: string;
    name: string;
    notes?: string | null;
    partnership_type?: string;
    public_path?: string | null;
    slug: string;
    source_id?: string | null;
    source_table?: string | null;
    starts_at?: string | null;
    status?: string;
    updated_at?: string;
    visibility?: string;
  };
  Update: {
    commercial_model?: Json;
    conversion_goal?: string | null;
    created_at?: string;
    ends_at?: string | null;
    id?: string;
    name?: string;
    notes?: string | null;
    partnership_type?: string;
    public_path?: string | null;
    slug?: string;
    source_id?: string | null;
    source_table?: string | null;
    starts_at?: string | null;
    status?: string;
    updated_at?: string;
    visibility?: string;
  };
  Relationships: [];
};

type PartnershipAttributions = {
  Row: {
    first_attributed_at: string;
    id: string;
    last_attributed_at: string;
    partner_id: string;
    session_id: string | null;
    source: string;
    user_id: string;
  };
  Insert: {
    first_attributed_at?: string;
    id?: string;
    last_attributed_at?: string;
    partner_id: string;
    session_id?: string | null;
    source?: string;
    user_id: string;
  };
  Update: {
    first_attributed_at?: string;
    id?: string;
    last_attributed_at?: string;
    partner_id?: string;
    session_id?: string | null;
    source?: string;
    user_id?: string;
  };
  Relationships: [
    {
      foreignKeyName: "partnership_attributions_partner_id_fkey";
      columns: ["partner_id"];
      isOneToOne: false;
      referencedRelation: "partnerships";
      referencedColumns: ["id"];
    },
  ];
};

type PartnershipConversionEvents = {
  Row: {
    created_at: string;
    entity_id: string | null;
    entity_type: string | null;
    event_type: string;
    id: string;
    metadata: Json;
    partner_id: string;
    residence_id: string | null;
    user_id: string | null;
    value: number | null;
  };
  Insert: {
    created_at?: string;
    entity_id?: string | null;
    entity_type?: string | null;
    event_type: string;
    id?: string;
    metadata?: Json;
    partner_id: string;
    residence_id?: string | null;
    user_id?: string | null;
    value?: number | null;
  };
  Update: {
    created_at?: string;
    entity_id?: string | null;
    entity_type?: string | null;
    event_type?: string;
    id?: string;
    metadata?: Json;
    partner_id?: string;
    residence_id?: string | null;
    user_id?: string | null;
    value?: number | null;
  };
  Relationships: [
    {
      foreignKeyName: "partnership_conversion_events_partner_id_fkey";
      columns: ["partner_id"];
      isOneToOne: false;
      referencedRelation: "partnerships";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "partnership_conversion_events_residence_id_fkey";
      columns: ["residence_id"];
      isOneToOne: false;
      referencedRelation: "residences";
      referencedColumns: ["id"];
    },
  ];
};

type ResidencePortalApplicationsSafe = {
  Row: {
    applicant_name: string | null;
    application_date: string | null;
    campus: string | null;
    course: string | null;
    created_at: string | null;
    funding_type: string | null;
    id: string | null;
    institution_type: string | null;
    move_in_date: string | null;
    moved_in: boolean | null;
    notes: string | null;
    residence_id: string | null;
    status: string | null;
    student_number: string | null;
    updated_at: string | null;
    user_id: string | null;
  };
  Relationships: [];
};

type ResidencePortalLeadsSafe = {
  Row: {
    academic_year: number | null;
    admin_notes: string | null;
    contact_name: string | null;
    created_at: string | null;
    funding_type: string | null;
    id: string | null;
    last_contacted_at: string | null;
    next_follow_up_at: string | null;
    residence_id: string | null;
    room_preference: string | null;
    source_id: string | null;
    source_type: string | null;
    stage: string | null;
    updated_at: string | null;
    user_id: string | null;
  };
  Relationships: [];
};

type RoommateProfilesPublic = {
  Row: {
    campus: string | null;
    course: string | null;
    full_name: string | null;
    id: string | null;
    lifestyle_preferences: Json | null;
    looking_for_roommate: boolean | null;
    profile_picture_url: string | null;
    updated_at: string | null;
    year_of_study: string | null;
  };
  Relationships: [];
};

export type Database = Omit<LegacyDatabase, "__InternalSupabase" | "public"> & {
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  public: Omit<LegacyPublic, "Tables" | "Views" | "Functions"> & {
    Tables: Omit<
      LegacyTables,
      | "residences"
      | "residence_room_types"
      | "residence_profile_change_log"
      | "partnerships"
      | "partnership_attributions"
      | "partnership_conversion_events"
    > & {
      residences: {
        Row: ResidenceRow;
        Insert: ResidenceInsert;
        Update: ResidenceUpdate;
        Relationships: LegacyTables["residences"]["Relationships"];
      };
      residence_room_types: {
        Row: ResidenceRoomTypesRow;
        Insert: ResidenceRoomTypesInsert;
        Update: ResidenceRoomTypesUpdate;
        Relationships: LegacyTables["residence_room_types"]["Relationships"];
      };
      residence_profile_change_log: ResidenceProfileChangeLog;
      partnerships: Partnerships;
      partnership_attributions: PartnershipAttributions;
      partnership_conversion_events: PartnershipConversionEvents;
    };
    Views: Omit<
      LegacyViews,
      "residence_portal_applications_safe" | "residence_portal_leads_safe" | "roommate_profiles_public_v"
    > & {
      residence_portal_applications_safe: ResidencePortalApplicationsSafe;
      residence_portal_leads_safe: ResidencePortalLeadsSafe;
      roommate_profiles_public_v: RoommateProfilesPublic;
    };
    Functions: Omit<
      LegacyFunctions,
      | "refresh_residence_data_quality"
      | "residence_portal_update_lead"
      | "residence_portal_update_profile"
      | "attribute_partnership"
      | "admin_partnership_command_center"
    > & {
      refresh_residence_data_quality: {
        Args: { p_residence_id: string };
        Returns: Json;
      };
      residence_portal_update_lead: {
        Args: { p_lead_id: string; p_patch: Json };
        Returns: ResidencePortalLeadsSafe["Row"];
      };
      residence_portal_update_profile: {
        Args: { p_patch: Json; p_residence_id: string };
        Returns: Json;
      };
      attribute_partnership: {
        Args: {
          p_partner_slug: string;
          p_session_id?: string;
          p_source?: string;
        };
        Returns: boolean;
      };
      admin_partnership_command_center: {
        Args: { p_days?: number };
        Returns: Json;
      };
    };
  };
};

export type Tables<
  TableName extends keyof (Database["public"]["Tables"] & Database["public"]["Views"]),
> = (Database["public"]["Tables"] & Database["public"]["Views"])[TableName] extends {
  Row: infer R;
}
  ? R
  : never;

export type TablesInsert<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName] extends { Insert: infer I } ? I : never;

export type TablesUpdate<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName] extends { Update: infer U } ? U : never;
