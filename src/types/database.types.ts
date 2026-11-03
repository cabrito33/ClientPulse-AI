/**
 * ==============================================================================
 * ClientPulse AI — Supabase Database Types
 * File: src/types/database.types.ts
 *
 * Generated TypeScript contract reflecting the complete Supabase PostgreSQL schema.
 * Issue: [BE-01] [P0] [L] Criar schema PostgreSQL no Supabase #15
 * ==============================================================================
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          agency_id: string | null;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          agency_id?: string | null;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agency_id?: string | null;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey";
            columns: ["agency_id"];
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };

      agencies: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      github_integrations: {
        Row: {
          id: string;
          agency_id: string;
          pat_token: string;
          github_username: string | null;
          is_valid: boolean;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agency_id: string;
          pat_token: string;
          github_username?: string | null;
          is_valid?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          agency_id?: string;
          pat_token?: string;
          github_username?: string | null;
          is_valid?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "github_integrations_agency_id_fkey";
            columns: ["agency_id"];
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };

      clients: {
        Row: {
          id: string;
          agency_id: string;
          name: string;
          email: string;
          company_name: string | null;
          communication_tone: string;
          language: "pt" | "en";
          github_project_id: string;
          github_project_owner: string;
          github_project_type: "user" | "organization";
          column_mapping: Json;
          schedule_day_of_week: number;
          schedule_hour_utc: number;
          auto_send_enabled: boolean;
          portal_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agency_id: string;
          name: string;
          email: string;
          company_name?: string | null;
          communication_tone?: string;
          language?: "pt" | "en";
          github_project_id: string;
          github_project_owner: string;
          github_project_type?: "user" | "organization";
          column_mapping?: Json;
          schedule_day_of_week?: number;
          schedule_hour_utc?: number;
          auto_send_enabled?: boolean;
          portal_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agency_id?: string;
          name?: string;
          email?: string;
          company_name?: string | null;
          communication_tone?: string;
          language?: "pt" | "en";
          github_project_id?: string;
          github_project_owner?: string;
          github_project_type?: "user" | "organization";
          column_mapping?: Json;
          schedule_day_of_week?: number;
          schedule_hour_utc?: number;
          auto_send_enabled?: boolean;
          portal_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey";
            columns: ["agency_id"];
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };

      reports: {
        Row: {
          id: string;
          client_id: string;
          agency_id: string;
          status: "draft" | "approved" | "sent" | "failed";
          period_start: string;
          period_end: string;
          summary_done: string;
          summary_blockers: string;
          summary_next_steps: string;
          raw_github_data: Json | null;
          approved_at: string | null;
          sent_at: string | null;
          email_delivery_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          agency_id: string;
          status?: "draft" | "approved" | "sent" | "failed";
          period_start: string;
          period_end: string;
          summary_done: string;
          summary_blockers: string;
          summary_next_steps: string;
          raw_github_data?: Json | null;
          approved_at?: string | null;
          sent_at?: string | null;
          email_delivery_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          agency_id?: string;
          status?: "draft" | "approved" | "sent" | "failed";
          period_start?: string;
          period_end?: string;
          summary_done?: string;
          summary_blockers?: string;
          summary_next_steps?: string;
          raw_github_data?: Json | null;
          approved_at?: string | null;
          sent_at?: string | null;
          email_delivery_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_agency_id_fkey";
            columns: ["agency_id"];
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };

      sprint_metrics: {
        Row: {
          id: string;
          client_id: string;
          agency_id: string;
          sprint: string;
          label: string;
          completed: number;
          planned: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          agency_id: string;
          sprint: string;
          label: string;
          completed?: number;
          planned?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          agency_id?: string;
          sprint?: string;
          label?: string;
          completed?: number;
          planned?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sprint_metrics_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sprint_metrics_agency_id_fkey";
            columns: ["agency_id"];
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };

      portal_tokens: {
        Row: {
          id: string;
          client_id: string;
          agency_id: string;
          token: string;
          is_active: boolean;
          expires_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          agency_id: string;
          token?: string;
          is_active?: boolean;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          agency_id?: string;
          token?: string;
          is_active?: boolean;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_tokens_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_tokens_agency_id_fkey";
            columns: ["agency_id"];
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };

      delivery_logs: {
        Row: {
          id: string;
          report_id: string | null;
          client_id: string;
          agency_id: string;
          status: "sent" | "delivered" | "bounced" | "failed";
          email_service: string;
          recipient_email: string;
          message_id: string | null;
          error_message: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          report_id?: string | null;
          client_id: string;
          agency_id: string;
          status?: "sent" | "delivered" | "bounced" | "failed";
          email_service?: string;
          recipient_email: string;
          message_id?: string | null;
          error_message?: string | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string | null;
          client_id?: string;
          agency_id?: string;
          status?: "sent" | "delivered" | "bounced" | "failed";
          email_service?: string;
          recipient_email?: string;
          message_id?: string | null;
          error_message?: string | null;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_logs_report_id_fkey";
            columns: ["report_id"];
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_logs_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_logs_agency_id_fkey";
            columns: ["agency_id"];
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };

      report_tasks: {
        Row: {
          id: string;
          report_id: string;
          client_id: string;
          github_item_id: string;
          title: string;
          status_category: "done" | "in_progress" | "blocked";
          assignee: string | null;
          labels: string[];
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          client_id: string;
          github_item_id: string;
          title: string;
          status_category: "done" | "in_progress" | "blocked";
          assignee?: string | null;
          labels?: string[];
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          client_id?: string;
          github_item_id?: string;
          title?: string;
          status_category?: "done" | "in_progress" | "blocked";
          assignee?: string | null;
          labels?: string[];
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_tasks_report_id_fkey";
            columns: ["report_id"];
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_tasks_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

/** Convenience helper types */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
