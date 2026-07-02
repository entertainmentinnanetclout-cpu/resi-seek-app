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
      application_activity_log: {
        Row: {
          action_type: string
          actor_type: string
          actor_user_id: string | null
          application_id: string
          created_at: string
          id: string
          metadata: Json
          residence_id: string
        }
        Insert: {
          action_type: string
          actor_type: string
          actor_user_id?: string | null
          application_id: string
          created_at?: string
          id?: string
          metadata?: Json
          residence_id: string
        }
        Update: {
          action_type?: string
          actor_type?: string
          actor_user_id?: string | null
          application_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          residence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_activity_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_activity_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "residence_handover_export_v"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_activity_log_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activity_log_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activity_log_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "residence_handover_export_v"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "fk_activity_log_residence"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
        ]
      }
      application_documents: {
        Row: {
          application_id: string
          doc_type: string
          file_path: string
          id: string
          original_filename: string | null
          rejection_reason: string | null
          residence_id: string
          status: string
          uploaded_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_id: string
          doc_type: string
          file_path: string
          id?: string
          original_filename?: string | null
          rejection_reason?: string | null
          residence_id: string
          status?: string
          uploaded_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_id?: string
          doc_type?: string
          file_path?: string
          id?: string
          original_filename?: string | null
          rejection_reason?: string | null
          residence_id?: string
          status?: string
          uploaded_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "residence_handover_export_v"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_documents_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_app_docs_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_app_docs_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "residence_handover_export_v"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "fk_app_docs_residence"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
        ]
      }
      application_messages: {
        Row: {
          application_id: string
          created_at: string
          id: string
          message: string
          residence_id: string
          sender_type: string
          sender_user_id: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          message: string
          residence_id: string
          sender_type: string
          sender_user_id?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          message?: string
          residence_id?: string
          sender_type?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "residence_handover_export_v"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_messages_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_app_messages_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_app_messages_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "residence_handover_export_v"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "fk_app_messages_residence"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
        ]
      }
      application_prep: {
        Row: {
          checklist: Json
          created_at: string
          id: string
          institution: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist?: Json
          created_at?: string
          id?: string
          institution: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist?: Json
          created_at?: string
          id?: string
          institution?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          application_date: string
          application_term: string | null
          application_year: number | null
          created_at: string
          desired_move_in: string | null
          funding_type: string
          id: string
          last_contacted_at: string | null
          move_in_confirmed: boolean | null
          move_in_date: string | null
          moved_in: boolean | null
          notes: string | null
          residence_id: string
          status: string
          student_profile: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_date?: string
          application_term?: string | null
          application_year?: number | null
          created_at?: string
          desired_move_in?: string | null
          funding_type?: string
          id?: string
          last_contacted_at?: string | null
          move_in_confirmed?: boolean | null
          move_in_date?: string | null
          moved_in?: boolean | null
          notes?: string | null
          residence_id: string
          status?: string
          student_profile?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_date?: string
          application_term?: string | null
          application_year?: number | null
          created_at?: string
          desired_move_in?: string | null
          funding_type?: string
          id?: string
          last_contacted_at?: string | null
          move_in_confirmed?: boolean | null
          move_in_date?: string | null
          moved_in?: boolean | null
          notes?: string | null
          residence_id?: string
          status?: string
          student_profile?: Json | null
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
          {
            foreignKeyName: "fk_applications_residence"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_applications_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_applications_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "fk_call_logs_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_call_logs_student"
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
      cart: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_cart_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cart_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string | null
          hamper_id: string | null
          hamper_item_id: string | null
          id: string
          image_snapshot: string | null
          item_type: string
          product_id: string | null
          quantity: number | null
          title_snapshot: string | null
          unit_price: number | null
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string | null
          hamper_id?: string | null
          hamper_item_id?: string | null
          id?: string
          image_snapshot?: string | null
          item_type?: string
          product_id?: string | null
          quantity?: number | null
          title_snapshot?: string | null
          unit_price?: number | null
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string | null
          hamper_id?: string | null
          hamper_item_id?: string | null
          id?: string
          image_snapshot?: string | null
          item_type?: string
          product_id?: string | null
          quantity?: number | null
          title_snapshot?: string | null
          unit_price?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cart_items_cart"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cart_items_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cart_items_variant"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          base_fee: number
          conditions: string | null
          created_at: string
          description: string | null
          display_order: number
          free_threshold: number | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          base_fee?: number
          conditions?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          free_threshold?: number | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          base_fee?: number
          conditions?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          free_threshold?: number | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      discount_orders: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          delivery_address: string | null
          discount_id: string
          id: string
          notes: string | null
          phone: string | null
          quantity: number
          status: string
          total_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          delivery_address?: string | null
          discount_id: string
          id?: string
          notes?: string | null
          phone?: string | null
          quantity?: number
          status?: string
          total_price: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          delivery_address?: string | null
          discount_id?: string
          id?: string
          notes?: string | null
          phone?: string | null
          quantity?: number
          status?: string
          total_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_orders_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "student_discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_discount_orders_discount"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "student_discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_discount_orders_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_discount_orders_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "fk_documents_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_documents_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      eft_payments: {
        Row: {
          admin_note: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          device_info: Json | null
          expected_amount: number
          expires_at: string
          fingerprint: string
          honeypot_triggered: boolean | null
          id: string
          order_id: string
          payment_reference: string
          pop_file_hash: string | null
          pop_image_url: string | null
          pop_uploaded_at: string | null
          risk_score: number | null
          status: string
          unique_cents: number
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          device_info?: Json | null
          expected_amount: number
          expires_at: string
          fingerprint: string
          honeypot_triggered?: boolean | null
          id?: string
          order_id: string
          payment_reference: string
          pop_file_hash?: string | null
          pop_image_url?: string | null
          pop_uploaded_at?: string | null
          risk_score?: number | null
          status?: string
          unique_cents?: number
          user_id: string
        }
        Update: {
          admin_note?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          device_info?: Json | null
          expected_amount?: number
          expires_at?: string
          fingerprint?: string
          honeypot_triggered?: boolean | null
          id?: string
          order_id?: string
          payment_reference?: string
          pop_file_hash?: string | null
          pop_image_url?: string | null
          pop_uploaded_at?: string | null
          risk_score?: number | null
          status?: string
          unique_cents?: number
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
          {
            foreignKeyName: "fk_favorites_residence"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_favorites_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_favorites_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_config: {
        Row: {
          control_type: string
          created_at: string
          display_order: number
          filter_group: string
          id: string
          is_featured: boolean
          is_multiselect: boolean
          is_visible: boolean
          key: string
          label: string
          options: Json | null
          updated_at: string
        }
        Insert: {
          control_type?: string
          created_at?: string
          display_order?: number
          filter_group?: string
          id?: string
          is_featured?: boolean
          is_multiselect?: boolean
          is_visible?: boolean
          key: string
          label: string
          options?: Json | null
          updated_at?: string
        }
        Update: {
          control_type?: string
          created_at?: string
          display_order?: number
          filter_group?: string
          id?: string
          is_featured?: boolean
          is_multiselect?: boolean
          is_visible?: boolean
          key?: string
          label?: string
          options?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      hamper_bundle_items: {
        Row: {
          created_at: string | null
          hamper_id: string
          id: string
          item_name: string
          quantity: number | null
        }
        Insert: {
          created_at?: string | null
          hamper_id: string
          id?: string
          item_name: string
          quantity?: number | null
        }
        Update: {
          created_at?: string | null
          hamper_id?: string
          id?: string
          item_name?: string
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hamper_bundle_items_hamper"
            columns: ["hamper_id"]
            isOneToOne: false
            referencedRelation: "hampers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hamper_bundle_items_hamper_id_fkey"
            columns: ["hamper_id"]
            isOneToOne: false
            referencedRelation: "hampers"
            referencedColumns: ["id"]
          },
        ]
      }
      hamper_items: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          estimated_price: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_orderable: boolean
          name: string
          price: number | null
          stock_quantity: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          estimated_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_orderable?: boolean
          name: string
          price?: number | null
          stock_quantity?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          estimated_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_orderable?: boolean
          name?: string
          price?: number | null
          stock_quantity?: number | null
        }
        Relationships: []
      }
      hamper_order_items: {
        Row: {
          created_at: string | null
          hamper_id: string
          id: string
          order_id: string
          price: number
          quantity: number | null
        }
        Insert: {
          created_at?: string | null
          hamper_id: string
          id?: string
          order_id: string
          price: number
          quantity?: number | null
        }
        Update: {
          created_at?: string | null
          hamper_id?: string
          id?: string
          order_id?: string
          price?: number
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hamper_order_items_hamper"
            columns: ["hamper_id"]
            isOneToOne: false
            referencedRelation: "hampers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hamper_order_items_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "hamper_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hamper_order_items_hamper_id_fkey"
            columns: ["hamper_id"]
            isOneToOne: false
            referencedRelation: "hampers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hamper_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "hamper_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      hamper_orders: {
        Row: {
          created_at: string | null
          delivery_address: string | null
          delivery_phone: string | null
          id: string
          order_number: string
          payment_method: string | null
          payment_status: string | null
          status: string | null
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_address?: string | null
          delivery_phone?: string | null
          id?: string
          order_number: string
          payment_method?: string | null
          payment_status?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          delivery_address?: string | null
          delivery_phone?: string | null
          id?: string
          order_number?: string
          payment_method?: string | null
          payment_status?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_hamper_orders_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hamper_orders_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hampers: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      health_status: {
        Row: {
          details: Json | null
          id: string
          last_checked_at: string
          last_success_at: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          details?: Json | null
          id?: string
          last_checked_at?: string
          last_success_at?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          details?: Json | null
          id?: string
          last_checked_at?: string
          last_success_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          slide_location: string
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
          slide_location?: string
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
          slide_location?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      landlord_application_documents: {
        Row: {
          application_id: string
          doc_type: string
          file_path: string
          id: string
          original_filename: string | null
          status: string
          uploaded_at: string
        }
        Insert: {
          application_id: string
          doc_type: string
          file_path: string
          id?: string
          original_filename?: string | null
          status?: string
          uploaded_at?: string
        }
        Update: {
          application_id?: string
          doc_type?: string
          file_path?: string
          id?: string
          original_filename?: string | null
          status?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landlord_application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "landlord_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_applications: {
        Row: {
          address: string | null
          admin_notes: string | null
          amenities: string[] | null
          application_type: string
          business_name: string | null
          campus: string | null
          capacity: number | null
          city: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          monthly_rent: number | null
          notes: string | null
          phone: string
          province: string | null
          residence_name: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          amenities?: string[] | null
          application_type?: string
          business_name?: string | null
          campus?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          monthly_rent?: number | null
          notes?: string | null
          phone: string
          province?: string | null
          residence_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          amenities?: string[] | null
          application_type?: string
          business_name?: string | null
          campus?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          monthly_rent?: number | null
          notes?: string | null
          phone?: string
          province?: string | null
          residence_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
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
            foreignKeyName: "fk_marketplace_listings_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_marketplace_listings_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_marketplace_listings_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "fk_marketplace_orders_buyer"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_marketplace_orders_buyer"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_marketplace_orders_listing"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_marketplace_orders_seller"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_marketplace_orders_seller"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "fk_notifications_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_notifications_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          created_at: string | null
          id: string
          note: string | null
          order_id: string
          status: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_status_history_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_action_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string | null
          eft_payment_id: string | null
          id: string
          metadata: Json | null
          order_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string | null
          eft_payment_id?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          eft_payment_id?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
        }
        Relationships: []
      }
      payment_rate_limits: {
        Row: {
          action_type: string
          attempt_count: number | null
          created_at: string | null
          id: string
          user_id: string
          window_start: string | null
        }
        Insert: {
          action_type: string
          attempt_count?: number | null
          created_at?: string | null
          id?: string
          user_id: string
          window_start?: string | null
        }
        Update: {
          action_type?: string
          attempt_count?: number | null
          created_at?: string | null
          id?: string
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          order_id: string
          payment_gateway: string | null
          payment_method: string
          payment_status: string | null
          transaction_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          order_id: string
          payment_gateway?: string | null
          payment_method: string
          payment_status?: string | null
          transaction_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          order_id?: string
          payment_gateway?: string | null
          payment_method?: string
          payment_status?: string | null
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_payments_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
        ]
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
      product_categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string | null
          id: string
          price: number
          product_id: string
          sku: string | null
          stock_quantity: number | null
          variant_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          price: number
          product_id: string
          sku?: string | null
          stock_quantity?: number | null
          variant_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          price?: number
          product_id?: string
          sku?: string | null
          stock_quantity?: number | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_variants_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          compare_at_price: number | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          is_landing_featured: boolean | null
          name: string
          price: number
          sku: string | null
          stock_quantity: number | null
          store_id: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_landing_featured?: boolean | null
          name: string
          price: number
          sku?: string | null
          stock_quantity?: number | null
          store_id: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_landing_featured?: boolean | null
          name?: string
          price?: number
          sku?: string | null
          stock_quantity?: number | null
          store_id?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_products_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_claims: {
        Row: {
          academic_year: number
          application_id: string
          claim_amount: number | null
          claim_status: string
          created_at: string
          funding_type: string
          id: string
          paid_at: string | null
          residence_id: string
          student_ref: string | null
        }
        Insert: {
          academic_year?: number
          application_id: string
          claim_amount?: number | null
          claim_status?: string
          created_at?: string
          funding_type: string
          id?: string
          paid_at?: string | null
          residence_id: string
          student_ref?: string | null
        }
        Update: {
          academic_year?: number
          application_id?: string
          claim_amount?: number | null
          claim_status?: string
          created_at?: string
          funding_type?: string
          id?: string
          paid_at?: string | null
          residence_id?: string
          student_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_referral_claims_application"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_referral_claims_application"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "residence_handover_export_v"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "fk_referral_claims_residence"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_claims_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_claims_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "residence_handover_export_v"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "referral_claims_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          sale_count: number
          signup_count: number
          total_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          sale_count?: number
          signup_count?: number
          total_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sale_count?: number
          signup_count?: number
          total_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_earnings: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string | null
          referred_user_id: string | null
          referrer_user_id: string
          source_type: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          referred_user_id?: string | null
          referrer_user_id: string
          source_type: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          referred_user_id?: string | null
          referrer_user_id?: string
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "fk_residence_analytics_residence"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_residence_analytics_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_residence_analytics_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      residence_portal_accounts: {
        Row: {
          created_at: string
          email: string
          is_active: boolean
          residence_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          is_active?: boolean
          residence_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          is_active?: boolean
          residence_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_portal_accounts_residence"
            columns: ["residence_id"]
            isOneToOne: true
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residence_portal_accounts_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: true
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
        ]
      }
      residence_sections: {
        Row: {
          applies_to: string | null
          color: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          subtitle: string | null
        }
        Insert: {
          applies_to?: string | null
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          subtitle?: string | null
        }
        Update: {
          applies_to?: string | null
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          subtitle?: string | null
        }
        Relationships: []
      }
      residences: {
        Row: {
          accepts_nsfas: boolean
          accepts_private: boolean
          accepts_tvet: boolean
          accepts_university: boolean
          address: string
          amenities: string[] | null
          application_count: number | null
          available_spots: number
          campus: string | null
          capacity: number
          category: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          deposit_amount: number | null
          description: string | null
          display_order: number | null
          distance_from_campus: number | null
          featured: boolean | null
          featured_rank: number | null
          gender: string | null
          has_parking: boolean | null
          has_wifi: boolean | null
          id: string
          image_url: string | null
          images: string[] | null
          institution_tags: string[]
          is_featured: boolean | null
          is_furnished: boolean | null
          is_trusted: boolean | null
          is_tut_accredited: boolean | null
          lease_period: string | null
          name: string
          price: number
          province: string | null
          quality_grade: string | null
          room_type: string | null
          room_types: string[] | null
          section_category: string | null
          singles_available: number | null
          slug: string | null
          updated_at: string
          utilities_included: boolean | null
          verification_level: string | null
          view_count: number | null
          virtual_tour_provider: string | null
          virtual_tour_url: string | null
        }
        Insert: {
          accepts_nsfas?: boolean
          accepts_private?: boolean
          accepts_tvet?: boolean
          accepts_university?: boolean
          address: string
          amenities?: string[] | null
          application_count?: number | null
          available_spots?: number
          campus?: string | null
          capacity?: number
          category?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          display_order?: number | null
          distance_from_campus?: number | null
          featured?: boolean | null
          featured_rank?: number | null
          gender?: string | null
          has_parking?: boolean | null
          has_wifi?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          institution_tags?: string[]
          is_featured?: boolean | null
          is_furnished?: boolean | null
          is_trusted?: boolean | null
          is_tut_accredited?: boolean | null
          lease_period?: string | null
          name: string
          price: number
          province?: string | null
          quality_grade?: string | null
          room_type?: string | null
          room_types?: string[] | null
          section_category?: string | null
          singles_available?: number | null
          slug?: string | null
          updated_at?: string
          utilities_included?: boolean | null
          verification_level?: string | null
          view_count?: number | null
          virtual_tour_provider?: string | null
          virtual_tour_url?: string | null
        }
        Update: {
          accepts_nsfas?: boolean
          accepts_private?: boolean
          accepts_tvet?: boolean
          accepts_university?: boolean
          address?: string
          amenities?: string[] | null
          application_count?: number | null
          available_spots?: number
          campus?: string | null
          capacity?: number
          category?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deposit_amount?: number | null
          description?: string | null
          display_order?: number | null
          distance_from_campus?: number | null
          featured?: boolean | null
          featured_rank?: number | null
          gender?: string | null
          has_parking?: boolean | null
          has_wifi?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          institution_tags?: string[]
          is_featured?: boolean | null
          is_furnished?: boolean | null
          is_trusted?: boolean | null
          is_tut_accredited?: boolean | null
          lease_period?: string | null
          name?: string
          price?: number
          province?: string | null
          quality_grade?: string | null
          room_type?: string | null
          room_types?: string[] | null
          section_category?: string | null
          singles_available?: number | null
          slug?: string | null
          updated_at?: string
          utilities_included?: boolean | null
          verification_level?: string | null
          view_count?: number | null
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
            foreignKeyName: "fk_reviews_residence"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_reviews_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_reviews_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      shop_order_items: {
        Row: {
          created_at: string | null
          hamper_id: string | null
          hamper_item_id: string | null
          id: string
          image_snapshot: string | null
          item_type: string
          order_id: string
          price: number
          product_id: string | null
          quantity: number
          store_id: string | null
          title_snapshot: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          hamper_id?: string | null
          hamper_item_id?: string | null
          id?: string
          image_snapshot?: string | null
          item_type?: string
          order_id: string
          price: number
          product_id?: string | null
          quantity?: number
          store_id?: string | null
          title_snapshot?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          hamper_id?: string | null
          hamper_item_id?: string | null
          id?: string
          image_snapshot?: string | null
          item_type?: string
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          store_id?: string | null
          title_snapshot?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_shop_order_items_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shop_order_items_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shop_order_items_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shop_order_items_variant"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          created_at: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_phone: string | null
          delivery_zone_id: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: string | null
          pop_uploaded_at: string | null
          pop_url: string | null
          referral_code: string | null
          referral_credited: boolean | null
          status: string
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_phone?: string | null
          delivery_zone_id?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: string | null
          pop_uploaded_at?: string | null
          pop_url?: string | null
          referral_code?: string | null
          referral_credited?: boolean | null
          status?: string
          total_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_phone?: string | null
          delivery_zone_id?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string | null
          pop_uploaded_at?: string | null
          pop_url?: string | null
          referral_code?: string | null
          referral_credited?: boolean | null
          status?: string
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shop_orders_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shop_orders_user"
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
            foreignKeyName: "fk_store_reviews_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
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
          delivery_info: string | null
          description: string | null
          discount: string
          how_to_claim: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_orderable: boolean | null
          is_verified: boolean
          link: string | null
          name: string
          original_price: number | null
          price: number | null
          provider: string
          stock_quantity: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          category: string
          created_at?: string
          delivery_info?: string | null
          description?: string | null
          discount: string
          how_to_claim?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_orderable?: boolean | null
          is_verified?: boolean
          link?: string | null
          name: string
          original_price?: number | null
          price?: number | null
          provider: string
          stock_quantity?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          delivery_info?: string | null
          description?: string | null
          discount?: string
          how_to_claim?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_orderable?: boolean | null
          is_verified?: boolean
          link?: string | null
          name?: string
          original_price?: number | null
          price?: number | null
          provider?: string
          stock_quantity?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      student_hamper_preferences: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          preference: string
          priority: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          preference?: string
          priority?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          preference?: string
          priority?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_hamper_prefs_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "hamper_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hamper_prefs_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_hamper_prefs_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_hamper_preferences_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "hamper_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          attempts: number
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          last_error: string | null
          op: string
          payload: Json | null
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          last_error?: string | null
          op: string
          payload?: Json | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          last_error?: string | null
          op?: string
          payload?: Json | null
          sent_at?: string | null
          status?: string
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
      whatsapp_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          template_key: string
          template_name: string
          template_text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_key: string
          template_name: string
          template_text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_key?: string
          template_name?: string
          template_text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      wil_admin_notes: {
        Row: {
          admin_id: string
          application_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          admin_id: string
          application_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          admin_id?: string
          application_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_wil_notes_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "wil_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wil_admin_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "wil_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      wil_applications: {
        Row: {
          campus: string
          course: string
          created_at: string
          full_name: string
          funding_status: string
          id: string
          notes: string | null
          preferred_area: string | null
          status: string
          student_id: string
          student_number: string
          updated_at: string
          wil_duration: string
          year_level: number
        }
        Insert: {
          campus: string
          course: string
          created_at?: string
          full_name: string
          funding_status: string
          id?: string
          notes?: string | null
          preferred_area?: string | null
          status?: string
          student_id: string
          student_number: string
          updated_at?: string
          wil_duration: string
          year_level: number
        }
        Update: {
          campus?: string
          course?: string
          created_at?: string
          full_name?: string
          funding_status?: string
          id?: string
          notes?: string | null
          preferred_area?: string | null
          status?: string
          student_id?: string
          student_number?: string
          updated_at?: string
          wil_duration?: string
          year_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_wil_applications_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wil_applications_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wil_apps_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wil_apps_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wil_assignments: {
        Row: {
          application_id: string
          assigned_at: string
          assigned_by: string
          assigned_to: string
          id: string
        }
        Insert: {
          application_id: string
          assigned_at?: string
          assigned_by: string
          assigned_to: string
          id?: string
        }
        Update: {
          application_id?: string
          assigned_at?: string
          assigned_by?: string
          assigned_to?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_wil_assign_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "wil_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wil_assignments_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "wil_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wil_assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "wil_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      wil_documents: {
        Row: {
          application_id: string
          doc_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          student_id: string
          uploaded_at: string
        }
        Insert: {
          application_id: string
          doc_type: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          student_id: string
          uploaded_at?: string
        }
        Update: {
          application_id?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          student_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_wil_docs_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "wil_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wil_documents_application"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "wil_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wil_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "wil_applications"
            referencedColumns: ["id"]
          },
        ]
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
      residence_handover_export_v: {
        Row: {
          application_date: string | null
          application_id: string | null
          campus: string | null
          created_at: string | null
          email: string | null
          funding_source: string | null
          move_in_date: string | null
          moved_in: boolean | null
          phone: string | null
          ref_code: string | null
          residence_id: string | null
          residence_name: string | null
          status: string | null
          student_name: string | null
          student_number: string | null
          student_surname: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_residence_id_fkey"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_applications_residence"
            columns: ["residence_id"]
            isOneToOne: false
            referencedRelation: "residences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_applications_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "marketplace_seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_applications_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      capture_referral: {
        Args: { _code: string; _referred: string }
        Returns: undefined
      }
      capture_referral_sale: { Args: { _order_id: string }; Returns: undefined }
      generate_ref_code: { Args: { app_id: string }; Returns: string }
      get_or_create_referral_code: {
        Args: never
        Returns: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          sale_count: number
          signup_count: number
          total_earned: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_codes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_residence_id: { Args: never; Returns: string }
      get_user_staff_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authorized_residence_user: {
        Args: { target_residence_id: string }
        Returns: boolean
      }
      validate_handover_pack: {
        Args: { _residence_id?: string }
        Returns: Json
      }
      validate_referral_code: { Args: { _code: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "student"
        | "residence_portal"
        | "operations_lead"
        | "commerce_lead"
        | "growth_lead"
        | "system_operator"
        | "support_agent"
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
      app_role: [
        "admin",
        "student",
        "residence_portal",
        "operations_lead",
        "commerce_lead",
        "growth_lead",
        "system_operator",
        "support_agent",
      ],
    },
  },
} as const
