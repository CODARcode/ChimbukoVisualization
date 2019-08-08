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

@web_app.route('/stream')
def stream():
    """
    Invoked by view clients, 
    Calls _stream() function which constantly pushes data to frontend.
    """
    return Response(
        _stream(),
        mimetype='text/event-stream')

def _stream():
    """
    Keeps watching if data has changed.
    If changed, pushes processed data to frontend application.
    """
    while(not data_manager.changed):
        time.sleep(0.1)
    
    with data_manager.lock: 
        data_manager.record_push_time(time.time())
        
        yield """
            retry: 10000\ndata:{"stream":%s, "delta": %s}\n\n
        """ % ( json.dumps(data_manager.stream), json.dumps(data_manager.delta) )
        data_manager.get_recording(time.time())
        data_manager.refresh()
        data_manager.changed = False

@web_app.route('/executions', methods=['POST'])
def receive_executions():
    """
    Receives executions from AD, and puts to buffer.
    """
    start = time.time()
    if not data_manager.log_manager.is_set():
        data_manager.log_manager.start_recording(start)
    else:
        data_manager.log_manager.add_receive_time(start)
    data_manager.add_to_buffer(request.json)
    data_manager.record_response_time(time.time()-start)
    return jsonify({'received': len(request.json['executions'])})

@web_app.route('/tree', methods=['POST'])
def get_tree():
    """
    Returns tree  
        by tree_id if 'forest' is already generated (deprecated)
        by execution_id after creating based on the current executions
    """
    if request.json['data'] == 'tree':
        tindex = request.json['value']
        log("select tree #{}".format(tindex))
        if len(data_manager.forest) > 0: # deprecated case 
            if len(data_manager.forest[tindex]['nodes']) == 1: # first request
                data_manager.generate_tree(tindex)
            return jsonify(data_manager.forest[tindex])
        else: # in-situ analysis
            eindex = request.json['eid']
            if eindex in data_manager.executions: 
                return jsonify(data_manager.generate_tree_by_eid(tindex, eindex))

@web_app.route('/scatterplot', methods=['POST'])
def get_scatterplot ():
    '''
    Returns executions queried by given time period (start, end)
    '''
    start = request.json['start']
    end = request.json['end']
    scatterplot = data_manager.get_scatterplot(start, end)
    return jsonify(scatterplot)

@web_app.route('/srate', methods=['POST'])
def set_sampling_rate():
    """
    (Deprecated)
    Sets sampling_rate as user adjusts.
    sampling_rate is utilized to uniformly downsample the visulizing data 
    """
    if request.json['data'] == 'sampling_rate':
        data_manager.sampling_rate = float(request.json['value'])
        log("set sampling_rate #{}".format(data_manager.sampling_rate))
        return jsonify({'srate': data_manager.sampling_rate})

@web_app.route('/events', methods=['POST'])
def receive_events():
    """
    (Deprecated) 
    Handles requests according to given 'type' 
        foi: sets foi 
        functions: map index 0,1,2,3,4.. to function names 
        labels: sets anomaly labels 
        event_types: sets event_types, such as receive, send, ... 
        events: sets raw events 
        info: adds received data frame to buffer 
        reset: initializes backend global variables 
    """
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
        data_manager.record_response_time(time.time()-start)
    elif request.json['type'] == 'reset':
        data_manager.reset()
    return jsonify({'received': len(data_manager.forest)})