import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import ThemeProvider from "@/components/ThemeProvider";
import LandingV2 from "@/pages/LandingV2";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingV2 />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
