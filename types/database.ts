export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    PostgrestVersion: "12";
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "practitioner" | "patient" | "admin";
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          avatar_url: string | null;
          suspended: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          role: "practitioner" | "patient" | "admin";
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          suspended?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: "practitioner" | "patient" | "admin";
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          suspended?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      practitioners: {
        Row: {
          id: string;
          profile_id: string;
          practice_name: string | null;
          discipline: string | null;
          registration_body: string | null;
          registration_number: string | null;
          years_of_practice: string | null;
          bio: string | null;
          verification_status: "pending" | "verified" | "rejected";
          booking_slug: string | null;
          session_length_mins: number;
          buffer_mins: number;
          allows_self_booking: boolean;
          initial_fee: number | null;
          followup_fee: number | null;
          cancellation_hours: number;
          is_live: boolean;
          stripe_account_id: string | null;
          notification_preferences: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          practice_name?: string | null;
          discipline?: string | null;
          registration_body?: string | null;
          registration_number?: string | null;
          years_of_practice?: string | null;
          bio?: string | null;
          verification_status?: "pending" | "verified" | "rejected";
          booking_slug?: string | null;
          session_length_mins?: number;
          buffer_mins?: number;
          allows_self_booking?: boolean;
          initial_fee?: number | null;
          followup_fee?: number | null;
          cancellation_hours?: number;
          is_live?: boolean;
          stripe_account_id?: string | null;
          notification_preferences?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          practice_name?: string | null;
          discipline?: string | null;
          registration_body?: string | null;
          registration_number?: string | null;
          years_of_practice?: string | null;
          bio?: string | null;
          verification_status?: "pending" | "verified" | "rejected";
          booking_slug?: string | null;
          session_length_mins?: number;
          buffer_mins?: number;
          allows_self_booking?: boolean;
          initial_fee?: number | null;
          followup_fee?: number | null;
          cancellation_hours?: number;
          is_live?: boolean;
          stripe_account_id?: string | null;
          notification_preferences?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      availability: {
        Row: {
          id: string;
          practitioner_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          practitioner_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          practitioner_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          profile_id: string;
          practitioner_id: string | null;
          date_of_birth: string | null;
          current_health: string | null;
          diagnosed_conditions: string | null;
          medications: string | null;
          allergies: string | null;
          goals: string[] | null;
          success_vision: string | null;
          motivation_level: "exploring" | "ready" | "all_in" | null;
          diet_type: string | null;
          meals_per_day: string | null;
          avg_sleep: string | null;
          activity_level: string | null;
          support_preferences: string[] | null;
          additional_notes: string | null;
          programme_start: string | null;
          programme_end: string | null;
          programme_weeks: number;
          notification_preferences: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          practitioner_id?: string | null;
          date_of_birth?: string | null;
          current_health?: string | null;
          diagnosed_conditions?: string | null;
          medications?: string | null;
          allergies?: string | null;
          goals?: string[] | null;
          success_vision?: string | null;
          motivation_level?: "exploring" | "ready" | "all_in" | null;
          diet_type?: string | null;
          meals_per_day?: string | null;
          avg_sleep?: string | null;
          activity_level?: string | null;
          support_preferences?: string[] | null;
          additional_notes?: string | null;
          programme_start?: string | null;
          programme_end?: string | null;
          programme_weeks?: number;
          notification_preferences?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          practitioner_id?: string | null;
          date_of_birth?: string | null;
          current_health?: string | null;
          diagnosed_conditions?: string | null;
          medications?: string | null;
          allergies?: string | null;
          goals?: string[] | null;
          success_vision?: string | null;
          motivation_level?: "exploring" | "ready" | "all_in" | null;
          diet_type?: string | null;
          meals_per_day?: string | null;
          avg_sleep?: string | null;
          activity_level?: string | null;
          support_preferences?: string[] | null;
          additional_notes?: string | null;
          programme_start?: string | null;
          programme_end?: string | null;
          programme_weeks?: number;
          notification_preferences?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          practitioner_id: string;
          patient_id: string;
          appointment_type: "initial" | "followup" | "review";
          status: "scheduled" | "completed" | "cancelled" | "no_show";
          scheduled_at: string;
          duration_mins: number;
          location_type: "virtual" | "in_person";
          daily_room_url: string | null;
          patient_notes: string | null;
          practitioner_notes: string | null;
          amount_pence: number | null;
          stripe_payment_id: string | null;
          reminder_sent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          practitioner_id: string;
          patient_id: string;
          appointment_type: "initial" | "followup" | "review";
          status?: "scheduled" | "completed" | "cancelled" | "no_show";
          scheduled_at: string;
          duration_mins: number;
          location_type?: "virtual" | "in_person";
          daily_room_url?: string | null;
          patient_notes?: string | null;
          practitioner_notes?: string | null;
          amount_pence?: number | null;
          stripe_payment_id?: string | null;
          reminder_sent?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          practitioner_id?: string;
          patient_id?: string;
          appointment_type?: "initial" | "followup" | "review";
          status?: "scheduled" | "completed" | "cancelled" | "no_show";
          scheduled_at?: string;
          duration_mins?: number;
          location_type?: "virtual" | "in_person";
          daily_room_url?: string | null;
          patient_notes?: string | null;
          practitioner_notes?: string | null;
          amount_pence?: number | null;
          stripe_payment_id?: string | null;
          reminder_sent?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      check_ins: {
        Row: {
          id: string;
          patient_id: string;
          checked_in_at: string;
          mood_score: number | null;
          energy_score: number | null;
          sleep_hours: number | null;
          digestion_score: number | null;
          symptoms: string[] | null;
          supplements_taken: string[] | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          patient_id: string;
          checked_in_at?: string;
          mood_score?: number | null;
          energy_score?: number | null;
          sleep_hours?: number | null;
          digestion_score?: number | null;
          symptoms?: string[] | null;
          supplements_taken?: string[] | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          patient_id?: string;
          checked_in_at?: string;
          mood_score?: number | null;
          energy_score?: number | null;
          sleep_hours?: number | null;
          digestion_score?: number | null;
          symptoms?: string[] | null;
          supplements_taken?: string[] | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      care_plans: {
        Row: {
          id: string;
          patient_id: string;
          practitioner_id: string;
          week_number: number;
          goals: string[] | null;
          supplements: Json | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          practitioner_id: string;
          week_number: number;
          goals?: string[] | null;
          supplements?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          practitioner_id?: string;
          week_number?: number;
          goals?: string[] | null;
          supplements?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      meal_plans: {
        Row: {
          id: string;
          patient_id: string;
          practitioner_id: string;
          week_number: number | null;
          protocol_name: string | null;
          days: Json | null;
          notes: string | null;
          assigned_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          practitioner_id: string;
          week_number?: number | null;
          protocol_name?: string | null;
          days?: Json | null;
          notes?: string | null;
          assigned_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          practitioner_id?: string;
          week_number?: number | null;
          protocol_name?: string | null;
          days?: Json | null;
          notes?: string | null;
          assigned_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          patient_id: string | null;
          practitioner_id: string | null;
          uploaded_by: string | null;
          document_type: "lab_result" | "intake_form" | "consent" | "report" | "other" | null;
          title: string;
          storage_path: string;
          is_lab_result: boolean;
          requires_pin: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id?: string | null;
          practitioner_id?: string | null;
          uploaded_by?: string | null;
          document_type?: "lab_result" | "intake_form" | "consent" | "report" | "other" | null;
          title: string;
          storage_path: string;
          is_lab_result?: boolean;
          requires_pin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string | null;
          practitioner_id?: string | null;
          uploaded_by?: string | null;
          document_type?: "lab_result" | "intake_form" | "consent" | "report" | "other" | null;
          title?: string;
          storage_path?: string;
          is_lab_result?: boolean;
          requires_pin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          recipient_id?: string;
          body?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          read: boolean;
          link: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          read?: boolean;
          link?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          read?: boolean;
          link?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      education_content: {
        Row: {
          id: string;
          practitioner_id: string;
          title: string;
          content_type: "article" | "video" | "course" | null;
          category: string | null;
          duration_mins: number | null;
          url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          practitioner_id: string;
          title: string;
          content_type?: "article" | "video" | "course" | null;
          category?: string | null;
          duration_mins?: number | null;
          url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          practitioner_id?: string;
          title?: string;
          content_type?: "article" | "video" | "course" | null;
          category?: string | null;
          duration_mins?: number | null;
          url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      education_assignments: {
        Row: {
          id: string;
          content_id: string | null;
          patient_id: string | null;
          assigned_at: string;
          completed_at: string | null;
          progress: number;
        };
        Insert: {
          id?: string;
          content_id?: string | null;
          patient_id?: string | null;
          assigned_at?: string;
          completed_at?: string | null;
          progress?: number;
        };
        Update: {
          id?: string;
          content_id?: string | null;
          patient_id?: string | null;
          assigned_at?: string;
          completed_at?: string | null;
          progress?: number;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          admin_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          id: string;
          allow_practitioner_signup: boolean;
          allow_patient_signup: boolean;
          maintenance_mode: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          allow_practitioner_signup?: boolean;
          allow_patient_signup?: boolean;
          maintenance_mode?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          allow_practitioner_signup?: boolean;
          allow_patient_signup?: boolean;
          maintenance_mode?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      practitioner_types: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      discount_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: "percentage" | "fixed";
          discount_value: number;
          applies_to: "all" | "initial" | "followup";
          max_uses: number | null;
          uses_count: number;
          valid_from: string | null;
          valid_until: string | null;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          discount_type: "percentage" | "fixed";
          discount_value: number;
          applies_to?: "all" | "initial" | "followup";
          max_uses?: number | null;
          uses_count?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          discount_type?: "percentage" | "fixed";
          discount_value?: number;
          applies_to?: "all" | "initial" | "followup";
          max_uses?: number | null;
          uses_count?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      referral_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          referrer_reward_type: "percentage" | "fixed" | "none";
          referrer_reward_value: number;
          referee_reward_type: "percentage" | "fixed" | "none";
          referee_reward_value: number;
          max_uses: number | null;
          uses_count: number;
          valid_from: string | null;
          valid_until: string | null;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          referrer_reward_type?: "percentage" | "fixed" | "none";
          referrer_reward_value?: number;
          referee_reward_type?: "percentage" | "fixed" | "none";
          referee_reward_value?: number;
          max_uses?: number | null;
          uses_count?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          referrer_reward_type?: "percentage" | "fixed" | "none";
          referrer_reward_value?: number;
          referee_reward_type?: "percentage" | "fixed" | "none";
          referee_reward_value?: number;
          max_uses?: number | null;
          uses_count?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row-type exports for use throughout the app
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Practitioner = Database["public"]["Tables"]["practitioners"]["Row"];
export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type CheckIn = Database["public"]["Tables"]["check_ins"]["Row"];
export type CarePlan = Database["public"]["Tables"]["care_plans"]["Row"];
export type MealPlan = Database["public"]["Tables"]["meal_plans"]["Row"];
export type NesemaDocument = Database["public"]["Tables"]["documents"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type UserNotification = Database["public"]["Tables"]["notifications"]["Row"];
export type EducationContent = Database["public"]["Tables"]["education_content"]["Row"];
export type EducationAssignment = Database["public"]["Tables"]["education_assignments"]["Row"];
export type AdminAuditLog = Database["public"]["Tables"]["admin_audit_log"]["Row"];
export type PlatformSettings = Database["public"]["Tables"]["platform_settings"]["Row"];
