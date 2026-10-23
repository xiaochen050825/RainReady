// Generate an idempotent D1 seed. Execute with Wrangler after reviewing the SQL.
// A new owner key preserves the previous shared workspace as a recoverable record.
import {writeFile} from 'node:fs/promises';
import {BASELINE_OWNER,createDemoValues} from '../lib/demoScenario.ts';
const destination=process.argv[2];if(!destination)throw new Error('Provide an output SQL path.');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const key='baselines/taman-rintis-v2.json';
const sql=`INSERT OR IGNORE INTO workspace_chunks(object_key,part,content) VALUES(${quote(key)},0,${quote(JSON.stringify(createDemoValues()))});\nINSERT OR IGNORE INTO workspaces(owner_id,revision,object_key,updated_at) VALUES(${quote(BASELINE_OWNER)},1,${quote(key)},${quote(new Date().toISOString())});\n`;
await writeFile(destination,sql);console.log('Read-only baseline seed written. Existing workspaces are preserved.');
