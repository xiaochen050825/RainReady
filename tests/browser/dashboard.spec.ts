import {test,expect} from "@playwright/test";
test("approved landing opens the working plan and capacity edits invalidate approval",async({page})=>{
 await page.goto('/');await page.locator('.product-header').getByRole('button',{name:'Open workspace'}).click();
 await expect(page.locator('.plan-counts')).toContainText('5 scheduled');
 await page.getByRole('button',{name:'Review plan',exact:true}).click();
 await page.getByRole('button',{name:'Approve this plan',exact:true}).click();
 await expect(page.locator('dialog .status')).toContainText('Approved');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.getByRole('button',{name:'Remove one crew',exact:true}).click();
 await expect(page.locator('.plan-counts')).toContainText('2 scheduled');
 await expect(page.locator('.workspace-title .status')).toContainText('Draft');
 await page.reload();await expect(page.locator('.stepper output')).toHaveText('1');
 await expect(page.locator('.plan-counts')).toContainText('26 deferred');
});
test("playback moves the simulation clock and selecting a task changes the inspector",async({page})=>{
 await page.goto('/#plan');await page.getByRole('button',{name:'Play preview',exact:true}).click();
 await expect.poll(async()=>Number(await page.getByLabel('Crew preview time',{exact:true}).inputValue())).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Pause preview',exact:true}).click();
 await page.locator('.timeline-block.work').filter({hasText:'RR-012'}).click();
 await expect(page.locator('.asset-sheet h2')).toHaveText('RR-012');
 await page.getByRole('button',{name:'Review plan',exact:true}).click();
 await page.keyboard.press('Escape');await expect(page.locator('dialog')).toHaveCount(0);
});
test("evidence runs seeded comparisons and keeps negative results",async({page})=>{
 await page.goto('/#evidence');await page.getByRole('button',{name:'Run comparison',exact:false}).click();
 await expect(page.locator('.chart-row')).toHaveCount(3);
 await expect(page.locator('.chart-row').nth(0)).toContainText('-4.08%');
 await expect(page.locator('.chart-row').nth(1)).toContainText('-16.70%');
 await expect(page.locator('.chart-row').nth(2)).toContainText('+15.37%');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export results ↗',exact:true}).click();
 expect((await download).suggestedFilename()).toBe('rainready-comparison.json');
});

