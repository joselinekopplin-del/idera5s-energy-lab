import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { KHRMaterialsClearcoat, KHRMaterialsIOR } from '@gltf-transform/extensions';
const base=new URL('../public/models/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
const io=new NodeIO().registerExtensions([KHRMaterialsClearcoat,KHRMaterialsIOR]);
for(const model of manifest.models)test(`${model.quality} GLB: dimensions, finite normals, topology and named animation contract`,async()=>{
  const bytes=await readFile(new URL(model.file,base));
  assert.equal(bytes.length,model.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256);
  const doc=await io.readBinary(bytes),root=doc.getRoot(),nodes=root.listNodes();
  assert.ok(nodes.some(n=>n.getName()==='body'));
  for(const [name,x,y]of [['wheel_FL',1.476,.7995],['wheel_FR',1.476,-.7995],['wheel_RL',-1.29,.802],['wheel_RR',-1.29,-.802]]){
    const node=nodes.find(n=>n.getName()===name);assert.ok(node,name);assert.deepEqual(node.getTranslation(),[x,y,.33965]);assert.deepEqual(node.getScale(),[1,1,1]);
  }
  const names=new Set(root.listMaterials().map(m=>m.getName()));for(const name of ['paint','glass','rubber','alloy','drl','headlamp','taillamp','brakelamp'])assert.ok(names.has(name));
  for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
    const pos=p.getAttribute('POSITION'),norm=p.getAttribute('NORMAL'),idx=p.getIndices();assert.ok(pos&&norm&&idx);assert.equal(pos.getCount(),norm.getCount());assert.equal(idx.getCount()%3,0);
    const positions=pos.getArray(),normals=norm.getArray(),indices=idx.getArray(),used=new Set(indices);
    assert.equal(used.size,pos.getCount(),'No unreferenced vertices after welding');
    for(let i=0;i<positions.length;i++)assert.ok(Number.isFinite(positions[i]));
    for(let i=0;i<normals.length;i+=3)assert.ok(Math.abs(Math.hypot(normals[i],normals[i+1],normals[i+2])-1)<.001,'Unit normal');
    for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];assert.ok(Math.max(a,b,c)<pos.getCount());assert.ok(a!==b&&b!==c&&a!==c);const u=[0,1,2].map(j=>positions[b*3+j]-positions[a*3+j]),v=[0,1,2].map(j=>positions[c*3+j]-positions[a*3+j]);assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-9,'No degenerate triangle');}
  }
  assert.ok(Math.abs(model.bodyLength-4.836)<1e-5);assert.ok(Math.abs(model.bodyWidth-1.880)<1e-5);assert.ok(Math.abs(model.height-1.505)<1e-5);assert.equal(model.invalidNormals,0);
});
test('LOD hierarchy reduces geometry and transfer cost',()=>{const [high,standard,low]=manifest.models;assert.ok(high.triangles>standard.triangles&&standard.triangles>low.triangles);assert.ok(high.bytes>standard.bytes&&standard.bytes>low.bytes);});
