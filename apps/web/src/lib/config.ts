/**
 * Single source of truth for product naming and public links.
 * The product name is a pending decision ("Runtime Lab" vs "Runtime AI");
 * change it here only.
 */
export const PRODUCT_NAME = 'Runtime Lab';
export const PRODUCT_TAGLINE = 'The Runtime Debugger & Lab Notebook for LLM Engineers';
export const REPO_URL = 'https://github.com/aemmykun/runtime-lab';
export const SPONSOR_URL = 'https://github.com/sponsors/aemmykun';

/** Creator bio. Facts taken only from the creator's resume. */
export const CREATOR = {
  name: 'Arthit (Arty) Pukhampuang',
  location: 'Melbourne, Australia',
  summary:
    'Hospitality operations leader turned governance architect. Arty spent nearly a decade in Melbourne hospitality, most recently as Executive Housekeeping Manager at Quest Southbank (Nov 2021 – Feb 2026), where he planned a budget of over A$1M, grew a team of 8 into a stable team of more than 20, and designed automated rostering and linen-forecasting tools.',
  project: {
    name: 'TenantSage™',
    url: 'https://tenantsage.org',
    summary:
      'As Governance Architect, he built TenantSage™, an authority-native governance system for enterprise AI adoption that treats authority, policy, audit and isolation as the primary product, with retrieval and generation strictly downstream of governance decisions. He has filed a patent covering identity-derived access scoping, pre-retrieval governance enforcement and injection-resistant, deterministic context handling.',
  },
  education: 'Bachelor of Science (Physiotherapy), Chiang Mai University; Diploma of Leadership & Management, ALTEC.',
} as const;
