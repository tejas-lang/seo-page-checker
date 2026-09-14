/**
 * The check registry.
 *
 * WHAT IT IS: the single list of every SEO check the engine runs.
 *
 * WHY IT MATTERS: adding a new check means writing one file and adding one
 * line here. Nothing else in the application needs to change — not the scorer,
 * not the API, not the dashboard — because everything downstream reads the
 * registry rather than hardcoding a list of checks.
 */

import type { SeoCheck } from "./types";

import {
  titleCheck,
  metaDescriptionCheck,
  h1Check,
  headingStructureCheck,
  imageAltCheck,
} from "./checks/on-page";

import {
  httpsCheck,
  httpStatusCheck,
  redirectCheck,
  canonicalCheck,
  robotsMetaCheck,
  robotsTxtCheck,
  sitemapCheck,
  languageCheck,
  viewportCheck,
  charsetCheck,
  faviconCheck,
} from "./checks/technical";

import { wordCountCheck, contentStructureCheck, renderingCheck } from "./checks/content";

import { internalLinksCheck, externalLinksCheck, linkQualityCheck } from "./checks/links";

import { jsonLdCheck, otherStructuredDataCheck } from "./checks/structured-data";

import { openGraphCheck, twitterCardCheck } from "./checks/social";

/**
 * Every check, in the order results are displayed.
 *
 * The order here is the order a person would want to read them: the things
 * that stop a page working, then the things that describe it, then the
 * optional extras.
 */
export const checkRegistry: readonly SeoCheck[] = [
  // Technical — can the page be reached and crawled at all?
  httpStatusCheck,
  httpsCheck,
  redirectCheck,
  robotsMetaCheck,
  canonicalCheck,
  robotsTxtCheck,
  sitemapCheck,
  languageCheck,
  viewportCheck,
  charsetCheck,
  faviconCheck,

  // On-page — does the page explain what it is about?
  titleCheck,
  metaDescriptionCheck,
  h1Check,
  headingStructureCheck,
  imageAltCheck,

  // Content — is there anything on the page?
  wordCountCheck,
  contentStructureCheck,
  renderingCheck,

  // Links — where does it lead?
  internalLinksCheck,
  externalLinksCheck,
  linkQualityCheck,

  // Structured data + social — the optional layers.
  jsonLdCheck,
  otherStructuredDataCheck,
  openGraphCheck,
  twitterCardCheck,
] as const;

/** Look up a single check by key. Used by the guide pages and the docs. */
export function getCheck(key: string): SeoCheck | undefined {
  return checkRegistry.find((check) => check.key === key);
}

/** Total number of checks, so the marketing copy can never drift from reality. */
export const CHECK_COUNT = checkRegistry.length;

/**
 * Guard against a registry mistake: two checks sharing a key would silently
 * overwrite each other in the database and the UI.
 */
const seenKeys = new Set<string>();
for (const check of checkRegistry) {
  if (seenKeys.has(check.key)) {
    throw new Error(`Duplicate SEO check key in registry: "${check.key}"`);
  }
  seenKeys.add(check.key);
}
