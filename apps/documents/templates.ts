export type DocumentBlockType = 'text' | 'checklist' | 'table' | 'callout' | 'quote' | 'deliverables' | 'timeline' | 'budget' | 'approval' | 'signature' | 'image' | 'pageBreak';

export type DocumentBlock = {
  id: string;
  type: DocumentBlockType;
  heading: string;
  body: string;
  items?: string[];
  rows?: string[][];
  checked?: boolean[];
  url?: string;
  caption?: string;
};

export type DocumentVersion = {id:string; createdAt:string; label:string; snapshot:string};
export type DocumentComment = {id:string; blockId?:string; body:string; resolved:boolean; createdAt:string};
export type DocumentLanguage = 'ru' | 'en';
export type DocumentContent = {title:string;intro:string;blocks:DocumentBlock[];client?:string;project?:string;type?:string;status?:string};

export type StudioDocument = {
  id: string;
  templateId: string;
  type: string;
  title: string;
  client: string;
  project: string;
  projectId?: string;
  date: string;
  status: 'Draft' | 'Review' | 'Approved' | 'Archived' | string;
  intro: string;
  blocks: DocumentBlock[];
  updatedAt: string;
  accent?: string;
  versions?: DocumentVersion[];
  comments?: DocumentComment[];
  language?: DocumentLanguage;
  localized?: {ru:DocumentContent;en:DocumentContent};
  sections?: Array<{id:string;heading:string;body:string}>;
};

export type DocumentTemplate = Omit<StudioDocument, 'id' | 'date' | 'updatedAt' | 'versions'> & {name:string;short:string;category:string};

const block = (id:string,type:DocumentBlockType,heading:string,body:string,items?:string[]):DocumentBlock => ({id,type,heading,body,items});
const template = (templateId:string,name:string,short:string,category:string,type:string,title:string,intro:string,blocks:DocumentBlock[]):DocumentTemplate => ({templateId,name,short,category,type,title,client:'Client name',project:'Project name',status:'Draft',intro,blocks,accent:'#ff5a2f'});

