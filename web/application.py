import json
import time
from flask import send_file, Response, jsonify, request, redirect, url_for
from web import web_app
import random
import numpy as np

class Data(object):
    def __init__(self):
        self.events = {} # store the event list by the rank ID {0:[...],1:[...],2:[...] ...}
        self.executions = [] # the paired function executions from event list
        self.forest = [] # the forest of call stack tree, roots are foi
        self.pos = [] # the positions of the call stak tree in the scatter plot
        self.labels = [] # the learned label, for now I simulated
        self.func_dict = [] # all the names of the functions
        self.foi = '' # function of interest
        self.event_types = {} # set the indices indicating event types in the event list
        self.changed = False # if there are new data come in
        self.lineid2functionid = {} # indicates which line in events stream is which function
        self.line_num = 0 # number of events from the very beggining of streaming
        self.initial_timestamp = 0;
        self.layout = ["entry","comm ranks"]#x,y
        # entry - entry time
        # value - execution time
        # comm ranks

    def set_functions(self, functions):# set function dictionary
        self.func_dict = functions

    def set_FOI(self, function):
        self.foi = function        
        self.changed = True

    def set_event_types(self, types):
        for i, e in enumerate(types):
            self.event_types[e] = i

    def set_labels(self, labels):
        for label in labels:# self.labels indicates all the anoamaly lines
            if label in self.lineid2functionid:
                self.labels[self.lineid2functionid[label]] = -1# -1= anomaly and 1 = normal
        self.changed = True

    def add_events(self, events):
        # convert events to json events
        count = 0
        irregular = 0
        for e in events:
            if e[0] != 1 or e[2] != 1: # program 1 or thread 1
                irregular += 1
                continue
            if not self.events: # the initial timestamp
                self.initial_timestamp = int(e[11])
            obj = {'prog names': e[0],
                'comm ranks': e[1],
                'threads': e[2],
                'event types': e[7] if(e[3]=='NA' or np.isnan(e[3])) else e[3],
                'name': 'NA' if(e[4]=='NA' or np.isnan(e[4])) else self.func_dict[int(e[4])],# dictionary
                'counters': e[5],
                'counter value': e[6],
                'Tag': e[8],
                'partner': e[9],
                'num bytes': e[10],
                'timestamp': int(e[11]) - self.initial_timestamp, 
                'lineid': self.line_num+count}# here line id is start from the beggining of the stream
            count += 1
            if not obj['comm ranks'] in self.events:
                self.events[obj['comm ranks']] = []
            self.events[obj['comm ranks']].append(obj)
        print("program 0 vs all: %d, %d" % (irregular, count))

        self.changed = True
        self.line_num += len(events)

    def reset(self):
        # when new application launches, everything needs to reset
        self.events.clear()
        self.executions = []
        self.forest = []
        self.lineid2functionid.clear()
        self.line_num = 0
        self.changed = False

    def _events2executions(self):
        #print("event 2 executions...")
        self.executions = [];
        for rankId, events in self.events.items():
            self._events2executionsByRank(rankId)

    def _events2executionsByRank(self, rankId):
        # convert event to execution entities
        #print("for rank: ", rankId)
        events = self.events[rankId]
        function_index = len(self.executions)
        stacks = {}; #one stack for one thread under the same rankId
        for i, obj in enumerate(events):
            # arrange event by threads
            if not obj['threads'] in stacks:
                stacks[obj['threads']] = []
            stack = stacks[obj['threads']]
            # check event type
            if obj['event types'] == self.event_types['ENTRY']:#'entry'
                #push to stack
                func = {}
                func['name'] = obj['name']
                func['comm ranks'] = obj['comm ranks']
                func['threads'] = obj['threads']
                func['lineid'] = obj['lineid']
                func['findex'] = function_index
                #print(func['name'], func['findex'])
                if len(stack) > 0:
                    func['parent'] = stack[-1]['findex']
                    stack[-1]['children'].append(function_index)
                    #print("Children root", stack[-1]['name'], stack[-1]['entry'])
                else:
                    func['parent'] = -1
                func['children'] = []
                func['entry'] = obj['timestamp']
                function_index+=1
                stack.append(func)
            elif obj['event types'] == self.event_types['EXIT']:#'exit'
                if len(stack) > 0 and obj['name'] == stack[-1]['name']:
                    stack[-1]['exit'] = obj['timestamp']
                    self.executions.append(stack[-1])
                    stack.pop()
                else: # mismatching
                    print(obj)
                    if len(stack) > 0:
                        print("matching error "+str(i)+":"+str(rankId)+"/"+ obj['name']+"/stack: "+stack[-1]['name'])
                        print([(e['name'], e['entry']) for e in stack])
                    else:
                        print("matching error "+str(i)+":"+str(rankId)+"/"+ obj['name']+"/empty stack")
            elif len(stack)>0 and (obj['event types']==self.event_types['SEND'] or obj['event types']==self.event_types['RECV']):
                #make sure the message is correct to append
                if obj['name'] != 'NA' and obj['name'] != stack[-1]['name']:
                    print("message issue: "+obj['name']+":"+stack[-1]['name'])
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
        # check if the stack is empty
        for threadId, stack in stacks.items():
            if stack: #not empty
                print("Rank %d stack %d is not empty:" % (rankId, threadId))
                print([(elem['name'], elem['findex']) for elem in stack])
        # the function index (findex) of i-th execution in the list is i
        self.executions = sorted(self.executions, key= lambda x: x['findex'])

    def _exections2forest(self):
        # get tree based on foi
        self.forest = []
        self.lineid2functionid = {}
        count = 0
        for execution in self.executions:
            if execution['name'] == self.foi:
                if execution["comm ranks"] == 0: #debug
                    count+=1
                self.lineid2functionid[execution["lineid"]] = len(self.forest)
                if not "messages" in execution:
                    execution["messages"] = []
                this_tree = { 
                        "node_index": execution["comm ranks"],
                        "threads": execution["threads"], # place holder
                        "graph_index": len(self.forest),
                        "nodes": [{ # root of the tree
                                "name": self.foi,
                                "id": 0,
                                "comm ranks": execution["comm ranks"],
                                "threads": execution["threads"],
                                "findex": execution["findex"],
                                "value": (execution["exit"] - execution["entry"]),
                                "messages": execution["messages"],
                                "entry": execution["entry"]
                            }],
                        "edges": []
                    }
                queue = [(execution,0)]
                while len(queue)>0:
                    node,ptid = queue[0]
                    queue.pop(0)
                    for child_id in node['children']:
                        if child_id >= len(self.executions):
                            print(len(self.executions), child_id)
                            print(node)
                        child_node = self.executions[child_id]
                        ctid = len(this_tree['nodes'])
                        if not "messages" in child_node:
                            child_node['messages'] = []
                        this_tree['nodes'].append({ # children of the tree
                                'name':child_node['name'],
                                "id": ctid,
                                "comm ranks": execution["comm ranks"],
                                "threads": execution["threads"],
                                "findex": child_node["findex"],
                                "value": (child_node["exit"] - child_node["entry"]),
                                "messages": child_node["messages"],
                                "entry": child_node["entry"]
                            })
                        this_tree['edges'].append({'source': ptid,'target': ctid})
                        queue.append((child_node,ctid))
                self.forest.append(this_tree)
        print("generate {} trees".format(len(self.forest)))

    def generate_forest(self):
        self._events2executions()
        self._exections2forest()
        # remove this, this is dummy
        while len(self.labels)<len(self.forest):
            if(random.randint(0,100)<90):
                self.labels.append(0.8)
            else:
                self.labels.append(-0.8)
        self.pos = []
        for t in self.forest:
            root = t['nodes'][0]
            self.pos.append([root[self.layout[0]],root[self.layout[1]]])
        self.changed = False

