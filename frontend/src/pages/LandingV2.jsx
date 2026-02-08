import React from "react";

import { Toaster } from "@/components/ui/sonner";
import { MOCK } from "@/mock";

import HeaderHero from "@/components/landing/HeaderHero";
import Sections from "@/components/landing/Sections";

export default function LandingV2() {
  return (
    <div className="rv2-page">
      <Toaster richColors closeButton />
      <HeaderHero brand={MOCK.brand} nav={MOCK.nav} stats={MOCK.stats} />
      <main className="rv2-main">
        <Sections data={MOCK} />
      </main>
    </div>
  );
}