export const templates:DocumentTemplate[] = [
  template('creative-brief','Creative brief','Brief','Discovery','creative brief','Creative brief — new project','The shared definition of the problem, audience, outcome, and boundaries before production begins.',[
    block('context','text','Context','What exists today, what changed, and why this project matters now.'),
    block('audience','text','Audience','Who makes the decision, what they need, and what prevents action.'),
    block('objectives','checklist','Objectives','Define observable outcomes.',['Clarify the offer','Create a coherent system','Prepare production-ready assets']),
    block('constraints','callout','Constraints','Budget, timing, technology, legal requirements, approvals, and dependencies.'),
    block('approval','approval','Approval','The brief is ready for production when every owner agrees on scope and success criteria.'),
  ]),
  template('motion-brief','Motion brief','Motion','Production','motion production brief','Motion brief — Instagram production','A practical brief for a reel, story, walkthrough, or motion carousel.',[
    block('message','text','Single message','What should the viewer understand after one watch?'),
    block('format','table','Outputs','Required social formats and durations.',undefined),
    block('beats','timeline','Story beats','Opening hook → proof → product moment → closing action.',['Hook · 0–2s','Build · 2–8s','Proof · 8–13s','CTA · 13–15s']),
    block('assets','checklist','Required assets','Materials needed before editing.',['Approved copy','Final UI capture','Logo and type','Music rights']),
    block('safe','callout','Instagram safety','Keep captions, logos, and calls to action inside platform-safe areas.'),
  ]),
  template('content-plan','Content plan','Content','Social','social content plan','Content plan — campaign','A production board for posts, carousels, reels, captions, owners, and delivery dates.',[
    block('pillars','deliverables','Content pillars','The recurring themes that make the feed coherent.',['Work','Process','Expertise','Studio']),
    block('calendar','table','Publishing plan','Post, format, owner, due date, and status.'),
    block('copy','checklist','Copy checklist','Every post ships with complete supporting copy.',['Caption','Alt text','Hashtags','CTA']),
  ]),
  template('proposal','Project proposal','Proposal','Commercial','project proposal','Proposal — project name','The recommended scope, approach, deliverables, schedule, and commercial terms.',[
    block('understanding','text','How we understand the task','A concise restatement of the business problem and why the proposed work addresses it.'),
    block('solution','text','Recommended solution','The system we propose and the rationale behind its shape.'),
    block('deliverables','deliverables','Deliverables','Concrete production outputs.',['Strategy and direction','Design system','Production files','Handoff documentation']),
    block('timeline','timeline','Stages','A sequence with review points.',['Discovery','Direction','Production','Launch']),
    block('budget','budget','Investment','Describe fees, payment stages, exclusions, and validity.'),
    block('approval','signature','Approval','Names, roles, dates, and signatures.'),
  ]),
  template('estimate','Project estimate','Estimate','Commercial','project estimate','Estimate — project name','A transparent breakdown of effort, cost, reserve, and payment timing.',[
    block('items','budget','Estimate','Workstream · quantity · rate · total.'),
    block('assumptions','callout','Assumptions','The estimate depends on timely feedback, complete materials, and the stated scope.'),
    block('schedule','timeline','Payment schedule','Deposit → direction approval → production approval → handoff.'),
  ]),
  template('scope','Statement of work','SOW','Commercial','statement of work','Statement of work — project name','The binding description of work, responsibilities, acceptance, and change control.',[
    block('scope','deliverables','In scope','Work included in the engagement.',['Discovery','Design','Implementation','Quality assurance']),
    block('out','checklist','Out of scope','Explicit exclusions prevent silent scope expansion.',['Content production unless listed','Third-party fees','Ongoing support']),
    block('responsibilities','table','Responsibilities','Owner, input, due date, and dependency.'),
    block('changes','callout','Change control','Additional work is estimated and approved before production.'),
  ]),
  template('kickoff','Project kickoff','Kickoff','Delivery','project kickoff','Kickoff — project name','The operational starting point: people, access, milestones, risks, and next actions.',[
    block('team','table','Team and roles','Name · role · responsibility · contact.'),
    block('access','checklist','Access checklist','Required access and source materials.',['Analytics','Hosting','Design files','Brand assets','Content']),
    block('milestones','timeline','Milestones','Kickoff → direction → production → QA → launch.'),
    block('risks','callout','Current risks','List the decisions or dependencies most likely to affect delivery.'),
  ]),
  template('production-checklist','Production checklist','Checklist','Delivery','production checklist','Production checklist — project name','A repeatable preflight for design, motion, content, and launch.',[
    block('design','checklist','Design QA','Visual and responsive checks.',['Spacing and alignment','Typography','States and edge cases','Mobile layouts']),
    block('motion','checklist','Motion QA','Playback and export checks.',['Safe areas','Caption readability','Audio levels','Loop and ending']),
    block('delivery','checklist','Delivery QA','Final package checks.',['Naming','Source files','Export dimensions','Documentation']),
  ]),
  template('brand-handoff','Brand handoff','Brand','Handoff','brand handoff','Brand handoff — project name','One practical map of the identity system, files, ownership, and correct usage.',[
    block('system','deliverables','System components','Assets included in the identity package.',['Logo suite','Colour system','Typography','Social templates']),
    block('files','table','File inventory','Asset · format · location · purpose.'),
    block('rules','callout','Usage rule','Use supplied masters. Do not redraw, stretch, or recreate identity assets.'),
    block('support','text','Support','Ownership, warranty period, and contact for production questions.'),
  ]),
  template('social-pack','Social media pack','Social','Handoff','social media pack','Social media pack — campaign','The index for carousels, reels, covers, copy, alt text, and posting guidance.',[
    block('outputs','deliverables','Included outputs','Production-ready social assets.',['Feed portrait posts','Square variants','Stories and reels','Captions and alt text']),
    block('naming','callout','Naming','Campaign_format_sequence_version.ext'),
    block('publishing','checklist','Publishing checklist','Complete before each post.',['Cover checked','Caption approved','Alt text added','Links verified']),
  ]),
  template('case-study','Case study','Case','Editorial','case study','Case study — project name','A clear account of context, decisions, production, and measurable outcome.',[
    block('challenge','text','Challenge','The situation before the work and the constraint that mattered most.'),
    block('approach','text','Approach','The decisive strategic and production choices.'),
    block('work','image','Selected work','Add a representative project visual.'),
    block('results','quote','Outcome','A concise proof point or client statement.'),
  ]),
  template('approval','Client approval sheet','Approve','Approval','client approval','Approval — project milestone','A precise record of what is being approved and what happens next.',[
    block('review','deliverables','Items for review','Files or decisions included in this approval.',['Direction','Copy','Motion preview','Production exports']),
    block('notes','text','Review notes','Consolidated feedback from the authorised approver.'),
    block('decision','approval','Decision','Approved · Approved with listed changes · Changes required.'),
    block('signature','signature','Authorisation','Name, role, date, and signature.'),
  ]),
  template('asset-inventory','Asset inventory','Assets','Handoff','asset inventory','Asset inventory — project name','A searchable register of source files, masters, exports, owners, and rights.',[
    block('inventory','table','Assets','Name · type · source · owner · rights · status.'),
    block('missing','checklist','Missing assets','Materials still required before completion.',[]),
    block('archive','callout','Archive policy','Keep final masters, licensed sources, and approval records together.'),
  ]),
  template('retrospective','Project retrospective','Retro','Operations','project retrospective','Retrospective — project name','A useful close: what worked, what slowed delivery, and what changes next time.',[
    block('worked','checklist','What worked','Practices worth repeating.',[]),
    block('friction','checklist','Friction','Patterns that cost time or clarity.',[]),
    block('actions','table','Actions','Change · owner · due date · success signal.'),
  ]),
  template('handoff','Project handoff','Handoff','Delivery','project handoff','Project handoff — project name','The single entry point for production files, access, operations, and support.',[
    block('links','table','Working links','Product · repository · design · analytics · hosting.'),
    block('access','checklist','Access','Services and confirmed owners.',['Domain','Hosting','Repository','Analytics']),
    block('operations','text','How to operate','The repeatable actions required to update, publish, and maintain the project.'),
    block('support','callout','Support','Warranty period, response boundaries, and responsible contact.'),
  ]),
];

