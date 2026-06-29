-- Add nickname and use_nickname columns to the players table
ALTER TABLE players ADD COLUMN nickname TEXT;
ALTER TABLE players ADD COLUMN use_nickname BOOLEAN DEFAULT false;
