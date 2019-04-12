import sys
sys.path.insert(0, '../../')

import requests
import time
import json
import glob
from module.DataManager import DataManager

MODE = 'events' # events or executions
DATA_PATH = "../../data/nwchem_outdated/" 

def update_old_events_to_trace_format(): # ../../data/nwchem_outdated/
    """
    Reformat outdated data format to merged trace format
    """
    func = []
    with open(DATA_PATH+"function.json", 'r') as f:
        func = json.load(f)
    et = []
    with open(DATA_PATH+"et.json", 'r') as f:
        et = json.load(f)
    trace_list = glob.glob(DATA_PATH+"trace.*.json")
    trace_list.sort(key=lambda x: int(x.split('.')[-2]))
    foi_list = glob.glob(DATA_PATH+"foi.*.json")
    foi_list.sort(key=lambda x: int(x.split('.')[-2]))
    anomaly_list = glob.glob(DATA_PATH+"anomaly.*.json")
    anomaly_list.sort(key=lambda x: int(x.split('.')[-2]))
    for i in range(len(trace_list)):
        foi = []
        with open(foi_list[i], 'r') as f:
            foi = json.load(f)
        trace = []
        with open(trace_list[i], 'r') as f:
            trace = json.load(f)
        anomaly = []
        with open(anomaly_list[i], 'r') as f:
            anomaly = json.load(f)
        trace.sort(key=lambda event:event[11])
        j = json.dumps({
            'type': 'info',
            'value': {
                'events': trace,
                'foi': foi,
                'functions': func,
                'event_types': et,
                'labels': anomaly
            }
        })
        f = open('trace.'+str(i)+'.json','w')
        f.write(j)
        f.close()

def convert_events_to_executions(): # ../../data/nwchem_outdated/
    """
    Convert events to executions
    """
    data_manager = DataManager()
    data_manager.reset()

    func = []
    with open(DATA_PATH+"function.json", 'r') as f:
        func = json.load(f)
    data_manager.set_functions(func)

    et = []
    with open(DATA_PATH+"et.json", 'r') as f:
        et = json.load(f)
    data_manager.set_event_types(et)

    trace_list = glob.glob(DATA_PATH+"trace.*.json")
    trace_list.sort(key=lambda x: int(x.split('.')[-2]))

    foi_list = glob.glob(DATA_PATH+"foi.*.json")
    foi_list.sort(key=lambda x: int(x.split('.')[-2]))

    anomaly_list = glob.glob(DATA_PATH+"anomaly.*.json")
    anomaly_list.sort(key=lambda x: int(x.split('.')[-2]))

    for i in range(len(trace_list)):
        foi = []
        with open(foi_list[i], 'r') as f:
            foi = json.load(f)
        anomaly = []
        with open(anomaly_list[i], 'r') as f:
            anomaly = json.load(f)
        trace = []
        with open(trace_list[i], 'r') as f:
            trace = json.load(f)
        data_manager.set_FOI(foi)
        data_manager.set_labels(anomaly)
        trace.sort(key=lambda event:event[11])
        data_manager.add_events(trace)
        data_manager.generate_forest()

def divide_by_rank(): 
    """
    Split aggregated data by rank
    """
    EXPAND_OFFSET = 0 # To be first rank
    filecnt = 0

    if MODE == 'events': # ../../data/nwchem_events/

        trace_list = glob.glob(DATA_PATH+"trace.*.json")
        trace_list.sort(key=lambda x: int(x.split('.')[-2]))

        for i in range(len(trace_list)):
            rank_map = {}
            trace = {}
            with open(trace_list[i], 'r') as f:
                trace = json.load(f)

            events = trace['value']['events']
            for event in events:
                event[1] = event[1] + EXPAND_OFFSET

            for event in events:
                rank_num = event[1]
                if rank_num not in rank_map:
                    rank_map[rank_num] = []
                rank_map[rank_num].append(event)

            for rank, rank_data in rank_map.items():
                trace['value']['events'] = rank_data
                j = json.dumps(trace)
                f = open('rank.'+str(int(rank))+'.trace.'+str(filecnt)+'.json','w')
                f.write(j)
                f.close()
            filecnt += 1

    elif MODE == 'executions': # ../../data/nwchem_executions/ 
        # load data
        data_list = glob.glob(DATA_PATH+"trace.*.json")
        data_list.sort(key=lambda x: int(x.split('.')[-2]))

        eidmap = {}
        eids = {}
        
        for i in range(len(data_list)):
            data = []
            with open(data_list[i], 'r') as f:
                data = json.load(f)
            executions = data['executions']
            frame_data = {}
            for eid, execution in executions.items():
                
                execution['comm ranks'] = execution['comm ranks'] + EXPAND_OFFSET
                
                rank_num = execution['comm ranks'] 
                
                if rank_num not in frame_data:
                    frame_data[rank_num] = {}
                # if rank_num not in eidmap:
                #     eidmap[rank_num] = {}
                if rank_num not in eids:
                    eids[rank_num] = -1
                
                fid = str(execution['findex']) if type(execution['findex']) == int else execution['findex']
                if fid not in eidmap:
                    eidmap[fid] = eids[rank_num]
                    eids[rank_num] -= 1
                execution['findex'] = eidmap[fid]
                
                pid = str(execution['parent']) if type(execution['parent']) == int else execution['parent']
                if pid not in eidmap:
                    eidmap[pid] = eids[rank_num]
                    eids[rank_num] -= 1
                execution['parent'] = eidmap[pid]
                
                new_children = []
                for cid in execution['children']:
                    cid = str(cid) if type(cid) == int else cid
                    if cid not in eidmap:
                        eidmap[cid] = eids[rank_num]
                        eids[rank_num] -= 1
                    new_children.append(eidmap[cid])
                execution['children'] = new_children
                
                frame_data[rank_num][eidmap[eid]] = execution

            for rank, rank_data in frame_data.items():
                data['executions'] = rank_data
                j = json.dumps(data)
                f = open('rank.'+str(int(rank))+'.trace.'+str(filecnt)+'.json','w')
                f.write(j)
                f.close()
            filecnt += 1

def update_statistics():
    
    data_list = glob.glob(DATA_PATH+"trace.*.json")
    data_list.sort(key=lambda x: int(x.split('.')[-2]))

    

        

if __name__ == "__main__":
    update_old_events_to_trace_format()
    # convert_events_to_executions()
    # divide_by_rank()