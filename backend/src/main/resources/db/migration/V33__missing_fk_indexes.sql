-- Add missing indexes on foreign keys to prevent sequential scans during references verification and deletes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications (actor_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON user_blocks (blocked_id);
CREATE INDEX IF NOT EXISTS idx_channels_created_by ON channels (created_by);
