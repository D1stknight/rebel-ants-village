import json, sys, numpy as np
d = json.load(open(sys.argv[1]))
np.savez(sys.argv[2], names=np.array(d['names']), parent=np.array(d['parent']), rest=np.array(d['rest'], float), Q=np.array(d['Q'], float), P=np.array(d['P'], float), dt=np.array(d['dt']))
