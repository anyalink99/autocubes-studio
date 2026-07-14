import fs from 'node:fs/promises';
import path from 'node:path';
import {EditorProject} from '../../packages/core/editor-project';
import {applyRecommendedCaptureActions,migrateEditorProject} from '../../packages/core/editor-operations';

const main=async()=>{
  const sourcePath=path.resolve(process.argv[2]??'data/projects/flowline.editor.json');
  const project=migrateEditorProject(JSON.parse(await fs.readFile(sourcePath,'utf8')) as EditorProject);
  applyRecommendedCaptureActions(project,project.captureAnalysis?.targets,project.motionProfile);
  await fs.writeFile(sourcePath,`${JSON.stringify(project,null,2)}\n`,'utf8');

  const generatedPath=path.resolve('data/generated/editor-project.json');
  const generated=await fs.readFile(generatedPath,'utf8').then((source)=>JSON.parse(source) as EditorProject).catch(()=>undefined);
  if(generated?.id===project.id)await fs.writeFile(generatedPath,`${JSON.stringify(project,null,2)}\n`,'utf8');

  console.log(`Recommended interactions applied: ${project.pointer.length} actions · ${project.duration.toFixed(2)} sec`);
};

void main().catch((error)=>{console.error(error);process.exitCode=1;});
