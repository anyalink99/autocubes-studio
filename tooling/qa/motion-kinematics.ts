import assert from 'node:assert/strict';
import {buildDirectedCapturePlan,captureDirectionReport,migrateEditorProject,updateFrameWithRipple} from '../../packages/core/editor-operations';
import {cursorStateAt} from '../../packages/core/motion-kinematics';
import {CaptureSection,CaptureTarget,EditorProject} from '../../packages/core/editor-project';

const project=migrateEditorProject({
  version:3,id:'motion-qa',title:'Motion QA',url:'https://example.com',fps:30,duration:12,
  viewport:{width:1080,height:1920},pageHeight:7600,frames:[],pointer:[],transitions:[],captions:[],audio:[],
} as EditorProject);

const sections:CaptureSection[]=[
  {id:'hero',label:'Hero',selector:'main',scrollY:0,level:1},
  {id:'feature',label:'Feature',selector:'#feature',scrollY:1500,level:2},
  {id:'proof',label:'Proof',selector:'#proof',scrollY:5200,level:2},
  {id:'final',label:'Final CTA',selector:'#final',scrollY:5680,level:2},
];
const targets:CaptureTarget[]=[
  {id:'cta',label:'Open project',selector:'#feature button',role:'button',x:770,y:680,pageY:2180,width:180,height:60},
  {id:'case',label:'View case',selector:'#proof a',role:'link',x:320,y:880,pageY:6080,width:240,height:80},
];

buildDirectedCapturePlan(project,sections,targets,'cinematic');
assert.equal(project.frames.length,4);
assert.equal(project.pointer.length,2);
assert.ok(project.frames[2].duration>project.frames[1].duration,'Longer scroll must receive more time');
assert.ok(project.frames.every((frame,index)=>index===0||frame.at>=project.frames[index-1].at+project.frames[index-1].duration+project.frames[index-1].hold-.02),'Scenes must not overlap');
assert.ok(project.pointer.every((event)=>event.path==='human'&&event.duration>.6),'Directed cursor moves must use readable human paths');

const event=project.pointer[0];
const before=cursorStateAt(project.pointer,event.at,project.viewport);
const middle=cursorStateAt(project.pointer,event.at+event.duration*.35,project.viewport);
const end=cursorStateAt(project.pointer,event.at+event.duration,project.viewport);
const linearCross=(middle.x-before.x)*(end.y-before.y)-(middle.y-before.y)*(end.x-before.x);
assert.ok(Math.abs(linearCross)>100,'Cursor midpoint must leave the robotic straight line');
assert.ok(Math.abs(end.x-event.x)<.01&&Math.abs(end.y-event.y)<.01,'Cursor must land exactly on its target');

const nextAt=project.frames[2].at;
const durationBefore=project.duration;
updateFrameWithRipple(project,project.frames[1].id,{hold:project.frames[1].hold+.5});
assert.ok(Math.abs(project.frames[2].at-nextAt-.5)<.001,'Timing edits must ripple through later scenes');
assert.ok(Math.abs(project.duration-durationBefore-.5)<.001,'Ripple edit must update output duration');

const report=captureDirectionReport(project);
assert.ok(report.score>=85,`Directed plan quality is too low: ${report.score}`);
console.log(`Motion kinematics passed · ${project.frames.length} scenes · ${project.pointer.length} actions · score ${report.score}`);
