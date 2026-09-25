import numpy as np
from PIL import Image, ImageDraw
def silhouette(V,F,rows=900):
    x,z=V[:,0],V[:,2]; ar=float(np.abs(x).max())*1.05; zr=float(z.max())
    cols=int(round(rows*2*ar/zr)); cols+= (cols%2==0)
    im=Image.new('L',(cols,rows),0); d=ImageDraw.Draw(im)
    C=(x+ar)/(2*ar)*(cols-1); R=(zr-z)/zr*(rows-1)
    for f in F: d.polygon([(C[i],R[i]) for i in f],fill=1)
    return np.array(im).astype(bool),dict(rows=rows,cols=cols,ar=ar,zr=zr)
