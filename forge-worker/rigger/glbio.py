import json,struct,numpy as np
def glb(p):
    b=open(p,'rb').read(); l=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+l]); off=20+l; bin_=None
    if off<len(b): bl=struct.unpack('<I',b[off:off+4])[0]; bin_=b[off+8:off+8+bl]
    return j,bin_
CT={5126:np.float32,5123:np.uint16,5125:np.uint32,5121:np.uint8,5122:np.int16,5120:np.int8}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(j,b,i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; n=NC[a['type']]; dt=CT[a['componentType']]
    o=bv.get('byteOffset',0)+a.get('byteOffset',0); arr=np.frombuffer(b,dt,a['count']*n,o)
    return arr.reshape(a['count'],n) if n>1 else arr