data = Data()

@web_app.route('/')
def home():
    return send_file("index.html")

@web_app.route('/tree', methods=['POST'])
def get_tree():
    if request.json['data'] == 'tree':
        tindex = request.json['value']
        print("select tree #{}".format(tindex))
        #print(data.forest[tindex])
        return jsonify(data.forest[tindex])

@web_app.route('/events', methods=['POST'])
def receive_events():
    if request.json['type'] == 'foi':
        data.set_FOI(request.json['value'])
    elif request.json['type'] == 'functions': #map index 0,1,2,3,4.. to function names
        data.set_functions(request.json['value'])
    elif request.json['type'] == 'labels':
        data.set_labels(request.json['value'])
    elif request.json['type'] == 'event_types':
        data.set_event_types(request.json['value'])
    elif request.json['type'] == 'events':
        data.add_events(request.json['value'])
    elif request.json['type'] == 'reset':
        data.reset()
    return jsonify({'received': len(data.forest)})

def _stream():
    while(not data.changed):
        time.sleep(0.1)
    data.generate_forest()
    #send back forest data
    yield """
        retry: 10000\ndata:{"pos":%s,"layout":%s, "labels":%s}\n\n
    """ % (json.dumps(data.pos), json.dumps(data.layout), json.dumps(data.labels))

@web_app.route('/stream')
def stream():
    return Response(
        _stream(),
        mimetype='text/event-stream')