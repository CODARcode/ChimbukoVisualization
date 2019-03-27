import requests
import time
import json
import glob

mode = 'executions' 
vis_url = 'http://0.0.0.0:5000/'
vis_data = "../data/aggregated/executions/"

# load data
data_list = glob.glob(vis_data+"trace.*.json")
data_list.sort(key=lambda x: int(x.split('.')[-2]))

eidmap = {}
eids = {}
filecnt = 0
for i in range(len(data_list)):
    data = []
    
    with open(data_list[i], 'r') as f:
        data = json.load(f)
    executions = data['executions']
    frame_data = {}
    for eid, execution in executions.items():
        
        execution['comm ranks'] = execution['comm ranks'] + 4 # if you want to increase rank data
        
        rankno = execution['comm ranks'] 
        
        if rankno not in frame_data:
            frame_data[rankno] = {}
        if rankno not in eidmap:
            eidmap[rankno] = {}
        if rankno not in eids:
            eids[rankno] = -1
        
        if execution['findex'] not in eidmap:
            eidmap[execution['findex']] = eids[rankno]
            eids[rankno] -= 1
        execution['findex'] = eidmap[execution['findex']]
        
        if execution['parent'] not in eidmap:
            eidmap[execution['parent']] = eids[rankno]
            eids[rankno] -= 1
        execution['parent'] = eidmap[execution['parent']]
        
        new_children = []
        for cid in execution['children']:
            if cid not in eidmap:
                eidmap[cid] = eids[rankno]
                eids[rankno] -= 1
            new_children.append(eidmap[cid])
        execution['children'] = new_children
        
        frame_data[rankno][eidmap[eid]] = execution

    for rank, rank_data in frame_data.items():
        j = json.dumps({
            'executions': rank_data,
            'stat': data['stat']
        })
        f = open('rank.'+str(int(rank))+'.execution.'+str(filecnt)+'.json','w')
        f.write(j)
        f.close()
    filecnt += 1
