Phased Plan
Phase 1: Branding Only
Change visible app name/logo to PricePilot: Android label, iOS display name, Flutter app title, web manifest/title, reusable logo widget/asset. No business logic changes.

Testing: local Flutter analyze/build checks. No backend deploy needed unless logo assets are server-hosted, which they are not.

Phase 2: Search Suggestions + Previous Search UI
Fix /products/search to return multiple real matching products from existing DB/store product data, with IDs, names, images, brand/category/store context. Keep fallback behavior only if needed, but prioritize real rows.

Then restore/polish the suggestion list UI to match the attached “old” design: thumbnail, product name, brand/store/category, clear add action, stable image loading.

Before live testing this phase, I will stop and ask you to push/update the backend on 213.199.35.225/tripsave.

Phase 3: Clearance Data + Clearance UI
Make clearance mean real discounted items only: sale_price < price, correct original price, clearance price, percent saved, product name, brand, image. If current DB lacks sale prices, wire the existing Flipp/original-price path or another real source into the backend rather than faking discounts.

Then improve clearance cards with larger product images, clean pricing, brand/store labels, and obvious clearance badges.

Before live testing this phase, I will ask you to deploy backend changes first.

Phase 4: Gas + Maps
Hide diesel everywhere in the app’s gas nearby/details UI and ensure regular gas is the only displayed fuel.

For maps, replace hardcoded map pins with real nearby store data, handle missing/invalid coordinates safely, and fit the map to show all nearby stores returned by the API.

Backend testing may be needed for /stores; I saw one live /stores request time out, so we should verify that endpoint after any map-related fix.

Phase 5: “How Far?” UX
Set onboarding default selection to 5 miles, update “Skip for now” to save 5, and clean up the page layout so it feels intentional and not oversized/awkward. This is frontend-only unless we also decide to change backend/user default fallbacks.

Phase 6: Final Regression
Run focused checks only around the 9 requests: search suggestions, search result UI, clearance, regular gas display, nearby store map, onboarding radius, and branding. Then we do one final deployed smoke test.