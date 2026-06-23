-- Add payload and org_slug columns to processed_events table
ALTER TABLE processed_events ADD COLUMN payload TEXT;
ALTER TABLE processed_events ADD COLUMN org_slug VARCHAR(255);

-- Index for fast lookup by tenant org slug
CREATE INDEX idx_processed_events_org_slug ON processed_events(org_slug);
