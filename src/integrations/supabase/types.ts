export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          application_date: string
          created_at: string
          id: string
          last_contacted_at: string | null
          move_in_confirmed: boolean | null
          move_in_date: string | null
          moved_in: boolean | null
          notes: string | null
          residence_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_date?: string
          created_at?: string
          id?: string
          last_contacted_at?: string | null
          move_in_confirmed?: boolean | null
          move_in_date?: string | null
          moved_in?: boolean | null
          notes?: string | null
          residence_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_date?: string
          created_at?: string
          id?: string
          last_contacted_at?: string | null
          move_in_confirmed?: boolean | null
          move_in_date?: string | null
          moved_in?: boolean | null
          notes?: string | null
          residence_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
        ]
      }
      bursaries: {
        Row: {
          amount: string | null
          created_at: string
          deadline: string | null
          description: string | null
          fields_of_study: string[] | null
          id: string
          image_url: string | null
          is_active: boolean
          link: string | null
          name: string
          provider: string
          requirements: string[] | null
          slug: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          fields_of_study?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          name: string
          provider: string
          requirements?: string[] | null
          slug?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          fields_of_study?: string[] | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          name?: string
          provider?: string
          requirements?: string[] | null
          slug?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          admin_id: string
          call_type: string
          created_at: string | null
          follow_up_date: string | null
          id: string
          notes: string | null
          outcome: string | null
          student_id: string
        }
        Insert: {
          admin_id: string
          call_type?: string
          created_at?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          student_id: string
        }
        Update: {
          admin_id?: string
          call_type?: string
          created_at?: string | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_news: {
        Row: {
          author: string | null
          category: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          category?: string
          content: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          campus: string | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          image_url: string | null
          interested_count: number | null
          location: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          campus?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date: string
          id?: string
          image_url?: string | null
          interested_count?: number | null
          location?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          campus?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          image_url?: string | null
          interested_count?: number | null
          location?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          residence_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          residence_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          residence_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_slides: {
        Row: {
          created_at: string
          cta_link: string | null
          cta_text: string | null
          description: string | null
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_listings: {
        Row: {
          category: string
          condition: string
          created_at: string
          description: string
          id: string
          images: string[]
          item_name: string
          price: number
          status: string
          store_id: string | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          category: string
          condition: string
          created_at?: string
          description: string
          id?: string
          images?: string[]
          item_name: string
          price: number
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          category?: string
          condition?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          item_name?: string
          price?: number
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          buyer_id: string
          buyer_notes: string | null
          buyer_phone: string | null
          created_at: string | null
          delivery_address: string | null
          id: string
          listing_id: string
          quantity: number | null
          seller_id: string
          status: string
          total_price: number
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          buyer_notes?: string | null
          buyer_phone?: string | null
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          listing_id: string
          quantity?: number | null
          seller_id: string
          status?: string
          total_price: number
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          buyer_notes?: string | null
          buyer_phone?: string | null
          created_at?: string | null
          delivery_address?: string | null
          id?: string
          listing_id?: string
          quantity?: number | null
          seller_id?: string
          status?: string
          total_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          campus: string | null
          course: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          lifestyle_preferences: Json | null
          looking_for_roommate: boolean | null
          phone: string | null
          profile_picture_url: string | null
          student_number: string | null
          updated_at: string
          year_of_study: string | null
        }
        Insert: {
          campus?: string | null
          course?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          lifestyle_preferences?: Json | null
          looking_for_roommate?: boolean | null
          phone?: string | null
          profile_picture_url?: string | null
          student_number?: string | null
          updated_at?: string
          year_of_study?: string | null
        }
        Update: {
          campus?: string | null
          course?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          lifestyle_preferences?: Json | null
          looking_for_roommate?: boolean | null
          phone?: string | null
          profile_picture_url?: string | null
          student_number?: string | null
          updated_at?: string
          year_of_study?: string | null
        }
        Relationships: []
      }
      residence_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          residence_id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          residence_id: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          residence_id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residence_analytics_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residence_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residence_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      residences: {
        Row: {
          address: string
          amenities: string[] | null
          available_spots: number
          campus: string | null
          capacity: number
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          display_order: number | null
          distance_from_campus: number | null
          featured: boolean | null
          id: string
          image_url: string | null
          images: string[] | null
          is_trusted: boolean | null
          name: string
          price: number
          province: string | null
          quality_grade: string | null
          room_type: string | null
          room_types: string[] | null
          updated_at: string
          verification_level: string | null
          virtual_tour_provider: string | null
          virtual_tour_url: string | null
        }
        Insert: {
          address: string
          amenities?: string[] | null
          available_spots?: number
          campus?: string | null
          capacity?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          distance_from_campus?: number | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_trusted?: boolean | null
          name: string
          price: number
          province?: string | null
          quality_grade?: string | null
          room_type?: string | null
          room_types?: string[] | null
          updated_at?: string
          verification_level?: string | null
          virtual_tour_provider?: string | null
          virtual_tour_url?: string | null
        }
        Update: {
          address?: string
          amenities?: string[] | null
          available_spots?: number
          campus?: string | null
          capacity?: number
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          distance_from_campus?: number | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_trusted?: boolean | null
          name?: string
          price?: number
          province?: string | null
          quality_grade?: string | null
          room_type?: string | null
          room_types?: string[] | null
          updated_at?: string
          verification_level?: string | null
          virtual_tour_provider?: string | null
          virtual_tour_url?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          cons: string[] | null
          content: string | null
          created_at: string
          helpful_count: number | null
          id: string
          pros: string[] | null
          rating: number
          residence_id: string
          title: string
          updated_at: string
          user_id: string
          verified_stay: boolean | null
        }
        Insert: {
          cons?: string[] | null
          content?: string | null
          created_at?: string
          helpful_count?: number | null
          id?: string
          pros?: string[] | null
          rating: number
          residence_id: string
          title: string
          updated_at?: string
          user_id: string
          verified_stay?: boolean | null
        }
        Update: {
          cons?: string[] | null
          content?: string | null
          created_at?: string
          helpful_count?: number | null
          id?: string
          pros?: string[] | null
          rating?: number
          residence_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          verified_stay?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          rating: number
          reviewer_id: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
          reviewer_id: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          reviewer_id?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          campus: string | null
          contact_email: string | null
          contact_whatsapp: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          rating: number | null
          store_banner_url: string | null
          store_description: string | null
          store_logo_url: string | null
          store_name: string
          total_sales: number | null
          updated_at: string | null
          user_id: string
          verified: boolean | null
        }
        Insert: {
          campus?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rating?: number | null
          store_banner_url?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name: string
          total_sales?: number | null
          updated_at?: string | null
          user_id: string
          verified?: boolean | null
        }
        Update: {
          campus?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rating?: number | null
          store_banner_url?: string | null
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string
          total_sales?: number | null
          updated_at?: string | null
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      student_discounts: {
        Row: {
          category: string
          created_at: string
          description: string | null
          discount: string
          how_to_claim: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_verified: boolean
          link: string | null
          name: string
          provider: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          discount: string
          how_to_claim?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_verified?: boolean
          link?: string | null
          name: string
          provider: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          discount?: string
          how_to_claim?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_verified?: boolean
          link?: string | null
          name?: string
          provider?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      marketplace_seller_profiles: {
        Row: {
          full_name: string | null
          id: string | null
          profile_picture_url: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
          profile_picture_url?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
          profile_picture_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
    },
  },
} as const
