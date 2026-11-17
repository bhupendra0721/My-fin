const test=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const Vault=require('../vault-core.js');
const sample={transactions:[{id:'1',type:'expense',amount:1250,date:'2026-11-01'}],budgets:{Food:5000},goals:[{name:'Emergency',target:10000,saved:1000}],recurring:[],settings:{theme:'dark',budgetAlert:true,billAlert:false}};
test('PIN and recovery password both decrypt the same records',async()=>{
 const r=await Vault.createRecord(sample,'123456','correct horse battery staple',webcrypto);
 const p=await Vault.decryptRecord(r,'123456','pin',webcrypto);
 const b=await Vault.decryptRecord(r,'correct horse battery staple','recovery',webcrypto);
 assert.deepEqual(p.data,sample); assert.deepEqual(b.data,sample);
});
test('wrong PIN and wrong recovery password are rejected',async()=>{
 const r=await Vault.createRecord(sample,'123456','correct horse battery staple',webcrypto);
 await assert.rejects(()=>Vault.decryptRecord(r,'000000','pin',webcrypto),/Incorrect PIN/);
 await assert.rejects(()=>Vault.decryptRecord(r,'wrong recovery phrase','recovery',webcrypto),/Incorrect recovery password/);
});
test('tampered encrypted payload is rejected',async()=>{
 const r=await Vault.createRecord(sample,'123456','correct horse battery staple',webcrypto);
 r.payload.cipher=r.payload.cipher.slice(0,-4)+'AAAA';
 await assert.rejects(()=>Vault.decryptRecord(r,'123456','pin',webcrypto),/could not be verified/);
});
test('invalid data and weak credentials are rejected',async()=>{
 await assert.rejects(()=>Vault.createRecord({transactions:[]},'123456','correct horse battery staple',webcrypto),/validation/);
 await assert.rejects(()=>Vault.createRecord(sample,'1234','correct horse battery staple',webcrypto),/PIN/);
 await assert.rejects(()=>Vault.createRecord(sample,'123456','short',webcrypto),/Recovery password/);
});
test('changing PIN preserves access through recovery password',async()=>{
 const r=await Vault.createRecord(sample,'123456','correct horse battery staple',webcrypto);
 const next=await Vault.changePin(r,'correct horse battery staple','654321','recovery',webcrypto);
 assert.deepEqual((await Vault.decryptRecord(next,'654321','pin',webcrypto)).data,sample);
 assert.deepEqual((await Vault.decryptRecord(next,'correct horse battery staple','recovery',webcrypto)).data,sample);
});
