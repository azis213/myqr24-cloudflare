-- DEVELOPMENT RESET — intentionally destructive.
--
-- Development and staging contain no data that must be retained. Migration
-- 0003 already leaves the final schema under the canonical table names; this
-- migration clears all TAG Application API rows while keeping that schema.
-- Apply only to disposable development/staging databases, never production.
-- R2 objects are not affected by D1 migrations and require a separate,
-- environment-scoped cleanup.

DELETE FROM tag_content_element_items;
DELETE FROM tag_content_media_variants;
DELETE FROM tag_content_items;
DELETE FROM tag_content_elements;
DELETE FROM tag_content;
DELETE FROM tag_range_content;
DELETE FROM global_content;

DELETE FROM tag_pin_credentials;
DELETE FROM tag_access_sessions;
DELETE FROM tag_pin_throttles;
DELETE FROM tag_routing;