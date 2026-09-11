-- Add a change-log action for edits that are not purely a time move (organizer, purpose, attendees).
ALTER TYPE "MeetingChangeAction" ADD VALUE 'UPDATE';
