-- WhatsApp templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  template_name TEXT NOT NULL,
  template_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active templates"
ON whatsapp_templates FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage templates"
ON whatsapp_templates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default templates
INSERT INTO whatsapp_templates (template_key, template_name, template_text) VALUES
('follow_up', 'Application Follow-Up', 'Hi {name}, this is ResKonnect following up on your accommodation application{residence_text}. How can we assist you today?'),
('call_alert', 'Call Alert', 'Hi {name}, ResKonnect will be calling you shortly regarding your student accommodation. Please have your student card ready.'),
('application_update', 'Application Status Update', 'Hi {name}, we have an update regarding your accommodation application. Please check your ResKonnect dashboard or reply to this message.'),
('documents_required', 'Documents Required', 'Hi {name}, we need additional documents for your application to {residence}. Please upload them in your ResKonnect dashboard.'),
('approval', 'Application Approved', 'Congratulations {name}! Your application to {residence} has been approved! Log in to ResKonnect for next steps.'),
('move_in_reminder', 'Move-In Reminder', 'Hi {name}, reminder: Your move-in date for {residence} is approaching. Contact us if you need any assistance.');

-- Add pricing fields to student_discounts
ALTER TABLE student_discounts 
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS is_orderable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_info TEXT;

-- Create discount orders table
CREATE TABLE IF NOT EXISTS discount_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  discount_id UUID NOT NULL REFERENCES student_discounts(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  total_price DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_address TEXT,
  phone TEXT,
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE discount_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create orders"
ON discount_orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own orders"
ON discount_orders FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all orders"
ON discount_orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create hamper items catalog
CREATE TABLE IF NOT EXISTS hamper_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  estimated_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hamper_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active hamper items"
ON hamper_items FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage hamper items"
ON hamper_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Student hamper preferences
CREATE TABLE IF NOT EXISTS student_hamper_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES hamper_items(id),
  preference TEXT NOT NULL DEFAULT 'want',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_id)
);

ALTER TABLE student_hamper_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
ON student_hamper_preferences FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences"
ON student_hamper_preferences FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE discount_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE hamper_items;
ALTER PUBLICATION supabase_realtime ADD TABLE student_hamper_preferences;