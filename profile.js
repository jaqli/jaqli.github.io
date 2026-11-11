function el(tag,text,className){
  const node=document.createElement(tag);
  if(text!=null)node.textContent=text;
  if(className)node.className=className;
  return node;
}
function url(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{const result=new URL(value,location.href);return ['http:','https:'].includes(result.protocol)?result.href:null;}catch{return null;}
}
function link(label,href,className='source-link'){
  const a=el('a',label,className),safe=url(href);
  if(safe)a.href=safe;
  a.target='_blank';a.rel='noopener noreferrer';return a;
}
function emailLink(email,label=email){
  if(!/^[a-z\d._%+-]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(email||''))return null;
  const a=el('a',label,'source-link');a.href=`mailto:${email}`;return a;
}
function publication(paper){
  const item=el('article',null,'publication');
  const meta=el('div',null,'publication-meta');
  const year=paper.venue?.includes(String(paper.year))?'':paper.year;
  meta.append(el('span',[paper.venue,year].filter(Boolean).join(' / ')));
  if(paper.role)meta.append(el('span',paper.role,'profile-badge'));
  const heading=el('h3');heading.append(link(paper.title,paper.url,''));
  item.append(meta,heading);
  if(paper.authors)item.append(el('p',paper.authors,'publication-authors'));
  return item;
}
export function renderProfile(profile){
  if(!profile?.syncedAt)return;
  const root=document.querySelector('#content'),nav=document.querySelector('#profile-nav');
  const about=profile.about||{},contacts=about.contacts||{};
  document.querySelector('#profile-name').textContent=profile.name;
  document.querySelector('#profile-lead').textContent=about.tagline||profile.affiliation||'Research & publications';
  document.querySelector('#profile-affiliation').textContent=about.tagline?(profile.affiliation||''):'';
  const avatar=document.querySelector('#profile-avatar');
  document.querySelector('#profile-picture').hidden=!url(profile.avatar?.url);
  if(url(profile.avatar?.url)){avatar.src=url(profile.avatar.url);avatar.alt=profile.avatar.alt||profile.name;}
  const links=document.querySelector('#profile-links');links.replaceChildren(link('Scholar ↗',profile.source));
  const email=emailLink(contacts.email,'Email ↗');if(email)links.append(email);
  if(contacts.github)links.append(link('GitHub ↗',contacts.github));
  root.replaceChildren();nav.replaceChildren();nav.hidden=false;
  let count=0;
  const section=(id,title,body)=>{
    const s=el('section',null,'profile-section');s.id=id;
    const heading=el('h2'),number=el('span',String(++count).padStart(2,'0'),'section-number');number.setAttribute('aria-hidden','true');
    heading.id=`${id}-heading`;heading.append(number,document.createTextNode(title));s.setAttribute('aria-labelledby',heading.id);
    s.append(heading,body);root.append(s);
    const a=el('a',title);a.href=`#${id}`;nav.append(a);
  };
  if(profile.bio)section('about','About',el('p',profile.bio,'profile-bio'));
  if(about.education?.length){
    const list=el('ol',null,'profile-timeline');
    for(const entry of about.education){
      const item=el('li');item.append(el('p',entry.period,'profile-date'),el('h3',entry.title),el('p',entry.institution,'profile-institution'),el('p',entry.department,'profile-note'));
      if(entry.advisor)item.append(el('p',`Advisor / ${entry.advisor}`,'profile-note'));
      list.append(item);
    }
    section('education','Education',list);
  }
  if(about.research?.length){
    const list=el('ul',null,'research-list');
    for(const entry of about.research){const item=el('li');item.append(el('h3',entry.title),el('p',entry.description));list.append(item);}
    section('research','Research',list);
  }else if(profile.interests?.length)section('research','Research',el('p',profile.interests.join(' / ')));
  const selected=about.selectedPublications||[],all=profile.publications||[];
  if(selected.length||all.length){
    const body=el('div',null,'publications-list');
    if(selected.length)body.append(el('p','SELECTED PUBLICATIONS','profile-eyebrow'));
    for(const paper of selected.length?selected:all)body.append(publication(paper));
    if(selected.length){
      const selectedURLs=new Set(selected.map(p=>p.scholarURL));
      const more=all.filter(p=>!selectedURLs.has(p.url));
      if(more.length){
        const details=el('details',null,'profile-disclosure');details.append(el('summary',`More publications (${more.length})`));
        const list=el('div',null,'more-publications');for(const paper of more)list.append(publication(paper));
        details.append(list);body.append(details);
      }
    }
    body.append(link('Google Scholar ↗',profile.source));section('publications','Publications',body);
  }
  if(about.competitions?.length){
    const list=el('ul',null,'achievement-list');
    for(const entry of about.competitions){
      const item=el('li'),meta=el('p',null,'achievement-meta');meta.append(el('span',`${entry.venue} / ${entry.year}`),el('span',entry.result,'profile-badge'));
      item.append(meta,el('h3',entry.title),el('p',entry.role,'profile-note'));list.append(item);
    }
    section('competitions','Competitions',list);
  }
  if(about.awards?.length){
    const list=el('ul',null,'honor-list');
    for(const entry of about.awards){
      const item=el('li'),text=el('div');text.append(el('h3',entry.title),el('p',[entry.organization,entry.note].filter(Boolean).join(' · ')));
      item.append(el('span',entry.year,'profile-date'),text);list.append(item);
    }
    section('honors','Honors',list);
  }
  if(contacts.email||contacts.codes?.length){
    const body=el('div',null,'profile-contact'),mail=emailLink(contacts.email);if(mail)body.append(mail);
    if(contacts.github)body.append(link('GitHub ↗',contacts.github));
    if(contacts.codes?.length){
      const details=el('details',null,'profile-disclosure');details.append(el('summary','WeChat / QQ'));
      const codes=el('div',null,'contact-codes');
      for(const code of contacts.codes){
        if(!url(code.url))continue;
        const figure=el('figure'),img=el('img');img.src=url(code.url);img.alt=`${code.label} 联系二维码`;img.loading='lazy';img.decoding='async';
        figure.append(img,el('figcaption',code.label));codes.append(figure);
      }
      details.append(codes);body.append(details);
    }
    section('contact','Contact',body);
  }
  if(about.source){const source=el('p',null,'profile-source');source.append(link('About on Notion ↗',about.source,''));root.append(source);}
}
