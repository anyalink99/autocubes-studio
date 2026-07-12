import {CaptionEvent} from './editor-project';

const parseTimestamp = (value: string) => {
  const [hours, minutes, rest] = value.trim().replace(',', '.').split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(rest);
};

const formatTimestamp = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const rest = seconds % 60;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${rest.toFixed(3).padStart(6,'0').replace('.',',')}`;
};

export const parseSrt = (source: string): CaptionEvent[] => source.trim().split(/\r?\n\s*\r?\n/).flatMap((block,index) => {
  const lines = block.trim().split(/\r?\n/);
  const timingIndex = lines.findIndex((line) => line.includes('-->'));
  if (timingIndex < 0) return [];
  const [from,to] = lines[timingIndex].split('-->').map(parseTimestamp);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  return [{id:`caption-import-${Date.now()}-${index}`,label:`Caption ${index+1}`,text:lines.slice(timingIndex+1).join('\n'),at:from,duration:Math.max(.2,to-from),position:'bottom' as const,style:'boxed' as const,size:54,align:'center' as const,maxWidth:86,lineHeight:1.08,letterSpacing:-2.5,animation:'rise' as const}];
});

export const captionsToSrt = (captions: CaptionEvent[]) => [...captions].sort((a,b) => a.at-b.at).map((caption,index) => `${index+1}\n${formatTimestamp(caption.at)} --> ${formatTimestamp(caption.at+caption.duration)}\n${caption.text}`).join('\n\n');

export const linesToCaptions = (source: string, startAt: number) => source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((text,index) => {
  const duration = Math.round(Math.max(1.5,text.split(/\s+/).length/2.8)*10)/10;
  const previousTime = index * 2.2;
  return {id:`caption-lines-${Date.now()}-${index}`,label:`Caption ${index+1}`,text,at:startAt+previousTime,duration,position:'bottom' as const,style:'boxed' as const,size:54,align:'center' as const,maxWidth:86,lineHeight:1.08,letterSpacing:-2.5,animation:'rise' as const};
});
