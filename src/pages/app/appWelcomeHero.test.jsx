// Session 43 (v282): the installed app (start_url /app) shows Ravi's Claude Design login screen;
// the website "/" keeps its own landing on phones.
import React from "react";
import fs from "fs";
import path from "path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const apiMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../lib/api", () => ({ api: apiMock }));
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: null, loading: false }) }));
import AppWelcome from "./AppWelcome";

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
afterEach(() => { cleanup(); apiMock.get.mockReset(); vi.useRealTimers(); delete window.__ybSplash; });
const show = () => render(<MemoryRouter><AppWelcome /></MemoryRouter>);

describe("installed-app welcome = Claude Design login", () => {
  it("has the four carousel slides and the photo role cards", () => {
    apiMock.get.mockResolvedValue({ data: { enabled: false } });
    show();
    expect(screen.getAllByText(/Get paid for every/).length).toBe(2); // slide 1 + its loop copy
    expect(screen.getByText(/Pay only on delivery\./)).toBeTruthy();
    expect(screen.getByText(/Both sides protected\./)).toBeTruthy();
    expect(screen.getByText(/downloads in a month/)).toBeTruthy();
    expect(screen.getByAltText("Ybex creators").getAttribute("src")).toBe("/app-login/creators.webp");
    expect(screen.getByAltText("Brands on Ybex").getAttribute("src")).toBe("/app-login/brands.webp");
    for (const f of ["creators", "brands", "yukti", "wefrnd", "camera"]) expect(fs.existsSync(`public/app-login/${f}.webp`)).toBe(true);
  });

  it("cards go to the app's email screen; no escrow wording", () => {
    apiMock.get.mockResolvedValue({ data: { enabled: false } });
    show();
    expect(screen.getByTestId("app-role-creator").getAttribute("href")).toBe("/app/continue/creator");
    expect(screen.getByTestId("app-role-brand").getAttribute("href")).toBe("/app/continue/brand");
    expect(document.body.textContent.toLowerCase()).not.toContain("escrow");
    expect(screen.getAllByText(/Secure payment hold/).length).toBeGreaterThan(0);
  });

  it("carousel moves by itself and the dots jump", () => {
    vi.useFakeTimers();
    apiMock.get.mockResolvedValue({ data: { enabled: false } });
    show();
    const track = screen.getByTestId("app-login-track");
    expect(track.style.transform).toBe("translateX(0%)");
    act(() => { vi.advanceTimersByTime(3600); });
    expect(track.style.transform).toBe("translateX(-20%)");
    fireEvent.click(screen.getByLabelText("Go to slide 4"));
    expect(track.style.transform).toBe("translateX(-60%)");
  });

  it("waits behind the splash, then drops in when the splash slides up", () => {
    apiMock.get.mockResolvedValue({ data: { enabled: false } });
    const sp = document.createElement("div"); sp.id = "yb-splash"; document.body.appendChild(sp);
    window.__ybSplash = { exit() {} };
    show();
    const hero = screen.getByTestId("landing-mobile-hero");
    expect(hero.style.transform).toBe("translateY(-110%)");
    act(() => { window.dispatchEvent(new Event("ybex:splash-up")); });
    expect(hero.style.animation).toContain("yb-drop");
    sp.remove();
  });

  it("demo link only when the server says DEMO_LOGIN is on", async () => {
    apiMock.get.mockResolvedValue({ data: { enabled: true } });
    show();
    expect((await screen.findByTestId("app-demo-link")).getAttribute("href")).toBe("/login?demo=1");
    expect(read("src/lib/useDemoLogin.js")).toContain("useState(Boolean(import.meta.env.DEV))");
  });

  it("website landing no longer carries the app hero; email screen is preloaded", () => {
    const landing = read("src/pages/dashboard/Landing.jsx");
    expect(landing).not.toContain("LandingMobileHero");
    expect(landing).not.toContain('<div className="hidden md:block">\n        <Hero />');
    expect(read("src/App.jsx")).toContain('import AppContinue from "./pages/app/AppContinue";');
    expect(read("src/App.jsx")).toContain('element={<AppContinue />}');
  });
});
