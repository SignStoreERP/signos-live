### 🟢 SignOS Production Portal (Legacy Version)
**Status:** 🛑 DEPRECATED & MIGRATED
**New Architecture:** Vercel (UI) + Supabase PostgreSQL & Deno Edge Functions (Backend)
**New Repository:** [SignStoreERP/SignOS-v3-Supabase](https://github.com/SignStoreERP/SignOS-v3-Supabase)
**New Live Portal:** [https://signos-v3-supabase.vercel.app/](https://signos-v3-supabase.vercel.app/)

---

#### 📖 What was this repository?
This repository previously hosted the **Live Production Storefront (`signos-live`)** for the legacy Google Sheets version of the SignOS ERP.

It served as the primary, stable user portal for the Sales and Production teams. All quoting modules, administrative matrices, and system tools hosted here were strictly version-controlled and manually promoted from our development sandbox after passing mathematical stress tests.

#### 🔐 Legacy Security & Access
Because this interface was exposed to the web, it utilized a strict client-side gatekeeper:
*   **Session Tracking:** Users were required to enter a 6-digit Staff PIN, which an Apps Script API verified against a hidden Master_Staff registry.
*   **Role-Based UI:** The `menu.html` dashboard dynamically injected and hid tools based on `SALES`, `PROD`, `ADMIN`, or `SUPER` permission booleans passed via the API payload.

#### 🚀 Transition to the New SignOS v4.0 ERP
To provide our team with faster load times, deeper Freshdesk integration, and more robust database security, **the Google Sheets API version of this portal has been permanently shut down.**

The entire dataset—including our Master Sheets, Cost Matrices, and Product Logic—has been successfully extracted via the Omni-Migration Console and seeded into a new **Supabase PostgreSQL** architecture. The user interface is now decoupled and hosted on Vercel.

**All users navigating to this old portal URL will now be automatically redirected via a hard HTTP redirect in `index.html` directly to the new SignOS application.**