// @ts-check
import { defineConfig } from "astro/config";

// Marketing site for proto. Served at cli.protolabs.studio, with the VitePress
// docs folded in at /docs by the marketing-deploy workflow.
export default defineConfig({
  site: "https://cli.protolabs.studio",
  output: "static",
});
