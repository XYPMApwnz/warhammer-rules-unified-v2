(function(){
  'use strict';

  class NavigationController{
    constructor({breakpoint=800,trackingGap=18,epsilon=1}={}){
      this.breakpoint=breakpoint;
      this.trackingGap=trackingGap;
      this.epsilon=epsilon;

      this.header=document.getElementById('appHeader');
      this.panel=document.getElementById('tocPanel');
      this.tree=document.getElementById('tocTree');
      this.main=document.getElementById('main');
      this.menuButton=document.getElementById('navMenu');
      this.collapseButton=document.getElementById('navCollapse');
      this.scrim=document.getElementById('tocScrim');

      this.mobile=window.innerWidth<=this.breakpoint;
      this.state={owner:'reader',active:'',drawer:false,collapsed:false,transition:0};
      this.frames={reader:0,geometry:0};
      this.geometry={headerBottom:0,glossaryHeight:0,ranges:[]};
      this.activeButtons=new Set();
      this.supportsInert='inert'in HTMLElement.prototype;

      this.items=[...this.tree.querySelectorAll('[data-nav-id]')].map(node=>{
        const row=this.direct(node,'toc-row');
        const button=row?.querySelector('[data-nav-target]');
        const id=button?.dataset.navTarget||'';
        const section=id?document.querySelector('[data-track="'+id+'"]'):null;
        return{
          id,node,row,button,section,
          depth:Number(node.dataset.navDepth),
          glossaryNested:Boolean(section&&section.id!=='glossary'&&section.closest('#glossary'))
        };
      }).filter(item=>item.id&&item.button&&item.section);
      this.byId=new Map(this.items.map(item=>[item.id,item]));

      this.bind();
      this.closeEveryBranch();
      this.applyViewportState();
      this.refreshGeometry();

      if('ResizeObserver'in window){
        this.layoutObserver=new ResizeObserver(()=>this.scheduleGeometry());
        this.layoutObserver.observe(this.main);
      }
    }

    get active(){return this.state.active||'start';}

    direct(node,className){return[...node.children].find(child=>child.classList.contains(className))||null;}
    branch(node){return this.direct(node,'toc-branch');}
    parentNode(node){const list=node.parentElement;return list?.classList.contains('toc-branch')?list.parentElement:null;}
    toggle(node){return this.direct(node,'toc-row')?.querySelector('[data-nav-toggle]')||null;}

    bind(){
      this.tree.addEventListener('click',event=>{
        const toggle=event.target.closest('[data-nav-toggle]');
        if(toggle&&this.tree.contains(toggle)){
          event.preventDefault();this.toggleBranch(toggle.closest('[data-nav-id]'));return;
        }
        const label=event.target.closest('[data-nav-target]');
        if(!label||!this.tree.contains(label))return;
        event.preventDefault();
        const node=label.closest('[data-nav-id]');
        this.revealPath(node,{includeSelf:true});
        this.go(label.dataset.navTarget);
      });

      this.menuButton.addEventListener('click',()=>this.setDrawer(!this.state.drawer));
      this.collapseButton.addEventListener('click',()=>this.setCollapsed(!this.state.collapsed));
      this.scrim.addEventListener('click',()=>this.setDrawer(false));
      window.addEventListener('scroll',()=>this.scheduleRead(),{passive:true});
      window.addEventListener('resize',()=>this.handleResize(),{passive:true});
      window.addEventListener('wheel',()=>this.cancelTransition(),{passive:true});
      window.addEventListener('touchstart',()=>this.cancelTransition(),{passive:true});
      window.addEventListener('pointerdown',()=>this.cancelTransition(),{passive:true});

      document.addEventListener('keydown',event=>{
        if(['PageUp','PageDown','Home','End','ArrowUp','ArrowDown',' '].includes(event.key))this.cancelTransition();
        if(event.key==='Tab'&&this.state.drawer)this.trapDrawerFocus(event);
        if(event.key==='Escape'&&this.state.drawer&&!document.querySelector('#popupLayer .term-popup'))this.setDrawer(false);
      });
    }

    closeEveryBranch(){for(const item of this.items)this.closeBranch(item.node,{deep:true});}
    closeBranch(node,{deep=true}={}){
      const branch=this.branch(node),toggle=this.toggle(node);if(!branch)return;
      branch.hidden=true;if(toggle)toggle.setAttribute('aria-expanded','false');
      if(deep)for(const child of branch.children)if(child.matches('[data-nav-id]'))this.closeBranch(child,{deep:true});
    }
    openBranch(node){
      const branch=this.branch(node),toggle=this.toggle(node);if(!branch)return;
      if(branch.hidden){
        for(const peer of node.parentElement.children)if(peer!==node&&peer.matches('[data-nav-id]')&&!this.isOnActivePath(peer))this.closeBranch(peer,{deep:true});
        branch.hidden=false;
      }
      if(toggle)toggle.setAttribute('aria-expanded','true');
    }
    isOnActivePath(node){
      const active=this.byId.get(this.state.active)?.node;
      for(let current=active;current;current=this.parentNode(current))if(current===node)return true;
      return false;
    }
    toggleBranch(node){
      const branch=this.branch(node);if(!branch)return;
      if(branch.hidden)this.openBranch(node);else if(!this.isOnActivePath(node))this.closeBranch(node,{deep:true});
    }
    revealPath(node,{includeSelf=false}={}){
      const path=[];for(let parent=this.parentNode(node);parent;parent=this.parentNode(parent))path.unshift(parent);
      for(const parent of path)this.openBranch(parent);
      if(includeSelf)this.openBranch(node);
    }

    setInteractive(root,interactive){
      if(this.supportsInert){root.inert=!interactive;return;}
      const key='data-nav-saved-tabindex';
      for(const control of root.querySelectorAll('a,button,input,select,textarea,[tabindex]')){
        if(!interactive&&!control.hasAttribute(key)){
          control.setAttribute(key,control.getAttribute('tabindex')??'');control.setAttribute('tabindex','-1');
        }else if(interactive&&control.hasAttribute(key)){
          const saved=control.getAttribute(key);control.removeAttribute(key);
          if(saved==='')control.removeAttribute('tabindex');else control.setAttribute('tabindex',saved);
        }
      }
    }
    applyViewportState(){
      const panelHidden=this.mobile?!this.state.drawer:this.state.collapsed;
      this.setInteractive(this.panel,!panelHidden);
      this.panel.setAttribute('aria-hidden',String(panelHidden));
      const documentBlocked=this.mobile&&this.state.drawer;
      this.setInteractive(this.main,!documentBlocked);
      if(documentBlocked)this.main.setAttribute('aria-hidden','true');else this.main.removeAttribute('aria-hidden');
      this.scrim.setAttribute('aria-hidden',String(!this.state.drawer));
      document.body.classList.toggle('nav-drawer-open',this.state.drawer);
      document.body.classList.toggle('nav-collapsed',this.state.collapsed);
      this.menuButton.setAttribute('aria-expanded',String(this.state.drawer));
      this.menuButton.setAttribute('aria-label',this.state.drawer?'Close navigation':'Open navigation');
      this.collapseButton.setAttribute('aria-expanded',String(!this.state.collapsed));
      this.collapseButton.setAttribute('aria-label',this.state.collapsed?'Expand navigation':'Collapse navigation');
      this.collapseButton.textContent=this.state.collapsed?'▶':'◀';
    }
    setDrawer(open){
      const next=this.mobile&&Boolean(open);if(next===this.state.drawer)return;
      const returnFocus=this.state.drawer&&this.panel.contains(document.activeElement);
      this.state.drawer=next;this.applyViewportState();
      if(next)requestAnimationFrame(()=>this.panel.querySelector('[data-nav-target]')?.focus({preventScroll:true}));
      else if(returnFocus)this.menuButton.focus({preventScroll:true});
    }
    setCollapsed(collapsed){
      const next=this.mobile?false:Boolean(collapsed);if(next===this.state.collapsed)return;
      const returnFocus=!this.state.collapsed&&this.panel.contains(document.activeElement);
      this.state.collapsed=next;this.applyViewportState();
      if(returnFocus&&next)this.collapseButton.focus({preventScroll:true});
    }
    trapDrawerFocus(event){
      const controls=[...this.panel.querySelectorAll('a,button,input,select,textarea,[tabindex]')].filter(control=>control.tabIndex>=0&&!control.closest('[hidden]'));
      if(!controls.length)return;
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    handleResize(){
      const mobile=window.innerWidth<=this.breakpoint;
      if(mobile!==this.mobile){
        this.mobile=mobile;this.state.drawer=false;if(mobile)this.state.collapsed=false;this.applyViewportState();
      }
      this.scheduleGeometry();
    }

    buttonSet(item){
      const buttons=new Set([item.button]);
      for(let parent=this.parentNode(item.node);parent;parent=this.parentNode(parent)){
        const button=this.direct(parent,'toc-row')?.querySelector('[data-nav-target]');if(button)buttons.add(button);
      }
      return buttons;
    }
    activate(id,{keepVisible=true,behavior='auto'}={}){
      const item=this.byId.get(id);if(!item)return;
      const next=this.buttonSet(item);
      for(const button of this.activeButtons)if(!next.has(button)){
        button.classList.remove('is-current','is-ancestor');button.removeAttribute('aria-current');
      }
      item.button.classList.remove('is-ancestor');item.button.classList.add('is-current');item.button.setAttribute('aria-current','location');
      for(const button of next)if(button!==item.button){button.classList.remove('is-current');button.classList.add('is-ancestor');button.removeAttribute('aria-current');}
      this.activeButtons=next;this.state.active=id;
      this.revealPath(item.node,{includeSelf:true});
      if(keepVisible)this.keepRowVisible(item.row,behavior);
    }
    keepRowVisible(row,behavior='auto'){
      if(!row||this.panel.inert||this.panel.getAttribute('aria-hidden')==='true')return;
      const panel=this.panel.getBoundingClientRect(),item=row.getBoundingClientRect(),gap=12;
      if(item.top<panel.top+gap)this.panel.scrollTo({top:this.panel.scrollTop-(panel.top+gap-item.top),behavior});
      else if(item.bottom>panel.bottom-gap)this.panel.scrollTo({top:this.panel.scrollTop+(item.bottom-panel.bottom+gap),behavior});
    }

    clearance(item){return item.glossaryNested?this.geometry.glossaryHeight:0;}
    destination(element){
      const item=this.byId.get(element.dataset.track||element.id);
      const clearance=item?this.clearance(item):(element.id!=='glossary'&&element.closest?.('#glossary')?this.geometry.glossaryHeight:0);
      return Math.max(0,window.scrollY+element.getBoundingClientRect().top-this.geometry.headerBottom-this.trackingGap-clearance);
    }
    scheduleGeometry(){
      if(this.frames.geometry)return;
      this.frames.geometry=requestAnimationFrame(()=>{this.frames.geometry=0;this.refreshGeometry();});
    }
    refreshGeometry(){
      const scrollY=window.scrollY;
      this.geometry.headerBottom=this.header.getBoundingClientRect().bottom;
      this.geometry.glossaryHeight=document.querySelector('.glossary-tools')?.getBoundingClientRect().height||0;
      this.geometry.ranges=this.items.map(item=>{
        const rect=item.section.getBoundingClientRect();return{item,top:scrollY+rect.top,bottom:scrollY+rect.bottom};
      });
      this.readViewport();
    }
    pickActive(){
      const scrollY=window.scrollY;let winner=null;
      for(const range of this.geometry.ranges){
        const line=scrollY+this.geometry.headerBottom+this.trackingGap+this.clearance(range.item);
        if(range.top<=line+this.epsilon&&range.bottom>line&&(!winner||range.item.depth>winner.item.depth||range.item.depth===winner.item.depth&&range.top>winner.top))winner=range;
      }
      if(winner?.item.id==='glossary'){
        let glossaryWinner=null;
        for(const range of this.geometry.ranges){
          if(!range.item.glossaryNested)continue;
          const line=scrollY+this.geometry.headerBottom+this.trackingGap+this.clearance(range.item);
          if(range.top<=line+this.epsilon&&(!glossaryWinner||range.top>glossaryWinner.top))glossaryWinner=range;
        }
        if(glossaryWinner)return glossaryWinner.item;
      }
      if(winner)return winner.item;
      for(const range of this.geometry.ranges){
        const line=scrollY+this.geometry.headerBottom+this.trackingGap+this.clearance(range.item);
        if(range.top<=line+this.epsilon&&(!winner||range.top>winner.top||range.top===winner.top&&range.item.depth>winner.item.depth))winner=range;
      }
      return winner?.item||this.items[0]||null;
    }
    scheduleRead(){
      if(this.state.owner!=='reader'||this.frames.reader)return;
      this.frames.reader=requestAnimationFrame(()=>{this.frames.reader=0;this.readViewport();});
    }
    readViewport(){
      if(this.state.owner!=='reader')return;
      const item=this.pickActive();if(item&&item.id!==this.state.active)this.activate(item.id);
    }

    highlightElement(element){
      if(element.matches?.('.glossary-card,.rule-card,.enhancement,.unit-card,.ability,.stratagem,.hero'))return element;
      const content=[...element.children].find(child=>child.classList?.contains('detachment-content'));
      const stratagem=content?.querySelector('.stratagem');if(stratagem)return stratagem;
      const heading=[...element.children].find(child=>child.matches?.('.section-title,.category-title,.detachment-part-title')||/^H[1-6]$/.test(child.tagName||''));
      if(heading)return heading;
      return[...element.children].find(child=>child.matches?.('.glossary-card,.rule-card,.enhancement,.unit-card,.ability,.stratagem'))||element;
    }
    highlight(element){
      const target=this.highlightElement(element);if(!target)return;
      target.classList.remove('destination-highlight');void target.offsetWidth;target.classList.add('destination-highlight');
      window.setTimeout(()=>target.classList.remove('destination-highlight'),2300);
    }

    go(id){const item=this.byId.get(id);if(!item)return;this.setDrawer(false);this.navigate(id,item.section);}
    navigate(id,element,settled){this.beginTransition(id,this.destination(element),()=>{this.highlight(element);settled?.();});}
    restore(id,scrollY,settled){this.beginTransition(id,Math.max(0,scrollY),settled);}
    beginTransition(id,destination,settled){
      const token=++this.state.transition;this.state.owner='controller';this.activate(id,{behavior:'smooth'});
      window.scrollTo({top:destination,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
      this.waitForSettle(destination,token,settled);
    }
    waitForSettle(destination,token,settled){
      const started=Date.now();let previous=window.scrollY,stable=0;
      const inspect=()=>{
        if(token!==this.state.transition)return;
        const current=window.scrollY;stable=Math.abs(current-previous)<1?stable+1:0;previous=current;
        if(Math.abs(current-destination)<2||stable>=6||Date.now()-started>2200){
          this.state.owner='reader';settled?.();this.readViewport();return;
        }
        requestAnimationFrame(inspect);
      };
      requestAnimationFrame(inspect);
    }
    cancelTransition(){
      if(this.state.owner!=='controller')return;
      this.state.transition++;this.state.owner='reader';this.scheduleRead();
    }
  }

  window.DGNavigation=NavigationController;
}());
