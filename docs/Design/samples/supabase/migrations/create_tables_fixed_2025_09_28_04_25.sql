-- Users profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles_2025_09_28_04_25 (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product reference data table
CREATE TABLE IF NOT EXISTS public.product_reference_data_2025_09_28_04_25 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name TEXT NOT NULL,
    product_code TEXT UNIQUE,
    matrix_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Routing configurations table
CREATE TABLE IF NOT EXISTS public.routing_configurations_2025_09_28_04_25 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    product_items TEXT[],
    routing_sequence JSONB,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Algorithm settings table
CREATE TABLE IF NOT EXISTS public.algorithm_settings_2025_09_28_04_25 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    algorithm_type TEXT,
    parameters JSONB,
    workflow_graph JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Data output settings table
CREATE TABLE IF NOT EXISTS public.data_output_settings_2025_09_28_04_25 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    columns JSONB,
    format_type TEXT,
    structure_settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- ML model data table
CREATE TABLE IF NOT EXISTS public.ml_model_data_2025_09_28_04_25 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_type TEXT,
    training_date TIMESTAMP WITH TIME ZONE,
    feature_weights JSONB,
    metrics JSONB,
    visualization_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- System options table
CREATE TABLE IF NOT EXISTS public.system_options_2025_09_28_04_25 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    option_category TEXT NOT NULL,
    option_name TEXT NOT NULL,
    option_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS public.activity_logs_2025_09_28_04_25 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    ip_address INET,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.user_profiles_2025_09_28_04_25 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reference_data_2025_09_28_04_25 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_configurations_2025_09_28_04_25 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.algorithm_settings_2025_09_28_04_25 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_output_settings_2025_09_28_04_25 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_model_data_2025_09_28_04_25 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_options_2025_09_28_04_25 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs_2025_09_28_04_25 ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- User profiles policies
CREATE POLICY "Users can view own profile" ON public.user_profiles_2025_09_28_04_25
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles_2025_09_28_04_25
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles_2025_09_28_04_25
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Product reference data policies
CREATE POLICY "Authenticated users can view product data" ON public.product_reference_data_2025_09_28_04_25
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own product data" ON public.product_reference_data_2025_09_28_04_25
    FOR ALL USING (auth.uid() = created_by);

-- Routing configurations policies
CREATE POLICY "Users can manage own routing configs" ON public.routing_configurations_2025_09_28_04_25
    FOR ALL USING (auth.uid() = created_by);

-- Algorithm settings policies
CREATE POLICY "Users can manage own algorithm settings" ON public.algorithm_settings_2025_09_28_04_25
    FOR ALL USING (auth.uid() = created_by);

-- Data output settings policies
CREATE POLICY "Users can manage own output settings" ON public.data_output_settings_2025_09_28_04_25
    FOR ALL USING (auth.uid() = created_by);

-- ML model data policies
CREATE POLICY "Authenticated users can view ML models" ON public.ml_model_data_2025_09_28_04_25
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own ML models" ON public.ml_model_data_2025_09_28_04_25
    FOR ALL USING (auth.uid() = created_by);

-- System options policies
CREATE POLICY "Users can manage own system options" ON public.system_options_2025_09_28_04_25
    FOR ALL USING (auth.uid() = created_by);

-- Activity logs policies
CREATE POLICY "Users can view own activity logs" ON public.activity_logs_2025_09_28_04_25
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity logs" ON public.activity_logs_2025_09_28_04_25
    FOR INSERT WITH CHECK (true);

-- Create trigger for user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user_2025_09_28_04_25()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles_2025_09_28_04_25 (id, username, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created_2025_09_28_04_25
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_2025_09_28_04_25();