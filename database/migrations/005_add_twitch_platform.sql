-- ============================================================
-- Migration 005: Add Twitch to platform_type
-- BrandCommand
-- ============================================================
-- Twitch is an MVP platform (see the onboarding flow and the
-- connect page), but it was missing from the enum created in
-- migration 001.
--
-- This migration is deliberately kept in its own file: Postgres
-- will not let a newly added enum value be *used* until the
-- transaction that added it has committed. Everything that
-- references 'twitch' lives in migration 006 onwards.
-- ============================================================

ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'twitch';
