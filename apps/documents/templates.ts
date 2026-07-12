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

export const createBlock=(type:DocumentBlockType):DocumentBlock=>({id:`block-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,type,heading:{text:'Text section',checklist:'Checklist',table:'Table',callout:'Important',quote:'Quote',deliverables:'Deliverables',timeline:'Timeline',budget:'Budget',approval:'Approval',signature:'Signatures',image:'Image',pageBreak:'Page break'}[type],body:'',items:type==='checklist'||type==='deliverables'||type==='timeline'?['New item']:undefined,rows:type==='table'||type==='budget'?[['Item','Owner','Status'],['New item','','']]:undefined,checked:type==='checklist'?[false]:undefined});

export const migrateDocument=(source:StudioDocument):StudioDocument=>({...source,blocks:source.blocks?.length?source.blocks:(source.sections??[]).map((section)=>({id:section.id,type:'text' as const,heading:section.heading,body:section.body})),versions:source.versions??[],comments:source.comments??[],accent:source.accent??'#ff5a2f'});

export const createDocument=(templateId:string):StudioDocument=>{
  const source=templates.find((item)=>item.templateId===templateId)??templates[0];
  const now=new Date();
  return {...structuredClone(source),id:`doc-${Date.now()}`,date:now.toISOString().slice(0,10),updatedAt:now.toISOString(),versions:[]};
};
