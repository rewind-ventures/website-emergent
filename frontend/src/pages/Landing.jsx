import React, { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import axios from "axios";

import { MOCK } from "@/mock";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Toaster, toast } from "@/components/ui/sonner";

import {
  ArrowRight,
  Calendar,
  Mail,
  Layers,
  Settings2,
  Code2,
  ShieldCheck,
  Workflow,
  Sparkles,
  RotateCcw,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const leadSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  company: z.string().min(2, "Please enter your company / venue name"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  need: z
    .string()

function loadLocalLeads() {
  try {
    const raw = localStorage.getItem("rewind_leads_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalLead(lead) {
  const existing = loadLocalLeads();
  const next = [lead, ...existing].slice(0, 25);
  localStorage.setItem("rewind_leads_v1", JSON.stringify(next));
  return next;
}

    .min(10, "Tell us a little more (at least 10 characters)")
    .max(1200, "Please keep it under 1200 characters"),
});

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function useInViewAnimation() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 40);
    return () => window.clearTimeout(t);
  }, []);
  return ready;
}

const ServiceIcon = ({ id }) => {
  const iconProps = { className: "h-5 w-5", "aria-hidden": true };
  if (id === "turnkey") return <Layers {...iconProps} />;
  if (id === "tech") return <Settings2 {...iconProps} />;
  return <Code2 {...iconProps} />;
};

const ServiceTabIcon = ({ id }) => (
  <span className="rv-tabIcon" aria-hidden>
    <ServiceIcon id={id} />
  </span>
);

