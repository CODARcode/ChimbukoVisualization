import json
import time
from flask import send_file, Response, jsonify, request, redirect, url_for
from web import web_app
from web import data_manager as dm

data = dm.Data()

@web_app.route('/')
def home():
    return send_file("index.html")

@web_app.route('/tree', methods=['POST'])
def get_tree():
    if request.json['data'] == 'tree':
        tindex = request.json['value']
        print("select tree #{}".format(tindex))
        if len(data.forest) > 0:
            if len(data.forest[tindex]['nodes']) == 1: # first request
                data.generate_tree(tindex)
            return jsonify(data.forest[tindex])
        else:
            eindex = request.json['eid']
            if data.executions[eindex] is not None: # first request
                return jsonify(data.generate_tree_by_eid(tindex, eindex))

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
    elif request.json['type'] == 'info':
        d = request.json['value']
        data.set_FOI(d['foi'])
        data.set_labels(d['labels'])
        data.add_events(d['events'])
        data.generate_forest()
    elif request.json['type'] == 'reset':
        data.reset()
    return jsonify({'received': len(data.forest)})
 
def _stream():
    while(not data.changed):
        time.sleep(0.1)
    #data.generate_forest()
    #send back forest data
    if data.pos:
        with data.lock: 
            print("send {} data to front".format(len(data.pos)))
            yield """
                retry: 10000\ndata:{"pos":%s, "layout":%s, "labels":%s, "prog":%s, "func":%s, "tidx":%s, "eidx":%s, "stat":%s}\n\n
            """ % (json.dumps(data.pos), json.dumps(data.layout), json.dumps(data.forest_labels), json.dumps(data.prog), 
            json.dumps(data.func_names), json.dumps(data.tidx), json.dumps(data.eidx), json.dumps(data.stat) )
            data.reset_forest()

@web_app.route('/stream')
def stream():
    return Response(
        _stream(),
        mimetype='text/event-stream')

@web_app.route('/srate', methods=['POST'])
def set_sampling_rate():
    if request.json['data'] == 'sampling_rate':
        data.sampling_rate = float(request.json['value'])
        print("set sampling_rate #{}".format(data.sampling_rate))
        return jsonify({'srate': data.sampling_rate})


@web_app.route('/executions', methods=['POST'])
def receive_executions():
    data.set_FOI(request.json['foi'])
    data.add_executions(request.json['executions'])
    return jsonify({'received': len(request.json['executions'])})


