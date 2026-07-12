import {useEffect, useRef, useState} from 'react';

export type ServerSyncStatus = 'connecting' | 'synced' | 'saving' | 'offline' | 'conflict';
type SyncEnvelope<T> = {channel:string;revision:number;updatedAt:string;updatedBy:string;data:T};

const clientId = () => {
  const key = 'autocubes-sync-client';
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const created = `browser-${crypto.randomUUID()}`;
  localStorage.setItem(key, created);
  return created;
};

const headers = () => {
  const token = sessionStorage.getItem('autocubes-sync-token');
  return {'content-type':'application/json', ...(token ? {'x-studio-sync-token': token} : {})};
};

export const useServerSync = <T,>(channel:'operations'|'documents', value:T, applyRemote:(value:T)=>void) => {
  const [status,setStatus] = useState<ServerSyncStatus>('connecting');
  const disabled = useRef(sessionStorage.getItem('autocubes-sync-disabled') === 'true');
  const revision = useRef(0);
  const ready = useRef(false);
  const applyingRemote = useRef(false);
  const latest = useRef(value);
  const apply = useRef(applyRemote);
  latest.current = value;
  apply.current = applyRemote;

  useEffect(()=>{
    if(disabled.current){ready.current=true;setStatus('offline');return;}
    let active=true;
    void (async()=>{
      try {
        const response=await fetch(`/api/sync/${channel}`,{headers:headers()});
        if(response.status===404){
          const created=await fetch(`/api/sync/${channel}`,{method:'PUT',headers:headers(),body:JSON.stringify({baseRevision:0,updatedBy:clientId(),data:latest.current})});
          if(!created.ok)throw new Error(`Sync bootstrap failed: ${created.status}`);
          const envelope=await created.json() as SyncEnvelope<T>;
          revision.current=envelope.revision;
        }else{
          if(!response.ok)throw new Error(`Sync load failed: ${response.status}`);
          const envelope=await response.json() as SyncEnvelope<T>;
          revision.current=envelope.revision;
          applyingRemote.current=true;
          apply.current(envelope.data);
        }
        if(active){ready.current=true;setStatus('synced');}
      }catch(error){
        console.warn(`Server sync for ${channel} is offline`,error);
        if(active){ready.current=true;setStatus('offline');}
      }
    })();
    return()=>{active=false;};
  },[channel]);

  useEffect(()=>{
    if(disabled.current)return;
    if(!ready.current)return;
    if(applyingRemote.current){applyingRemote.current=false;return;}
    const timer=window.setTimeout(()=>void (async()=>{
      setStatus('saving');
      try{
        const response=await fetch(`/api/sync/${channel}`,{method:'PUT',headers:headers(),body:JSON.stringify({baseRevision:revision.current,updatedBy:clientId(),data:value})});
        if(response.status===409){
          localStorage.setItem(`autocubes-${channel}-conflict-${Date.now()}`,JSON.stringify(value));
          const envelope=await response.json() as SyncEnvelope<T>;
          revision.current=envelope.revision;
          applyingRemote.current=true;
          apply.current(envelope.data);
          setStatus('conflict');
          return;
        }
        if(!response.ok)throw new Error(`Sync save failed: ${response.status}`);
        const envelope=await response.json() as SyncEnvelope<T>;
        revision.current=envelope.revision;
        setStatus('synced');
      }catch(error){console.warn(`Server sync for ${channel} could not save`,error);setStatus('offline');}
    })(),700);
    return()=>window.clearTimeout(timer);
  },[channel,value]);

  return status;
};

export const syncStatusLabel:Record<ServerSyncStatus,string>={connecting:'Подключение…',synced:'Синхронизировано',saving:'Сохраняем…',offline:'Локально · сервер недоступен',conflict:'Конфликт сохранён локально'};
