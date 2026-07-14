import React, {useState} from 'react';
import {Camera, Check, Copy, MousePointer2, Trash2} from 'lucide-react';
import {AssetLibrary, EditorProject, Selection} from '../../packages/core/editor-project';
import {findMediaPreset, formatRatio, mediaPresets} from '../../packages/core/media-presets';
import {PagePositionControl} from './PagePositionControl';
import {EasingControl} from './EasingControl';
import {CaptureTarget} from '../../packages/core/editor-project';
import {captureTargetAction, clamp} from '../../packages/core/editor-operations';

type Props = {
  project: EditorProject;
  selection: Selection;
  assets: AssetLibrary;
  capturingFrame: boolean;
  onChangeProject: (patch: Partial<EditorProject>) => void;
  onChangeItem: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCaptureFrame: () => void;
  onDeleteProject: () => void;
};

const NumberField = ({label, value, min, max, step = 0.1, onChange}: {label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void}) => (
  <label className="field">
    <span>{label}</span>
    <input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

const TextField = ({label, value, onChange, placeholder}: {label: string; value: string; onChange: (value: string) => void; placeholder?: string}) => (
  <label className="field">
    <span>{label}</span>
    <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const TextAreaField = ({label, value, onChange}: {label: string; value: string; onChange: (value: string) => void}) => (
  <label className="field"><span>{label}</span><textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)}/></label>
);

const SelectField = ({label, value, options, onChange}: {label: string; value: string; options: string[]; onChange: (value: string) => void}) => (
  <label className="field">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{({en:'English',ru:'Русский',linear:'Равномерно',easeIn:'Разгон',easeOut:'Торможение',easeInOut:'Плавно',spring:'Пружина',move:'Перемещение',hover:'Наведение',click:'Клик',pulse:'Импульс',ring:'Кольцо',top:'Сверху',center:'По центру',bottom:'Снизу',clean:'Без фона',boxed:'На плашке',accent:'Акцентный',left:'Слева',right:'Справа',none:'Без анимации',fade:'Проявление',rise:'Подъём',scale:'Масштаб',words:'По словам',music:'Музыка',voice:'Голос',sfx:'Эффект',cut:'Без перехода',blur:'Размытие',dipBlack:'Через чёрный',dipWhite:'Через белый',wipe:'Шторка',slide:'Сдвиг',zoomBlur:'Зум-размытие',flash:'Вспышка',up:'Вверх',down:'Вниз',logo:'Логотип',progress:'Прогресс',label:'Метка',cta:'Призыв',frame:'Рамка',grain:'Шум',timecode:'Таймкод',seconds:'Секунды',frames:'Кадры',cinematic:'Кинематографично',balanced:'Сбалансированно',snappy:'Динамично',human:'Естественная дуга',arc:'Выразительная дуга',direct:'Прямая линия'} as Record<string,string>)[option]??option}</option>)}
    </select>
  </label>
);

