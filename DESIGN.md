---
name: Script Library
description: A native Android script library built from calm translucent layers.
colors:
  light-ground: "#EEF3FF"
  light-surface: "#FFFFFF"
  light-ink: "#121827"
  light-muted: "#596579"
  light-accent: "#465BD8"
  dark-ground: "#080B14"
  dark-surface: "#171D2A"
  dark-ink: "#F5F7FF"
  dark-muted: "#ABB4C7"
  dark-accent: "#AEBAFF"
  error: "#B4233F"
typography:
  headline:
    fontFamily: "sans-serif-medium"
    fontSize: "27sp"
    fontWeight: 500
  title:
    fontFamily: "sans-serif-medium"
    fontSize: "18sp"
    fontWeight: 500
  body:
    fontFamily: "sans-serif"
    fontSize: "15sp"
    fontWeight: 400
  label:
    fontFamily: "sans-serif"
    fontSize: "12sp"
    fontWeight: 400
rounded:
  control: "16dp"
  card: "22dp"
  sheet: "30dp"
spacing:
  xs: "4dp"
  sm: "8dp"
  md: "12dp"
  lg: "20dp"
  xl: "30dp"
---

# Design System: Script Library

## Overview

**Creative North Star: "The Liquid Library"**

Script Library uses familiar Android structure with the depth and motion of iOS 26 Liquid Glass. Cool ink-blue grounds and restrained violet accents support dense script content, while translucent tonal surfaces make navigation, controls, dialogs, and bottom sheets feel like parts of one continuous object.

The interface stays functional first: type hierarchy, touch targets, and stable placement carry the task. Glass appears only when one layer floats above another or groups related controls. It never obscures code, metadata, or list density.

**Key Characteristics:**

- Cool blue-neutral light and dark themes.
- Translucent tonal surfaces with one crisp highlight edge.
- Dense lists paired with generous 48 dp controls.
- Draggable bottom sheets for deep tasks and details.
- One accent family for selection and primary actions.
- A slow gradient backdrop that keeps empty space visually alive without competing with content.
- Liquid Glass and system-style variants, plus comfortable and compact density.

## Colors

The palette is cool, low-noise, and tuned separately for light and dark environments.

### Primary

- **Signal Indigo:** The light accent marks primary actions, active navigation, links, and progress.
- **Mist Violet:** The dark accent performs the same role without blooming against the dark ground.

### Neutral

- **Cloud Ground / Midnight Ground:** Full-screen fields beneath translucent surfaces.
- **Clear Surface / Deep Surface:** Card and control bases, made translucent when elevated above content.
- **Ink / Frost Ink:** Primary text roles.
- **Slate / Silver Slate:** Secondary text, metadata, and inactive navigation.

### Named Rules

**The One Signal Rule.** Accent color identifies action or selection; it does not tint ordinary card backgrounds.

**The Theme Pair Rule.** Light and dark palettes are authored counterparts, never automatic inversions.

## Typography

**Display Font:** Android system sans medium
**Body Font:** Android system sans
**Label/Mono Font:** Android system monospace for Lua code only

**Character:** The system typeface keeps localized controls familiar and reliable. Weight and size create hierarchy; decorative fonts are absent from task surfaces.

### Hierarchy

- **Headline** (500, 27sp): screen titles and primary section anchors.
- **Title** (500, 18sp): cards, sheets, and important actions.
- **Body** (400, 15sp): descriptions, forms, and help content.
- **Label** (400, 12sp): dates, UUIDs, counts, and supporting status.

### Named Rules

**The Code Exception Rule.** Monospace is reserved for Lua, UUIDs, and exact data.

## Layout

Phone screens use a compact top app bar, one scrollable work area, and four bottom navigation destinations. Main content uses 20 dp horizontal insets. Related controls group at 8–12 dp; separate tasks open at 20–30 dp. Sheets occupy at most 92 percent of the viewport and keep their primary action pinned above scrollable content.

## Elevation & Depth

Depth comes from tonal layering, translucency, a crisp highlight edge, and system blur on Android 12 and newer. Controls and cards share the same glass edge; floating navigation and modal layers add restrained elevation or background blur.

**The Earned Glass Rule.** Blur belongs to floating layers with a clear foreground/background relationship; content cards stay readable without relying on blur.

## Shapes

Controls use 16 dp corners, cards use 22 dp, and sheets use 30 dp top corners. Small indicators may be pill-shaped. Bottom sheets have a visible drag handle and square lower corners aligned to the screen edge.

## Components

### Buttons

- **Shape:** Gently rounded controls (16dp) with a minimum 48dp touch height.
- **Primary:** Solid accent fill, high-contrast label, and leading icon when the action has one.
- **Secondary:** Translucent surface with ink label and accent icon.
- **State:** Ripple feedback, disabled native state, and concise progress text nearby.
- **Motion:** Press to 96.5 percent in 85ms, then settle to full size with a soft 260ms curve.

### Cards / Containers

- **Corner Style:** Soft card corners (22dp).
- **Background:** Translucent tonal surface with one subtle highlight edge.
- **Shadow Strategy:** Flat at rest; depth is reserved for floating layers.
- **Internal Padding:** 14–20dp according to content density.

### Inputs / Fields

- **Style:** Translucent surface, 16dp corners, readable hint and input colors in both themes.
- **Focus:** Native caret and keyboard behavior remain intact.
- **Error / Disabled:** Inline field error where recovery belongs to one field; a themed modal for request-level failures.

### Navigation

Four destinations remain fixed on compact screens. The active item uses the accent and a quiet tonal selection surface; inactive items use the muted role. Every destination keeps its icon and label.

### Draggable Sheet

Details, battle settings, profiles, code tools, and pickers rise from the bottom with a visible handle. Dragging the header down dismisses the sheet after a clear threshold; otherwise it settles back into place.

### Glass Notice

Status notices rise above navigation from a small point, expand into a readable glass pill, and collapse after the message has been read. Reduced-motion settings skip the transformation.

## Do's and Don'ts

### Do:

- **Do** show cached content immediately while refreshing state in the background.
- **Do** keep primary battle launch available above long parameter lists.
- **Do** use the shared icon set and minimum 48dp touch targets.
- **Do** preserve localized text expansion and system font scaling.

### Don't:

- **Don't** use platform-default AlertDialog styling beside custom application surfaces.
- **Don't** stack duplicate sheets for the same action.
- **Don't** use glass as an opaque decorative card effect or behind code text.
- **Don't** hide recovery actions inside generic error messages.
