(function(){
  'use strict';

  class GlossarySearch{
    constructor(){
      this.input=document.getElementById('glossarySearch');
      this.clear=document.getElementById('searchClear');
      this.empty=document.getElementById('noResults');
      this.cards=[...document.querySelectorAll('[data-glossary-title]')];
      this.origin=null;
      this.input.addEventListener('input',()=>this.apply());
      this.clear.addEventListener('click',()=>this.reset());
    }
    showAll(){this.cards.forEach(card=>{card.hidden=false;card.style.order='';});this.empty.hidden=true;}
    apply(){
      const query=this.input.value.trim().toLocaleLowerCase();
      if(!query){const top=this.origin;this.origin=null;this.showAll();if(top!==null)window.scrollTo({top,behavior:'smooth'});return;}
      if(this.origin===null)this.origin=window.scrollY;
      let shown=0;
      this.cards.forEach(card=>{const title=card.dataset.glossaryTitle.toLocaleLowerCase(),visible=title.includes(query);card.hidden=!visible;card.style.order=title===query?'-1':'';if(visible)shown++;});
      this.empty.hidden=shown!==0;
    }
    reset(){const top=this.origin;this.input.value='';this.origin=null;this.showAll();this.input.focus({preventScroll:true});if(top!==null)window.scrollTo({top,behavior:'smooth'});}
  }

  class ThemeController{
    constructor(){
      this.button=document.getElementById('themeButton');
      let saved=null;try{saved=localStorage.getItem('dg-v4-theme');}catch(error){}
      this.set(saved||(matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'));
      this.button.addEventListener('click',()=>this.set(document.documentElement.dataset.theme==='dark'?'light':'dark'));
    }
    set(theme){
      document.documentElement.dataset.theme=theme;
      this.button.textContent=theme==='dark'?'☼':'☾';
      this.button.setAttribute('aria-label',theme==='dark'?'Use light theme':'Use dark theme');
      try{localStorage.setItem('dg-v4-theme',theme);}catch(error){}
    }
  }

  class TableAccessibility{
    constructor(){
      for(const table of document.querySelectorAll('.weapon-table[role="table"]')){
        const rows=[...table.querySelectorAll('.weapon-row')];
        table.setAttribute('aria-colcount','7');table.setAttribute('aria-rowcount',String(rows.length));
        rows.forEach((row,rowIndex)=>[...row.children].forEach((cell,columnIndex)=>cell.setAttribute('role',rowIndex===0?'columnheader':columnIndex===0?'rowheader':'cell')));
      }
    }
  }

  window.DGGlossarySearch=GlossarySearch;
  window.DGTheme=ThemeController;
  window.DGTableAccessibility=TableAccessibility;
}());
