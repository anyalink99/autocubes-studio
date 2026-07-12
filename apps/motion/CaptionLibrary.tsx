import React, {useState} from 'react';
import {Captions, Download, Plus, Upload} from 'lucide-react';
import {CaptionEvent, EditorProject} from '../../packages/core/editor-project';
import {captionsToSrt, linesToCaptions, parseSrt} from '../../packages/core/captions';

type Props = {project:EditorProject; currentTime:number; selectedId?:string; onSelect:(id:string)=>void; onImport:(captions:CaptionEvent[])=>void};

export const CaptionLibrary = ({project,currentTime,selectedId,onSelect,onImport}:Props) => {
  const [draft,setDraft] = useState('');
  const download = () => {
    const url=URL.createObjectURL(new Blob([captionsToSrt(project.captions)],{type:'application/x-subrip'}));
    const link=document.createElement('a'); link.href=url; link.download=`${project.id}.srt`; link.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <div className="caption-library">
    <div className="sidebar-section-head"><span>{project.captions.length} captions</span><div><label className="asset-upload" title="Import SRT"><Upload size={13}/><input type="file" accept=".srt,text/plain" onChange={(event)=>{const file=event.target.files?.[0]; if(file) void file.text().then((text)=>onImport(parseSrt(text))); event.target.value='';}}/></label><button onClick={download} title="Export SRT"><Download size={13}/></button></div></div>
    <section className="caption-paste"><span>Paste one caption per line</span><textarea value={draft} onChange={(event)=>setDraft(event.target.value)} placeholder={'Opening statement\nProduct detail\nCall to action'}/><button disabled={!draft.trim()} onClick={()=>{onImport(linesToCaptions(draft,currentTime));setDraft('');}}><Plus size={13}/>Create sequence at playhead</button></section>
    <div className="caption-list">{[...project.captions].sort((a,b)=>a.at-b.at).map((caption,index)=><button key={caption.id} className={selectedId===caption.id?'selected':''} onClick={()=>onSelect(caption.id)}><Captions size={13}/><span><strong>{caption.text || caption.label}</strong><small>{index+1} · {caption.at.toFixed(1)}s → {(caption.at+caption.duration).toFixed(1)}s</small></span></button>)}</div>
  </div>;
};
