(function(){
  'use strict';

  class PopupController{
    constructor(terms){
      this.terms=terms;
      this.layer=document.getElementById('popupLayer');
      this.ids=[];
      this.origins=[];
      this.originSequence=0;
      this.bind();
    }

    bind(){
      document.addEventListener('click',event=>{
        const close=event.target.closest('[data-popup-close]');
        if(close&&this.layer.contains(close)){event.preventDefault();this.closeFrom(Number(close.dataset.popupClose));return;}
        const trigger=event.target.closest('[data-term]');
        if(trigger){event.preventDefault();this.open(trigger.dataset.term,trigger);}
      });
      document.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&this.ids.length){event.preventDefault();event.stopImmediatePropagation();this.closeFrom(this.ids.length-1);}
      },true);
      window.addEventListener('resize',()=>this.reposition(),{passive:true});
    }

    snapshot(){return this.ids.slice();}
    rootElement(){return this.resolveOrigin(this.origins[0]);}
    captureOrigin(element,termId){
      if(!element)return null;
      const parent=element.closest?.('.term-popup');
      const rect=element.getBoundingClientRect?.();
      if(parent)return{kind:'popup',parentIndex:Number(parent.dataset.popupIndex),termId,rect};
      if(!element.id)element.id='term-origin-'+(++this.originSequence);
      return{kind:'document',elementId:element.id,rect};
    }
    resolveOrigin(reference){
      if(!reference)return null;
      if(reference.kind==='document')return document.getElementById(reference.elementId);
      if(reference.kind==='popup'){
        const parent=this.layer.querySelector('.term-popup[data-popup-index="'+reference.parentIndex+'"]');
        return[...(parent?.querySelectorAll('[data-term]')||[])].find(button=>button.dataset.term===reference.termId)||null;
      }
      return null;
    }

    open(id,trigger){
      if(!this.terms[id])return;
      const nested=Boolean(trigger?.closest?.('.term-popup'));
      if(!nested){
        if(this.ids.length===1&&this.ids[0]===id){this.focusTop();return;}
        this.ids=[];this.origins=[];
      }
      const current=this.ids[this.ids.length-1];
      if(current===id){this.focusTop();return;}
      const previous=this.ids[this.ids.length-2];
      if(previous===id){this.ids.pop();this.origins.pop();this.sync({focus:true});return;}
      this.ids.push(id);this.origins.push(this.captureOrigin(trigger,id));this.sync({focus:true});
    }
    restore(ids,{root=null,focus=true}={}){
      this.ids=ids.filter(id=>this.terms[id]);
      this.origins=this.ids.map((id,index)=>index===0?this.captureOrigin(root,id):{kind:'popup',parentIndex:index-1,termId:id,rect:null});
      this.sync({focus});
    }
    closeFrom(index){
      if(index<0||index>=this.ids.length)return;
      const returnReference=this.origins[index];
      this.ids=this.ids.slice(0,index);this.origins=this.origins.slice(0,index);this.sync();
      const target=this.resolveOrigin(returnReference);
      if(target?.isConnected)target.focus({preventScroll:true});else this.focusTop();
    }

    actionList(term){
      const actions=[];
      if(term.glossary)actions.push({label:'Glossary',target:term.glossary,type:'glossary'});
      if(term.rule)actions.push({label:'To rule',target:term.rule,type:'rule'});
      if(term.datasheet)actions.push({label:'Datasheet & Wargear',target:term.datasheet,type:'datasheet'});
      if(term.statline)actions.push({label:'Statline',target:term.statline,type:'datasheet'});
      return actions.filter(action=>document.getElementById(action.target));
    }
    createCard(id,index){
      const term=this.terms[id],card=document.createElement('section'),titleId='term-popup-title-'+index+'-'+id;
      card.className='term-popup surface';card.dataset.popupTerm=id;card.dataset.popupIndex=String(index);card.tabIndex=-1;
      card.setAttribute('role','dialog');card.setAttribute('aria-modal','false');card.setAttribute('aria-labelledby',titleId);

      const close=document.createElement('button');close.className='popup-close';close.dataset.popupClose=String(index);close.setAttribute('aria-label','Close '+term.title+' popup');close.textContent='×';
      const title=document.createElement('h3');title.id=titleId;title.textContent=term.title;
      const summary=document.createElement('p');summary.textContent=term.summary;
      card.append(close,title,summary);

      const related=(term.related||[]).filter(relatedId=>relatedId!==id&&this.terms[relatedId]);
      if(related.length){
        const paragraph=document.createElement('p');paragraph.className='popup-related';paragraph.append('Related: ');
        related.forEach((relatedId,relatedIndex)=>{
          if(relatedIndex)paragraph.append(', ');
          const button=document.createElement('button');button.className='term-link';button.dataset.term=relatedId;button.textContent=this.terms[relatedId].title;paragraph.append(button);
        });
        card.append(paragraph);
      }
      const actions=this.actionList(term);
      if(actions.length){
        const group=document.createElement('div');group.className='popup-actions';
        actions.forEach((action,actionIndex)=>{
          const button=document.createElement('button');button.className='popup-action';button.dataset.journeyTarget=action.target;button.dataset.journeyType=action.type;button.dataset.actionKey=index+'-'+actionIndex+'-'+action.type+'-'+action.target;button.textContent=action.label;group.append(button);
        });
        card.append(group);
      }
      return card;
    }

    sync({focus=false}={}){
      const cards=[...this.layer.children];let prefix=0;
      while(prefix<cards.length&&prefix<this.ids.length&&cards[prefix].dataset.popupTerm===this.ids[prefix])prefix++;
      for(let index=cards.length-1;index>=prefix;index--)cards[index].remove();
      for(let index=prefix;index<this.ids.length;index++)this.layer.append(this.createCard(this.ids[index],index));
      this.reposition();if(focus)this.focusTop();
    }
    focusTop(){this.layer.lastElementChild?.focus({preventScroll:true});}

    reposition(){
      const mobile=window.innerWidth<=800,headerBottom=document.getElementById('appHeader').getBoundingClientRect().bottom;
      const cards=[...this.layer.children],visibleStart=Math.max(0,cards.length-3);
      cards.forEach((card,index)=>{
        const previousLeft=card.style.left,previousTop=card.style.top;
        card.style.removeProperty('left');card.style.removeProperty('top');card.style.removeProperty('bottom');
        if(mobile){
          const visibleIndex=Math.max(0,index-visibleStart);
          card.style.left='14px';card.style.bottom='calc('+(14+visibleIndex*24)+'px + env(safe-area-inset-bottom))';return;
        }
        const origin=this.resolveOrigin(this.origins[index]),rect=origin?.getBoundingClientRect?.()||this.origins[index]?.rect;
        if(rect&&(rect.bottom<0||rect.top>window.innerHeight)&&previousLeft&&previousTop){card.style.left=previousLeft;card.style.top=previousTop;return;}
        const margin=14,gap=10,width=card.offsetWidth,height=card.offsetHeight;
        let left=rect?rect.left:(window.innerWidth-width)/2;
        left=Math.max(margin,Math.min(left,window.innerWidth-width-margin));
        let top=rect?rect.bottom+gap:(window.innerHeight-height)/2;
        if(rect&&top+height>window.innerHeight-margin)top=rect.top-height-gap;
        top=Math.max(headerBottom+margin,Math.min(top,window.innerHeight-height-margin));
        card.style.left=Math.round(left+(window.scrollX||0))+'px';
        card.style.top=Math.round(top+(window.scrollY||0))+'px';
      });
    }
  }

  window.DGPopups=PopupController;
}());
