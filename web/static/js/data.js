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
        this.views.addView(new RankView(this, d3.select("#rankview")));
        this.views.addView(new HistoryView(this, d3.select("#historyview")));

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

        this.streamCurrent = {};
        this.streamAccumulated = {};
        this.frameWindow = 10
        this.frameInterval = 500 // ms
        this.frames = {};
        this.frameID = -1;
        this.date = new Date();
        this.rendering();
    }

    streaming(){
        var me = this;
        var sse = new EventSource('/stream');
        sse.onmessage = function (message) {
            console.log('['+me.date.toLocaleTimeString()+'] streaming()');
            var d = jQuery.parseJSON(message.data);  
            var stream = d['stream']
            me.updateStream(stream)
        };
    }

    updateStream(stream) {
        for(var rank in stream) {
            if(!this.streamCurrent[rank]) {
                this.streamCurrent[rank] = 0
            }
            if(!this.streamAccumulated[rank]) {
                this.streamAccumulated[rank] = 0
            }
            this.streamCurrent[rank] += stream[rank]
            this.streamAccumulated[rank] += stream[rank]
        }
    }
    
    resetStream() {
        this.streamCurrent = {}
    }

    makeFrame() {
        this.frameID += 1;
        this.frames[this.frameID] = this.streamCurrent;
        this.removeOldFrame();
        this.resetStream();
    }

    removeOldFrame() {
        var oldID = this.frameID - this.frameWindow
        if (this.frames[oldID]!==undefined) {
            delete this.frames[oldID];
        }
    }
    
    rendering() {
        if(Object.keys(this.streamAccumulated).length >0) {
            var me = this; 
            console.log('['+this.date.toLocaleTimeString()+'] rendering()');
            this.makeFrame();
            // console.log(this.frames)
            // console.log(this.streamAccumulated)
            this.views.stream_update();
        }
        setTimeout(this.rendering.bind(this), this.frameInterval);
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