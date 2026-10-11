#!/usr/bin/env node
import{readFileSync}from"node:fs";import{projectCampaignPretoolContext}from"../src/campaign-pretool.mjs";export{projectCampaignPretoolContext};if(import.meta.main){const i=JSON.parse(readFileSync(0,"utf8"));const r=projectCampaignPretoolContext(i.reading,i.payload);if(r!==null)process.stdout.write(`${JSON.stringify(r)}\n`);}
