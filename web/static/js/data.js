class Data {
    constructor(main) {
        //data
        this.data = [];
        this.selectedIds = [1];
        this.streaming();
        this.idx_offset = 0;//how many has poped out

        this.scoreThreshold = 0;
        this.clusterLoaded = false;
        //vis
        this.views = new Visualizations(this);
        this.views.init(this);
        // this.views.addView(new DynamicGraphView(this, d3.select("#treeview")));
        // this.views.addView(new TemporalView(this, d3.select("#temporalview")));
        // this.views.addView(new ScatterView(this, d3.select("#overview")));
        // this.views.addView(new GlobalView(this, d3.select("#globalview")));
        this.views.addView(new StreamView(this, d3.select("#streamview")));
        this.views.addView(new FrameView(this, d3.select("#frameview")));
        this.views.addView(new CurrentView(this, d3.select("#currentview")));
        this.views.addView(new HistView(this, d3.select("#histview")));

        this.k = visOptions.clusterk;
        this.eps = visOptions.clustereps;
        this.outlier_fraction = 0.02;
        this.projectionMethod = 0;
        this.scatterLayout = [];
        this.stat = [];

        this.func_names = []
        this.prog_names = []
        this.initial_timestamp = -1
        this.prev_receive_time = -1
        this.global_rank_anomaly = {}
        this.rank_of_interest = new Set(); // by default
    }

    streaming(){
        var me = this;
        var sse = new EventSource('/stream');
        sse.onmessage = function (message) {
            console.log('----------------------------------------------')
            // var date = new Date()
            
            // if (me.prev_receive_time == -1) {
            //     me.prev_receive_time = date.getTime()
            //     console.log('First Data Arrival: ', date.toLocaleTimeString())
            // } else {
            //     var now = date.getTime()
            //     console.log('Data Arrival: ', date.toLocaleTimeString())
            //     console.log('Interval of Data Arrival: '+ ((now-me.prev_receive_time)/1000))
            //     me.prev_receive_time = now
            // }
            
            var _json = jQuery.parseJSON(message.data);  
            me.frames = _json['frames']
            console.log(me.frames)
            // me.stat = _json['stat']
            // me.scatterLayout = _json['layout'];
            // me.global_rank_anomaly = _json['global_rank']; 
            // var latest_time = -1;
            // var _start_time = -1;
            // var _end_time = -1;
            // _json['pos'].forEach(function(d, i) { //load data to front end (scatter plot view)
            //     // if (me.initial_timestamp == -1) {
            //     //     me.initial_timestamp = d[_json['layout'].indexOf('entry')] // this will be moved to backend
            //     //     // console.log('initial_timestamp: '+me.initial_timestamp)
            //     // } 
            //     // d[_json['layout'].indexOf('entry')] = d[_json['layout'].indexOf('entry')] - me.initial_timestamp;
            //     // d[_json['layout'].indexOf('exit')] = d[_json['layout'].indexOf('exit')] - me.initial_timestamp;
            //     // if (d[_json['layout'].indexOf('entry')]<0) {
            //     //     return 
            //     // }
            //     if(_start_time == -1) {
            //         _start_time = d[_json['layout'].indexOf('entry')]
            //     } else {
            //         _start_time = Math.min(_start_time, d[_json['layout'].indexOf('entry')]);
            //     } 

            //     if(_end_time == -1) {
            //         _end_time = d[_json['layout'].indexOf('exit')]
            //     } else {
            //         _end_time = Math.max(_end_time, d[_json['layout'].indexOf('exit')]);
            //     }

            //     latest_time = Math.max(latest_time, d[_json['layout'].indexOf('exit')]);// according to server, 3 is exit time
            //     me.data.push({
            //         "id": _json['tidx'][i],
            //         "eid": _json['eidx'][i],
            //         "weight": 1,
            //         "pos": d,
            //         "anomaly_score": _json['labels'][i],
            //         "prog_name": _json['prog'][i],
            //         "func_name": _json['func'][i],
            //         "cluster_label": -1,
            //         "tree": null
            //     });
            //     if(!(_json['prog'][i] in me.prog_names)) {
            //         me.prog_names.push(_json['prog'][i]);
            //     }
            //     if(!(_json['func'][i] in me.func_names)) {
            //         me.func_names.push(_json['func'][i]);
            //     }
            // });
            // var time_window = 60000000;//1 min
            // //pop data
            // while(me.data.length>0&&latest_time-time_window>me.data[0]['pos'][3]){//#
            //     me.data.shift();
            // }
            // me.idx_offset = me.data.length==0?0:me.data[0]['id'];
            // // console.log("refresh scatter plot, remove points exit before "+(latest_time-time_window)+", num of points: "+me.data.length);
            // console.log('Amount of Data: '+ _json['pos'].length)
            // console.log('Time Range of Data: ' + ((_end_time - _start_time)/1000000) + ' (Start: '+ (_start_time/1000000) + ', end: ' + (_end_time/1000000)+')')
            // console.log('Data Preparation Time: ' + ((Date.now()-me.prev_receive_time)/1000))
            me.views.stream_update();
            if (_json["percent"] >= 1.0) {
                sse.close();
                sse = null;
                console.log("sse closed");            
            }
            // console.log('Overall Processing Time: '+ ((Date.now()-me.prev_receive_time)/1000))
        };
    }

    fetchWithCallback(data, callback, options) {
        fetch('/tree', {
                method: "POST",
                body: JSON.stringify(data),
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin"

            }).then(response => response.json()
                .then(json => {
                    if (response.ok) {
                        callback(json, options);
                        return json
                    } else {
                        return Promise.reject(json)
                    }
                })
            )
            .catch(error => console.log(error));
    }

    _getTree(callback, options) {
        var me = this;
        var index = options.id-me.idx_offset;
        if (me.data[index].tree) {
            callback(me.data[index].tree, options);
        } else {
            options.callback = callback;
            me.fetchWithCallback({
                'data': 'tree',
                'value': options.id,
                'eid': options.eid
            }, me._saveTree.bind(me), options);
        }
    }

    _saveTree(json, options) {
        var me = this;
        var index = options.id-me.idx_offset;
        var callback = options.callback;

        var tree = me.data[index];
        tree.tree = json;
        tree.tree.id = options.id;
        tree.tree.nodes[0].level = 0;
        tree.tree.edges.forEach(function(d){
            tree.tree.nodes[d.target].level = tree.tree.nodes[d.source].level + 1;
        });
        //add a subtree list        
        callback(tree.tree, options);
    }
    setSelections(indices) {
        var me = this;
        this.selectedIds = indices;// now use the first, will update to the center
        if(this.selectedIds.length>0){
            me._getTree(me.views.selected.bind(me), {
                'id':me.selectedIds[0],
                'eid': me.selectedIds[1]
            });
        }
    }

    clearHight() {
        this.views.unselected();
    }

    getSelectedTree() {// now use the first, will update to the center
        return this.data[this.selectedIds[0]-this.idx_offset].tree;
    }

    isSelected(index) {
        return this.selectedIds.indexOf(index+this.idx_offset) != -1;
    }

    getScoreByIndex(index) {
        index-=this.idx_offset;
        return (this.data[index].relabel == 0) ? (this.data[index].anomaly_score) : this.data[index].relabel;
    }

    setSamplingRate(rate) {
        fetch('/srate', {
            method: "POST",
            body: JSON.stringify(rate),
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin"
        }).then(response => response.json()
            .then(json => {
                if (response.ok) {
                    return json
                } else {
                    return Promise.reject(json)
                }
            })
        )
        .catch(error => console.log(error));
    }
}