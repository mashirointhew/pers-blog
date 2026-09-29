import fs from 'node:fs'; import path from 'node:path';
const title=process.argv.slice(2).join(' ').trim(); if(!title) throw new Error('Usage: npm run new -- "Post title"');
const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); const date=new Date().toISOString().slice(0,10); const file=path.join('src','content','posts',`${slug}.mdx`);
if(fs.existsSync(file)) throw new Error(`Post already exists: ${file}`); fs.writeFileSync(file,`---\ntitle: "${title.replaceAll('"','\\"')}"\ndescription: "Add a short description."\ndate: ${date}\ntags: []\ndraft: true\n---\n\nStart writing here.\n`); console.log(`Created ${file}`);
