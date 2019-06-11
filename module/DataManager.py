import json
import time
import random
import numpy as np
from threading import Lock
from module.BufferManager import BufferManager
from module.LogManager import LogManager
from module.OnlineStatManager import OnlineStatManager
from utils.CommonUtils import log

class DataManager(object):
    
    def __init__(self):
        self.events = {} # store the event list by the rank ID {0:[...],1:[...],2:[...] ...}
        self.executions = {} # the paired function executions from event list
        self.forest = [] # the forest of call stack tree, roots are foi
        self.pos = [] # the positions of the call stak tree in the scatter plot
        self.labels = [] # the passed labels of the lineid of functions
        self.forest_labels = [] # the learned label, for now I simulated
        self.prog = [] # the program names of the tree in scatter plot
        self.tidx = []
        self.eidx = []
        self.func_names = [] # the function name of interest in scatter plot
        self.func_dict = {} # all the names of the functions
        self.foi = [] # function of interest
        self.event_types = {} # set the indices indicating event types in the event list
        self.changed = False # if there are new data come in
        self.lineid2treeid = {} # indicates which line in events stream is which function
        # self.line_num = 0 # number of events from the very beggining of streaming
        self.initial_timestamp = -1
        self.msgs = [] # debug only for messages
        self.func_idx = 0 # global function index for each entry function
        self.stacks = {} # one stack for one program under the same rankId
        self.idx_holder = {
            "fidx": [],
            "tidx": 0,
            "eidx": 0
        }
        self.sampling_rate = 1
        self.sampling_strategy = ["uniform"]
        self.layout = ["entry", "value", "comm ranks", "exit"] # feild no.1, 2, ..
        self.log = []
        self.lock = Lock()
        self.time_window = 3600000000 # one hour
        self.window_start = 0
        self.clean_count = 0
        self.stat = {}
        self.anomaly_cnt = 0
        self.filecnt = -1
        self.buffer_manager = BufferManager(self.process_frame) # MAX_BUFFER_SIZE
        self.log_manager = LogManager() # MAX_BUFFER_SIZE

        self.SECOND_IN_MICROSECOND = 1000000 # microsecond by default
        self.GRA = {} # Global Rank Anomaly
        self.GRA_temp = {} 
        self.GRA_time_bound = 0 # starting from 0
        self.GRA_interval = self.SECOND_IN_MICROSECOND * 10 #  interval for # anomalies calculation
        self.GRA_time_window = self.SECOND_IN_MICROSECOND * 60 # interval for removal of rank stat
        self.GRA_sampling_interval = self.SECOND_IN_MICROSECOND * 60 # interval for stratified sampling
        self.GRA_outliers = set()
        self.online_stat_manager = OnlineStatManager()

        self.accum_rankmap = {} # accumulated # anomalies per rank
        self.frames = {} # frames obj
        self.frame_temp = {
            'total': 0
        } 
        self.frame_id = -1 # frame id 
        self.FRAME_WINDOW = 100 # frame window
        self.FRAME_INTERVAL = 0.001 # second
        self.frame_time_bound = -1

    def set_functions(self, functions):# set function dictionary
        with self.lock:
            if type(functions) == list: # make sure if functions is given as dict
                for i in range(len(functions)):
                    self.func_dict[str(i)] = functions[i]
            else:
                self.func_dict = functions

    def set_FOI(self, functions):
        with self.lock:
            self.foi = functions     
            #self.changed = True

    def set_event_types(self, types):
        with self.lock:
            for i, e in enumerate(types):
                self.event_types[e] = i

    def set_labels(self, labels):
        with self.lock:
            self.labels = labels
            #print("received %d anomaly" % len(labels))
            #self.changed = True

    def add_events(self, events):
        # convert events to json events
        with self.lock:
            count = 0
            prev = None
            for e in events:
                if self.initial_timestamp == -1: # the initial timestamp
                    self.initial_timestamp = int(e[11])
                    print("Initial time: ", self.initial_timestamp)
                self.window_start = max(0, int(e[11]) - self.time_window - self.initial_timestamp)
                obj = {'prog names': e[0],
                    'comm ranks': e[1],
                    'threads': e[2],
                    'event types': e[7] if(e[3]=='NA' or np.isnan(e[3])) else e[3],
                    'name': 'NA' if(e[4]=='NA' or np.isnan(e[4])) else self.func_dict[str(int(e[4]))],# dictionary
                    'counters': e[5],
                    'counter value': e[6],
                    'Tag': e[8],
                    'partner': e[9],
                    'num bytes': e[10],
                    'timestamp': int(e[11]) - self.initial_timestamp, 
                    'lineid': e[12]}# here line id is start from the beggining of the stream
                count += 1
                if count == len(events):
                    log(obj['timestamp'])
                #if obj['event types'] == self.event_types['RECV'] or obj['event types'] == self.event_types['SEND']:
                #     print(prev)
                #     print(obj)
                #     print('\n')
                if not obj['comm ranks'] in self.events:
                    self.events[obj['comm ranks']] = []
                    self.idx_holder[obj['comm ranks']] = 0 # initialize by ranks
                self.events[obj['comm ranks']].append(obj)
                prev = obj
                #if obj['lineid'] in self.labels:
                #    print(obj['lineid'], ": ", e)

                if obj['event types'] == self.event_types['ENTRY']:
                    fname = obj["name"]
                    if not fname in self.stat:
                        self.stat[fname] = {
                            'abnormal': 0,
                            'regular': 0,
                            'ratio': 0
                        }
                    s = self.stat[fname]
                    if str(int(obj["lineid"])) in self.labels:
                        self.anomaly_cnt += 1
                        obj['anomaly_score'] = -1
                        s['abnormal'] = s['abnormal'] + 1
                    else:
                        obj['anomaly_score'] = 1
                        s['regular'] = s['regular'] + 1
                    if s['regular']>0 or s['abnormal']>0:
                        s['ratio'] = (s['abnormal']/(s['regular']+s['abnormal']))*100 

            log('processed', self.anomaly_cnt, 'anomalies.')
            #self.changed = True

    def remove_old_data(self):
        # clean executions every time_window
        if self.window_start // self.time_window < self.clean_count:
            return
        self.clean_count += 1
        log("clean old executions before {}".format(self.window_start))
        remove_list = []
        for findex, exe in self.executions.items():
            if(exe['exit']<self.window_start):
                remove_list.append(findex)
        for findex in remove_list:
            del self.executions[findex]
        
        for i, t in enumerate(self.forest):
            if('nodes' in t and t['nodes'][0]['exit'] < self.window_start):
                self.forest[i] = {}

    def reset(self):
        # when new application launches, everything needs to reset
        with self.lock: 
            self.func_idx = 0
            self.clean_count = 0
            self.window_start = 0
            self.anomaly_cnt = 0
            self.initial_timestamp = -1
            self.idx_holder = {
                "fidx": [],
                "tidx": 0,
                "eidx": 0
            }
            self.stat = {}
            self.events.clear()
            self.executions.clear()
            self.forest.clear()
            self.lineid2treeid.clear()
            self.msgs.clear()
            self.func_dict.clear()
            self.event_types.clear()
            self.stacks.clear()
            self.log.clear()
            self.changed = False
            self.eidx = []
            self.tidx = []
            self.GRA = {}
            self.GRA_temp = {}
            self.GRA_outliers = set()

    def _events2executions(self):
        #print("event 2 executions...")
        # self.executions = {}
        # self.func_idx = 0
        for rankId, events in self.events.items():
            self._events2executionsByRank(rankId)
        #check who has messages
        # for f in self.msgs:
        #     ff = f
        #     while ff in self.executions and self.executions[ff]['parent'] != -1:
        #         if self.executions[ff]['parent'] in self.executions:
        #             print(self.executions[self.executions[ff]['parent']]['name'])
        #             ff = self.executions[ff]['parent']
        #         else:
        #             break
        # print("\n")

    def _events2executionsByRank(self, rankId):
        # convert event to execution entities
        #print("for rank: ", rankId)
        events = self.events[rankId]
        #function_index = len(self.executions)
        # stacks = {} #one stack for one program under the same rankId
        # for i, obj in enumerate(events):
        for obj in events: 
            self.idx_holder[rankId] += 1
            # arrange event by programs first, then threads
            if not obj['comm ranks'] in self.stacks:
                self.stacks[obj['comm ranks']] = {}
                
            if not obj['prog names'] in self.stacks[obj['comm ranks']]:
                self.stacks[obj['comm ranks']][obj['prog names']] = {}
            
            if not obj['threads'] in self.stacks[obj['comm ranks']][obj['prog names']]:
                self.stacks[obj['comm ranks']][obj['prog names']][obj['threads']] = []

            stack = self.stacks[obj['comm ranks']][obj['prog names']][obj['threads']]

            # check event type
            if obj['event types'] == self.event_types['ENTRY']:#'entry'
                #push to stack
                func = {}
                func['prog names'] = obj['prog names']
                func['name'] = obj['name']
                func['comm ranks'] = obj['comm ranks']
                func['threads'] = obj['threads']
                func['lineid'] = obj['lineid']
                func['findex'] = self.func_idx #function_index
                func['anomaly_score'] = obj['anomaly_score']
                #print(func['name'], func['findex'])
                if len(stack) > 0:
                    func['parent'] = stack[-1]['findex']
                    stack[-1]['children'].append(self.func_idx) #(function_index)
                    #print("Children root", stack[-1]['name'], stack[-1]['entry'])
                else:
                    func['parent'] = -1
                func['children'] = []
                func['entry'] = obj['timestamp']
                self.func_idx += 1 #function_index+=1
                stack.append(func)
            elif obj['event types'] == self.event_types['EXIT']: #'exit'
                if len(stack) > 0 and obj['name']:
                    # stack[-1]['anomaly_score'] = obj['anomaly_score']
                    stack[-1]['exit'] = obj['timestamp']
                    #self.executions.append(stack[-1])
                    self.executions[stack[-1]['findex']] = stack[-1]
                    self.idx_holder['fidx'].append(stack[-1]['findex'])
                    stack.pop()
                else: # mismatching
                    log("Exit before Entry", obj['comm ranks'], obj['prog names'], obj['threads'], obj['name'])
                    # print(obj)
                    # if len(stack) > 0:
                        # print("matching error "+str(i)+":"+str(rankId)+"/"+ obj['name']+"/stack: "+stack[-1]['name'])
                        # print([(e['name'], e['entry']) for e in stack])
                    # else:
                    #     print("matching error "+str(i)+":"+str(rankId)+"/"+ obj['name']+"/empty stack")
            elif obj['event types'] == self.event_types['RECV'] or obj['event types'] == self.event_types['SEND']:
                if len(stack) > 0:
                    #make sure the message is correct to append
                    if obj['name'] != 'NA' and obj['name'] != stack[-1]['name']:
                        log("message issue: "+obj['name']+":"+stack[-1]['name'])
                    #append to function
                    #assumption: execution never exits until message is received
                    if not 'messages' in stack[-1]:
                        stack[-1]['messages']=[]
                    stack[-1]['messages'].append({
                        "event-type": "send" if(obj['event types']==self.event_types['SEND']) else "receive",
                        "source-node-id": obj['comm ranks'] if(obj['event types']==self.event_types['SEND']) else obj['partner'],
                        "destination-node-id": obj['comm ranks'] if(obj['event types']==self.event_types['RECV']) else obj['partner'],
                        "thread-id": obj['threads'], #place holder
                        "message-size": obj['num bytes'],
                        "message-tag": obj['Tag'],
                        "time": obj['timestamp']
                    })
                    temp = stack[-1]
                    self.msgs.append(temp['findex'])
                else:
                    log("Send/Recv mismatched", obj['comm ranks'], obj['prog names'], obj['threads'], obj['name'])
        # events = []
        del self.events[rankId][:]

    def generate_tree_recursive(self, this_tree, pexecution, ptid):
        pnode = this_tree['nodes'][ptid]
        pnode['hide'] = False if pexecution['anomaly_score'] == -1 else True
        for child_id in pexecution['children']:
            if not child_id in self.executions:
                if str(child_id) in self.executions:
                    child_id = str(child_id)
                else:
                    # log("child not in executions") # regular
                    continue
            child_node = self.executions[child_id]
            ctid = len(this_tree['nodes'])
            if not "messages" in child_node:
                child_node['messages'] = []
            this_tree['nodes'].append({ # children of the tree
                    'name':child_node['name'],
                    "id": ctid,
                    "comm ranks": pnode["comm ranks"],
                    "prog_name": pnode["prog_name"],
                    "threads": pnode["threads"],
                    "findex": child_node["findex"],
                    "value": (child_node["exit"] - child_node["entry"]),
                    "messages": child_node["messages"],
                    "entry": child_node["entry"],
                    "exit": pnode["exit"],
                    "anomaly_score": child_node["anomaly_score"]
                })
            this_tree['edges'].append({'source': ptid,'target': ctid})
            if not self.generate_tree_recursive(this_tree, child_node, ctid):
                this_tree['nodes'][ptid]['hide'] = False
        return this_tree['nodes'][ptid]['hide']

    def generate_tree(self, treeid):
        this_tree = self.forest[treeid]
        execution = self.executions[this_tree['eid']]
        self.generate_tree_recursive(this_tree, execution, 0)

    def generate_tree_by_eid(self, tid, eid):
        execution = self.executions[eid]
        this_tree = self.create_tree_by_execution(tid, execution)
        self.generate_tree_recursive(this_tree, execution, 0)
        return this_tree

    def create_tree_by_execution(self, tid, execution):
        if not "messages" in execution:
            execution["messages"] = []
        return {
            "id": tid,
            "eid": execution['findex'],
            "prog_name": execution["prog names"],
            "node_index": execution["comm ranks"],
            "threads": execution["threads"],
            "graph_index": execution['findex'],
            "nodes": [{ # root of the tree
                    "name": execution['name'], # self.foi,
                    "id": 0, # parent
                    "comm ranks": execution["comm ranks"],
                    "prog_name": execution["prog names"],
                    "threads": execution["threads"],
                    "findex": execution["findex"],
                    "value": (execution["exit"] - execution["entry"]),
                    "messages": execution["messages"],
                    "entry": execution["entry"],
                    "exit": execution["exit"],
                    "anomaly_score": execution["anomaly_score"]
                }],
            "edges": [],
            "anomaly_score": execution['anomaly_score']
        }

    def _exections2forest(self):
        # get tree based on foi
        # self.forest = []
        self.lineid2treeid = {}
        count = 0
        while len(self.idx_holder['fidx']) >0:
            fidx = self.idx_holder['fidx'].pop(0)
            if fidx in self.executions:
                execution = self.executions[fidx]    
                if execution['name'] in self.foi:
                    if execution["comm ranks"] == 0: #debug
                        count+=1
                    self.lineid2treeid[execution["lineid"]] = len(self.forest)
                    if not "messages" in execution:
                        execution["messages"] = []
                    if (execution["exit"]-execution["entry"]) < 0:
                        log('negative run time detected.')
                    self.forest.append({
                        "id": len(self.forest),
                        "eid": fidx,
                        "prog_name": execution["prog names"],
                        "node_index": execution["comm ranks"],
                        "threads": execution["threads"],
                        "graph_index": len(self.forest),
                        "nodes": [{ # root of the tree
                                "name": execution['name'], # self.foi,
                                "id": 0,
                                "comm ranks": execution["comm ranks"],
                                "prog_name": execution["prog names"],
                                "threads": execution["threads"],
                                "findex": execution["findex"],
                                "value": (execution["exit"] - execution["entry"]),
                                "messages": execution["messages"],
                                "entry": execution["entry"],
                                "exit": execution["exit"],
                                "anomaly_score": execution["anomaly_score"]
                            }],
                        "edges": [],
                        "anomaly_score": execution['anomaly_score'] #-1 if str(int(execution["lineid"])) in self.labels else 1
                    })
        #print("generate {} trees".format(len(self.forest)))

    def generate_forest(self):
        with self.lock:
            self._events2executions()
            self.remove_old_data()
            # self.write_file()
            self._exections2forest()

            # the scatterplot positions of the forest
            for i, t in enumerate(self.forest[self.idx_holder["tidx"]:], start=self.idx_holder["tidx"]):
                if t['anomaly_score'] == -1 or (i%(1000/(self.sampling_rate*1000))==0): 
                    self.idx_holder["tidx"] += 1
                    root = t['nodes'][0]
                    
                    ent = root[self.layout[0]]
                    val = root[self.layout[1]]
                    rnk_thd = root[self.layout[2]] + root['threads']*0.1
                    ext = root[self.layout[3]]

                    self.tidx.append(t["id"])
                    self.forest_labels.append(t["anomaly_score"])
                    self.prog.append(root['prog_name'])
                    self.func_names.append(root['name'])  
                    self.pos.append([
                        ent, val, rnk_thd, ext
                    ])
            log("generate {} trees".format(len(self.forest)))
            self.changed = True
    
    def reset_forest(self):
        self.pos = []
        self.prog = []
        self.func_names = []
        self.forest_labels = []
        self.tidx = []
        self.eidx = []
        log("reset forest data")
        self.changed = False
        
    def write_file(self):
        self.filecnt += 1
        execs = {}
        for fidx in self.idx_holder['fidx']:
            if self.executions[fidx]['name'] in self.foi: #or 'messages' in self.executions[fidx]
                execs[fidx] = self.executions[fidx]
        j = json.dumps({
            'executions': execs,
            'stat': self.stat
        })
        f = open('trace.'+str(self.filecnt)+'.json','w')
        f.write(j)
        f.close()

    def add_executions(self, executions):
        with self.lock:
            _executions = self.process_executions(executions)
            self.executions.update(_executions)
            self.remove_old_data()

    def process_executions(self, executions):
        new_executions = {}
        for i, (eidx, execution) in enumerate(executions.items()):
            execution = self.update_execution(execution)
            self.update_GRA(execution) # Counting anomalies
            new_executions[execution['findex']] = execution
        
        # GRA Sampling
        upper_bound = self.online_stat_manager.get_upper_bound()
        for t, rmap in self.GRA.items():
            for rank, freq in rmap.items():
                if upper_bound < freq:
                    self.GRA_outliers.add(rank)
        log('GRA upper bound: ', upper_bound)
        log('GRA outliers: ', self.GRA_outliers)

        for eidx, execution in new_executions.items():
            if execution['comm ranks'] in self.GRA_outliers:
                self.calculate_layout(execution)

        self.changed = True
        return new_executions
    
    def calculate_layout(self, execution):
        self.eidx.append(execution['findex'])
        self.tidx.append(self.idx_holder['tidx'])
        self.idx_holder['tidx'] += 1
        self.forest_labels.append(execution["anomaly_score"])
        self.prog.append(execution['prog names'])
        self.func_names.append(execution['name'])  
        self.pos.append([
            execution[self.layout[0]], # entry 
            execution[self.layout[1]], # value (execution time)
            execution[self.layout[2]], # rank and thread
            execution[self.layout[3]] # exit
        ])
        if execution['anomaly_score'] == -1:
            self.anomaly_cnt += 1

    def update_execution(self, execution):
        execution['entry'] = int(execution['entry'])
        execution['exit'] = int(execution['exit'])
        execution['anomaly_score'] = int(execution['anomaly_score'])
        execution['comm ranks'] = int(execution['comm ranks'])
        
        if self.initial_timestamp == -1: 
            self.initial_timestamp = execution['entry']
            print("Initial time: ", self.initial_timestamp)
        
        execution['entry'] -= self.initial_timestamp
        execution['exit'] -= self.initial_timestamp
        execution['value'] = execution["exit"] - execution["entry"]

        prefix = str(execution['comm ranks']) + '&&' # delimeter
        execution['findex'] = prefix+str(execution['findex'])
        execution['parent'] = prefix+str(execution['parent'])
        new_children = []
        for cid in execution['children']:
            new_children.append(prefix+str(cid))
        execution['children'] = new_children
        return execution

    def update_GRA(self, execution):
        # update GRA if window has passed
        if execution['exit'] > self.GRA_time_bound:
            self.GRA[int(self.GRA_time_bound/1000000)] = self.GRA_temp
            self.online_stat_manager.compute(self.GRA_temp)
            self.GRA_temp = {} # initialize GRA info
            self.GRA_time_bound += self.GRA_interval
        # count anomaly per rank
        if execution['comm ranks'] not in self.GRA_temp:
            self.GRA_temp[execution['comm ranks']] = 0
        self.GRA_temp[execution['comm ranks']] += 1
        # remove old data
        self.remove_old_GRA()

    def remove_old_GRA(self):
        # remove passed timewindow
        remove_list = []
        for t in self.GRA.keys():
            if t < ((self.GRA_time_bound - self.GRA_time_window)/1000000):
                remove_list.append(t)
        for t in remove_list:
            del self.GRA[t]

    def set_statistics(self, stat):
        with self.lock:
            for func, temp in stat.items():
                if 'factor' not in temp:
                    temp['factor'] = 1 # by default
                if 'mean' not in temp:
                    temp['mean'] = -1
                elif np.isnan(temp['mean']) or np.isinf(temp['mean']):
                    temp['mean'] =-1
                else:
                    temp['mean'] = temp['mean'] * temp['factor']
                
                if 'std' not in temp:
                    temp['std'] = -1
                elif np.isnan(temp['std']) or np.isinf(temp['std']):
                    temp['std'] =-1
                else:
                    temp['std'] = temp['std'] * temp['factor'] # sqrt(VAR[CX]) => std[x] = C*std[cx], c == 1/factor
                
                if 'regular' in temp:
                    temp['total'] = temp['regular']

                if np.isnan(temp['total']) or np.isinf(temp['total']):
                    temp['total'] =-1
                else:
                    temp['total'] = temp['total'] * temp['factor'] 
                 
                if func in self.stat:
                    func_stat = self.stat[func]
                    func_stat['abnormal'] = temp['abnormal'] if temp['abnormal']>func_stat['abnormal'] else func_stat['abnormal']
                    func_stat['total'] = temp['total'] if temp['total']>func_stat['total'] else func_stat['total']
                    func_stat['mean'] = temp['mean'] # replace
                    func_stat['std'] = temp['std'] # replace
                    # if 'ratio' in temp:
                    #     if 'ratio' in func:
                    #         func_stat['ratio'] = temp['ratio'] if temp['ratio']>func_stat['ratio'] else func_stat['ratio']
                    #     else:
                    #         func_stat['ratio'] = temp['ratio']
                    # else:
                    #     func_stat['ratio'] = (func_stat['abnormal']/(func_stat['abnormal']+func_stat['regular']))*100
                else:
                    self.stat[func] = temp

    def add_to_buffer(self, frame):
        if not self.log_manager.is_set():
            self.log_manager.start_recording(time.time())
        self.buffer_manager.add(frame)

    def process_frame(self, frame):
        if 'type' in frame: # Raw trace events
            value = frame['value']
            self.set_event_types(value['event_types'])
            self.set_functions(value['functions'])
            self.set_FOI(value['foi'])
            self.set_labels(value['labels'])
            self.add_events(value['events'])
            self.generate_forest()
        else: # Executions
            # self.set_statistics(frame['stat'])
            # self.add_executions(frame['executions'])
            self.calculate_frame(frame['executions'])
    
    def record_response_time(self, time):
        self.log_manager.add_response_time(time)

    def record_push_time(self, time):
        self.log_manager.add_push_time(time)

    def get_recording(self, time):
        self.log_manager.pin_recording(time)
        self.log_manager.get_avg_response_time()
        log('NUM ANOMALIES: ', self.anomaly_cnt)

    def calculate_frame(self, executions):
        if self.frame_time_bound == -1:
            self.frame_time_bound = time.time()
        for i, execution in executions.items():
            execution = self.update_execution(execution)
            if execution['comm ranks'] not in self.frame_temp:
                self.frame_temp[execution['comm ranks']] = 0
            self.frame_temp[execution['comm ranks']] += 1
            self.frame_temp['total'] += 1
            self.anomaly_cnt += 1
        now = time.time()
        if now - self.frame_time_bound > (self.FRAME_INTERVAL):
            self.frame_id += 1
            self.frames[self.frame_id] = self.frame_temp
            self.frame_time_bound = now
            self.update_rankmap()
            self.frame_temp = {
                'total': 0
            }
        if len(self.frames.keys()) > self.FRAME_WINDOW:
            del_id = self.frame_id - self.FRAME_WINDOW
            del self.frames[del_id]
        self.changed = True

    def update_rankmap(self):
        for rank, value in self.frame_temp.items():
            if rank not in self.accum_rankmap:
                self.accum_rankmap[rank] = 0
            self.accum_rankmap[rank] += value