export const createBlock=(type:DocumentBlockType):DocumentBlock=>({id:`block-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,type,heading:{text:'Текстовый раздел',checklist:'Чек-лист',table:'Таблица',callout:'Важно',quote:'Цитата',deliverables:'Результаты',timeline:'Этапы',budget:'Бюджет',approval:'Согласование',signature:'Подписи',image:'Изображение',pageBreak:'Разрыв страницы'}[type],body:'',items:type==='checklist'||type==='deliverables'||type==='timeline'?['Новый пункт']:undefined,rows:type==='table'||type==='budget'?[['Пункт','Ответственный','Статус'],['Новый пункт','','']]:undefined,checked:type==='checklist'?[false]:undefined});

const headingRu:Record<string,string>={Context:'Контекст',Audience:'Аудитория',Objectives:'Цели',Constraints:'Ограничения',Approval:'Согласование','Single message':'Главное сообщение',Outputs:'Форматы','Story beats':'Сценарные акценты','Required assets':'Необходимые материалы','Instagram safety':'Безопасные зоны Instagram','Content pillars':'Контентные направления','Publishing plan':'План публикаций','Copy checklist':'Проверка текста','How we understand the task':'Как мы поняли задачу','Recommended solution':'Предлагаемое решение',Deliverables:'Результаты',Stages:'Этапы',Investment:'Стоимость',Estimate:'Смета',Assumptions:'Допущения','Payment schedule':'График оплаты','In scope':'В составе работ','Out of scope':'За рамками','Responsibilities':'Ответственность','Change control':'Изменение объёма','Team and roles':'Команда и роли','Access checklist':'Доступы',Milestones:'Контрольные точки','Current risks':'Текущие риски','Design QA':'Проверка дизайна','Motion QA':'Проверка motion','Delivery QA':'Проверка передачи','System components':'Состав системы','File inventory':'Состав файлов','Usage rule':'Правила использования',Support:'Поддержка','Included outputs':'Материалы в пакете',Naming:'Именование','Publishing checklist':'Проверка публикации',Challenge:'Задача',Approach:'Подход','Selected work':'Выбранные материалы',Outcome:'Результат','Items for review':'Материалы на согласование','Review notes':'Комментарии','Decision':'Решение',Authorisation:'Подтверждение',Assets:'Материалы','Missing assets':'Недостающие материалы','Archive policy':'Правила архива','What worked':'Что сработало',Friction:'Что мешало',Actions:'Следующие действия','Working links':'Рабочие ссылки',Access:'Доступы','How to operate':'Как управлять'};
const titleRu:Record<string,string>={'creative-brief':'Креативный бриф — новый проект','motion-brief':'Motion-бриф — шоукейс продукта','content-plan':'Контент-план — кампания',proposal:'Предложение по проекту',estimate:'Смета проекта',scope:'Состав и условия работ',kickoff:'Старт проекта','production-checklist':'Производственный чек-лист','brand-handoff':'Передача айдентики','social-pack':'Пакет материалов для соцсетей','case-study':'Кейс проекта',approval:'Лист согласования','asset-inventory':'Реестр материалов',retrospective:'Ретроспектива проекта',handoff:'Передача проекта'};
const introRu:Record<string,string>={'creative-brief':'Общее определение задачи, аудитории, результата и границ проекта до начала производства.','motion-brief':'Практический бриф для reels, stories, обзора сайта или motion-карусели.','content-plan':'План производства постов, каруселей, роликов и сопровождающего текста.',proposal:'Предлагаемый состав работ, подход, сроки и коммерческие условия.',estimate:'Прозрачная разбивка работ, стоимости, резерва и этапов оплаты.',scope:'Зафиксированный состав работ, ответственность сторон и порядок приёмки.',kickoff:'Стартовая точка проекта: команда, доступы, сроки, риски и ближайшие действия.','production-checklist':'Единая проверка дизайна, motion, контента и финальной передачи.','brand-handoff':'Практическая карта айдентики, файлов, владельцев и правил использования.','social-pack':'Индекс каруселей, reels, обложек, текстов и рекомендаций по публикации.','case-study':'Понятная история контекста, решений, производства и результата.',approval:'Точная фиксация материалов на согласование и принятого решения.','asset-inventory':'Реестр исходников, мастер-файлов, экспортов, владельцев и прав.',retrospective:'Что сработало, что замедляло проект и что изменить в следующий раз.',handoff:'Единая точка входа в файлы, доступы, эксплуатацию и поддержку проекта.'};
const itemRu:Record<string,string>={'Clarify the offer':'Прояснить предложение','Create a coherent system':'Создать цельную систему','Prepare production-ready assets':'Подготовить материалы к производству','Approved copy':'Согласованный текст','Final UI capture':'Финальная запись интерфейса','Logo and type':'Логотип и типографика','Music rights':'Права на музыку',Work:'Работы',Process:'Процесс',Expertise:'Экспертиза',Studio:'Студия',Caption:'Подпись','Alt text':'Альтернативный текст',Hashtags:'Хэштеги',CTA:'Призыв к действию'};
const russianContent=(template:DocumentTemplate):DocumentContent=>({title:titleRu[template.templateId]??template.title,intro:introRu[template.templateId]??'Рабочий документ студии для подготовки, согласования и передачи проекта.',client:'Название клиента',project:'Название проекта',type:{'creative-brief':'креативный бриф','motion-brief':'motion-бриф','content-plan':'контент-план',proposal:'предложение',estimate:'смета',scope:'состав работ',kickoff:'старт проекта','production-checklist':'производственный чек-лист','brand-handoff':'передача айдентики','social-pack':'пакет для соцсетей','case-study':'кейс',approval:'согласование','asset-inventory':'реестр материалов',retrospective:'ретроспектива',handoff:'передача проекта'}[template.templateId]??template.type,status:'Черновик',blocks:template.blocks.map((block)=>({...structuredClone(block),heading:headingRu[block.heading]??block.heading,body:block.body?`Заполните раздел «${headingRu[block.heading]??block.heading}»: зафиксируйте конкретные решения, владельцев и критерии готовности.`:'',items:block.items?.map((item)=>itemRu[item]??item)}))});
const contentOf=(source:StudioDocument):DocumentContent=>({title:source.title,intro:source.intro,client:source.client,project:source.project,type:source.type,status:source.status,blocks:structuredClone(source.blocks)});

export const migrateDocument=(source:StudioDocument):StudioDocument=>{const blocks=source.blocks?.length?source.blocks:(source.sections??[]).map((section)=>({id:section.id,type:'text' as const,heading:section.heading,body:section.body}));const base={...source,blocks,versions:source.versions??[],comments:source.comments??[],accent:source.accent??'#ff5a2f'};const content=contentOf(base);return {...base,language:source.language??'ru',localized:source.localized??{ru:content,en:content}};};

export const syncDocumentLocale=(source:StudioDocument):StudioDocument=>{const language=source.language??'ru';const localized=structuredClone(source.localized??{ru:contentOf(source),en:contentOf(source)});localized[language]=contentOf(source);return {...source,language,localized};};

export const switchDocumentLocale=(source:StudioDocument,language:DocumentLanguage):StudioDocument=>{const synced=syncDocumentLocale(source);const content=synced.localized![language];return {...synced,language,title:content.title,intro:content.intro,client:content.client??synced.client,project:content.project??synced.project,type:content.type??synced.type,status:content.status??synced.status,blocks:structuredClone(content.blocks)};};

export const createDocument=(templateId:string):StudioDocument=>{
  const source=templates.find((item)=>item.templateId===templateId)??templates[0];
  const now=new Date();
  const en={title:source.title,intro:source.intro,client:source.client,project:source.project,type:source.type,status:source.status,blocks:structuredClone(source.blocks)};
  const ru=russianContent(source);
  return {...structuredClone(source),...ru,id:`doc-${Date.now()}`,date:now.toISOString().slice(0,10),updatedAt:now.toISOString(),versions:[],language:'ru',localized:{ru,en}};
};