export const Inspector = ({project, selection, assets, capturingFrame, onChangeProject, onChangeItem, onDelete, onDuplicate, onCaptureFrame, onDeleteProject}: Props) => {
  const frameItem = selection.track === 'frames' ? project.frames.find((candidate) => candidate.id === selection.id) : undefined;
  const pointerItem = selection.track === 'pointer' ? project.pointer.find((candidate) => candidate.id === selection.id) : undefined;
  const transitionItem = selection.track === 'transitions' ? project.transitions.find((candidate) => candidate.id === selection.id) : undefined;
  const captionItem = selection.track === 'captions' ? project.captions.find((candidate) => candidate.id === selection.id) : undefined;
  const audioItem = selection.track === 'audio' ? project.audio.find((candidate) => candidate.id === selection.id) : undefined;
  const overlayItem = selection.track === 'overlays' ? project.overlays?.find((candidate) => candidate.id === selection.id) : undefined;
  const item = selection.track === 'project' ? project : frameItem ?? pointerItem ?? transitionItem ?? captionItem ?? audioItem ?? overlayItem;
  const projectChecks = [
    {label: 'Формат подходит для соцсетей', ok: Boolean(findMediaPreset(project.viewport.width, project.viewport.height))},
    {label: 'У всех сцен есть снимки', ok: project.frames.length > 0 && project.frames.every((frame) => Boolean(frame.thumbnail))},
    {label: 'Не меньше 30 кадров/с', ok: project.fps >= 30},
    {label: 'У текстовых сцен есть содержание', ok: project.captions.every((caption) => Boolean((project.outputLanguage==='ru'?caption.textRu:caption.textEn)?.trim()))},
    {label: 'Все элементы внутри ролика', ok: [...project.frames, ...project.pointer, ...project.transitions, ...project.captions, ...project.audio, ...(project.overlays ?? [])].every((entry) => entry.at + ('hold' in entry ? entry.duration + entry.hold : entry.duration) <= project.duration + .01)},
  ];

  if (!item) {
    return <aside className="inspector"><div className="inspector-empty">Выберите элемент</div></aside>;
  }

  const title = selection.track === 'project' ? 'Проект' : ({frames:'Сцена',pointer:'Курсор',transitions:'Смена сцены',captions:'Текст',audio:'Звук',overlays:'Графика'} as Record<string,string>)[selection.track];
  const patch = (value: Record<string, unknown>) => selection.track === 'project'
    ? onChangeProject(value as Partial<EditorProject>)
    : onChangeItem(value);

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div><span>Параметры</span><strong>{title}</strong></div>
        {selection.track !== 'project' ? (
          <div className="inspector-actions">
            <button className="icon-button" title="Создать копию" onClick={onDuplicate}><Copy size={15} /></button>
            <button className="icon-button danger" title="Удалить" onClick={onDelete}><Trash2 size={15} /></button>
          </div>
        ) : null}
      </div>

      <div className="inspector-body">
        {selection.track === 'project' ? (
          <>
            <section className="inspector-section">
              <div className="section-label"><span>Формат результата</span><b>{findMediaPreset(project.viewport.width, project.viewport.height)?.shortLabel ?? formatRatio(project.viewport.width, project.viewport.height)}</b></div>
              <div className="format-grid">
                {mediaPresets.map((preset) => {
                  const active = preset.width === project.viewport.width && preset.height === project.viewport.height;
                  return <button key={preset.id} className={active ? 'active' : ''} onClick={() => patch({viewport: {width: preset.width, height: preset.height}, guides: true})}><span>{preset.shortLabel}</span><strong>{preset.label}</strong>{active ? <Check size={12}/> : null}</button>;
                })}
              </div>
            </section>
            <TextField label="Название проекта" value={project.title} onChange={(title) => patch({title})} />
            <TextField label="Адрес страницы" value={project.url} onChange={(url) => patch({url})} />
            <div className="field-grid">
              <NumberField label="Длительность" value={project.duration} min={1} step={0.5} onChange={(duration) => patch({duration})} />
              <NumberField label="Кадров/с" value={project.fps} min={1} step={1} onChange={(fps) => patch({fps})} />
            </div>
            <div className="field-grid">
              <NumberField label="Ширина" value={project.viewport.width} min={320} step={1} onChange={(width) => patch({viewport: {...project.viewport, width}})} />
              <NumberField label="Высота" value={project.viewport.height} min={320} step={1} onChange={(height) => patch({viewport: {...project.viewport, height}})} />
            </div>
            <NumberField label="Высота страницы" value={project.pageHeight} min={project.viewport.height} step={1} onChange={(pageHeight) => patch({pageHeight})} />
            <TextField label="Записанное видео" value={project.previewVideo ?? ''} onChange={(previewVideo) => patch({previewVideo})} />
            <NumberField label="Смещение видео" value={project.videoOffset ?? 0} min={0} onChange={(videoOffset) => patch({videoOffset})} />
            <div className="field-grid"><SelectField label="Отображение времени" value={project.timeDisplay ?? 'timecode'} options={['timecode','seconds','frames']} onChange={(timeDisplay) => patch({timeDisplay})}/><SelectField label="Скорость просмотра" value={String(project.playbackRate ?? 1)} options={['0.25','0.5','0.75','1','1.25','1.5','2']} onChange={(playbackRate) => patch({playbackRate:Number(playbackRate)})}/></div>
            <SelectField label="Язык результата" value={project.outputLanguage ?? 'en'} options={['en','ru']} onChange={(outputLanguage)=>patch({outputLanguage})}/>
            <section className="inspector-section motion-character">
              <div className="section-label"><span>Характер движения</span><b>Capture + MP4</b></div>
              <SelectField label="Режиссёрский профиль" value={project.motionProfile ?? 'balanced'} options={['cinematic','balanced','snappy']} onChange={(motionProfile)=>patch({motionProfile})}/>
              <label className="field range-field"><span>Размер курсора <b>{Math.round((project.cursorScale ?? 1)*100)}%</b></span><input type="range" min={.65} max={1.5} step={.05} value={project.cursorScale ?? 1} onChange={(event)=>patch({cursorScale:Number(event.target.value)})}/></label>
              <label className="toggle-field"><input type="checkbox" checked={project.cursorTrail !== false} onChange={(event)=>patch({cursorTrail:event.target.checked})}/><span>Мягкий шлейф при быстром движении</span></label>
            </section>
            <label className="field range-field"><span>Общая громкость <b>{Math.round((project.masterVolume ?? 1) * 100)}%</b></span><input type="range" min={0} max={1.5} step={.01} value={project.masterVolume ?? 1} onChange={(event) => patch({masterVolume:Number(event.target.value)})}/></label>
            <div className="field-grid"><NumberField label="Начало экспорта" value={project.exportRange?.in ?? 0} min={0} max={project.duration} onChange={(value) => patch({exportRange:{in:value,out:project.exportRange?.out ?? project.duration}})}/><NumberField label="Конец экспорта" value={project.exportRange?.out ?? project.duration} min={0} max={project.duration} onChange={(value) => patch({exportRange:{in:project.exportRange?.in ?? 0,out:value}})}/></div>
            <label className="toggle-field"><input type="checkbox" checked={project.guides !== false} onChange={(event) => patch({guides: event.target.checked})} /><span>Показывать безопасные зоны</span></label>
            <label className="toggle-field"><input type="checkbox" checked={project.snap !== false} onChange={(event) => patch({snap: event.target.checked})} /><span>Привязывать элементы на монтаже</span></label>
            <section className="output-checks">
              <div className="section-label"><span>Проверка перед экспортом</span><b>{projectChecks.filter((check) => check.ok).length}/{projectChecks.length}</b></div>
              {projectChecks.map((check) => <div className={check.ok ? 'ok' : 'pending'} key={check.label}><span>{check.ok ? '✓' : '–'}</span>{check.label}</div>)}
            </section>
            <button className="wide-button danger-button" onClick={onDeleteProject}><Trash2 size={15}/>Удалить проект</button>
          </>
        ) : null}

        {frameItem ? (
          <>
            <TextField label="Название сцены" value={frameItem.label} onChange={(label) => patch({label})} />
            <div className="field-grid">
              <NumberField label="Начало" value={frameItem.at} min={0} max={project.duration} onChange={(at) => patch({at})} />
              <NumberField label="Скролл" value={frameItem.duration} min={0} max={project.duration} onChange={(duration) => patch({duration})} />
            </div>
            <NumberField label="Пауза в сцене" value={frameItem.hold} min={0} max={project.duration} onChange={(hold) => patch({hold})} />
            <PagePositionControl key={frameItem.id} project={project} value={frameItem.scrollY} onChange={(scrollY) => patch({scrollY})}/>
            <EasingControl value={frameItem.easing} onChange={(easing)=>patch({easing})}/>
            <button className="wide-button" onClick={onCaptureFrame} disabled={capturingFrame}>
              <Camera size={16} /> {capturingFrame ? 'Снимаем…' : 'Обновить снимок сцены'}
            </button>
          </>
        ) : null}

        {pointerItem ? (
          <>
            <TextField label="Название действия" value={pointerItem.label} onChange={(label) => patch({label})} />
            <div className="field-grid">
              <SelectField label="Действие" value={pointerItem.kind} options={['move', 'hover', 'click']} onChange={(kind) => patch({kind})} />
              <NumberField label="Начало" value={pointerItem.at} min={0} max={project.duration} onChange={(at) => patch({at})} />
            </div>
            <NumberField label="Время движения" value={pointerItem.duration} min={0.05} onChange={(duration) => patch({duration})} />
            <EasingControl value={pointerItem.easing} onChange={(easing)=>patch({easing})}/>
            <SelectField label="Траектория" value={pointerItem.path ?? 'human'} options={['human','arc','direct']} onChange={(path)=>patch({path})}/>
            <div className="field-grid"><NumberField label="Изгиб траектории" value={pointerItem.curve ?? 0} min={-240} max={240} step={1} onChange={(curve)=>patch({curve:curve||undefined})}/><NumberField label="Пауза перед кликом" value={pointerItem.settle ?? .2} min={0} max={.5} step={.01} onChange={(settle)=>patch({settle})}/></div>
            <div className="field-grid">
              <NumberField label="X" value={pointerItem.x} min={0} max={project.viewport.width} step={1} onChange={(x) => patch({x})} />
              <NumberField label="Y" value={pointerItem.y} min={0} max={project.viewport.height} step={1} onChange={(y) => patch({y})} />
            </div>
            <TextField label="Цель на странице" value={pointerItem.selector ?? ''} placeholder="CSS-селектор найденной кнопки или ссылки" onChange={(selector) => patch({selector})} />
            {project.captureAnalysis?.targets.length?<TargetPicker targets={project.captureAnalysis.targets} onPick={(target)=>{const frame=[...project.frames].sort((a,b)=>a.at-b.at).reduce((active,item)=>pointerItem.at>=item.at?item:active,project.frames[0]);patch({selector:target.selector,targetLabel:target.label,targetRole:target.role,kind:captureTargetAction(target),x:clamp(target.x,20,project.viewport.width-20),y:clamp(target.pageY-(frame?.scrollY??0),20,project.viewport.height-20),resultThumbnail:undefined,interactionChanged:undefined});}}/>:null}
            {pointerItem.resultThumbnail?<div className={`interaction-result ${pointerItem.interactionChanged?'changed':'delivered'}`}><img src={pointerItem.resultThumbnail} alt="Состояние страницы после действия"/><span><b>{pointerItem.interactionChanged?'Страница отреагировала':'Событие выполнено'}</b><small>{pointerItem.interactionChanged?'После действия сохранено изменённое состояние DOM.':'Наведение или клик доставлены, заметного изменения DOM нет.'}</small></span></div>:<p className="interaction-pending">Реакция страницы будет проверена во время следующей записи.</p>}
            <SelectField label="Эффект клика" value={pointerItem.clickEffect ?? 'ring'} options={['ring','pulse','none']} onChange={(clickEffect)=>patch({clickEffect})}/>
            <label className="toggle-field"><input type="checkbox" checked={pointerItem.visible} onChange={(event) => patch({visible: event.target.checked})} /><span>Показывать курсор</span></label>
            <div className="pick-hint"><MousePointer2 size={15} /> Нажмите на превью, чтобы изменить точку действия</div>
          </>
        ) : null}

        {transitionItem ? (
          <>
            <TextField label="Название" value={transitionItem.label} onChange={(label) => patch({label})} />
            <div className="field-grid">
              <NumberField label="Начало" value={transitionItem.at} min={0} max={project.duration} onChange={(at) => patch({at})} />
              <NumberField label="Длительность" value={transitionItem.duration} min={0.05} onChange={(duration) => patch({duration})} />
            </div>
            <SelectField label="Тип" value={transitionItem.kind} options={['cut', 'fade', 'blur', 'dipBlack', 'dipWhite', 'wipe', 'slide', 'zoomBlur', 'flash']} onChange={(kind) => patch({kind})} />
            <div className="field-grid"><SelectField label="Направление" value={transitionItem.direction ?? 'left'} options={['left','right','up','down']} onChange={(direction) => patch({direction})}/><label className="field color-control"><span>Цвет</span><input type="color" value={transitionItem.color ?? '#000000'} onChange={(event) => patch({color:event.target.value})}/></label></div>
            <label className="field range-field"><span>Сила <b>{Math.round(transitionItem.strength * 100)}%</b></span><input type="range" min={0} max={1} step={0.01} value={transitionItem.strength} onChange={(event) => patch({strength: Number(event.target.value)})} /></label>
          </>
        ) : null}

        {captionItem ? (
          <>
            <TextField label="Название" value={captionItem.label} onChange={(label) => patch({label})}/>
            <TextAreaField label="English output" value={captionItem.textEn ?? captionItem.text} onChange={(textEn) => patch({textEn,...(project.outputLanguage==='en'?{text:textEn}:{})})}/>
            <TextAreaField label="Русский результат" value={captionItem.textRu ?? captionItem.text} onChange={(textRu) => patch({textRu,...(project.outputLanguage==='ru'?{text:textRu}:{})})}/>
            <div className="caption-tools"><span>{(project.outputLanguage==='ru'?captionItem.textRu:captionItem.textEn)?.length??0} символов</span><button onClick={() => {const value=(project.outputLanguage==='ru'?captionItem.textRu:captionItem.textEn)??captionItem.text;patch({duration: Math.round(Math.max(1.5, value.trim().split(/\s+/).filter(Boolean).length / 2.8) * 10) / 10});}}>Подогнать время чтения</button></div>
            <div className="field-grid"><NumberField label="Начало" value={captionItem.at} min={0} max={project.duration} onChange={(at) => patch({at})}/><NumberField label="Длительность" value={captionItem.duration} min={0.2} onChange={(duration) => patch({duration})}/></div>
            <div className="field-grid"><SelectField label="Положение" value={captionItem.position} options={['top','center','bottom']} onChange={(position) => patch({position})}/><SelectField label="Стиль" value={captionItem.style} options={['clean','boxed','accent']} onChange={(style) => patch({style})}/></div>
            <div className="field-grid"><SelectField label="Выравнивание" value={captionItem.align ?? 'center'} options={['left','center','right']} onChange={(align) => patch({align})}/><SelectField label="Появление" value={captionItem.animation ?? 'none'} options={['none','fade','rise','scale','words']} onChange={(animation) => patch({animation})}/></div>
            <label className="field range-field"><span>Размер текста <b>{captionItem.size}px</b></span><input type="range" min={24} max={110} step={1} value={captionItem.size} onChange={(event) => patch({size:Number(event.target.value)})}/></label>
            <label className="field range-field"><span>Ширина текста <b>{captionItem.maxWidth ?? 86}%</b></span><input type="range" min={30} max={100} step={1} value={captionItem.maxWidth ?? 86} onChange={(event) => patch({maxWidth:Number(event.target.value)})}/></label>
            <div className="field-grid"><NumberField label="Высота строки" value={captionItem.lineHeight ?? 1.08} min={.8} max={2} step={.01} onChange={(lineHeight) => patch({lineHeight})}/><NumberField label="Трекинг" value={captionItem.letterSpacing ?? -2.5} min={-10} max={20} step={.1} onChange={(letterSpacing) => patch({letterSpacing})}/></div>
          </>
        ) : null}

        {audioItem ? (
          <>
            <TextField label="Название" value={audioItem.label} onChange={(label) => patch({label})} />
            <div className="field-grid">
              <NumberField label="Начало" value={audioItem.at} min={0} max={project.duration} onChange={(at) => patch({at})} />
              <NumberField label="Длительность" value={audioItem.duration} min={0.05} onChange={(duration) => patch({duration})} />
            </div>
            <label className="field"><span>Файл</span><select value={audioItem.asset} onChange={(event) => patch({asset: event.target.value})}>{assets.audio.map((asset) => <option key={asset} value={asset}>{asset.split('/').pop()}</option>)}</select></label>
            <SelectField label="Категория" value={audioItem.category ?? 'sfx'} options={['music','voice','sfx']} onChange={(category)=>patch({category})}/>
            <label className="field range-field"><span>Громкость <b>{Math.round(audioItem.volume * 100)}%</b></span><input type="range" min={0} max={1.5} step={0.01} value={audioItem.volume} onChange={(event) => patch({volume: Number(event.target.value)})} /></label>
            <div className="field-grid"><NumberField label="Нарастание" value={audioItem.fadeIn ?? 0} min={0} max={audioItem.duration} onChange={(fadeIn) => patch({fadeIn})}/><NumberField label="Затухание" value={audioItem.fadeOut ?? 0} min={0} max={audioItem.duration} onChange={(fadeOut) => patch({fadeOut})}/></div>
            <NumberField label="Интервал бита, сек" value={audioItem.beatInterval ?? 0} min={0} max={4} step={.01} onChange={(beatInterval)=>patch({beatInterval})}/>
            <label className="toggle-field"><input type="checkbox" checked={audioItem.loop ?? false} onChange={(event) => patch({loop:event.target.checked})}/><span>Повторять до конца клипа</span></label>
            {audioItem.category==='music'?<label className="toggle-field"><input type="checkbox" checked={audioItem.ducking ?? false} onChange={(event)=>patch({ducking:event.target.checked})}/><span>Приглушать музыку под голосом</span></label>:null}
            <label className="toggle-field"><input type="checkbox" checked={audioItem.enabled} onChange={(event) => patch({enabled: event.target.checked})} /><span>Включён</span></label>
          </>
        ) : null}

        {overlayItem ? <>
          <TextField label="Название" value={overlayItem.label} onChange={(label) => patch({label})}/>
          <TextField label="English output" value={overlayItem.textEn ?? overlayItem.text} onChange={(textEn) => patch({textEn,...(project.outputLanguage==='en'?{text:textEn}:{})})}/>
          <TextField label="Русский результат" value={overlayItem.textRu ?? overlayItem.text} onChange={(textRu) => patch({textRu,...(project.outputLanguage==='ru'?{text:textRu}:{})})}/>
          <div className="field-grid"><NumberField label="Начало" value={overlayItem.at} min={0} max={project.duration} onChange={(at) => patch({at})}/><NumberField label="Длительность" value={overlayItem.duration} min={.1} onChange={(duration) => patch({duration})}/></div>
          <SelectField label="Тип графики" value={overlayItem.kind} options={['logo','progress','label','cta','frame','grain']} onChange={(kind) => patch({kind})}/>
          <div className="field-grid"><NumberField label="X %" value={overlayItem.x} min={0} max={100} step={1} onChange={(x) => patch({x})}/><NumberField label="Y %" value={overlayItem.y} min={0} max={100} step={1} onChange={(y) => patch({y})}/></div>
          <label className="field range-field"><span>Масштаб <b>{Math.round(overlayItem.scale * 100)}%</b></span><input type="range" min={.25} max={3} step={.01} value={overlayItem.scale} onChange={(event) => patch({scale:Number(event.target.value)})}/></label>
          <label className="field range-field"><span>Прозрачность <b>{Math.round(overlayItem.opacity * 100)}%</b></span><input type="range" min={0} max={1} step={.01} value={overlayItem.opacity} onChange={(event) => patch({opacity:Number(event.target.value)})}/></label>
          <label className="field color-control"><span>Цвет</span><input type="color" value={overlayItem.color} onChange={(event) => patch({color:event.target.value})}/><code>{overlayItem.color}</code></label>
        </> : null}
      </div>
    </aside>
  );
};

const TargetPicker=({targets,onPick}:{targets:CaptureTarget[];onPick:(target:CaptureTarget)=>void})=>{const[query,setQuery]=useState('');const filtered=targets.filter((target)=>`${target.label} ${target.role} ${target.selector}`.toLowerCase().includes(query.toLowerCase())).slice(0,24);return <details className="target-picker"><summary>Выбрать элемент со страницы</summary><div><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Кнопка, ссылка или поле…"/>{filtered.map((target)=><button key={target.id} onClick={(event)=>{event.preventDefault();onPick(target);event.currentTarget.closest('details')?.removeAttribute('open');}}><strong>{target.label}</strong><small>{target.role} · {target.selector}</small></button>)}</div></details>;};
