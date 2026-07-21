(function(){
  'use strict';

  class JourneyController{
    constructor(navigation,popups,glossary){
      this.navigation=navigation;
      this.popups=popups;
      this.glossary=glossary;
      this.history=[];
      this.sequence=0;
      this.backButton=document.getElementById('backButton');
      document.addEventListener('click',event=>{
        const trigger=event.target.closest('[data-journey-target]');
        if(trigger){event.preventDefault();this.start(trigger,trigger.dataset.journeyTarget,trigger.dataset.journeyType||'link');}
      });
      this.backButton.addEventListener('click',()=>this.back());
    }

    ensureId(element,prefix){if(!element.id)element.id=prefix+'-'+(++this.sequence);return element.id;}
    start(trigger,targetId,type){
      const target=document.getElementById(targetId);if(!target)return;
      if(target.closest?.('#glossary'))this.glossary?.reveal?.(target);
      const triggerId=this.ensureId(trigger,'journey-trigger');
      const root=this.popups.rootElement();if(root)this.ensureId(root,'journey-popup-root');
      const popupCard=trigger.closest('.term-popup');
      this.history.push({
        triggerId,
        scrollY:window.scrollY,
        navId:this.navigation.active,
        popupIds:this.popups.snapshot(),
        popupRootId:root?.id||'',
        popupAction:popupCard?{
          level:Number(popupCard.dataset.popupIndex),
          key:trigger.dataset.actionKey||'',
          target:targetId,
          type:trigger.dataset.journeyType||''
        }:null,
        type
      });
      this.backButton.hidden=false;
      this.popups.restore([],{focus:false});
      const unit=target.closest('.unit-card');
      this.navigation.navigate(unit?.id||targetId,target);
    }

    findRestoredAction(action){
      if(!action)return null;
      const card=this.popups.layer.querySelector('.term-popup[data-popup-index="'+action.level+'"]');
      if(!card)return null;
      const buttons=[...card.querySelectorAll('[data-journey-target]')];
      return buttons.find(button=>button.dataset.actionKey===action.key)||buttons.find(button=>button.dataset.journeyTarget===action.target&&button.dataset.journeyType===action.type)||null;
    }
    highlight(element){
      if(!element)return;
      element.classList.remove('return-highlight');void element.offsetWidth;element.classList.add('return-highlight');
      window.setTimeout(()=>element.classList.remove('return-highlight'),2300);
    }
    back(){
      const record=this.history.pop();if(!record)return;
      this.backButton.hidden=this.history.length===0;
      this.navigation.restore(record.navId,record.scrollY,()=>{
        const popupRoot=document.getElementById(record.popupRootId||record.triggerId);
        this.popups.restore(record.popupIds,{root:popupRoot,focus:false});
        this.popups.reposition();
        const trigger=document.getElementById(record.triggerId)||this.findRestoredAction(record.popupAction);
        const restoredPopup=trigger?.closest?.('.term-popup');
        this.highlight(restoredPopup||trigger);
        if(trigger)trigger.focus({preventScroll:true});else if(record.popupIds.length)this.popups.focusTop();
      });
    }
  }

  window.DGJourney=JourneyController;
}());
