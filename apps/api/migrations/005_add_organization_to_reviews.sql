ALTER TABLE reviews
ADD COLUMN organization_id UUID REFERENCES organizations(id);