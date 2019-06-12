import json
import time
from flask import send_file, Response, jsonify, request, redirect, url_for
from web import web_app
from module.DataManager import DataManager
from utils.CommonUtils import log

data_manager = DataManager()

@web_app.route('/')
def home():
    return send_file("index.html")

@web_app.route('/tree', methods=['POST'])
def get_tree():
    if request.json['data'] == 'tree':
        tindex = request.json['value']
        log("select tree #{}".format(tindex))
        if len(data_manager.forest) > 0:
            if len(data_manager.forest[tindex]['nodes']) == 1: # first request
                data_manager.generate_tree(tindex)
            return jsonify(data_manager.forest[tindex])
        else:
            eindex = request.json['eid']
            if eindex in data_manager.executions: # first request
                return jsonify(data_manager.generate_tree_by_eid(tindex, eindex))

@web_app.route('/events', methods=['POST'])
def receive_events():
    if request.json['type'] == 'foi':
        data_manager.set_FOI(request.json['value'])
    elif request.json['type'] == 'functions': #map index 0,1,2,3,4.. to function names
        data_manager.set_functions(request.json['value'])
    elif request.json['type'] == 'labels':
        data_manager.set_labels(request.json['value'])
    elif request.json['type'] == 'event_types':
        data_manager.set_event_types(request.json['value'])
    elif request.json['type'] == 'events':
        data_manager.add_events(request.json['value'])
    elif request.json['type'] == 'info':
        start = time.time()
        if not data_manager.log_manager.is_set():
            data_manager.log_manager.start_recording(start)
        data_manager.add_to_buffer(request.json)
        # d = request.json['value']
        # data_manager.set_event_types(d['event_types'])
        # data_manager.set_functions(d['functions'])
        # data_manager.set_FOI(d['foi'])
        # data_manager.set_labels(d['labels'])
        # data_manager.add_events(d['events'])
        # data_manager.generate_forest()
        data_manager.record_response_time(time.time()-start)
    elif request.json['type'] == 'reset':
        data_manager.reset()
    return jsonify({'received': len(data_manager.forest)})
 
def _stream():
    while(not data_manager.changed):
        time.sleep(0.1)
    #data_manager.generate_forest()
    #send back forest data
    # if data_manager.pos:
    with data_manager.lock: 
        data_manager.record_push_time(time.time())
        # log('sending', len(data_manager.pos), 'data to front')
        # yield """
        #     retry: 10000\ndata:{"pos":%s, "layout":%s, "labels":%s, "prog":%s, "func":%s, "tidx":%s, "eidx":%s, "stat":%s, "global_rank":%s}\n\n
        # """ % (json.dumps(data_manager.pos), json.dumps(data_manager.layout), json.dumps(data_manager.forest_labels), json.dumps(data_manager.prog), 
        # json.dumps(data_manager.func_names), json.dumps(data_manager.tidx), json.dumps(data_manager.eidx), json.dumps(data_manager.stat), json.dumps(data_manager.GRA) )
        # data_manager.reset_forest()
        
        yield """
            retry: 10000\ndata:{"stream":%s}\n\n
        """ % ( json.dumps(data_manager.stream) )
        data_manager.get_recording(time.time())
        data_manager.refresh()
        data_manager.changed = False

@web_app.route('/stream')
def stream():
    return Response(
        _stream(),
        mimetype='text/event-stream')

@web_app.route('/srate', methods=['POST'])
def set_sampling_rate():
    if request.json['data'] == 'sampling_rate':
        data_manager.sampling_rate = float(request.json['value'])
        log("set sampling_rate #{}".format(data_manager.sampling_rate))
        return jsonify({'srate': data_manager.sampling_rate})

@web_app.route('/executions', methods=['POST'])
def receive_executions():
    start = time.time()
    if not data_manager.log_manager.is_set():
        data_manager.log_manager.start_recording(start)
    else:
        data_manager.log_manager.add_receive_time(start)
    #### 
    data_manager.add_to_buffer(request.json)
    ####
    # data_manager.set_statistics(request.json['stat'])
    # data_manager.add_executions(request.json['executions'])
    ####
    data_manager.record_response_time(time.time()-start)
    return jsonify({'received': len(request.json['executions'])})


