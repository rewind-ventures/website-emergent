import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import ContactForm from "@/components/landing/ContactForm";

import {
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Layers,
  Settings2,
  Code2,
} from "lucide-react";

export default function Sections({ data }) {
  const { brand, services, outcomes, faqs, stats } = data;

  return (
    <>
      {/* Services */}
      <section id="services" className="rv2-section">
        <div className="rv2-container">
          <div className="rv2-sectionHead">
            <Badge className="rv2-sectionTag" variant="secondary">
              WHAT WE DO
            </Badge>
            <h2 className="rv2-h2">Comprehensive Sports Infrastructure Solutions</h2>
            <p className="rv2-p">
              From courts to systems to operations — delivered end-to-end.
            </p>
          </div>

          <div className="rv2-cardGrid3">
            {services.map((s) => (
              <Card key={s.id} className="rv2-panel">
                <CardHeader className="rv2-panelHead">
                  <div className="rv2-iconBox" aria-hidden>
                    {s.id === "turnkey" ? (
                      <Layers className="h-5 w-5" />
                    ) : s.id === "tech" ? (
                      <Settings2 className="h-5 w-5" />
                    ) : (
                      <Code2 className="h-5 w-5" />
                    )}
                  </div>
                  <CardDescription className="rv2-panelKicker">
                    {s.id === "turnkey"
                      ? "End-to-End Facility Setup"
                      : s.id === "tech"
                        ? "Smart Venue Technology"
                        : "Custom Solutions"}
                  </CardDescription>
                  <CardTitle className="rv2-panelTitle">{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="rv2-panelDesc">{s.desc}</p>
                  <div className="rv2-bullets">
                    {s.bullets.map((b) => (
                      <div key={b} className="rv2-bullet">
                        <span className="rv2-bulletDot" aria-hidden />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rv2-outcomes">
            {outcomes.map((o) => (
              <div key={o.title} className="rv2-outcomeChip">
                <span className="rv2-outcomeDot" aria-hidden />
                <span className="rv2-outcomeTitle">{o.title}:</span>
                <span className="rv2-outcomeDesc">{o.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof */}
      <section id="proof" className="rv2-section">
        <div className="rv2-container">
          <div className="rv2-sectionHead">
            <Badge className="rv2-sectionTag" variant="secondary">
              TRACK RECORD
            </Badge>
            <h2 className="rv2-h2">Numbers that speak</h2>
            <p className="rv2-p">Proof that delivery is our default.</p>
          </div>

          <div className="rv2-statGrid">
            {stats.map((s, idx) => (
              <div
                key={s.v}
                className={`rv2-metric ${idx === 1 ? "rv2-metricHot" : ""}`}>
                <div className="rv2-metricK">{s.k}</div>
                <div className="rv2-metricV">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="rv2-section">
        <div className="rv2-container">
          <div className="rv2-sectionHead">
            <Badge className="rv2-sectionTag" variant="secondary">
              FAQ
            </Badge>
            <h2 className="rv2-h2">Quick answers</h2>
            <p className="rv2-p">What clients ask before we start.</p>
          </div>

          <Card className="rv2-panel">
            <CardContent className="rv2-faqWrap">
              <Accordion type="single" collapsible className="rv2-accordion">
                {faqs.map((f, idx) => (
                  <AccordionItem key={f.q} value={`f-${idx}`} className="rv2-accItem">
                    <AccordionTrigger className="rv2-accTrigger">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="rv2-accContent">
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
      <section id="contact" className="rv2-section rv2-contact">
        <div className="rv2-container">
          <div className="rv2-contactGrid">
            <div className="rv2-contactLeft">
              <Badge className="rv2-sectionTag" variant="secondary">
                CONTACT
              </Badge>
              <h2 className="rv2-h2">Let’s talk about your venue</h2>
              <p className="rv2-p">
                Reach out by email, phone, or send a message — we’ll get back
                within 1–2 business days.
              </p>

              <div className="rv2-contactItems">
                <div className="rv2-contactItem">
                  <span className="rv2-contactIcon" aria-hidden>
                    <Mail className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="rv2-contactLabel">Email us at</div>
                    <a className="rv2-contactValue" href={`mailto:${brand.email}`}>
                      {brand.email}
                    </a>
                  </div>
                </div>

                <div className="rv2-contactItem">
                  <span className="rv2-contactIcon" aria-hidden>
                    <Phone className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="rv2-contactLabel">Call us at</div>
                    <div className="rv2-contactValue">+91 7020923573</div>
                  </div>
                </div>

                <div className="rv2-contactItem">
                  <span className="rv2-contactIcon" aria-hidden>
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="rv2-contactLabel">Based in</div>
                    <div className="rv2-contactValue">
                      Pune, India — Servicing Across India
                    </div>
                  </div>
                </div>
              </div>

              <Button
                className="rv2-btn rv2-btnPrimary rv2-btnXL"
                onClick={() => (window.location.href = "/consultation")}
                type="button">
Book a consultation
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="rv2-contactRight" id="proposalForm">
              <Card className="rv2-panel">
                <CardHeader>
                  <CardTitle className="rv2-panelTitle">Send a message</CardTitle>
                  <CardDescription className="rv2-panelDesc">
                    Tell us what you’re building and where you are in the journey.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ContactForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="rv2-footer">
        <div className="rv2-container">
          <div className="rv2-footerRow">
            <div className="rv2-footerBrand">{brand.name}</div>
            <div className="rv2-footerMeta">{brand.email}</div>
          </div>
          <div className="rv2-footerBottom">
            <span>© {new Date().getFullYear()} {brand.name}. All rights reserved.</span>
            <span className="rv2-footerNote">Built for modern venue operators.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
