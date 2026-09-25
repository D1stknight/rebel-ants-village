# rasterize front silhouette -> joints.json + joints.png
import os,sys,json,numpy as np; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import landmarks
OUT=os.environ.get('FORGE_OUT','.')
d=np.load(OUT+'/norm.npz'); J,dbg=landmarks.detect(d['V'],d['F'])
json.dump({k:list(map(float,v)) for k,v in J.items()},open(OUT+'/joints.json','w'),indent=0); landmarks.draw(J,dbg,OUT+'/joints.png')
print('joints',len(J))
