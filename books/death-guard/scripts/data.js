(function(){
  'use strict';

  window.DG_TERMS=Object.freeze({
    'contagion-range':Object.freeze({title:'Contagion Range',summary:'The range used by Nurgle’s Gift. Enemy units in range are Afflicted; the range cannot exceed 12″ after modifiers.',glossary:'glossary-contagion-range',rule:'army-rule'}),
    assault:Object.freeze({title:'Assault',summary:'A unit with an Assault weapon can remain eligible to shoot in a turn in which it Advanced.',glossary:'glossary-assault',related:['lethal-hits']}),
    'deadly-demise':Object.freeze({title:'Deadly Demise',summary:'When this model is destroyed, its listed Deadly Demise value can cause mortal wounds to nearby units.',glossary:'glossary-deadly-demise'}),
    'lethal-hits':Object.freeze({title:'Lethal Hits',summary:'Critical Hits made with this weapon automatically wound the target.',glossary:'glossary-lethal-hits',related:['assault']}),
    'foul-infusion':Object.freeze({title:'Foul Infusion',summary:'The Biologus Putrifier improves the weapons and Critical Hit threshold of the unit it leads.',glossary:'glossary-foul-infusion',rule:'foul-infusion'}),
    'hyper-blight-grenades':Object.freeze({title:'Hyper blight grenades',summary:'12″ · A D6 · BS 3+ · S 7 · AP -1 · D 2',statline:'biologus-profile',datasheet:'biologus-putrifier',related:['assault','lethal-hits']}),
    'injector-pistol':Object.freeze({title:'Injector pistol',summary:'3″ · A 1 · BS 3+ · S 4 · AP -1 · D 3',statline:'biologus-profile',datasheet:'biologus-putrifier'}),
    'plague-knives':Object.freeze({title:'Plague knives',summary:'Melee · A 4 · WS 3+ · S 4 · AP 0 · D 1',statline:'biologus-profile',datasheet:'biologus-putrifier',related:['lethal-hits']}),
    'defiler-ectoplasma':Object.freeze({title:'Ectoplasma destructor',summary:'36″ · A D6 · BS 3+ · S 12 · AP -3 · D 3',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-excruciator':Object.freeze({title:'Excruciator cannon',summary:'36″ · A 6 · BS 3+ · S 6 · AP -1 · D 2',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-hades-battle-cannon':Object.freeze({title:'Hades battle cannon',summary:'48″ · A D6+3 · BS 3+ · S 10 · AP -1 · D 3',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-hades-lascannon':Object.freeze({title:'Hades lascannon',summary:'48″ · A 2 · BS 3+ · S 12 · AP -3 · D D6+1',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-heavy-baleflamer':Object.freeze({title:'Heavy baleflamer',summary:'12″ · A D6+3 · BS N/A · S 7 · AP -2 · D 2',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-missile-krak':Object.freeze({title:'Heavy missile launcher - krak',summary:'48″ · A 2 · BS 3+ · S 10 · AP -2 · D D6+1',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-missile-frag':Object.freeze({title:'Heavy missile launcher - frag',summary:'48″ · A 2D6 · BS 3+ · S 5 · AP -1 · D 1',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-reaper-autocannon':Object.freeze({title:'Heavy reaper autocannon',summary:'48″ · A 4 · BS 3+ · S 9 · AP -1 · D 3',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-magma-cutters':Object.freeze({title:'Magma cutters',summary:'12″ · A 2 · BS 3+ · S 9 · AP -4 · D D6',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-electroscourge':Object.freeze({title:'Electroscourge',summary:'Melee · A 5 · WS 3+ · S 12 · AP -2 · D 2',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-claws-strike':Object.freeze({title:'Shearing claws - strike',summary:'Melee · A 5 · WS 3+ · S 16 · AP -3 · D D6+1',statline:'defiler-profile',datasheet:'defiler'}),
    'defiler-claws-sweep':Object.freeze({title:'Shearing claws - sweep',summary:'Melee · A 10 · WS 3+ · S 6 · AP -2 · D 1',statline:'defiler-profile',datasheet:'defiler'})
  });
}());
