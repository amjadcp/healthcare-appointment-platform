-- 1. Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add organization_id column to users (initially nullable)
ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;

-- 3. Create a default organization for transitioning existing data
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Organization', 'default-org');

-- 4. Update existing users to point to the default organization
UPDATE users SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;

-- 5. Alter organization_id column to be NOT NULL
ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
