import React from 'react';
import {Composition} from 'remotion';
import editorProject from '../../data/generated/editor-project.json';
import {EditorReel} from './editor/EditorReel';
import {FlowlineCursorStudy} from './flowline/FlowlineCursorStudy';
import {FlowlineReel} from './flowline/FlowlineReel';

export const Root = () => (
  <>
    <Composition
      id="EditorReel"
      component={EditorReel}
      width={editorProject.viewport.width}
      height={editorProject.viewport.height}
      fps={editorProject.fps}
      durationInFrames={Math.round(editorProject.duration * editorProject.fps)}
      defaultProps={{}}
    />
    <Composition
      id="FlowlineReel"
      component={FlowlineReel}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={570}
      defaultProps={{}}
    />
    <Composition
      id="FlowlineCursorStudy"
      component={FlowlineCursorStudy}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={660}
      defaultProps={{}}
    />
  </>
);
