import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(projectRoot,'books','death-guard');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const readProject=name=>fs.readFileSync(path.join(projectRoot,name),'utf8');
const html=read('index.html');
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
check('all navigation targets exist',navTargets.every(id=>idSet.has(id)),navTargets.filter(id=>!idSet.has(id)).join(', '));
check('all navigation targets have tracked ranges',navTargets.every(id=>trackTargets.includes(id)),navTargets.filter(id=>!trackTargets.includes(id)).join(', '));
check('navigation has 26 destinations',navTargets.length===26,String(navTargets.length));
const depths=[...markup.matchAll(/data-nav-depth="(\d+)"/g)].map(match=>Number(match[1]));
check('navigation depth is at most three',Math.max(...depths)===3);
const depthThreeLabels=[...markup.matchAll(/<li[^>]+data-nav-depth="3"[^>]*>[\s\S]*?<button class="toc-label"[^>]*>([^<]+)<\/button>[\s\S]*?<\/li>/g)].map(match=>match[1].trim());
check('leaf navigation uses body titles instead of generic card types',!depthThreeLabels.some(label=>['Detachment Rule','Enhancement','Stratagems'].includes(label)),depthThreeLabels.join(', '));
check('datasheet local parts are absent from global navigation',['biologus-profile','biologus-abilities','biologus-composition','biologus-keywords','defiler-profile','defiler-abilities','defiler-composition','defiler-keywords'].every(id=>!navTargets.includes(id)));

