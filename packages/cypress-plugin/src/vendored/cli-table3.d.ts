// Copyright (c) 2023 Developer Innovations, LLC

// Cypress imports this even though it's not part of the cli-table3 exports, so we add some types
// here.
declare module "cli-table3/src/utils.js" {
  import { default as Table } from "cli-table3";

  function mergeOptions(
    options: Table.TableConstructorOptions,
    defaults?: Table.TableConstructorOptions
  ): Table.TableConstructorOptions;
}
