import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(projectRoot,'books','death-guard');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const readProject=name=>fs.readFileSync(path.join(projectRoot,name),'utf8');
const html=read('index.html');
const bookData=JSON.parse(read('content/death-guard-rules.en.json'));
const files=['scripts/data.js','scripts/navigation-controller.js','scripts/popup-controller.js','scripts/journey-controller.js','scripts/ui-controllers.js','scripts/app.js'];
const results=[];
const check=(name,ok,detail='')=>results.push({name,ok,detail});

for(const file of files){try{new vm.Script(read(file),{filename:file});check(file+' syntax',true);}catch(error){check(file+' syntax',false,error.message);}}

const markup=html.replace(/<script[\s\S]*?<\/script>/gi,'');
const ids=[...markup.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
check('HTML IDs are unique',duplicateIds.length===0,duplicateIds.join(', '));
const idSet=new Set(ids);
const navTargets=[...markup.matchAll(/data-nav-target="([^"]+)"/g)].map(match=>match[1]);
const trackTargets=[...markup.matchAll(/data-track="([^"]+)"/g)].map(match=>match[1]);
const walkBlocks=bookData.sections.flatMap(section=>[...(section.blocks||[]),...(section.subsections||[]).flatMap(sub=>sub.blocks||[])]);
const blockCount=type=>walkBlocks.filter(block=>block.type===type).length;
check('canonical content audit is 9 detachments, 36 datasheets and 366 terms',bookData.audit.detachments===9&&bookData.audit.datasheets===36&&bookData.glossary.length===366);
check('full gameplay block inventory is present',blockCount('enhancement')===30&&blockCount('rule')===45&&blockCount('statline')===36&&blockCount('weapon')===146,`enhancements ${blockCount('enhancement')}, rules ${blockCount('rule')}, statlines ${blockCount('statline')}, weapons ${blockCount('weapon')}`);
check('all navigation targets exist',navTargets.every(id=>idSet.has(id)),navTargets.filter(id=>!idSet.has(id)).join(', '));
check('all navigation targets have tracked ranges',navTargets.every(id=>trackTargets.includes(id)),navTargets.filter(id=>!trackTargets.includes(id)).join(', '));
check('navigation covers the generated full-content tree',navTargets.length===104,String(navTargets.length));
const depths=[...markup.matchAll(/data-nav-depth="(\d+)"/g)].map(match=>Number(match[1]));
check('navigation depth is at most three',Math.max(...depths)===3);
const unitIds=bookData.sections.filter(section=>section.kind==='unit').map(section=>section.id);
check('all 36 datasheets are global navigation destinations',unitIds.length===36&&unitIds.every(id=>navTargets.includes(id)));
const detachmentSections=bookData.sections.filter(section=>section.id.startsWith('detachment-'));
check('all nine detachment trees expose rule, Enhancement and Stratagems',detachmentSections.length===9&&detachmentSections.every(section=>(section.subsections||[]).length===3)&&detachmentSections.every(section=>['Detachment Rule','Enhancement','Stratagems'].every(label=>markup.includes(`data-nav-target="${section.subsections[['Detachment Rule','Enhancement','Stratagems'].indexOf(label)].id}">${label}</button>`))));
const unitLocalIds=bookData.sections.filter(section=>section.kind==='unit').flatMap(section=>[`${section.id}-profile`,...(section.subsections||[]).map(sub=>sub.id)]);
check('datasheet local parts are absent from global navigation',unitLocalIds.every(id=>!navTargets.includes(id)));

const dataSource=read('scripts/data.js');
const termContext={window:{},Object};
vm.runInNewContext(dataSource,termContext,{filename:'scripts/data.js'});
const termKeys=Object.keys(termContext.window.DG_TERMS||{});
const usedTerms=[...markup.matchAll(/data-term="([^"]+)"/g)].map(match=>match[1]);
check('term registry has all 366 entries',termKeys.length===366,String(termKeys.length));
check('all term triggers resolve',usedTerms.every(id=>termKeys.includes(id)),usedTerms.filter(id=>!termKeys.includes(id)).join(', '));
check('every registered term is exercised',termKeys.every(id=>usedTerms.includes(id)),termKeys.filter(id=>!usedTerms.includes(id)).join(', '));
const journeyTargets=[...markup.matchAll(/data-journey-target="([^"]+)"/g)].map(match=>match[1]);
check('all journey targets exist',journeyTargets.every(id=>idSet.has(id)),journeyTargets.filter(id=>!idSet.has(id)).join(', '));
check('generated document contains no acceptance placeholders',!/(small acceptance set|points not listed|subject to the full rule|qualifying attacks)/i.test(markup));

const navigation=read('scripts/navigation-controller.js');
const popups=read('scripts/popup-controller.js');
const journey=read('scripts/journey-controller.js');
check('navigation uses one passive scroll listener',(navigation.match(/addEventListener\('scroll'/g)||[]).length===1&&navigation.includes('{passive:true}'));
check('navigation avoids :scope',!navigation.includes(':scope'));
check('navigation has explicit reader/controller ownership',navigation.includes("owner:'reader'")&&navigation.includes("owner='controller'")&&navigation.includes("owner='reader'"));
const settleSource=navigation.match(/waitForSettle\([\s\S]*?\n    cancelTransition/)?.[0]||'';
check('navigation settles by geometry instead of fixed delay',settleSource.includes('stable>=6')&&settleSource.includes('Math.abs(current-destination)<2')&&settleSource.includes('Date.now()-started>2200')&&!settleSource.includes('setTimeout'));
check('mobile breakpoint clears collapsed state',navigation.includes('if(mobile)this.state.collapsed=false'));
check('native inert avoids the full tabindex walk',navigation.includes("this.supportsInert='inert'in HTMLElement.prototype")&&navigation.includes('if(this.supportsInert){root.inert=!interactive;return;}'));
check('tabindex fallback remains available for legacy browsers',navigation.includes('data-nav-saved-tabindex'));
check('unchanged drawer state is a no-op',navigation.includes('if(next===this.state.drawer)return'));
const readViewportSource=navigation.match(/readViewport\(\)\{[\s\S]*?\n    \}/)?.[0]||'';
check('scroll spy performs no layout measurements per frame',!readViewportSource.includes('getBoundingClientRect'));
check('user input cancels controlled scrolling',navigation.includes('cancelTransition()')&&navigation.includes("window.addEventListener('touchstart'"));
check('navigation branches use strict sibling accordion',navigation.includes("if(peer!==node&&peer.matches('[data-nav-id]'))this.closeBranch(peer,{deep:true})")&&!navigation.includes('isOnActivePath'));
check('manual accordion state yields back to scroll tracking',navigation.includes('pathIsOpen(node)')&&navigation.includes("else if(item&&!this.pathIsOpen(item.node))this.revealPath(item.node,{includeSelf:true})"));
check('branch labels and arrows have separate actions',navigation.includes("event.target.closest('[data-nav-toggle]')")&&navigation.includes("event.target.closest('[data-nav-target]')"));
const navigationClassSource=navigation.match(/(class NavigationController\{[\s\S]*?\n  \})\n\n  window\.DGNavigation/)?.[1]||'';
try{
  const NavigationController=Function(`"use strict";return (${navigationClassSource});`)();
  const controller=Object.create(NavigationController.prototype);
  controller.trackingGap=18;
  controller.epsilon=1;
  controller.geometry={headerBottom:72,glossaryHeight:64,ranges:[]};
  controller.byId=new Map();
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  try{
    globalThis.window={scrollY:1000,setTimeout:()=>0};
    globalThis.document={querySelector:()=>null};
    const glossaryTarget={id:'term',dataset:{},closest:selector=>selector==='#glossary'?{}:null,getBoundingClientRect:()=>({top:200})};
    check('behavior: glossary destination clears sticky search',controller.destination(glossaryTarget)===1046,String(controller.destination(glossaryTarget)));
    const glossaryRoot={id:'glossary',dataset:{},closest:selector=>selector==='#glossary'?{}:null,getBoundingClientRect:()=>({top:200})};
    check('behavior: Glossary root ignores its own sticky search',controller.destination(glossaryRoot)===1110,String(controller.destination(glossaryRoot)));
    const classes=new Set(),heading={tagName:'H3',offsetWidth:80,classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)}};
    const section={matches:()=>false,children:[heading]};controller.highlight(section);
    check('behavior: click destination highlights its direct heading',classes.has('destination-highlight'));
    const enhancementClasses=new Set(),enhancement={offsetWidth:300,matches:selector=>selector.split(',').includes('.enhancement'),children:[heading],classList:{add:name=>enhancementClasses.add(name),remove:name=>enhancementClasses.delete(name)}};
    controller.highlight(enhancement);
    check('behavior: Enhancement highlights the complete card',enhancementClasses.has('destination-highlight'));
    let selected='';globalThis.window.scrollY=0;controller.state={owner:'reader',active:''};controller.items=[{id:'parent',depth:1,glossaryNested:false},{id:'child',depth:2,glossaryNested:false}];controller.geometry.ranges=[{item:controller.items[0],top:0,bottom:500},{item:controller.items[1],top:120,bottom:300}];controller.activate=id=>{selected=id};controller.readViewport();
    check('behavior: child below tracking line does not pre-activate',selected==='parent',selected);
    selected='';controller.geometry.ranges[1]={item:controller.items[1],top:90.5,bottom:300};controller.readViewport();
    check('behavior: subpixel target at tracking line activates',selected==='child',selected);
    selected='';controller.items=[{id:'glossary',depth:1,glossaryNested:false},{id:'glossary-core',depth:2,glossaryNested:true}];controller.geometry.ranges=[{item:controller.items[0],top:0,bottom:500},{item:controller.items[1],top:154.5,bottom:300}];controller.readViewport();
    check('behavior: nested Glossary group uses sticky tracking line',selected==='glossary-core',selected);
    selected='';controller.items=[{id:'glossary',depth:1,glossaryNested:false},{id:'glossary-core',depth:2,glossaryNested:true},{id:'glossary-next',depth:2,glossaryNested:true}];controller.geometry.ranges=[{item:controller.items[0],top:0,bottom:700},{item:controller.items[1],top:100,bottom:145},{item:controller.items[2],top:180,bottom:320}];controller.readViewport();
    check('behavior: Glossary root does not flash between nested groups',selected==='glossary-core',selected);
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
}catch(error){check('navigation destination geometry',false,error.message);}
check('popup root clicks replace the chain',popups.includes('this.ids=[];this.origins=[]'));
check('nested popups preserve the common DOM prefix',popups.includes('while(prefix<cards.length')&&popups.includes('for(let index=prefix;index<this.ids.length'));
check('adjacent bounce checks only previous level',popups.includes('const previous=this.ids[this.ids.length-2]')&&!popups.includes('lastIndexOf'));
check('popup cards suppress self links',popups.includes('relatedId!==id'));
check('desktop popup coordinates include document scroll',popups.includes("window.scrollY||0")&&/\.popup-layer\s*\{[^}]*position:\s*absolute/.test(read('styles/popups.css')));
check('mobile popup layer is fixed',/@media\s*\(max-width:\s*800px\)[\s\S]*?\.popup-layer\s*\{[^}]*position:\s*fixed/.test(read('styles/popups.css')));
check('popup cards expose dialog semantics',popups.includes("setAttribute('role','dialog')")&&popups.includes("setAttribute('aria-modal','false')"));
check('unit popups render semantic characteristic grids',popups.includes("card.classList.add('popup-statline')")&&popups.includes("summary=document.createElement('dl')")&&popups.includes("name=document.createElement('dt')")&&popups.includes("score=document.createElement('dd')"));
check('unit popup grid has a mobile no-overflow layout',/\.popup-stats\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(54px, 1fr\)\)/.test(read('styles/popups.css'))&&/@media\s*\(max-width:\s*480px\)[\s\S]*?\.popup-stats\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/.test(read('styles/popups.css')));

const popupClassSource=popups.match(/(class PopupController\{[\s\S]*?\n  \})\n\n  window\.DGPopups/)?.[1]||'';
try{
  const PopupController=Function(`"use strict";return (${popupClassSource});`)();
  const controller=Object.create(PopupController.prototype);
  controller.terms=Object.fromEntries(termKeys.map(id=>[id,{}]));controller.ids=[];controller.origins=[];
  controller.captureOrigin=(trigger,id)=>({trigger,id});controller.sync=()=>{};controller.focusTop=()=>{};
  const external={closest:()=>null},nested={closest:selector=>selector==='.term-popup'?{}:null};
  controller.open('core-assault',external);controller.open('core-lethal-hits',nested);
  check('behavior: nested trigger appends a level',controller.ids.join(',')==='core-assault,core-lethal-hits');
  controller.open('core-assault',nested);
  check('behavior: adjacent A-B-A collapses only B',controller.ids.join(',')==='core-assault');
  controller.open('core-lethal-hits',nested);controller.open('core-deadly-demise',nested);controller.open('core-assault',nested);
  check('behavior: distant repeated term creates a new level',controller.ids.join(',')==='core-assault,core-lethal-hits,core-deadly-demise,core-assault');
  controller.open('contagion-range',external);
  check('behavior: external term replaces the complete chain',controller.ids.join(',')==='contagion-range');
  controller.open('contagion-range',external);
  check('behavior: current root term does not duplicate',controller.ids.join(',')==='contagion-range');

  const makeStyle=(left='',top='')=>({left,top,bottom:'',removeProperty(name){this[name]='';}});
  const makeCard=(left='',top='')=>({style:makeStyle(left,top),offsetWidth:300,offsetHeight:180});
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  try{
    globalThis.document={getElementById:()=>({getBoundingClientRect:()=>({bottom:72})})};
    const desktopCard=makeCard('412px','980px');
    globalThis.window={innerWidth:1200,innerHeight:700,scrollX:0,scrollY:800};
    controller.layer={children:[desktopCard]};controller.origins=[{rect:{left:412,top:-300,bottom:-260}}];controller.resolveOrigin=()=>null;
    controller.reposition();
    check('behavior: offscreen desktop popup preserves both coordinates',desktopCard.style.left==='412px'&&desktopCard.style.top==='980px',desktopCard.style.left+','+desktopCard.style.top);

    const mobileCards=Array.from({length:5},()=>makeCard());
    globalThis.window={innerWidth:600,innerHeight:700,scrollX:0,scrollY:0};controller.layer={children:mobileCards};controller.origins=[];
    controller.reposition();
    check('behavior: mobile centers the last three visible levels',mobileCards.slice(-3).map(card=>card.style.top).join('|')==='260px|278px|296px',mobileCards.slice(-3).map(card=>card.style.top).join('|'));
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
}catch(error){check('popup behavioral state machine',false,error.message);}

check('Journey captures full popup context',journey.includes('popupIds:this.popups.snapshot()')&&journey.includes('popupRootId')&&journey.includes('popupAction'));
check('Journey synchronously reveals filtered glossary targets',journey.includes("target.closest?.('#glossary')")&&journey.includes('this.glossary?.reveal?.(target)'));
const backSource=journey.match(/back\(\)\{[\s\S]*?\n    \}/)?.[0]||'';
check('Back restores before highlighting rebuilt action',backSource.indexOf('this.popups.restore(record.popupIds')<backSource.indexOf('this.highlight(restoredPopup||trigger)'));
check('Back restores popups only after navigation settles',backSource.indexOf('this.navigation.restore')<backSource.indexOf('this.popups.restore(record.popupIds'));
check('Back has rebuilt-action fallback',journey.includes('this.findRestoredAction(record.popupAction)'));
check('click navigation highlights only after controlled scroll settles',navigation.includes("()=>{this.highlight(element);settled?.();}"));

const cssFiles=['styles/tokens.css','styles/layout.css','styles/navigation.css','styles/content.css','styles/popups.css'];
check('all five style layers are linked',cssFiles.every(file=>html.includes('href="./'+file+'?v=3"')));
const contentCss=read('styles/content.css');
check('datasheet statlines keep all seven characteristics on one row',/\.statline\s*\{[^}]*grid-template-columns:\s*repeat\(7,minmax\(0,1fr\)\)/.test(contentCss));
check('heading destination highlight uses text glow without outline',/\.destination-highlight:is\(h1,h2,h3,h4,h5,h6\)\s*\{[^}]*animation-name:\s*destination-heading-highlight/.test(contentCss)&&contentCss.includes('@keyframes destination-heading-highlight')&&!contentCss.match(/@keyframes destination-heading-highlight[^}]*outline/));
check('detachment navigation targets render in separate rows',/\.detachment-content\s*\{[^}]*grid-template-columns:\s*1fr/.test(contentCss));
check('each detachment has a visible Stratagems destination',(markup.match(/class="detachment-part"[^>]*data-track="[^"]+">\s*<h4 class="detachment-part-title">Stratagems<\/h4>/g)||[]).length===bookData.audit.detachments);
check('no inline style or inline script',!/<style|<script(?![^>]*src=)/i.test(html));
check('no runtime fetch in document controllers',!files.some(file=>/\bfetch\s*\(/.test(read(file))));
check('service worker registration is protocol gated',read('scripts/app.js').includes("location.protocol==='http:'||location.protocol==='https:'"));
check('weapon rows receive explicit table semantics',read('scripts/ui-controllers.js').includes("row.setAttribute('role','row')"));
check('mobile header disables expensive backdrop blur',/@media\s*\(max-width:\s*800px\)[\s\S]*?\.app-header\s*\{[^}]*backdrop-filter:\s*none/.test(read('styles/layout.css')));
check('book uses the unified root manifest',html.includes('href="../../manifest.webmanifest"'));
check('unified service worker owns only the v2 cache family',readProject('service-worker.js').includes('key.startsWith(CACHE_PREFIX)')&&readProject('service-worker.js').includes('warhammer-rules-unified-v2-'));
check('PWA cache revision is bumped for the navigation rewrite',readProject('service-worker.js').includes('`${CACHE_PREFIX}v3`'));
check('book scripts and styles use the current release token',[...cssFiles,...files].every(file=>html.includes('./'+file+'?v=3')));
check('v4 icon is used without legacy v3 PNG references',html.includes('assets/icon-v4.svg')&&!html.includes('icon-180.png'));
check('navigation and popup specifications are present',['docs/SPEC_NAVIGATION.md','docs/SPEC_POPUPS.md'].every(file=>fs.existsSync(path.join(root,file))));

for(const result of results)console.log(`${result.ok?'PASS':'FAIL'}  ${result.name}${result.detail?' — '+result.detail:''}`);
const failed=results.filter(result=>!result.ok);
console.log(`\n${results.length-failed.length}/${results.length} checks passed.`);
if(failed.length)process.exitCode=1;
