ALTER TABLE "terms_policy_versions"
ADD COLUMN "title" TEXT,
ADD COLUMN "html" TEXT,
ADD COLUMN "buttonLabel" TEXT;

ALTER TABLE "subscription_policy_versions"
ADD COLUMN "title" TEXT,
ADD COLUMN "html" TEXT,
ADD COLUMN "buttonLabel" TEXT;

ALTER TABLE "consent_formula_versions"
ADD COLUMN "title" TEXT,
ADD COLUMN "text" TEXT;

UPDATE "terms_policy_versions" v
SET
  "title" = t."title",
  "html" = t."html",
  "buttonLabel" = t."buttonLabel"
FROM "terms_policy_version_translations" t
WHERE t."versionId" = v."id";

UPDATE "subscription_policy_versions" v
SET
  "title" = t."title",
  "html" = t."html",
  "buttonLabel" = t."buttonLabel"
FROM "subscription_policy_version_translations" t
WHERE t."versionId" = v."id";

UPDATE "consent_formula_versions" v
SET
  "title" = t."title",
  "text" = t."text"
FROM "consent_formula_version_translations" t
WHERE t."consentVersionId" = v."id";

DROP TABLE "consent_formula_version_translations";
DROP TABLE "subscription_policy_version_translations";
DROP TABLE "terms_policy_version_translations";
