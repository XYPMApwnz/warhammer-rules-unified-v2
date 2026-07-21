import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const exists=name=>fs.existsSync(path.join(root,name));
const results=[];
const check=(name,ok,detail='')=>results.push({name,ok,detail});

const library=read('index.html');
const book=read('books/death-guard/index.html');
const app=read('books/death-guard/scripts/app.js');
const sw=read('service-worker.js');

for(const file of ['service-worker.js','books/death-guard/scripts/app.js']){
  try{new vm.Script(read(file),{filename:file});check(file+' syntax',true);}
  catch(error){check(file+' syntax',false,error.message);}
}

const bookFiles=[
  'books/death-guard/index.html','books/death-guard/assets/icon-v4.svg',
  'books/death-guard/styles/tokens.css','books/death-guard/styles/layout.css',
  'books/death-guard/styles/navigation.css','books/death-guard/styles/content.css',
  'books/death-guard/styles/popups.css','books/death-guard/scripts/data.js',
  'books/death-guard/scripts/navigation-controller.js','books/death-guard/scripts/popup-controller.js',
  'books/death-guard/scripts/journey-controller.js','books/death-guard/scripts/ui-controllers.js',
  'books/death-guard/scripts/app.js'
];

check('library links to the Death Guard entry file',library.includes('href="books/death-guard/index.html"'));
check('all integrated Death Guard files exist',bookFiles.every(exists),bookFiles.filter(file=>!exists(file)).join(', '));
check('Death Guard links to the root manifest',book.includes('href="../../manifest.webmanifest"'));
check('Death Guard exposes an explicit library link',book.includes('class="library-link"')&&book.includes('href="../../index.html"'));
check('Death Guard delegates to the root service worker',app.includes("register('../../service-worker.js')"));
check('no nested service worker or manifest is shipped',!exists('books/death-guard/service-worker.js')&&!exists('books/death-guard/manifest.webmanifest'));
check('unified v2 cache prefix is isolated',sw.includes('warhammer-rules-unified-v2-')&&!sw.includes('const CACHE_PREFIX = "warhammer-rules-"'));
check('unified cache revision is current',sw.includes('`${CACHE_PREFIX}v3`'));
check('navigation responses are cached under their own URL',sw.includes('fetchAndCache(request);')&&!sw.includes('fetchAndCache(request, LIBRARY_FALLBACK)'));
check('Death Guard has a dedicated offline fallback',sw.includes('DEATH_GUARD_FALLBACK')&&sw.includes('/books/death-guard/'));
const versionedBookFile=file=>/\.(css|js)$/.test(file)?`"./${file}?v=3"`:`"./${file}"`;
check('every book shell file is precached',bookFiles.every(file=>sw.includes(versionedBookFile(file))||file==='books/death-guard/index.html'&&sw.includes('DEATH_GUARD_FALLBACK')),bookFiles.filter(file=>!sw.includes(versionedBookFile(file))&&!(file==='books/death-guard/index.html'&&sw.includes('DEATH_GUARD_FALLBACK'))).join(', '));
check('book shell assets use release-versioned URLs',bookFiles.filter(file=>/\.(css|js)$/.test(file)).every(file=>book.includes(`./${file.replace('books/death-guard/','')}?v=3`)));

for(const result of results)console.log(`${result.ok?'PASS':'FAIL'}  ${result.name}${result.detail?' — '+result.detail:''}`);
const failed=results.filter(result=>!result.ok);
console.log(`\n${results.length-failed.length}/${results.length} integration checks passed.`);
if(failed.length)process.exitCode=1;
