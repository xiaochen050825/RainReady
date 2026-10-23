import {test,expect} from "@playwright/test";
test("invalid imports cannot replace the workspace and valid imports wait for apply",async({page})=>{
 await page.goto('/#plan');await page.getByRole('button',{name:'Import network',exact:true}).click();
 await page.getByLabel('Import network JSON',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({name:'Invalid',synthetic:true,nodes:[],edges:[]}))});
 await expect(page.locator('dialog [role=alert]')).toBeVisible();
 await expect(page.getByRole('button',{name:'Apply to workspace',exact:true})).toBeDisabled();
 await page.getByLabel('Import network JSON',{exact:true}).setInputFiles('public/rainready-network.example.json');
 await expect(page.locator('.import-valid')).toContainText('28 assets');
 await expect(page.getByRole('button',{name:'Apply to workspace',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.locator('.plan-counts')).toContainText('28 assets');
});
test("notes and asset association persist independently from planning",async({page})=>{
 await page.goto('/#inspections');
 await page.getByLabel('Inspector notes',{exact:true}).fill('Inspect inlet before rainfall');
 await page.getByLabel('Linked asset ID',{exact:true}).selectOption('RR-027');
 await page.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(page.locator('.inspection-actions')).toContainText('saved in your browser');
 await page.reload();await expect(page.getByLabel('Inspector notes',{exact:true})).toHaveValue('Inspect inlet before rainfall');
 await expect(page.getByLabel('Linked asset ID',{exact:true})).toHaveValue('RR-027');
});
