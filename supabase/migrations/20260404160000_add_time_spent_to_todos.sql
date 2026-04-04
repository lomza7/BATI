-- Time tracking on todos (in minutes)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS time_spent integer DEFAULT 0;
