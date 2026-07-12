import React, {useEffect, useState} from 'react';
import {ArrowDownToLine, ArrowUpToLine, ChevronsDown, ChevronsUp, LocateFixed} from 'lucide-react';
import {EditorProject} from '../../packages/core/editor-project';
import {clamp, maxScroll, parsePagePosition, scrollPercent} from '../../packages/core/editor-operations';

type Props = {project: EditorProject; value: number; onChange: (value: number) => void};

export const PagePositionControl = ({project, value, onChange}: Props) => {
  const [input, setInput] = useState(`${Math.round(value)}px`);
  const maximum = maxScroll(project);
  const percent = Math.round(scrollPercent(project, value) * 100);
  useEffect(() => setInput(`${Math.round(value)}px`), [value]);

  const submit = () => {
    const next = parsePagePosition(input, project);
    onChange(next);
    setInput(`${Math.round(next)}px`);
  };

  const beginScrub = (event: React.PointerEvent) => {
    event.preventDefault();
    const origin = event.clientX;
    const start = value;
    const move = (next: PointerEvent) => onChange(clamp(start + (next.clientX - origin) * (next.shiftKey ? 1 : 10), 0, maximum));
    const up = () => {window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);};
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return <section className="page-position-control">
    <div className="page-position-head"><button onPointerDown={beginScrub} title="Потяните, чтобы изменить положение"><LocateFixed size={13}/>Положение на странице</button><strong>{percent}%</strong></div>
    <div className="position-input-row">
      <input value={input} onChange={(event) => setInput(event.target.value)} onBlur={submit} onKeyDown={(event) => {if (event.key === 'Enter') submit();}} aria-label="Page position in pixels or percent"/>
      <span>из {Math.round(maximum)}px</span>
    </div>
    <input className="position-range" type="range" min={0} max={maximum} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))}/>
    <div className="position-presets">
      <button onClick={() => onChange(0)} title="Начало"><ArrowUpToLine size={12}/><span>Начало</span></button>
      <button onClick={() => onChange(maximum * .25)}><ChevronsUp size={12}/><span>25%</span></button>
      <button onClick={() => onChange(maximum * .5)}><LocateFixed size={12}/><span>Центр</span></button>
      <button onClick={() => onChange(maximum * .75)}><ChevronsDown size={12}/><span>75%</span></button>
      <button onClick={() => onChange(maximum)} title="Конец"><ArrowDownToLine size={12}/><span>Конец</span></button>
    </div>
    <div className="position-nudges"><span>Сдвиг</span>{[-100,-10,-1,1,10,100].map((amount) => <button key={amount} onClick={() => onChange(clamp(value + amount, 0, maximum))}>{amount > 0 ? '+' : ''}{amount}</button>)}</div>
    <p>Можно ввести <b>1200px</b>, <b>50%</b>, <b>center</b> или <b>bottom</b>.</p>
  </section>;
};
