"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme]   = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("didit-identity-theme") || "dark";
    setTheme(stored);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("didit-identity-theme", next);
  };

  if (!mounted) return null;
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        position:       "fixed",
        bottom:         20,
        right:          20,
        zIndex:         9999,
        width:          40,
        height:         40,
        borderRadius:   "50%",
        border:         "1px solid var(--border)",
        background:     "var(--surface)",
        color:          "var(--text)",
        fontSize:       "1.1rem",
        cursor:         "pointer",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        boxShadow:      isDark ? "0 2px 12px rgba(0,0,0,0.5)" : "0 2px 12px rgba(0,0,0,0.15)",
        transition:     "background .2s, box-shadow .2s",
      }}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
