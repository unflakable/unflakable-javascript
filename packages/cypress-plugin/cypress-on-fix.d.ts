// Copyright (c) 2023-2024 Developer Innovations, LLC

declare module "cypress-on-fix" {
  import * as Cypress from "cypress";
  export default function onProxy(
    on: Cypress.PluginEvents
  ): Cypress.PluginEvents;
}
