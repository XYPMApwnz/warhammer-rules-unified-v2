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
      this.metricsFrame=0;
      this.metrics=[];
      this.headerBottom=0;
      this.glossaryToolsHeight=0;
      this.activeButtons=new Set();
      this.supportsInert='inert'in HTMLElement.prototype;
      this.items=[...this.tree.querySelectorAll('[data-nav-id]')].map(node=>{
        const button=[...node.children].find(child=>child.classList.contains('toc-row'))?.querySelector('[data-nav-target]');
        const id=button?.dataset.navTarget||'';
        return{id,node,button,depth:Number(node.dataset.navDepth),section:document.querySelector('[data-track="'+id+'"]')};
      }).filter(item=>item.id&&item.button&&item.section);
      this.byId=new Map(this.items.map(item=>[item.id,item]));
      this.bind();
      this.closeAll();
      this.setCollapsed(false,{force:true});
      this.refreshMetrics();
      if('ResizeObserver'in window){this.layoutObserver=new ResizeObserver(()=>this.scheduleMetrics());this.layoutObserver.observe(this.main);}
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
      window.addEventListener('wheel',()=>this.cancelControlledScroll(),{passive:true});
      window.addEventListener('touchstart',()=>this.cancelControlledScroll(),{passive:true});
      window.addEventListener('pointerdown',()=>this.cancelControlledScroll(),{passive:true});
      document.addEventListener('keydown',event=>{
        if(['PageUp','PageDown','Home','End','ArrowUp','ArrowDown',' '].includes(event.key))this.cancelControlledScroll();
        if(event.key==='Tab'&&this.state.drawer)this.trapDrawerFocus(event);
        if(event.key==='Escape'&&this.state.drawer&&!document.querySelector('#popupLayer .term-popup'))this.setDrawer(false);
      });
    }

    closeAll(){for(const item of this.items)this.closeBranch(item.node);}
    closeBranch(node){
      const branch=this.branch(node),toggle=this.toggle(node);
      if(branch?.hidden&&toggle?.getAttribute('aria-expanded')==='false')return;
      if(branch)branch.hidden=true;
      if(toggle)toggle.setAttribute('aria-expanded','false');
      if(branch)for(const child of branch.children)if(child.matches('[data-nav-id]'))this.closeBranch(child);
    }
    openBranch(node){
      const branch=this.branch(node),toggle=this.toggle(node);if(!branch||!toggle)return;
      if(!branch.hidden&&toggle.getAttribute('aria-expanded')==='true')return;
      for(const peer of node.parentElement.children)if(peer!==node&&peer.matches('[data-nav-id]'))this.closeBranch(peer);
      branch.hidden=false;toggle.setAttribute('aria-expanded','true');
    }
    toggleBranch(node){const branch=this.branch(node);if(branch)(branch.hidden?this.openBranch(node):this.closeBranch(node));}
    trapDrawerFocus(event){
      const controls=[...this.panel.querySelectorAll('a,button,input,select,textarea,[tabindex]')].filter(control=>control.tabIndex>=0&&!control.closest('[hidden]'));
      if(!controls.length)return;
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    revealPath(node){
      const parents=[];for(let parent=this.parentNode(node);parent;parent=this.parentNode(parent))parents.unshift(parent);
      for(const parent of parents)this.openBranch(parent);
      if(this.branch(node))this.openBranch(node);
    }

    setInteractive(root,interactive){
      if(this.supportsInert){root.inert=!interactive;return;}
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
    setDrawer(open,{force=false}={}){
      const next=this.mobile&&Boolean(open);if(!force&&next===this.state.drawer)return;
      const returnFocus=this.state.drawer&&this.panel.contains(document.activeElement);
      this.state.drawer=next;
      document.body.classList.toggle('nav-drawer-open',this.state.drawer);
      this.menuButton.setAttribute('aria-expanded',String(this.state.drawer));
      this.menuButton.setAttribute('aria-label',this.state.drawer?'Close navigation':'Open navigation');
      this.syncVisibility();
      if(this.state.drawer){requestAnimationFrame(()=>this.panel.querySelector('[data-nav-target]')?.focus({preventScroll:true}));}
      else if(returnFocus)this.menuButton.focus({preventScroll:true});
    }
    setCollapsed(collapsed,{force=false}={}){
      const next=this.mobile?false:Boolean(collapsed);if(!force&&next===this.state.collapsed)return;
      const returnFocus=!this.state.collapsed&&this.panel.contains(document.activeElement);
      this.state.collapsed=next;
      document.body.classList.toggle('nav-collapsed',this.state.collapsed);
      this.collapseButton.setAttribute('aria-expanded',String(!this.state.collapsed));
      this.collapseButton.setAttribute('aria-label',this.state.collapsed?'Expand navigation':'Collapse navigation');
      this.collapseButton.textContent=this.state.collapsed?'▶':'◀';
      this.syncVisibility();
      if(returnFocus&&this.state.collapsed)this.collapseButton.focus({preventScroll:true});
    }
    onResize(){
      const mobile=window.innerWidth<=this.breakpoint;
      if(mobile!==this.mobile){this.mobile=mobile;this.setCollapsed(false,{force:true});this.setDrawer(false);}
      this.scheduleMetrics();
    }

    select(id,{reveal=true,behavior='auto'}={}){
      const selected=this.byId.get(id);if(!selected)return;
      const nextButtons=new Set([selected.button]);
      for(let parent=this.parentNode(selected.node);parent;parent=this.parentNode(parent)){
        const button=this.row(parent)?.querySelector('[data-nav-target]');if(button)nextButtons.add(button);
      }
      for(const button of this.activeButtons)if(!nextButtons.has(button)){button.classList.remove('is-current','is-ancestor');button.removeAttribute('aria-current');}
      this.state.active=id;
      selected.button.classList.remove('is-ancestor');
      selected.button.classList.add('is-current');selected.button.setAttribute('aria-current','location');
      for(const button of nextButtons)if(button!==selected.button){button.classList.remove('is-current');button.classList.add('is-ancestor');button.removeAttribute('aria-current');}
      this.activeButtons=nextButtons;
      this.revealPath(selected.node);
      if(reveal)this.keepVisible(this.row(selected.node),behavior);
    }
    keepVisible(row,behavior='auto'){
      if(!row||this.panel.inert||this.panel.getAttribute('aria-hidden')==='true')return;
      const panel=this.panel.getBoundingClientRect(),item=row.getBoundingClientRect(),gap=12;
      if(item.top<panel.top+gap)this.panel.scrollTo({top:this.panel.scrollTop-(panel.top+gap-item.top),behavior});
      else if(item.bottom>panel.bottom-gap)this.panel.scrollTo({top:this.panel.scrollTop+(item.bottom-panel.bottom+gap),behavior});
    }

    trackingGap(){return 18;}
    stickyClearance(element){
      return element.id!=='glossary'&&element.closest?.('#glossary')?(this.glossaryToolsHeight||0):0;
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
      const token=++this.state.transition;this.state.owner='controller';this.select(id,{behavior:'smooth'});
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

    cancelControlledScroll(){
      if(this.state.owner!=='controller')return;
      this.state.transition++;this.state.owner='reader';this.scheduleRead();
    }

    scheduleRead(){if(this.state.owner!=='reader'||this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.readViewport();});}
    scheduleMetrics(){if(this.metricsFrame)return;this.metricsFrame=requestAnimationFrame(()=>{this.metricsFrame=0;this.refreshMetrics();});}
    refreshMetrics(){
      const scrollY=window.scrollY;
      this.headerBottom=this.header.getBoundingClientRect().bottom;
      this.glossaryToolsHeight=document.querySelector('.glossary-tools')?.getBoundingClientRect().height||0;
      this.metrics=this.items.map(item=>{const rect=item.section.getBoundingClientRect();return{item,top:scrollY+rect.top,bottom:scrollY+rect.bottom};});
      this.readViewport();
    }
    readViewport(){
      if(this.state.owner!=='reader')return;
      const baseLine=window.scrollY+this.headerBottom+18;
      let winner=null;
      for(const value of this.metrics){
        const line=baseLine+this.stickyClearance(value.item.section)+1;
        if(value.top<=line&&value.bottom>line&&(!winner||value.item.depth>winner.item.depth||value.item.depth===winner.item.depth&&value.top>winner.top))winner=value;
      }
      if(!winner)for(const value of this.metrics){
        const line=baseLine+this.stickyClearance(value.item.section)+1;
        if(value.top<=line&&(!winner||value.top>winner.top||value.top===winner.top&&value.item.depth>winner.item.depth))winner=value;
      }
      winner=winner||this.metrics[0];
      if(winner&&winner.item.id!==this.state.active)this.select(winner.item.id);
    }
  }

  window.DGNavigation=NavigationController;
}());
