(() => {
  const rect=e=>e.getBoundingClientRect(),visible=e=>rect(e).width>0&&rect(e).height>0;
  const card=document.querySelector('#card'),strip=document.querySelector('.strip'),fees=document.querySelector('.fees'),blocks=[...document.querySelectorAll('.block')],errors=[],embed=!!document.documentElement.dataset.embed;
  if(!card||!strip||!fees||blocks.length<3||blocks.length>7)return{ok:false,errors:['Missing bounded timeline/fee layout']};
  const within=(a,b)=>a.left>=b.left-.5&&a.right<=b.right+.5&&a.top>=b.top-.5&&a.bottom<=b.bottom+.5;
  if(!embed&&Math.abs(rect(card).height-230)>.1)errors.push('Standalone card is not230px');
  for(const e of document.querySelectorAll('.heading,.strip,.fees,.status-row'))if(visible(e)&&!within(rect(e),rect(card)))errors.push('Section outside card: '+e.className);
  for(const [i,b]of blocks.entries()){
    const box=rect(b),lane=rect(strip);
    if(box.top<lane.top-.5||box.bottom>lane.bottom+.5)errors.push('Block '+i+' exceeds timeline height');
    if(Math.abs(box.width/box.height-132/164)>.02)errors.push('Block '+i+' lost rectangular reference proportions');
    const children=[...b.children].filter(visible);
    for(const c of children)if(!within(rect(c),box))errors.push('Block '+i+' child overflow: '+c.className);
    for(let n=1;n<children.length;n++)if(rect(children[n-1]).bottom>rect(children[n]).top+.5)errors.push('Block '+i+' internal overlap');
    if(rect(b.querySelector('svg')).height<10)errors.push('Block '+i+' graphic too small');
    if(box.bottom>rect(fees).top)errors.push('Block '+i+' overlaps fees');
    if(b.tagName!=='BUTTON'||b.closest('a')||b.querySelector('a'))errors.push('Block '+i+' is not a local inspection control');
  }
  for(const b of document.querySelectorAll('[data-fee]')){
    if(!within(rect(b),rect(fees)))errors.push('Fee control overflow');
    const [label,value]=b.children;if(rect(label).bottom>rect(value).top+.5)errors.push('Fee text overlap');
    if(!within(rect(label),rect(b))||!within(rect(value),rect(b)))errors.push('Fee text outside button');
  }
  if(document.querySelector('a[href^="https://mempool.space"]'))errors.push('Provider link remains');
  if(document.querySelector('#facts,#key,#band-readout'))errors.push('Redundant persistent panels remain');
  const footer=document.querySelector('footer');if(visible(footer)){const links=[...footer.querySelectorAll('a')];if(links.length!==2||links.at(-1).textContent!=='Source')errors.push('Footer differs from Price');if(Math.abs(rect(links.at(-1)).right-rect(footer).right)>.5)errors.push('Source not right aligned');}
  if(document.documentElement.scrollWidth>innerWidth)errors.push('Horizontal page overflow');
  if(embed&&document.documentElement.scrollHeight>innerHeight)errors.push('Embed vertical overflow');
  if(window.__errors?.length)errors.push(...window.__errors);
  return{ok:errors.length===0,errors,viewport:[innerWidth,innerHeight],theme:document.documentElement.dataset.theme,embed,card:rect(card).toJSON(),blocks:blocks.length,graphics:blocks.map(b=>rect(b.querySelector('svg')).height)};
})()
