import numpy as np
def chain_of(n):
    n=n.replace('mixamorig_','')
    for s in ('Left','Right'):
        if n.startswith(s):
            r=n[len(s):]
            if r in ('ForeArm','Hand') or r.startswith('Hand'): return s+'Hand'
            if r=='Arm': return s+'Arm'
            if r=='Shoulder': return 'core'
            return s+'Leg'
    return 'core'
def bad(a,b):
    # only limb-to-limb fusions that can never be legit skin: hand/arm touching a leg, hands touching each other
    if a==b: return False
    s={a,b}
    armish=[x for x in s if x.endswith('Hand') or x.endswith('Arm')]; legs=[x for x in s if x.endswith('Leg')]
    if armish and legs: return True
    for h in [x for x in s if x.endswith('Hand')]:
        o=(s-{h}).pop()
        if o!=h[:-4]+'Arm': return True
    return False
