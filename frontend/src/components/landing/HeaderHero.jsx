import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { ArrowRight } from "lucide-react";

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function useInViewAnimation() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 50);
    return () => window.clearTimeout(t);
  }, []);
  return ready;
}

export default function HeaderHero({ brand, nav, stats }) {
  const ready = useInViewAnimation();

  return (
    <>
      <header className="rv2-header">
        <div className="rv2-container">
          <div className="rv2-headerRow">
            <a
              href="#top"
              className="rv2-logo"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("top");
              }}>
              <span className="rv2-logoMark" aria-hidden>
                <span className="rv2-logoMonogram">RV</span>
              </span>
              <span className="rv2-logoText">{brand.name}</span>
            </a>

            <nav className="rv2-nav">
              {nav.map((n) => (
                <a
                  key={n.id}
                  className="rv2-navLink"
                  href={`#${n.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId(n.id);
                  }}>
                  {n.label}
                </a>
              ))}
            </nav>

            <div className="rv2-headerCtas">
              <Button
                className="rv2-btn rv2-btnPrimary"
                onClick={() => window.open(brand.calendlyUrl, "_blank")}
                type="button">
                Book a consultation
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section id="top" className="rv2-hero">
        <div className="rv2-container">
          <div className={`rv2-heroInner ${ready ? "rv2-in" : ""}`}>
            <Badge className="rv2-pill" variant="secondary">
              <span className="rv2-pillDot" aria-hidden />
              Sports Infrastructure Experts
            </Badge>

            <h1 className="rv2-heroTitle">
              Build world-class <span className="rv2-accent">sports venues</span>
              <br />
              at scale.
            </h1>

            <p className="rv2-heroSub">
              Turn-key facility setup, venue tech delivery, and bespoke software —
              designed for real-world operations.
            </p>

            <div className="rv2-heroCtas">
              <Button
                className="rv2-btn rv2-btnPrimary rv2-btnXL"
                onClick={() => window.open(brand.calendlyUrl, "_blank")}
                type="button">
                Book a consultation
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                className="rv2-btn rv2-btnSecondary rv2-btnXL"
                variant="outline"
                onClick={() => scrollToId("contact")}
                type="button">
                Request a proposal
                <Calendar className="h-4 w-4" />
              </Button>
              <Button
                className="rv2-btn rv2-btnGhost"
                variant="ghost"
                onClick={() => (window.location.href = `mailto:${brand.email}`)}
                type="button">
                Contact us
                <Mail className="h-4 w-4" />
              </Button>
            </div>

            <div className="rv2-statRow" aria-label="Track record">
              {stats.map((s, idx) => (
                <div
                  key={s.v}
                  className={`rv2-statCard ${idx === 1 ? "rv2-statCardHot" : ""}`}>
                  <div className="rv2-statK">{s.k}</div>
                  <div className="rv2-statV">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
