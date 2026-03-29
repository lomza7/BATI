/*
  # Create todos table for artisan task management

  1. New Tables
    - `todos`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, nullable for now)
      - `title` (text, not null) - the task title
      - `description` (text) - optional details
      - `priority` (text) - 'haute', 'moyenne', 'basse'
      - `category` (text) - 'chantier', 'administratif', 'achat', 'client', 'autre'
      - `due_date` (date) - optional due date
      - `completed` (boolean) - task status
      - `completed_at` (timestamptz) - when task was completed
      - `position` (integer) - for ordering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `todos` table
    - Add policies for authenticated users to manage their own todos
    - Add policy for anonymous access during development (user_id is null)
*/

CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  priority text NOT NULL DEFAULT 'moyenne',
  category text NOT NULL DEFAULT 'autre',
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own todos"
  ON todos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own todos"
  ON todos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos"
  ON todos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos"
  ON todos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Allow anonymous read access to todos without user_id"
  ON todos FOR SELECT
  TO anon
  USING (user_id IS NULL);

CREATE POLICY "Allow anonymous insert for todos without user_id"
  ON todos FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Allow anonymous update for todos without user_id"
  ON todos FOR UPDATE
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Allow anonymous delete for todos without user_id"
  ON todos FOR DELETE
  TO anon
  USING (user_id IS NULL);
