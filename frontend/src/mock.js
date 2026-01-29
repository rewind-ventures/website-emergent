// MOCK DATA (frontend-only) for Rewind Ventures landing page
// Later we can replace the localStorage lead capture with backend APIs.

export const MOCK = {
  brand: {
    name: "Rewind Ventures",
    email: "hello@rewind-ventures.com",
    calendlyUrl: "https://calendly.com/your-link-here",
  },
  nav: [
    { id: "services", label: "Services" },
    { id: "approach", label: "How we deliver" },
    { id: "proof", label: "Proof" },
    { id: "faq", label: "FAQ" },
    { id: "contact", label: "Contact" },
  ],
  hero: {
    headline: "Sports infrastructure, technology & operations — delivered end‑to‑end.",
    subhead:
      "We set up racquet-sport venues, ship booking + tournament systems, and build bespoke software that fits your operational reality — without vendor chaos.",
    bullets: [
      "Turn-key facility setup & management",
      "Sports tech consultancy + delivery",
      "Custom software for venue-specific workflows",
    ],
  },
  stats: [
    { k: "2", v: "Pickleball facilities set up" },
    { k: "4", v: "Venues with technology delivery" },
    { k: "4–8 wks", v: "Typical go-live window" },
  ],
  services: [
    {
      id: "turnkey",
      title: "Turn‑key Projects",
      desc:
        "From layout to launch: court specs, vendor coordination, tech stack, SOPs, and ongoing management. One accountable partner.",
      bullets: [
        "Site planning + vendor orchestration",
        "Equipment selection + procurement support",
        "Operations playbooks + launch readiness",
      ],
    },
    {
      id: "tech",
      title: "Sports Tech Consultancy & Delivery",
      desc:
        "We implement the systems that run your venue: booking, tournaments, memberships, ratings — integrated cleanly.",
      bullets: [
        "Venue booking + payments integration",
        "Tournament workflows + bracket ops",
        "Rating system integration + data hygiene",
      ],
    },
    {
      id: "software",
      title: "Bespoke Custom Software",
      desc:
        "When off-the-shelf tools don’t match your operations, we build the missing layer — fast, maintainable, and measurable.",
      bullets: [
        "Admin dashboards + reporting",
        "Custom member flows",
        "Automation for ops + staff",
      ],
    },
  ],
  outcomes: [
    {
      title: "Less vendor chaos",
      desc: "One plan, one delivery owner, fewer moving parts.",
    },
    {
      title: "Operational clarity",
      desc: "Workflows are documented, repeatable, and easy for staff.",
    },
    {
      title: "Systems that talk",
      desc: "Booking, tournaments, and ratings integrated (not duct-taped).",
    },
  ],
  testimonials: [
    {
      name: "Venue Operator",
      role: "Racquet sports facility",
      quote:
        "They made the launch feel structured — requirements, delivery, training. We went live without the usual last‑minute chaos.",
    },
    {
      name: "Tournament Director",
      role: "Community league",
      quote:
        "The tournament workflow was finally predictable. Registration, seeding, and reporting just worked.",
    },
    {
      name: "Owner",
      role: "Multi‑court venue",
      quote:
        "The tech setup was clean and scalable. We can add courts and programs without reworking everything.",
    },
  ],
  faqs: [
    {
      q: "Do you only work with pickleball venues?",
      a: "No — we focus on racquet sports and modern venue operations. Pickleball is a strong track record area, but our delivery approach applies broadly.",
    },
    {
      q: "Can you work with our existing booking or membership provider?",
      a: "Yes. We prefer integrating what you already use if it’s viable. We’ll audit your current stack and propose the fastest path to a reliable setup.",
    },
    {
      q: "What does the engagement look like?",
      a: "Typically: discovery (ops + goals) → solution map (systems + vendors) → delivery sprints → go-live support. We’ll align on timelines before we start.",
    },
    {
      q: "Do you offer ongoing management after launch?",
      a: "Yes — we can support operations, upgrades, and continuous improvements depending on your needs.",
    },
  ],
  imagery: {
    // Inline images only (NOT background). Sources provided by the image selection agent.
    heroPrimary:
      "https://images.unsplash.com/photo-1761644658016-324918bc373c",
    heroSecondary:
      "https://images.unsplash.com/photo-1559369064-c4d65141e408",
    techAccent:
      "https://images.unsplash.com/photo-1760037028485-d00dd2b8f6f0",
  },
};

export const LS_KEYS = {
  leads: "rewind_leads_v1",
};

export function loadLeads() {
  try {
    const raw = localStorage.getItem(LS_KEYS.leads);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLead(lead) {
  const existing = loadLeads();
  const next = [lead, ...existing].slice(0, 25);
  localStorage.setItem(LS_KEYS.leads, JSON.stringify(next));
  return next;
}
