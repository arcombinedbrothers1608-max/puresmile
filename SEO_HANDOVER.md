# PureDent / PureSmile - Technical SEO & Handover Guide

This document outlines the technical configurations, indexing steps, and Core Web Vitals optimization guidelines for the PureDent web platform.

---

## 1. Domain & Environment Configuration

Configure your production domain environment variables in `.env`:

```env
# Production Canonical Domain
VITE_SITE_URL=https://puredentclinic.com
CLINIC_WEBSITE_URL=https://puredentclinic.com

# Meta & Head Open Graph defaults
CLINIC_NAME="PureDent Dental Clinic"
CLINIC_PHONE="+1-800-787-3764"
```

---

## 2. Google Search Console & Indexing Setup

### Step 1: Property Verification
1. Navigate to [Google Search Console](https://search.google.com/search-console).
2. Select **Domain** property type and enter `puredentclinic.com`.
3. Add the DNS TXT record provided by Google to your DNS provider (Cloudflare, Namecheap, GoDaddy).

### Step 2: Sitemap Submission
1. Once verified, open **Sitemaps** from the left navigation.
2. In the **Add a new sitemap** input, enter:
   `sitemap.xml`
3. Click **Submit**. Google will crawl all primary routes within 24–48 hours.

### Step 3: Indexing API & Inspection
* Use the **URL Inspection Tool** to verify that Googlebot successfully renders the page, discovers the JSON-LD `Dentist` schema, and correctly evaluates canonical paths.

---

## 3. Core Web Vitals & Performance Optimization

This web app uses high-fidelity Three.js 3D models and smooth animations. Follow these practices to maintain green Core Web Vitals (LCP < 2.5s, FID/INP < 200ms, CLS < 0.1):

### A. Largest Contentful Paint (LCP)
* **3D Canvas Lazy Hydration:** Hero 3D canvases use dynamic imports for `OrbitControls` and progressive loaders so the primary HTML heading (`<h1>`) paints immediately before the WebGL mesh loads.
* **Font Optimization:** Use `font-display: swap;` for serif luxury fonts (`Cinzel` / `Playfair`) so text renders without Flash of Invisible Text (FOIT).

### B. Cumulative Layout Shift (CLS)
* **Explicit Container Heights:** The 3D viewport containers (`HeroScene`, `ScannerScene`) have fixed minimum heights (`min-h-[400px]`, `h-[320px] sm:h-[480px]`) so the page layout never shifts when the WebGL canvas mounts.
* **Direct DOM Refs for HUD Displays:** `PrecisionTechSection.tsx` mutates text and progress bars via direct DOM references (`textContent`, `style.width`), bypassing React's reconciliation engine and preventing layout recalculations during 60 FPS animation.

### C. First Input Delay (FID) / Interaction to Next Paint (INP)
* **Vite Rollup Chunking:** Chunks are split cleanly via Vite, ensuring runtime packages (`three`, `@react-three/fiber`, `lucide-react`) do not block the main execution thread during initialization.

---

## 4. Maintenance Checklist for Future Updates

| Frequency | Task |
|---|---|
| **Weekly** | Check Google Search Console for any 404 crawl errors or indexing alerts. |
| **Monthly** | If new clinic services or specialist doctors are added, append their anchors to `public/sitemap.xml`. |
| **Quarterly** | Test site performance via Google PageSpeed Insights and Lighthouse. |
