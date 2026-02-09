import React from "react";

import "@/landing-v2.css";

import "@/App.css";
import { HashRouter, Routes, Route } from "react-router-dom";

import ThemeProvider from "@/components/ThemeProvider";
import LandingV2 from "@/pages/LandingV2";
import Consultation from "@/pages/Consultation";

// Using HashRouter for GitHub Pages compatibility
// This means routes will be like: rewind-ventures.com/#/consultation
function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LandingV2 />} />
          <Route path="/consultation" element={<Consultation />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
