# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Players of Null's Brawl who browse community Lua scripts, inspect their code, configure a battle, and launch the selected script from a phone. Authors also use the app to manage their own scripts and account.

## Product Purpose

Script Library provides a fast native catalog of public script authors and scripts, code viewing and editing, battle configuration, favorites, recent items, account access, and launch into Null's Brawl. Success means the library is immediately useful at launch, keeps the signed-in state stable, and gets the user from a script card to a configured battle with minimal waiting.

## Positioning

The app combines a dynamically maintained public author catalog with direct Null's Brawl battle launch and script management in one native Android interface.

## Operating Context

The app is used one-handed on Android phones. Users frequently reopen recently viewed scripts, switch between the public library and their account, inspect large Lua files, and launch scripts with default or saved battle parameters. Network access and Null's authentication can be delayed, so cached public and account state must remain useful while refresh continues.

## Capabilities and Constraints

- Java Android application without a cross-platform UI framework.
- Supports system, light, and dark themes and multiple interface languages.
- Reads the public author registry from the maintained GitHub branch and calls the Null's scripting API.
- Preserves the existing package identity and release signing key so updates install over prior releases.
- Public browsing and battle launch remain available without requiring sign-in where the upstream service permits it.
- Existing script, account, battle, sync, blocklist, import, and update behavior must remain intact through visual work.

## Brand Commitments

The product name is Script Library. Copy stays direct and functional, without promotional or AI-generated sounding descriptions. The application icon and existing recognizable navigation symbols are preserved, while interface materials may be redesigned around native-feeling translucent surfaces and rounded geometry.

## Evidence on Hand

The repository contains the complete Android source, localization assets, icon resources, a working signed release workflow, and production API integration. No separate design file or external visual reference is present.

## Product Principles

- Show useful cached content immediately and refresh without replacing it with false signed-out states.
- Keep the primary path from discovery to battle launch short and responsive.
- Use consistent native controls, gestures, sheets, and error states throughout the application.
- Preserve full script data and advanced controls while keeping common actions easy to reach.
- Treat network and authentication delays as recoverable background states.

## Accessibility & Inclusion

Respect system light and dark themes, readable contrast, Android font scaling, touch targets, reduced-motion expectations, and localized text expansion.
