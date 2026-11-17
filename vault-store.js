/* IndexedDB adapter for MyFinance encrypted vault. */
(function(root){
  'use strict';
  const DB='myfinance-secure-v1', STORE='vault', KEY='primary';
  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('Could not open secure local storage.'));
    });
  }
  async function request(mode, action){
    const db=await openDb();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode), os=tx.objectStore(STORE), req=action(os);
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('Secure storage operation failed.'));
      tx.onabort=()=>reject(tx.error||new Error('Secure storage transaction failed.'));
    });} finally {db.close();}
  }
  async function get(){return (await request('readonly',os=>os.get(KEY)))||null;}
  async function put(record){await request('readwrite',os=>os.put(record,KEY));return true;}
  async function remove(){await request('readwrite',os=>os.delete(KEY));}
  async function create(data,pin,recovery){
    const record=await MyFinanceVaultCore.createRecord(data,pin,recovery,crypto);
    await put(record);
    const stored=await get();
    const check=await MyFinanceVaultCore.decryptRecord(stored,pin,'pin',crypto);
    if(JSON.stringify(check.data)!==JSON.stringify(data)) throw new Error('Secure storage verification failed. Original records were not removed.');
    return {record:stored,data:check.data,master:check.master};
  }
  async function unlock(secret,mode){
    const record=await get(); if(!record) throw new Error('No secure finance vault was found.');
    const result=await MyFinanceVaultCore.decryptRecord(record,secret,mode,crypto);
    return {record,data:result.data,master:result.master};
  }
  async function save(data,record,master){
    const key=master;
    const plain=new TextEncoder().encode(JSON.stringify(data));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);
    const b64=b=>{let s='';new Uint8Array(b).forEach(v=>s+=String.fromCharCode(v));return btoa(s);};
    const next=Object.assign({},record,{payload:{iv:b64(iv),cipher:b64(cipher)},updatedAt:new Date().toISOString()});
    await put(next); return next;
  }
  async function importBackup(text,recovery){
    let record; try{record=JSON.parse(text);}catch(_){throw new Error('This file is not a valid backup.');}
    const result=await MyFinanceVaultCore.decryptRecord(record,recovery,'recovery',crypto);
    await put(record);
    const check=await get();
    const verified=await MyFinanceVaultCore.decryptRecord(check,recovery,'recovery',crypto);
    if(JSON.stringify(verified.data)!==JSON.stringify(result.data)) throw new Error('Backup restore verification failed.');
    return {record:check,data:verified.data,master:verified.master};
  }
  async function exportBackup(){const record=await get();if(!record)throw new Error('No encrypted backup is available yet.');return JSON.stringify(record,null,2);}
  root.MyFinanceVault={
    get,put,remove,create,unlock,save,importBackup,exportBackup,
    changePin:async(record,oldSecret,newPin,mode)=>{const next=await MyFinanceVaultCore.changePin(record,oldSecret,newPin,mode,crypto);await put(next);return next;}
  };
})(globalThis);
