/**
 * Kalakar Setu — TypeScript Definitions
 */

export interface UserProfile {
  id: string;
  phone_number: string;
  display_name: string | null;
  preferred_language: string;
  craft_types: string[];
  state_code: string | null;
  district_code: string | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  is_active: boolean;
  gem_seller_id?: string | null;
  ondc_subscriber_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  is_new_user?: boolean;
  onboarding_completed?: boolean;
}

export interface SellerReadiness {
  profile_complete: boolean;
  has_display_name: boolean;
  has_craft_type: boolean;
  has_location: boolean;
  onboarding_completed: boolean;
  gem_connected: boolean;
  ondc_connected: boolean;
  completion_percentage: number;
}

export interface CraftType {
  id: string;
  name_en: string;
  name_hi: string;
  icon?: string | null;
}

export interface StateRef {
  code: string;
  name_en: string;
  name_hi: string;
}

export interface DistrictRef {
  code: string;
  state_code: string;
  name_en: string;
  name_hi: string;
}

export interface LanguageRef {
  code: string;
  name_en: string;
  name_native: string;
}
