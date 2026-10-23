import {test,expect} from "@playwright/test";
test("a repeated image cannot verify cleanup",async({page})=>{
 await page.goto('/#inspections');
 await page.getByLabel('After photo file',{exact:true}).setInputFiles('public/demo-drain.jpg');
 await expect(page.locator('.verification-status')).toContainText('Same or near-identical photo detected');
 await expect(page.getByRole('button',{name:'Approve & close',exact:true})).toBeDisabled();
 await expect(page.locator('.inspection-detail')).toContainText('Asset condition unchanged');
});
test("mobile task view remains usable without page overflow",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#plan');
 await page.getByRole('button',{name:'Tasks',exact:true}).click();
 await expect(page.locator('.mobile-task-list')).toBeVisible();
 await expect(page.locator('.mobile-task-list')).toContainText('Arrive +7 min');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Mobile review plan',exact:true}).click();
 await expect(page.locator('dialog')).toBeVisible();
 expect(await page.locator('dialog').evaluate(e=>e.getBoundingClientRect().width<=innerWidth)).toBe(true);
});
