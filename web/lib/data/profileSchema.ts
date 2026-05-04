// Schema-driven form definition for config/profile.yml.
// Each section/field carries the metadata the UI needs (label, hint, example)
// so the form can render itself without sprinkling copy through components.
//
// Types live in `yamlForm.ts` so other YAML files (portals, etc.) can reuse
// the same renderer with their own schemas.

import type { Schema } from "./yamlForm";

export const PROFILE_SCHEMA: Schema = [
  {
    key: "candidate",
    label: "Candidate",
    description: "Identity. Used in CV headers, outreach drafts, and tracker rows.",
    fields: [
      {
        key: "candidate.full_name",
        kind: "string",
        label: "Full name",
        placeholder: "Jane Smith",
        tooltip: "Your name as it should appear on the CV header and in outreach.",
        example: "Stephen Fang",
      },
      {
        key: "candidate.email",
        kind: "email",
        label: "Email",
        placeholder: "you@example.com",
        tooltip: "Primary contact email recruiters will see.",
        example: "fullstackfang@gmail.com",
      },
      {
        key: "candidate.phone",
        kind: "string",
        label: "Phone",
        placeholder: "+1-555-0123",
        tooltip: "International format preferred. Stays on the CV; not used for outbound calls.",
        example: "+1-646-226-8158",
        optional: true,
      },
      {
        key: "candidate.location",
        kind: "string",
        label: "Location",
        placeholder: "City, State/Country",
        tooltip: "Where you're based. Shown on the CV and used for remote/relocation matching.",
        example: "New York, NY",
      },
      {
        key: "candidate.linkedin",
        kind: "url",
        label: "LinkedIn URL",
        placeholder: "linkedin.com/in/yourhandle",
        tooltip: "Public LinkedIn profile. Empty string is fine if you'd rather not share.",
        example: "linkedin.com/in/stephenfang",
        optional: true,
      },
      {
        key: "candidate.portfolio_url",
        kind: "url",
        label: "Portfolio",
        placeholder: "https://yourname.dev",
        tooltip: "Personal site or portfolio. The agent reaches for this when proof points need a link.",
        example: "https://fullstackfang.ai",
        optional: true,
      },
      {
        key: "candidate.github",
        kind: "url",
        label: "GitHub",
        placeholder: "github.com/yourhandle",
        tooltip: "Public GitHub profile if you want it on the CV.",
        example: "github.com/fullstackfang",
        optional: true,
      },
      {
        key: "candidate.twitter",
        kind: "url",
        label: "Twitter / X",
        placeholder: "https://x.com/yourhandle",
        tooltip: "Public X/Twitter profile. Optional.",
        example: "https://x.com/fullstackfang",
        optional: true,
      },
      {
        key: "candidate.canva_resume_design_id",
        kind: "string",
        label: "Canva resume design ID",
        placeholder: "DAxxxxxxxxx",
        tooltip:
          "Optional. The 11-char Canva design ID used by /career-ops pdf for visual CVs. Find it in the Canva URL: canva.com/design/<ID>/...",
        example: "DAGabc123XYZ",
        optional: true,
      },
    ],
  },
  {
    key: "target_roles",
    label: "Target roles",
    description: "What you're optimizing for. Drives fit scoring during evaluations.",
    fields: [
      {
        key: "target_roles.primary",
        kind: "list-string",
        label: "Primary role titles",
        itemLabel: "Title",
        tooltip:
          "Your North Star roles. Be specific — 'Senior Backend Engineer' beats 'Engineer'. The scanner uses these as positive matches.",
        example: "Director, Applied AI",
        placeholder: "e.g. Senior AI Engineer",
        minItems: 1,
      },
      {
        key: "target_roles.archetypes",
        kind: "list-object",
        label: "Archetypes",
        itemLabel: "Archetype",
        tooltip:
          "Fit categories used by the evaluation system. Primary = dream role, secondary = good fit, adjacent = stretch. Order doesn't matter; the agent reads `fit`.",
        fields: [
          {
            key: "name",
            kind: "string",
            label: "Name",
            placeholder: "AI/ML Engineer",
            tooltip: "How you'd describe this role family.",
            example: "Director / VP, Applied AI & AI Engineering",
          },
          {
            key: "level",
            kind: "string",
            label: "Level",
            placeholder: "Senior / Staff / Director / VP",
            tooltip: "Seniority band you're targeting in this archetype.",
            example: "Director / VP",
          },
          {
            key: "fit",
            kind: "select",
            label: "Fit",
            options: ["primary", "secondary", "adjacent"],
            tooltip:
              "primary = dream role · secondary = good fit · adjacent = stretch. Drives the fit score in evaluations.",
            example: "primary",
          },
        ],
      },
    ],
  },
  {
    key: "narrative",
    label: "Narrative",
    description: "How the agent frames you in CVs, outreach, and rationale text.",
    fields: [
      {
        key: "narrative.headline",
        kind: "string",
        label: "Headline",
        placeholder: "One line that captures who you are right now",
        tooltip:
          "Single line. Read by recruiters in the first 2 seconds — and used by the agent at the top of CVs.",
        example: "Enterprise technology leader closing the authorship gap on AI delivery",
      },
      {
        key: "narrative.exit_story",
        kind: "text",
        label: "Exit story",
        placeholder: "What makes you unique and why now? 2–4 sentences.",
        tooltip:
          "Your origin/transition narrative. The agent quotes from this when explaining your fit. Multi-line OK.",
        example:
          "12+ years building enterprise systems from the ground up. Past two years I've shifted from advising on AI to shipping it: production RAG pipeline at a 1,000+ member institution, plus an AI governance platform built with Harvard's Safra Center for Ethics.",
      },
      {
        key: "narrative.superpowers",
        kind: "list-string",
        label: "Superpowers",
        itemLabel: "Superpower",
        tooltip:
          "3–5 things you do better than most peers. Specific beats generic — 'Reduced ML inference 40%' beats 'fast learner'.",
        example:
          "Building from zero: IT functions, RAG pipelines, AI platforms — greenfield is the default mode",
        placeholder: "e.g. End-to-end ML pipelines",
      },
      {
        key: "narrative.proof_points",
        kind: "list-object",
        label: "Proof points",
        itemLabel: "Proof point",
        tooltip:
          "Projects, articles, or case studies with a measurable impact. The hero metric is what the agent quotes verbatim.",
        fields: [
          {
            key: "name",
            kind: "string",
            label: "Name",
            placeholder: "Project / paper / case study",
            tooltip: "Short name for this proof point.",
            example: "Production RAG Pipeline — Leading NYC Institution",
          },
          {
            key: "url",
            kind: "url",
            label: "URL",
            placeholder: "https://...",
            tooltip: "Link to the artifact. Empty string is fine if it's not public.",
            example: "https://assess.fullstackfang.ai",
            optional: true,
          },
          {
            key: "hero_metric",
            kind: "text",
            label: "Hero metric",
            placeholder: "Quantified impact in one line",
            tooltip:
              "The single number/result the agent will repeat. Aim for measurable: latency, $, %, or scale.",
            example: "0.92+ faithfulness scores; replaced $100K+/year legacy stack",
          },
        ],
      },
    ],
  },
  {
    key: "compensation",
    label: "Compensation",
    description: "Comp targets used in evaluation, comparison, and negotiation.",
    fields: [
      {
        key: "compensation.target_range",
        kind: "string",
        label: "Target range",
        placeholder: "$150K-200K base",
        tooltip:
          "Total comp or base — be explicit which. The agent uses this to score offers and frame counters.",
        example: "$250K-350K base",
      },
      {
        key: "compensation.currency",
        kind: "select",
        label: "Currency",
        options: ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "JPY", "SGD", "HKD", "INR"],
        tooltip: "ISO currency code for the range above.",
        example: "USD",
      },
      {
        key: "compensation.minimum",
        kind: "string",
        label: "Walk-away minimum",
        placeholder: "$120K",
        tooltip:
          "Hard floor. Below this number the agent will recommend declining or pushing back.",
        example: "$200K base",
      },
      {
        key: "compensation.location_flexibility",
        kind: "text",
        label: "Location flexibility",
        placeholder: "Remote / hybrid / on-site preferences",
        tooltip:
          "How flexible you are on location. Used to filter postings that are off-policy for you.",
        example: "NYC metro on-site or hybrid; open to select remote-first roles",
        optional: true,
      },
    ],
  },
  {
    key: "location",
    label: "Location",
    description: "Where you live and work. Affects visa filtering and remote eligibility.",
    fields: [
      {
        key: "location.country",
        kind: "string",
        label: "Country",
        placeholder: "United States",
        tooltip: "Country of residence. Used for visa/sponsorship checks during evaluation.",
        example: "United States",
      },
      {
        key: "location.city",
        kind: "string",
        label: "City",
        placeholder: "New York",
        tooltip: "City you're based in. Helps the agent rank on-site/hybrid roles.",
        example: "New York",
      },
      {
        key: "location.timezone",
        kind: "string",
        label: "Timezone",
        placeholder: "EST",
        tooltip:
          "Your working timezone (e.g. EST, PST, CET). Used when evaluating overlap with team timezones.",
        example: "EST",
      },
      {
        key: "location.visa_status",
        kind: "string",
        label: "Visa status",
        placeholder: "No sponsorship needed",
        tooltip:
          "What you can work on without intervention. Common values: 'No sponsorship needed', 'Need H-1B', 'EU citizen', 'Open to relocation with sponsorship'.",
        example: "No sponsorship needed",
      },
      {
        key: "location.onsite_availability",
        kind: "text",
        label: "On-site availability",
        placeholder: "1 week/month in any city",
        tooltip:
          "For remote roles outside your country: how often can you fly out? Optional.",
        example: "1 week/month in any city",
        optional: true,
      },
    ],
  },
];
