/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Omi App URL - URL of the omi web app (e.g. https://app.omi.ac, or http://localhost:3000 for local dev). */
  "appUrl": string,
  /** Omi API URL - URL of the omi Convex site. Most users should leave this as the default. */
  "convexSiteUrl": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `search-resources` command */
  export type SearchResources = ExtensionPreferences & {}
  /** Preferences accessible in the `save-url` command */
  export type SaveUrl = ExtensionPreferences & {}
  /** Preferences accessible in the `save-tab` command */
  export type SaveTab = ExtensionPreferences & {}
  /** Preferences accessible in the `save-note` command */
  export type SaveNote = ExtensionPreferences & {}
  /** Preferences accessible in the `connect` command */
  export type Connect = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `search-resources` command */
  export type SearchResources = {}
  /** Arguments passed to the `save-url` command */
  export type SaveUrl = {}
  /** Arguments passed to the `save-tab` command */
  export type SaveTab = {}
  /** Arguments passed to the `save-note` command */
  export type SaveNote = {}
  /** Arguments passed to the `connect` command */
  export type Connect = {}
}