function generateId() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    // ignore
  }
  return `lead_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
}

export default function Landing() {
  const ready = useInViewAnimation();
  const [leads, setLeads] = useState([]);
  const [leadsSource, setLeadsSource] = useState("local");
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  const form = useForm({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      need: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!API || API.includes("undefined")) return;
      setIsLoadingLeads(true);
      try {
        const res = await axios.get(`${API}/leads`, { params: { limit: 6 } });
        if (!mounted) return;
        setLeadsSource("api");
        const normalized = Array.isArray(res.data)
          ? res.data.map((l) => ({
              ...l,
              createdAt: l.created_at || l.createdAt,
            }))
          : [];
        setLeads(normalized);
      } catch (e) {
        // Keep localStorage leads as fallback
        if (!mounted) return;
        setLeadsSource("local");
      } finally {
        if (mounted) setIsLoadingLeads(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (values) => {
    const localPayload = {
      ...values,
      id: generateId(),
      createdAt: new Date().toISOString(),
      source: "landing_form",
    };

    try {
      const res = await axios.post(`${API}/leads`, {
        name: values.name,
        company: values.company,
        email: values.email,
        phone: values.phone || null,
        need: values.need,
        source: "landing_form",
      });

      const created = {
        ...res.data,
        createdAt: res.data.created_at || res.data.createdAt,
      };

      setLeads((prev) => [created, ...prev].slice(0, 6));
      setLeadsSource("api");

      toast.success("Request received", {
        description: "Submitted successfully. We'll get back to you shortly.",
      });
    } catch (e) {
      // Fallback to localStorage if backend is unreachable
      const next = saveLocalLead(localPayload);
      setLeads(next.slice(0, 6));
      setLeadsSource("local");

      toast.message("Saved locally", {
        description:
          "Backend unavailable, so we saved this in your browser (MOCK fallback).",
      });
    } finally {
      form.reset();
      window.setTimeout(() => {
        scrollToId("proposalForm");
      }, 40);
    }
  };

  return (
    <div className="rv-page">
      <Toaster richColors closeButton />

      {/* Header */}
      <header className="rv-header">
        <div className="rv-container">
          <div className="rv-navWrap">
            <a
              href="#top"
              className="rv-logo"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("top");
              }}>
              <span className="rv-logoMark" aria-hidden>
                <RotateCcw className="h-4 w-4" />
              </span>
              {MOCK.brand.name}
            </a>

            <nav className="rv-nav">
              {MOCK.nav.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className="rv-navLink"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId(n.id);
                  }}>
                  {n.label}
                </a>
              ))}
            </nav>

            <div className="rv-navCtas">
              <Button
                className="rv-btn rv-btnSecondary"
                variant="outline"
                onClick={() => scrollToId("contact")}
                type="button">
                Request a proposal
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                className="rv-btn rv-btnPrimary"
                onClick={() => window.open(MOCK.brand.calendlyUrl, "_blank")}
                type="button">
                Book a consultation
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main id="top" className="rv-main">
        <section className="rv-hero">
          <div className="rv-container">
            <div className="rv-heroGrid">
              <div className={`rv-heroCopy ${ready ? "rv-in" : ""}`}>
                <Badge className="rv-pill" variant="secondary">
                  Sports infrastructure + technology delivery
                </Badge>

                <h1 className="rv-display">{MOCK.hero.headline}</h1>
                <p className="rv-bodyLead">{MOCK.hero.subhead}</p>

                <div className="rv-heroBullets">
                  {MOCK.hero.bullets.map((b) => (
                    <div key={b} className="rv-bullet">
                      <span className="rv-bulletIcon" aria-hidden>
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <span className="rv-bulletText">{b}</span>
                    </div>
                  ))}
                </div>

                <div className="rv-heroActions">
                  <Button
                    className="rv-btn rv-btnPrimary rv-btnCta"
                    onClick={() => scrollToId("contact")}
                    type="button">
                    Request a proposal
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <Button
                    className="rv-btn rv-btnSecondary"
                    variant="outline"
                    onClick={() => window.open(MOCK.brand.calendlyUrl, "_blank")}
                    type="button">
                    Book a consultation
                    <Calendar className="h-4 w-4" />
                  </Button>

                  <Button
                    className="rv-btn rv-btnGhost"
                    variant="ghost"
                    onClick={() => (window.location.href = `mailto:${MOCK.brand.email}`)}
                    type="button">
                    Contact us
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>

                <div className="rv-miniProof" aria-label="Highlights">
                  {MOCK.stats.map((s) => (
                    <div key={s.v} className="rv-miniStat">
                      <div className="rv-miniK">{s.k}</div>
                      <div className="rv-miniV">{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rv-heroVisual ${ready ? "rv-in" : ""}`}>
                <div className="rv-visualStack">
                  <Card className="rv-glass rv-photoCard rv-photoPrimary">
                    <CardContent className="rv-photoInner">
                      <AspectRatio ratio={4 / 3}>
                        <img
                          src={MOCK.imagery.heroPrimary}
                          alt="Modern indoor racquet sports facility"
                          className="rv-img" />
                      </AspectRatio>
                    </CardContent>
                  </Card>

                  <Card className="rv-glass rv-photoCard rv-photoSecondary">
                    <CardContent className="rv-photoInner">
                      <AspectRatio ratio={16 / 10}>
                        <img
                          src={MOCK.imagery.heroSecondary}
                          alt="Professional indoor sports court architecture"
                          className="rv-img" />
                      </AspectRatio>
                    </CardContent>
                  </Card>

                  <Card className="rv-glass rv-floatCard">
                    <CardHeader className="rv-floatHeader">
                      <CardTitle className="rv-floatTitle">
                        Delivery you can trust
                      </CardTitle>
                      <CardDescription>
                        Clear scope, reliable systems, launch support.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="rv-floatBody">
                      <div className="rv-floatRow">
                        <span className="rv-floatDot" aria-hidden />
                        <span>Tech stack selection + integration</span>
                      </div>
                      <div className="rv-floatRow">
                        <span className="rv-floatDot" aria-hidden />
                        <span>Operational SOPs + staff handoff</span>
                      </div>
                      <div className="rv-floatRow">
                        <span className="rv-floatDot" aria-hidden />
                        <span>Go‑live checklist + support</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="rv-section">
          <div className="rv-container">
            <div className="rv-sectionHead">
              <h2 className="rv-h2">What we do</h2>
              <p className="rv-body">
                Three ways we help venues launch faster — and run smoother.
              </p>
            </div>

            <Tabs defaultValue={MOCK.services[0]?.id} className="rv-tabs">
              <TabsList className="rv-tabsList">
                {MOCK.services.map((s) => (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    className="rv-tabsTrigger">
                    <ServiceTabIcon id={s.id} />
                    {s.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              {MOCK.services.map((s) => (
                <TabsContent key={s.id} value={s.id} className="rv-tabsContent">
                  <div className="rv-grid2">
                    <Card className="rv-card">
                      <CardHeader>
                        <CardTitle className="rv-cardTitle">{s.title}</CardTitle>
                        <CardDescription className="rv-cardDesc">
                          {s.desc}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="rv-list">
                          {s.bullets.map((b) => (
                            <div key={b} className="rv-listItem">
                              <span className="rv-listIcon" aria-hidden>
                                <Sparkles className="h-4 w-4" />
                              </span>
                              <span>{b}</span>
                            </div>
                          ))}
                        </div>
                        <Separator className="rv-sep" />
                        <div className="rv-inlineCtas">
                          <Button
                            className="rv-btn rv-btnPrimary"
                            onClick={() => scrollToId("contact")}
                            type="button">
                            Get a proposal
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <Button
                            className="rv-btn rv-btnSecondary"
                            variant="outline"
                            onClick={() => window.open(MOCK.brand.calendlyUrl, "_blank")}
                            type="button">
                            Book a consultation
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rv-card rv-cardSoft">
                      <CardHeader>
                        <CardTitle className="rv-cardTitle">Expected outcomes</CardTitle>
                        <CardDescription className="rv-cardDesc">
                          Practical improvements you can feel in day‑to‑day ops.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="rv-outcomes">
                          {MOCK.outcomes.map((o) => (
                            <div key={o.title} className="rv-outcome">
                              <div className="rv-outcomeTop">
                                <Workflow className="h-4 w-4" aria-hidden />
                                <div className="rv-outcomeTitle">{o.title}</div>
                              </div>
                              <div className="rv-outcomeDesc">{o.desc}</div>
                            </div>
                          ))}
                        </div>

                        <div className="rv-techAccent">
                          <AspectRatio ratio={21 / 9}>
                            <img
                              src={MOCK.imagery.techAccent}
                              alt="Technology brand aesthetic"
                              className="rv-img" />
                          </AspectRatio>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </section>

        {/* Approach */}
        <section id="approach" className="rv-section rv-sectionAlt">
          <div className="rv-container">
            <div className="rv-sectionHead">
              <h2 className="rv-h2">How we deliver</h2>
              <p className="rv-body">
                A calm, structured process that keeps launches predictable.
              </p>
            </div>

            <div className="rv-grid3">
              <Card className="rv-card rv-lift">
                <CardHeader>
                  <CardTitle className="rv-stepTitle">1. Discovery</CardTitle>
                  <CardDescription className="rv-cardDesc">
                    Goals, constraints, existing tools, and operational reality.
                  </CardDescription>
                </CardHeader>
                <CardContent className="rv-stepBody">
                  <div className="rv-stepChip">Stakeholders + requirements</div>
                  <div className="rv-stepChip">Venue workflows</div>
                  <div className="rv-stepChip">Success metrics</div>
                </CardContent>
              </Card>

              <Card className="rv-card rv-lift">
                <CardHeader>
                  <CardTitle className="rv-stepTitle">2. Solution map</CardTitle>
                  <CardDescription className="rv-cardDesc">
                    Systems + vendors + timeline, with clear handoffs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="rv-stepBody">
                  <div className="rv-stepChip">Stack selection</div>
                  <div className="rv-stepChip">Integration plan</div>
                  <div className="rv-stepChip">Launch checklist</div>
                </CardContent>
              </Card>

              <Card className="rv-card rv-lift">
                <CardHeader>
                  <CardTitle className="rv-stepTitle">3. Delivery</CardTitle>
                  <CardDescription className="rv-cardDesc">
                    Implementation sprints, testing, training, go‑live.
                  </CardDescription>
                </CardHeader>
                <CardContent className="rv-stepBody">
                  <div className="rv-stepChip">Build + configure</div>
                  <div className="rv-stepChip">QA + rehearsal</div>
                  <div className="rv-stepChip">Support + iteration</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Proof */}
        <section id="proof" className="rv-section">
          <div className="rv-container">
            <div className="rv-sectionHead">
              <h2 className="rv-h2">Credibility, without the noise</h2>
              <p className="rv-body">
                A few signals that you’re working with operators — not just vendors.
              </p>
            </div>

            <div className="rv-proofGrid">
              <Card className="rv-card rv-lift">
                <CardHeader>
                  <CardTitle className="rv-cardTitle">Track record</CardTitle>
                  <CardDescription className="rv-cardDesc">
                    Delivered multiple venue launches and tech rollouts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rv-stats">
                    {MOCK.stats.map((s) => (
                      <div key={s.v} className="rv-stat">
                        <div className="rv-statK">{s.k}</div>
                        <div className="rv-statV">{s.v}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rv-card rv-lift">
                <CardHeader>
                  <CardTitle className="rv-cardTitle">What clients value</CardTitle>
                  <CardDescription className="rv-cardDesc">
                    Fewer surprises, better handover, cleaner integrations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rv-list">
                    <div className="rv-listItem">
                      <span className="rv-listIcon" aria-hidden>
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <span>Clear scope and launch checklist</span>
                    </div>
                    <div className="rv-listItem">
                      <span className="rv-listIcon" aria-hidden>
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <span>Systems chosen for real‑world operations</span>
                    </div>
                    <div className="rv-listItem">
                      <span className="rv-listIcon" aria-hidden>
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <span>Staff training + documentation</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rv-card rv-lift">
                <CardHeader>
                  <CardTitle className="rv-cardTitle">Testimonials</CardTitle>
                  <CardDescription className="rv-cardDesc">
                    Representative quotes (placeholder for now).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rv-testimonials">
                    {MOCK.testimonials.map((t) => (
                      <div key={t.quote} className="rv-quote">
                        <div className="rv-quoteText">“{t.quote}”</div>
                        <div className="rv-quoteBy">
                          <span className="rv-quoteName">{t.name}</span>
                          <span className="rv-quoteRole">{t.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="rv-section rv-sectionAlt">
          <div className="rv-container">
            <div className="rv-sectionHead">
              <h2 className="rv-h2">FAQ</h2>
              <p className="rv-body">Fast answers before we talk.</p>
            </div>

            <Card className="rv-card rv-glass">
              <CardContent className="rv-faq">
                <Accordion type="single" collapsible className="rv-accordion">
                  {MOCK.faqs.map((f, idx) => (
                    <AccordionItem key={f.q} value={`i-${idx}`} className="rv-accItem">
                      <AccordionTrigger className="rv-accTrigger">
                        {f.q}
                      </AccordionTrigger>
                      <AccordionContent className="rv-accContent">
                        {f.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="rv-section">
          <div className="rv-container">
            <div className="rv-sectionHead">
              <h2 className="rv-h2">Let’s set up your venue the right way</h2>
              <p className="rv-body">
                Send your details and we’ll reply to {MOCK.brand.email}. You can also
                email us directly.
              </p>
            </div>

            <div className="rv-grid2">
              <Card className="rv-card" id="proposalForm">
                <CardHeader>
                  <CardTitle className="rv-cardTitle">Request a proposal</CardTitle>
                  <CardDescription className="rv-cardDesc">
                    Tell us what you&apos;re building — we&apos;ll respond via email within 1–2 business days.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="rv-form">
                      <div className="rv-formGrid">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Your name</FormLabel>
                              <FormControl>
                                <Input placeholder="Name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />

                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company / venue</FormLabel>
                              <FormControl>
                                <Input placeholder="Venue name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                      </div>

                      <div className="rv-formGrid">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="you@company.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />

                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone (optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="+91 …" {...field} />
                              </FormControl>
                              <FormDescription>
                                If you prefer WhatsApp/call follow‑up.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                      </div>

                      <FormField
                        control={form.control}
                        name="need"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>What are you building?</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="E.g., 6-court pickleball venue — need booking + tournaments + rating integration, and go-live ops support"
                                className="rv-textarea"
                                {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                      <div className="rv-formActions">
                        <Button className="rv-btn rv-btnPrimary rv-btnCta" type="submit">
                          Submit request
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                          className="rv-btn rv-btnSecondary"
                          variant="outline"
                          type="button"
                          onClick={() => (window.location.href = `mailto:${MOCK.brand.email}`)}>
                          Email instead
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card className="rv-card rv-cardSoft">
                <CardHeader>
                  <CardTitle className="rv-cardTitle">Recent inquiries</CardTitle>
                  <CardDescription className="rv-cardDesc">
                    {isLoadingLeads
                      ? "Loading recent inquiries…"
                      : leadsSource === "api"
                        ? "Pulled from the backend."
                        : "Showing your browser-saved inquiries (MOCK fallback)."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {leads.length === 0 ? (
                    <div className="rv-empty">
                      No form submissions yet. Send one to see it appear here.
                    </div>
                  ) : (
                    <div className="rv-leads">
                      {leads.slice(0, 6).map((l) => (
                        <div key={l.id} className="rv-lead">
                          <div className="rv-leadTop">
                            <div className="rv-leadName">{l.name}</div>
                            <div className="rv-leadMeta">
                              {new Date(l.createdAt || l.created_at || Date.now()).toLocaleString()}
                            </div>
                          </div>
                          <div className="rv-leadCompany">{l.company}</div>
                          <div className="rv-leadEmail">{l.email}</div>
                          <div className="rv-leadNeed">{l.need}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator className="rv-sep" />

                  <div className="rv-contactCard">
                    <div className="rv-contactTitle">Prefer email?</div>
                    <a className="rv-emailLink" href={`mailto:${MOCK.brand.email}`}>
                      {MOCK.brand.email}
                    </a>
                    <div className="rv-contactHint">
                      We typically respond within 1–2 business days.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="rv-footer">
          <div className="rv-container">
            <div className="rv-footerGrid">
              <div>
                <div className="rv-footerBrand">{MOCK.brand.name}</div>
                <div className="rv-footerMeta">
                  Sports infrastructure & technology setup / management.
                </div>
              </div>

              <div className="rv-footerLinks">
                {MOCK.nav.map((n) => (
                  <button
                    key={n.id}
                    className="rv-footerLink"
                    onClick={() => scrollToId(n.id)}
                    type="button">
                    {n.label}
                  </button>
                ))}
              </div>

              <div className="rv-footerCtas">
                <Button
                  className="rv-btn rv-btnPrimary"
                  onClick={() => scrollToId("contact")}
                  type="button">
                  Request a proposal
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  className="rv-btn rv-btnSecondary"
                  variant="outline"
                  onClick={() => window.open(MOCK.brand.calendlyUrl, "_blank")}
                  type="button">
                  Book a consultation
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rv-footerBottom">
              <span>© {new Date().getFullYear()} {MOCK.brand.name}. All rights reserved.</span>
              <span className="rv-footerNote">
                Form submissions are stored locally (MOCK) until backend wiring.
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
