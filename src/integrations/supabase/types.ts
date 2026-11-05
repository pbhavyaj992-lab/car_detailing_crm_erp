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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          changes: Json | null
          company_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          parent_entity: string | null
          parent_id: string | null
          summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          company_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          parent_entity?: string | null
          parent_id?: string | null
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          company_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          parent_entity?: string | null
          parent_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_attempts: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          billing_cycle: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          grace_days: number
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          plan_price: number
          plan_tier: string
          public_site_enabled: boolean
          seats: number
          slug: string
          status: string
          subscription_ends_at: string | null
          subscription_started_at: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_cycle?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          grace_days?: number
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          plan_price?: number
          plan_tier?: string
          public_site_enabled?: boolean
          seats?: number
          slug: string
          status?: string
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_cycle?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          grace_days?: number
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          plan_price?: number
          plan_tier?: string
          public_site_enabled?: boolean
          seats?: number
          slug?: string
          status?: string
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          method: string | null
          notes: string | null
          paid_on: string
          period_end: string | null
          period_start: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          period_end?: string | null
          period_start?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          period_end?: string | null
          period_start?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_sites: {
        Row: {
          company_id: string
          created_at: string
          custom_domain: string | null
          id: string
          is_active: boolean
          subdomain: string | null
          theme: string
          theme_config: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          subdomain?: string | null
          theme?: string
          theme_config?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          subdomain?: string | null
          theme?: string
          theme_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          follow_up_at: string | null
          id: string
          last_contacted_at: string | null
          lead_status: string
          name: string
          normalized_phone: string | null
          notes: string | null
          phone: string
          source: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          follow_up_at?: string | null
          id?: string
          last_contacted_at?: string | null
          lead_status?: string
          name: string
          normalized_phone?: string | null
          notes?: string | null
          phone: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          follow_up_at?: string | null
          id?: string
          last_contacted_at?: string | null
          lead_status?: string
          name?: string
          normalized_phone?: string | null
          notes?: string | null
          phone?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_sequences: {
        Row: {
          company_id: string
          kind: string
          last_no: number
          year: number
        }
        Insert: {
          company_id?: string
          kind: string
          last_no?: number
          year: number
        }
        Update: {
          company_id?: string
          kind?: string
          last_no?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "doc_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          bill_path: string | null
          category: string
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          payment_method: string | null
          spent_on: string
          tax_amount: number
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          bill_path?: string | null
          category: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          spent_on?: string
          tax_amount?: number
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          bill_path?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          spent_on?: string
          tax_amount?: number
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          contacted_at: string | null
          created_at: string
          customer_id: string | null
          deleted_at: string | null
          follow_up_at: string | null
          follow_up_count: number
          id: string
          last_follow_up_at: string | null
          message: string | null
          name: string
          notes: string | null
          phone: string
          service: string | null
          source: string
          status: string
          updated_at: string
          vehicle: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          contacted_at?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          follow_up_at?: string | null
          follow_up_count?: number
          id?: string
          last_follow_up_at?: string | null
          message?: string | null
          name: string
          notes?: string | null
          phone: string
          service?: string | null
          source?: string
          status?: string
          updated_at?: string
          vehicle?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          contacted_at?: string | null
          created_at?: string
          customer_id?: string | null
          deleted_at?: string | null
          follow_up_at?: string | null
          follow_up_count?: number
          id?: string
          last_follow_up_at?: string | null
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string
          service?: string | null
          source?: string
          status?: string
          updated_at?: string
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          company_id: string | null
          id: string
          invoice_id: string
          name: string
          qty: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount?: number
          company_id?: string | null
          id?: string
          invoice_id: string
          name: string
          qty?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          company_id?: string | null
          id?: string
          invoice_id?: string
          name?: string
          qty?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adjustment_amount: number
          adjustment_note: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          discount: number
          id: string
          issued_at: string
          job_id: string | null
          notes: string | null
          number: string
          paid_amount: number
          signature_url: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          adjustment_amount?: number
          adjustment_note?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          discount?: number
          id?: string
          issued_at?: string
          job_id?: string | null
          notes?: string | null
          number: string
          paid_amount?: number
          signature_url?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          adjustment_amount?: number
          adjustment_note?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          discount?: number
          id?: string
          issued_at?: string
          job_id?: string | null
          notes?: string | null
          number?: string
          paid_amount?: number
          signature_url?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_events: {
        Row: {
          changed_by: string | null
          company_id: string | null
          created_at: string
          id: string
          job_id: string
          note: string | null
          status: Database["public"]["Enums"]["job_status"] | null
        }
        Insert: {
          changed_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          note?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
        }
        Update: {
          changed_by?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "job_status_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_to: string[]
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          delivered_at: string | null
          delivery_notes: string | null
          expected_delivery: string | null
          id: string
          notes: string | null
          number: string
          quote_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          assigned_to?: string[]
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          number: string
          quote_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          assigned_to?: string[]
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          number?: string
          quote_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          browser: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          os: string | null
          region: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          region?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          job_id: string | null
          kind: Database["public"]["Enums"]["media_kind"]
          mime: string | null
          quote_id: string | null
          stage: Database["public"]["Enums"]["media_stage"]
          storage_path: string
          uploaded_by: string | null
          vehicle_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          job_id?: string | null
          kind?: Database["public"]["Enums"]["media_kind"]
          mime?: string | null
          quote_id?: string | null
          stage: Database["public"]["Enums"]["media_stage"]
          storage_path: string
          uploaded_by?: string | null
          vehicle_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          job_id?: string | null
          kind?: Database["public"]["Enums"]["media_kind"]
          mime?: string | null
          quote_id?: string | null
          stage?: Database["public"]["Enums"]["media_stage"]
          storage_path?: string
          uploaded_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          received_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          received_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          received_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_plans: {
        Row: {
          created_at: string
          features: string[]
          id: string
          is_active: boolean
          max_seats: number
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
        }
        Insert: {
          created_at?: string
          features?: string[]
          id?: string
          is_active?: boolean
          max_seats?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
        }
        Update: {
          created_at?: string
          features?: string[]
          id?: string
          is_active?: boolean
          max_seats?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
        }
        Relationships: []
      }
      platform_thresholds: {
        Row: {
          activity_critical: number
          activity_warn: number
          files_critical: number
          files_warn: number
          id: boolean
          inactive_days: number
          rows_critical: number
          rows_warn: number
          seats_critical_pct: number
          seats_warn_pct: number
          updated_at: string
        }
        Insert: {
          activity_critical?: number
          activity_warn?: number
          files_critical?: number
          files_warn?: number
          id?: boolean
          inactive_days?: number
          rows_critical?: number
          rows_warn?: number
          seats_critical_pct?: number
          seats_warn_pct?: number
          updated_at?: string
        }
        Update: {
          activity_critical?: number
          activity_warn?: number
          files_critical?: number
          files_warn?: number
          id?: boolean
          inactive_days?: number
          rows_critical?: number
          rows_warn?: number
          seats_critical_pct?: number
          seats_warn_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          id: string
          name: string
          qty: number
          quote_id: string
          service_id: string | null
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount?: number
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          qty?: number
          quote_id: string
          service_id?: string | null
          sort_order?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          qty?: number
          quote_id?: string
          service_id?: string | null
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          company_id: string | null
          context: Database["public"]["Enums"]["vehicle_context"]
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          discount: number
          follow_up_at: string | null
          id: string
          notes: string | null
          number: string
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          approved_at?: string | null
          company_id?: string | null
          context?: Database["public"]["Enums"]["vehicle_context"]
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          discount?: number
          follow_up_at?: string | null
          id?: string
          notes?: string | null
          number: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          approved_at?: string | null
          company_id?: string | null
          context?: Database["public"]["Enums"]["vehicle_context"]
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          discount?: number
          follow_up_at?: string | null
          id?: string
          notes?: string | null
          number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          id: string
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          address: string | null
          business_name: string
          company_id: string
          currency: string
          default_tax_rate: number
          email: string | null
          gstin: string | null
          invoice_prefix: string
          job_prefix: string
          phone: string | null
          quote_prefix: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name?: string
          company_id?: string
          currency?: string
          default_tax_rate?: number
          email?: string | null
          gstin?: string | null
          invoice_prefix?: string
          job_prefix?: string
          phone?: string | null
          quote_prefix?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          company_id?: string
          currency?: string
          default_tax_rate?: number
          email?: string | null
          gstin?: string | null
          invoice_prefix?: string
          job_prefix?: string
          phone?: string | null
          quote_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          company_id: string | null
          created_at: string
          granted: boolean
          id: string
          permission_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          granted: boolean
          id?: string
          permission_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          granted?: boolean
          id?: string
          permission_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          color: string | null
          company_id: string | null
          created_at: string
          customer_id: string
          deleted_at: string | null
          fuel_type: string | null
          id: string
          model: string | null
          normalized_registration: string | null
          notes: string | null
          number: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          fuel_type?: string | null
          id?: string
          model?: string | null
          normalized_registration?: string | null
          notes?: string | null
          number: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          fuel_type?: string | null
          id?: string
          model?: string | null
          normalized_registration?: string | null
          notes?: string | null
          number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_company_logo: {
        Args: { _object_name: string }
        Returns: boolean
      }
      check_auth_rate_limit: { Args: { _identifier: string }; Returns: boolean }
      current_company_id: { Args: never; Returns: string }
      current_user_can_admin: { Args: never; Returns: boolean }
      current_user_can_finance: { Args: never; Returns: boolean }
      current_user_is_staff: { Args: never; Returns: boolean }
      current_user_is_super_admin: { Args: never; Returns: boolean }
      delete_company_completely: {
        Args: { _company_id: string }
        Returns: undefined
      }
      find_or_create_customer: {
        Args: {
          _address?: string
          _company_id?: string
          _email?: string
          _name?: string
          _phone?: string
          _source?: string
        }
        Returns: {
          address: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          follow_up_at: string | null
          id: string
          last_contacted_at: string | null
          lead_status: string
          name: string
          normalized_phone: string | null
          notes: string | null
          phone: string
          source: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_or_create_vehicle: {
        Args: {
          _brand?: string
          _color?: string
          _company_id?: string
          _customer_id?: string
          _fuel_type?: string
          _model?: string
          _number?: string
        }
        Returns: {
          brand: string | null
          color: string | null
          company_id: string | null
          created_at: string
          customer_id: string
          deleted_at: string | null
          fuel_type: string | null
          id: string
          model: string | null
          normalized_registration: string | null
          notes: string | null
          number: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      in_my_company: { Args: { _cid: string }; Returns: boolean }
      is_company_active: { Args: { _cid: string }; Returns: boolean }
      merge_customers: {
        Args: { _source: string; _target: string }
        Returns: Json
      }
      my_company_subscription: {
        Args: never
        Returns: {
          is_active: boolean
          name: string
          plan_tier: string
          seats: number
          status: string
          subscription_ends_at: string
        }[]
      }
      next_doc_number: {
        Args: { _kind: string; _prefix: string }
        Returns: string
      }
      normalize_phone: { Args: { p: string }; Returns: string }
      normalize_registration: { Args: { r: string }; Returns: string }
      platform_stats: { Args: never; Returns: Json }
      recalc_invoice_paid: { Args: { _invoice_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "owner"
        | "manager"
        | "reception"
        | "worker"
      invoice_status: "unpaid" | "partial" | "paid" | "cancelled"
      job_status:
        | "received"
        | "inspection"
        | "work_started"
        | "quality_check"
        | "ready"
        | "delivered"
      media_kind: "photo" | "video"
      media_stage: "pre_work" | "post_work"
      payment_method: "cash" | "upi" | "card" | "bank_transfer" | "other"
      quote_status: "draft" | "approved" | "converted" | "cancelled"
      vehicle_context: "at_garage" | "inquiry_only"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "super_admin",
        "admin",
        "owner",
        "manager",
        "reception",
        "worker",
      ],
      invoice_status: ["unpaid", "partial", "paid", "cancelled"],
      job_status: [
        "received",
        "inspection",
        "work_started",
        "quality_check",
        "ready",
        "delivered",
      ],
      media_kind: ["photo", "video"],
      media_stage: ["pre_work", "post_work"],
      payment_method: ["cash", "upi", "card", "bank_transfer", "other"],
      quote_status: ["draft", "approved", "converted", "cancelled"],
      vehicle_context: ["at_garage", "inquiry_only"],
    },
  },
} as const
