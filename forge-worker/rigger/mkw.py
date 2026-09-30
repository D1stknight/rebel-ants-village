import os,sys; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); OUT=os.environ.get('FORGE_OUT','.')
import numpy as np, json; from gate import gate, exclusive, facing
d=np.load(OUT+'/proxyW.npz'); PV,PN,W,names=d['PV'],d['PN'],d['W'],d['names']; B=json.load(open(OUT+'/bones.json'))
W1=W
W2,_,frac=gate(PV,W1,names,B); W3,fx=exclusive(W2,names); print('exclusive fixed',fx)
np.savez(OUT+'/proxyW_g.npz',PV=PV,W=W3,names=names)
