#!/usr/bin/env node
import{readFileSync}from"node:fs";import{projectCampaignRollup}from"../src/campaign-rollup.mjs";export{projectCampaignRollup};if(import.meta.main){const i=JSON.parse(readFileSync(0,"utf8"));process.stdout.write(`${JSON.stringify(projectCampaignRollup(i.snapshot,i.params))}\n`);}
