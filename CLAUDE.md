# Rang De

Next.js (App Router) + TypeScript + Tailwind v4. Must deploy cleanly on Vercel (`npm run build` passes).

## Rules

- **Tokens:** all design tokens live in `styles/tokens.css`. Never hardcode colours, sizes, spacing, radii, shadows or font values anywhere else, including arbitrary Tailwind values like `p-[18px]` or `bg-[#fff]`.
- **Tailwind:** `styles/tailwind-theme.css` maps every token to a utility, and Tailwind's defaults are cleared, so only token utilities exist. Spacing names are Figma step numbers, not multiples (`p-4` = step 4), so `*-0` is step 0 = 2px: use `inset-zero`, `top-zero`, `left-zero` etc. (or `translate-none`) for a true 0. `r` = responsive, `x` = off-scale pixel value. Read the theme file for the names.
- **Components:** live in `components/ui` and are exported from `components/ui/index.ts`. Reuse them. Never recreate a button, input, tab, popup, etc. inline. Extend the existing component instead.
- **Icons:** only through `<Icon name="..." />` (SVGs in `public/icons`) or `<MotionIcon name="..." />` (Lottie JSON in `public/icons/motion`). Don't draw, inline or import icons any other way.
- **Ask first:** if a token, component, variant, state or icon is missing, ask before inventing it. Do not guess values. When the user shares a screenshot or Figma link, build from it using existing tokens and components.
- Source of truth is the Figma file "Rang De Design System v2". Light theme only.
- `app/page.tsx` is a component gallery for checking the system. It is not a real page.

## Components

Import from `@/components/ui`.

- **Button:** `<Button variant="primary" size="lg" tone="white" iconAfter={<Icon name="cart-arrow" />}>Pay</Button>` (variants: primary, secondary, tertiary, pill, underlined; `status` success/delete on primary lg).
- **Input:** `<Input label="Phone" error="Required" />` (`variant="compact"` for the right-aligned box).
- **Tabs:** `<Tabs level={2} items={[{ id: "a", label: "A" }]} value={tab} onChange={setTab} />` (`size="lg"` on level 2 = P3 medium black labels, one line).
- **Accordion:** `<Accordion title="Question" defaultOpen>Answer</Accordion>`.
- **Tooltip:** `<Tooltip arrow="bottom" pointer="center" footer={{ label: "Total", value: "₹ 1,498" }}>Text</Tooltip>`.
- **Popup:** `<Popup variant="cta" text="Are you sure?" primaryLabel="Accept" onClose={close} />` (variants: default, priority, centre, xirr, cta).
- **BottomBand:** `<BottomBand variant="progress" title="₹30,000 left" goalLabel="of ₹50,000 goal" progress={0.6} actionLabel="Invest" />`.
- **CartBand:** `<CartBand label="1 Investment added" avatars={urls} onAction={pay} />`.
- **Icon:** `<Icon name="chevron-down" />` (names are the `IconName` type in `Icon.tsx`).
- **MotionIcon:** `<MotionIcon name="eye-morph-select" size={32} active={hovered} playKey={taps} />` for animated Lottie icons (JSON in `public/icons/motion`, names are `MotionIconName`). `active` plays to the selected state (`ACTIVE_FRAME`), false plays back; changing `playKey` plays the whole file once.
- **Slider:** `<Slider label="Zoom" min={0} max={4} value={v} onChange={setV} />` snaps to steps, thumb glides between them.
- **Header / Footer:** `<Header banner="..." />` (General / Investment / Focus, logged out) and `<Footer />` (Full).

## Header, footer and brand assets

- **Header:** Figma `Common Assets > Header` (https://www.figma.com/design/afoBLnoe5mdenYa4HTKtUU/Rang-De-Design-System-v2?node-id=10544-8749). Desktop and mobile top nav. The states are General, Investment (no Invest CTA) and Focus (no navigation), each logged in or out. Includes the logo component.
- **Footer:** Figma `Common Assets > Footer` (https://www.figma.com/design/afoBLnoe5mdenYa4HTKtUU/Rang-De-Design-System-v2?node-id=10548-576). Full (browsing pages), Compact (action pages), and Compact + security proof (checkout), on desktop and mobile.
- **Assets:** logo `public/brand/rangde-logo.svg`, footer tree `public/brand/rangde-tree.svg`, social icon strip `public/brand/social-icons.svg`, RBI seal `public/brand/rbi-seal.png`, menu icon `public/icons/menu.svg`.
- `test.html` has a plain HTML/CSS version of the General / Logged Out header and the Full footer. React `Header` (logged out only) and `Footer` (Full only) now exist; ask before adding logged-in or Compact variants.

## Not built yet (ask before assuming)

Toggle, Arrow, Back and standalone Close buttons, Shine effect, waitlisted bottom band, animated cart steps, dark-mode buttons, and the Common assets page.
