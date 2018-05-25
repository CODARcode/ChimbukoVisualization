import json
import time
from flask import send_file, Response, jsonify, request
from web import web_app
import random

class Data(object):
    def __init__(self):
        self.events = {} # store the event list by the rank ID {0:[...],1:[...],2:[...] ...}
        self.executions = [] # the paired function executions from event list
        self.forest = [] # the forest of call stack tree, roots are foi
        self.pos = [] # the positions of the call stak tree in the scatter plot
        self.labels = [] # the learned label, for now I simulated
        self.func_dict = [] # all the names of the functions
        self.foi = '' # function of interest
        self.changed = False # if there are new data come in
        self.lineid2functionid = {} # indicates which line in events stream is which function
        self.line_num = 0 # number of events from the very beggining of streaming

    def set_functions(self, functions):# set function dictionary
        self.func_dict = functions

    def set_FOI(self, function):
        self.foi = function        
        self.changed = True

    def set_labels(self, labels):
        for label in labels:# self.labels indicates all the anoamaly lines
            if label in self.lineid2functionid:
                self.labels[self.lineid2functionid[label]] = -1# -1= anomaly and 1 = normal
        self.changed = True

    def add_events(self, events):
        # convert events to json events
        count = 0
        for e in events:
            obj = {'prog names': e[0],
                'comm ranks': e[1],
                'threads': e[2],
                'event types': e[7] if(e[3]=='NA') else e[3],
                'name': 'NA' if(e[4]=='NA') else self.func_dict[int(e[4])],# dictionary
                'counters': e[5],
                'counter value': e[6],
                'Tag': e[8],
                'partner': e[9],
                'num bytes': e[10],
                'timestamp': int(e[11]),
                'lineid': self.line_num+count}# here line id is start from the beggining of the stream
            count += 1
            if not obj['comm ranks'] in self.events:
                self.events[obj['comm ranks']] = []
            self.events[obj['comm ranks']].append(obj)
        self.changed = True
        self.line_num += len(events)

    def _events2executions(self):
        self.executions = [];
        for rankId, events in self.events.items():
            self._events2executionsByRank(rankId)

    def _events2executionsByRank(self, rankId):
        # convert event to execution entities
        events = self.events[rankId]
        stack = [];
        function_index = len(self.executions)
        for i, obj in enumerate(events):
            if obj['event types'] == 1:#'entry'
                #push to stack
                func = {}
                func['name'] = obj['name']
                func['comm ranks'] = obj['comm ranks']
                func['lineid'] = obj['lineid']
                func['findex'] = function_index
                if len(stack) > 0:
                    func['parent'] = stack[-1]['findex']
                    stack[-1]['children'].append(function_index)
                else:
                    func['parent'] = -1
                func['children'] = []
                func['entry'] = obj['timestamp']
                function_index+=1
                stack.append(func)
            elif obj['event types'] == 0:#'exit'
                if len(stack) > 0 and obj['name'] == stack[-1]['name']:
                    stack[-1]['exit'] = obj['timestamp']
                    self.executions.append(stack[-1])
                    stack.pop()
                else:
                    print("matching error "+str(i)+"/"+ obj['name']+"/"+stack[-1]['name'])

            elif len(stack)>0:
                #append to function
                if not 'messages' in stack[-1]:
                    stack[-1]['messages']=[]
                stack[-1]['messages'].append({
                        "event-type": "send" if(obj['event types']==2) else "receive",
                        "source-node-id": obj['comm ranks'] if(obj['event types']==2)else obj['partner'],
                        "destination-node-id": obj['comm ranks'] if(obj['event types']==3) else obj['partner'],
                        "message-size": obj['num bytes'],
                        "message-tag": obj['Tag'],
                        "time": obj['timestamp']
                    })
        # the function index (findex) of i-th execution in the list is i
        self.executions = sorted(self.executions, key= lambda x: x['findex'])

    def _exections2forest(self):
        # get tree based on foi
        self.forest = []
        self.lineid2functionid = {}
        count = 0
        for execution in self.executions:
            if execution['name'] == self.foi:
                if execution["comm ranks"] ==0:
                    count+=1
                self.lineid2functionid[execution["lineid"]] = len(self.forest)
                if not "messages" in execution:
                    execution["messages"] = []
                this_tree = {
                        "node_index": execution["comm ranks"],
                        "graph_index": len(self.forest),
                        "nodes": [{
                                "name": self.foi,
                                "id": 0,
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
                        child_node = self.executions[child_id]
                        ctid = len(this_tree['nodes'])
                        if not "messages" in child_node:
                            child_node['messages'] = []
                        this_tree['nodes'].append({
                                'name':child_node['name'],
                                "id": ctid,
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
            self.pos.append([root['entry'],root['value']])
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
        return jsonify(data.forest[tindex])

@web_app.route('/events', methods=['POST'])
def receive_events():
    if request.json['type'] == 'foi':
        data.set_FOI(request.json['value'])
    elif request.json['type'] == 'functions': #map index 0,1,2,3,4.. to function names
        data.set_functions(request.json['value'])
    elif request.json['type'] == 'labels':
        data.set_labels(request.json['value'])
    elif request.json['type'] == 'events':
        data.add_events(request.json['value'])
    return jsonify({'received': len(data.forest)})

def _stream():
    while(not data.changed):
        time.sleep(0.1)
    data.generate_forest()
    yield """
        retry: 10000\ndata:{"pos":%s,"labels":%s}\n\n
    """ % (json.dumps(data.pos), json.dumps(data.labels))

@web_app.route("/stream")
def stream():
    return Response(
        _stream(),
        mimetype='text/event-stream')