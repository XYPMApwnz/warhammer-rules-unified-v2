(function(){
  'use strict';

  class NavigationController{
    constructor({breakpoint=800}={}){
      this.breakpoint=breakpoint;
      this.header=document.getElementById('appHeader');
      this.panel=document.getElementById('tocPanel');
      this.tree=document.getElementById('tocTree');
      this.main=document.getElementById('main');
      this.menuButton=document.getElementById('navMenu');
      this.collapseButton=document.getElementById('navCollapse');
      this.scrim=document.getElementById('tocScrim');
      this.mobile=window.innerWidth<=this.breakpoint;
      this.state={owner:'reader',active:'',drawer:false,collapsed:false,transition:0};
      this.frame=0;
      this.items=[...this.tree.querySelectorAll('[data-nav-id]')].map(node=>{
        const button=[...node.children].find(child=>child.classList.contains('toc-row'))?.querySelector('[data-nav-target]');
        const id=button?.dataset.navTarget||'';
        return{id,node,button,depth:Number(node.dataset.navDepth),section:document.querySelector('[data-track="'+id+'"]')};
      }).filter(item=>item.id&&item.button&&item.section);
      this.byId=new Map(this.items.map(item=>[item.id,item]));
      this.bind();
      this.closeAll();
      this.setCollapsed(false);
      this.setDrawer(false);
      this.readViewport();
    }

    get active(){return this.state.active||'start';}
    direct(node,className){return[...node.children].find(child=>child.classList.contains(className))||null;}
    row(node){return this.direct(node,'toc-row');}
    branch(node){return this.direct(node,'toc-branch');}
    parentNode(node){const list=node.parentElement;return list?.classList.contains('toc-branch')?list.parentElement:null;}
    toggle(node){return this.row(node)?.querySelector('[data-nav-toggle]')||null;}

    bind(){
      this.tree.addEventListener('click',event=>{
        const toggle=event.target.closest('[data-nav-toggle]');
        if(toggle&&this.tree.contains(toggle)){event.preventDefault();this.toggleBranch(toggle.closest('[data-nav-id]'));return;}
        const target=event.target.closest('[data-nav-target]');
        if(!target||!this.tree.contains(target))return;
        event.preventDefault();
        const node=target.closest('[data-nav-id]');
        if(this.branch(node))this.openBranch(node);
        this.go(target.dataset.navTarget);
      });
      this.menuButton.addEventListener('click',()=>this.setDrawer(!this.state.drawer));
      this.collapseButton.addEventListener('click',()=>this.setCollapsed(!this.state.collapsed));
      this.scrim.addEventListener('click',()=>this.setDrawer(false));
      window.addEventListener('scroll',()=>this.scheduleRead(),{passive:true});
      window.addEventListener('resize',()=>this.onResize(),{passive:true});
      document.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&this.state.drawer&&!document.querySelector('#popupLayer .term-popup'))this.setDrawer(false);
      });
    }

    closeAll(){for(const item of this.items)this.closeBranch(item.node);}
    closeBranch(node){
      const branch=this.branch(node),toggle=this.toggle(node);
      if(branch)branch.hidden=true;
      if(toggle)toggle.setAttribute('aria-expanded','false');
      if(branch)for(const child of branch.children)if(child.matches('[data-nav-id]'))this.closeBranch(child);
    }
    openBranch(node){
      const branch=this.branch(node),toggle=this.toggle(node);if(!branch||!toggle)return;
      for(const peer of node.parentElement.children)if(peer!==node&&peer.matches('[data-nav-id]'))this.closeBranch(peer);
      branch.hidden=false;toggle.setAttribute('aria-expanded','true');
    }
    toggleBranch(node){const branch=this.branch(node);if(branch)(branch.hidden?this.openBranch(node):this.closeBranch(node));}
    revealPath(node){
      const parents=[];for(let parent=this.parentNode(node);parent;parent=this.parentNode(parent))parents.unshift(parent);
      for(const parent of parents)this.openBranch(parent);
      if(this.branch(node))this.openBranch(node);
    }

    setInteractive(root,interactive){
      root.inert=!interactive;
      for(const control of root.querySelectorAll('a,button,input,select,textarea,[tabindex]')){
        const key='data-nav-saved-tabindex';
        if(!interactive&&!control.hasAttribute(key)){
          control.setAttribute(key,control.getAttribute('tabindex')??'');control.setAttribute('tabindex','-1');
        }else if(interactive&&control.hasAttribute(key)){
          const value=control.getAttribute(key);control.removeAttribute(key);
          if(value==='')control.removeAttribute('tabindex');else control.setAttribute('tabindex',value);
        }
      }
    }
    syncVisibility(){
      const panelHidden=this.mobile?!this.state.drawer:this.state.collapsed;
      this.setInteractive(this.panel,!panelHidden);
      this.panel.setAttribute('aria-hidden',String(panelHidden));
      const blocked=this.mobile&&this.state.drawer;
      this.setInteractive(this.main,!blocked);
      if(blocked)this.main.setAttribute('aria-hidden','true');else this.main.removeAttribute('aria-hidden');
      this.scrim.setAttribute('aria-hidden',String(!this.state.drawer));
    }
    setDrawer(open){
      const returnFocus=this.state.drawer&&this.panel.contains(document.activeElement);
      this.state.drawer=this.mobile&&Boolean(open);
      document.body.classList.toggle('nav-drawer-open',this.state.drawer);
      this.menuButton.setAttribute('aria-expanded',String(this.state.drawer));
      this.menuButton.setAttribute('aria-label',this.state.drawer?'Close navigation':'Open navigation');
      this.syncVisibility();
      if(returnFocus&&!this.state.drawer)this.menuButton.focus({preventScroll:true});
    }
    setCollapsed(collapsed){
      const returnFocus=!this.state.collapsed&&this.panel.contains(document.activeElement);
      this.state.collapsed=this.mobile?false:Boolean(collapsed);
      document.body.classList.toggle('nav-collapsed',this.state.collapsed);
      this.collapseButton.setAttribute('aria-expanded',String(!this.state.collapsed));
      this.collapseButton.setAttribute('aria-label',this.state.collapsed?'Expand navigation':'Collapse navigation');
      this.collapseButton.textContent=this.state.collapsed?'▶':'◀';
      this.syncVisibility();
      if(returnFocus&&this.state.collapsed)this.collapseButton.focus({preventScroll:true});
    }
    onResize(){
      const mobile=window.innerWidth<=this.breakpoint;
      if(mobile!==this.mobile){this.mobile=mobile;if(mobile)this.setCollapsed(false);this.setDrawer(false);}
      this.syncVisibility();this.scheduleRead();
    }

    select(id,{reveal=true}={}){
      const selected=this.byId.get(id);if(!selected)return;
      this.state.active=id;
      for(const item of this.items){item.button.classList.remove('is-current','is-ancestor');item.button.removeAttribute('aria-current');}
      selected.button.classList.add('is-current');selected.button.setAttribute('aria-current','location');
      for(let parent=this.parentNode(selected.node);parent;parent=this.parentNode(parent))this.row(parent)?.querySelector('[data-nav-target]')?.classList.add('is-ancestor');
      this.revealPath(selected.node);
      if(reveal)this.keepVisible(this.row(selected.node));
    }
    keepVisible(row){
      if(!row||this.panel.inert)return;
      const panel=this.panel.getBoundingClientRect(),item=row.getBoundingClientRect(),gap=12;
      if(item.top<panel.top+gap)this.panel.scrollTo({top:this.panel.scrollTop-(panel.top+gap-item.top),behavior:'smooth'});
      else if(item.bottom>panel.bottom-gap)this.panel.scrollTo({top:this.panel.scrollTop+(item.bottom-panel.bottom+gap),behavior:'smooth'});
    }

    trackingGap(){return 18;}
    stickyClearance(element){
      const glossaryTools=element.id!=='glossary'&&element.closest?.('#glossary')?document.querySelector('.glossary-tools'):null;
      return glossaryTools?.getBoundingClientRect().height||0;
    }
    destination(element){
      return Math.max(0,window.scrollY+element.getBoundingClientRect().top-this.header.getBoundingClientRect().height-this.trackingGap()-this.stickyClearance(element));
    }
    highlightElement(element){
      if(element.matches?.('.glossary-card,.rule-card,.enhancement,.unit-card,.ability,.stratagem,.hero'))return element;
      const directHeading=[...element.children].find(child=>child.matches?.('.section-title,.category-title,.detachment-part-title')||/^H[1-6]$/.test(child.tagName||''));
      if(directHeading)return directHeading;
      const directCard=[...element.children].find(child=>child.matches?.('.glossary-card,.rule-card,.enhancement,.unit-card,.ability,.stratagem'));
      return directCard||element;
    }
    highlight(element){
      const target=this.highlightElement(element);if(!target)return;
      target.classList.remove('destination-highlight');void target.offsetWidth;target.classList.add('destination-highlight');
      window.setTimeout(()=>target.classList.remove('destination-highlight'),2300);
    }
    go(id){const item=this.byId.get(id);if(!item)return;this.setDrawer(false);this.navigate(id,item.section);}
    navigate(id,element,settled){this.controlledScroll(id,this.destination(element),()=>{this.highlight(element);if(settled)settled();});}
    restore(id,scrollY,settled){this.controlledScroll(id,Math.max(0,scrollY),settled);}
    controlledScroll(id,destination,settled){
      const token=++this.state.transition;this.state.owner='controller';this.select(id);
      window.scrollTo({top:destination,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
      this.waitForSettle(destination,token,settled);
    }
    waitForSettle(destination,token,settled){
      const started=Date.now();let previous=window.scrollY,stable=0;
      const inspect=()=>{
        if(token!==this.state.transition)return;
        const current=window.scrollY;stable=Math.abs(current-previous)<1?stable+1:0;previous=current;
        if(Math.abs(current-destination)<2||stable>=6||Date.now()-started>2200){
          this.state.owner='reader';if(settled)settled();this.readViewport();return;
        }
        requestAnimationFrame(inspect);
      };
      requestAnimationFrame(inspect);
    }

    scheduleRead(){if(this.state.owner!=='reader'||this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.readViewport();});}
    readViewport(){
      if(this.state.owner!=='reader')return;
      const baseLine=this.header.getBoundingClientRect().bottom+18;
      const measured=this.items.map(item=>({item,rect:item.section.getBoundingClientRect(),line:baseLine+this.stickyClearance(item.section)+1}));
      let winner=measured.filter(value=>value.rect.top<=value.line&&value.rect.bottom>value.line)
        .sort((a,b)=>b.item.depth-a.item.depth||b.rect.top-a.rect.top)[0]||null;
      if(!winner)winner=measured.filter(value=>value.rect.top<=value.line).sort((a,b)=>b.rect.top-a.rect.top||b.item.depth-a.item.depth)[0]||measured[0];
      if(winner&&winner.item.id!==this.state.active)this.select(winner.item.id);
    }
  }

  window.DGNavigation=NavigationController;
}());