const dataSource=read('scripts/data.js');
const termKeys=[...dataSource.matchAll(/^\s{4}(?:'([^']+)'|([a-z][a-z-]*)):Object\.freeze/gm)].map(match=>match[1]||match[2]);
const usedTerms=[...markup.matchAll(/data-term="([^"]+)"/g)].map(match=>match[1]);
check('term registry has 20 entries',termKeys.length===20,String(termKeys.length));
check('all term triggers resolve',usedTerms.every(id=>termKeys.includes(id)),usedTerms.filter(id=>!termKeys.includes(id)).join(', '));
check('every registered term is exercised',termKeys.every(id=>usedTerms.includes(id)),termKeys.filter(id=>!usedTerms.includes(id)).join(', '));
const journeyTargets=[...markup.matchAll(/data-journey-target="([^"]+)"/g)].map(match=>match[1]);
check('all journey targets exist',journeyTargets.every(id=>idSet.has(id)),journeyTargets.filter(id=>!idSet.has(id)).join(', '));

const navigation=read('scripts/navigation-controller.js');
const popups=read('scripts/popup-controller.js');
const journey=read('scripts/journey-controller.js');
check('navigation uses one passive scroll listener',(navigation.match(/addEventListener\('scroll'/g)||[]).length===1&&navigation.includes('{passive:true}'));
check('navigation avoids :scope',!navigation.includes(':scope'));
check('navigation has explicit reader/controller ownership',navigation.includes("owner:'reader'")&&navigation.includes("owner='controller'")&&navigation.includes("owner='reader'"));
check('navigation settles by geometry instead of fixed delay',navigation.includes('stable>=6')&&navigation.includes('Math.abs(current-destination)<2'));
check('navigation highlights the clicked destination',navigation.includes("classList.add('destination-highlight')")&&navigation.includes('this.highlight(element)'));
check('navigation highlights compact body destinations',navigation.includes("child.matches?.('.section-title,.category-title')")&&navigation.includes('return directCard||element'));
check('mobile breakpoint clears collapsed state',navigation.includes('if(mobile)this.setCollapsed(false)'));
check('hidden trees use inert and tabindex fallback',navigation.includes('root.inert=!interactive')&&navigation.includes('data-nav-saved-tabindex'));
const navigationClassSource=navigation.match(/(class NavigationController\{[\s\S]*?\n  \})\n\n  window\.DGNavigation/)?.[1]||'';
try{
  const NavigationController=Function(`"use strict";return (${navigationClassSource});`)();
  const controller=Object.create(NavigationController.prototype);
  controller.header={getBoundingClientRect:()=>({height:72})};
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  try{
    globalThis.window={scrollY:1000};
    globalThis.document={querySelector:selector=>selector==='.glossary-tools'?{getBoundingClientRect:()=>({height:64})}:null};
    const glossaryTarget={closest:selector=>selector==='#glossary'?{}:null,getBoundingClientRect:()=>({top:200})};
    check('behavior: glossary destination clears sticky search',controller.destination(glossaryTarget)===1046,String(controller.destination(glossaryTarget)));
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
}catch(error){check('navigation destination geometry',false,error.message);}
check('popup root clicks replace the chain',popups.includes('this.ids=[];this.origins=[]'));
check('nested popups preserve the common DOM prefix',popups.includes('while(prefix<cards.length')&&popups.includes('for(let index=prefix;index<this.ids.length'));
check('adjacent bounce checks only previous level',popups.includes('const previous=this.ids[this.ids.length-2]')&&!popups.includes('lastIndexOf'));
check('popup cards suppress self links',popups.includes('relatedId!==id'));
check('desktop popup coordinates include document scroll',popups.includes("window.scrollY||0")&&/\.popup-layer\s*\{\s*position:\s*absolute/.test(read('styles/popups.css')));
check('mobile popup layer is fixed',/@media\s*\(max-width:\s*800px\)[\s\S]*?\.popup-layer\s*\{\s*position:\s*fixed/.test(read('styles/popups.css')));
check('popup cards expose dialog semantics',popups.includes("setAttribute('role','dialog')")&&popups.includes("setAttribute('aria-modal','false')"));

const popupClassSource=popups.match(/(class PopupController\{[\s\S]*?\n  \})\n\n  window\.DGPopups/)?.[1]||'';
try{
  const PopupController=Function(`"use strict";return (${popupClassSource});`)();
  const controller=Object.create(PopupController.prototype);
  controller.terms=Object.fromEntries(termKeys.map(id=>[id,{}]));controller.ids=[];controller.origins=[];
  controller.captureOrigin=(trigger,id)=>({trigger,id});controller.sync=()=>{};controller.focusTop=()=>{};
  const external={closest:()=>null},nested={closest:selector=>selector==='.term-popup'?{}:null};
  controller.open('assault',external);controller.open('lethal-hits',nested);
  check('behavior: nested trigger appends a level',controller.ids.join(',')==='assault,lethal-hits');
  controller.open('assault',nested);
  check('behavior: adjacent A-B-A collapses only B',controller.ids.join(',')==='assault');
  controller.open('lethal-hits',nested);controller.open('deadly-demise',nested);controller.open('assault',nested);
  check('behavior: distant repeated term creates a new level',controller.ids.join(',')==='assault,lethal-hits,deadly-demise,assault');
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
    check('behavior: mobile centers the last three visible levels',mobileCards.slice(-3).map(card=>card.style.top).join('|')==='260px|278px|296px'&&mobileCards.slice(-3).every(card=>card.style.bottom===''),mobileCards.slice(-3).map(card=>card.style.top).join('|'));
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
}catch(error){check('popup behavioral state machine',false,error.message);}

check('Journey captures full popup context',journey.includes('popupIds:this.popups.snapshot()')&&journey.includes('popupRootId')&&journey.includes('popupAction'));
check('Back restores before highlighting rebuilt action',journey.indexOf('this.popups.restore(record.popupIds')<journey.indexOf('this.highlight(restoredPopup||trigger)'));
check('Back restores popup before scrolling to prevent flicker',journey.indexOf('this.popups.restore(record.popupIds')<journey.indexOf('this.navigation.restore(record.navId'));
check('Back has rebuilt-action fallback',journey.includes('this.findRestoredAction(record.popupAction)'));
check('Back highlights the restored popup card',journey.includes("trigger?.closest?.('.term-popup')")&&journey.includes('this.highlight(restoredPopup||trigger)'));

const cssFiles=['styles/tokens.css','styles/layout.css','styles/navigation.css','styles/content.css','styles/popups.css'];
check('all five style layers are linked',cssFiles.every(file=>html.includes('href="./'+file+'"')));
check('detachment rule and enhancement stack vertically',/\.detachment-grid\s*\{[^}]*grid-template-columns:\s*1fr/.test(read('styles/content.css')));
check('faction stripe uses a short original-style colour transition',read('styles/tokens.css').includes('#c8df7f 74%, #c3167c 82%'));
check('no inline style or inline script',!/<style|<script(?![^>]*src=)/i.test(html));
check('no runtime fetch in document controllers',!files.slice(0,-1).some(file=>/\bfetch\s*\(/.test(read(file))));
check('book registers the unified root service worker',read('scripts/app.js').includes("register('../../service-worker.js')"));
check('service worker deletes only unified-v2-owned caches',readProject('service-worker.js').includes('key.startsWith(CACHE_PREFIX)')&&readProject('service-worker.js').includes('warhammer-rules-unified-v2-'));
check('v4 icon is used without legacy v3 PNG references',html.includes('assets/icon-v4.svg')&&!html.includes('icon-180.png'));
check('specification update rule exists in both specs',['docs/SPEC_NAVIGATION.md','docs/SPEC_POPUPS.md'].every(file=>read(file).includes('Правило актуализации ТЗ')));

for(const result of results)console.log(`${result.ok?'PASS':'FAIL'}  ${result.name}${result.detail?' — '+result.detail:''}`);
const failed=results.filter(result=>!result.ok);
console.log(`\n${results.length-failed.length}/${results.length} checks passed.`);
if(failed.length)process.exitCode=1;
