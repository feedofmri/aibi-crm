-- Replies become part of the conversation: each message is inbound (from the
-- customer) or outbound (from BIAI), with who sent it and how.

ALTER TABLE messages
  ADD COLUMN direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  ADD COLUMN author    TEXT NOT NULL DEFAULT '',
  ADD COLUMN delivery  TEXT NOT NULL DEFAULT '' CHECK (delivery IN ('', 'auto', 'manual'));

CREATE INDEX messages_lead_direction_idx ON messages (lead_id, direction, received_at);

-- Automation settings gain an auto-reply switch; existing installs start with it off.
UPDATE settings SET value = value || '{"autoReply": "off"}'::jsonb
 WHERE key = 'automation' AND NOT value ? 'autoReply';
