# BVH-compatible source built from fbx2npz output (rest orientation = identity world, like BVH).
import numpy as np
from scipy.spatial.transform import Rotation as Rot
class NPZSrc:
    def __init__(s, path):
        z = np.load(path); s.names = [str(n) for n in z['names']]; s.parent = list(z['parent'])
        rest = z['rest']; s.offset = np.array([rest[j] - (rest[s.parent[j]] if s.parent[j] >= 0 else 0) for j in range(len(s.names))])
        s.Q = z['Q']; s.Pw = z['P']; s.dt = float(z['dt']); s.nf = s.Q.shape[0]
    def fk(s, frames=None):
        if frames is None: frames = np.arange(s.nf)
        return s.Pw[frames], [Rot.from_quat(s.Q[frames, j]) for j in range(len(s.names))]
