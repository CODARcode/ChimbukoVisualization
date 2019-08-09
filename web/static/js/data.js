class Data {
    constructor(main) {
        //data
        this.data = [];
        this.selected_eid = [1];
        this.streaming();
        this.idx_offset = 0;//how many has poped out

        this.scoreThreshold = 0;
        this.clusterLoaded = false;
        //vis
        this.views = new Visualizations(this);
        this.views.init(this);
        this.views.addView(new DynamicGraphView(this, d3.select("#treeview")));
        this.views.addView(new TemporalView(this, d3.select("#temporalview")));
        this.views.addView(new ScatterView(this, d3.select("#overview"), 'scatterview'));
        this.views.addView(new DynamicBarChartView(this, d3.select("#deltaview"), 'deltaview'));
        this.views.addView(new HistoryView(this, d3.select("#historyview"), 'historyview'));

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

        this.SECOND = 1000 // ms
        this.delta = {};
        this.prev = {};
        this.frameID = 0;
        this.frameWindow = 30
        this.frameInterval = this.SECOND * 0.5
        this.frames = {};
        this.frames_bottom = {};
        this.renderingFrames = {};
        this.renderingFramesBottom = {};
        this.renderingDelta = {};
        this.renderingDeltaBottom = {};
        this.selectedFrames = []
        this.date = new Date();
        this.setWait = true;
        this.NUM_SELECTION_RANK = 10;
        this.history = {};
        this.selected_execution = {};

        // rendering is invoked as the thread startsd
        this.rendering(); 
    }

    rendering() {
        /**
         * Keep watching if the data has received,
         *  if so, renders view components every 0.5 sec.
         *  else, wait next 2 sec.
         */
        console.log('['+this.date.toLocaleTimeString()+'] rendering() ');
        if(this.hasReceived()){
            this.views.stream_update();
            this.frameID += 1; // maintains frame id for frontend
            this.frameInterval = this.SECOND * 0.5
        } else {
            this.frameInterval = this.SECOND * 2
        }
        setTimeout(this.rendering.bind(this), this.frameInterval);
    }

    streaming(){
        /**
         * If data has pushed from backend, the callback of EventSource is invoked
         * Receives delta and processed data
         *  stream == {
         *      rank_id = list of the number of anomalies per rank
         *   }
         * 
         *  "delta" from backend is deprecated (currently calculated in frontend side)
         *  to reflect the changes at the moment whenever the plot is drawed.
         */
        var me = this;
        var sse = new EventSource('/stream');
        sse.onmessage = function (message) {
            console.log('['+me.date.toLocaleTimeString()+'] received data');
            var d = jQuery.parseJSON(message.data);  
            me._update(d['stream']);
        };
    }

    _update(stream) {
        /**
         * concat new array to the corresponding array based on the rank
         */
        for(var rank in stream) { 
            if(!this.frames[rank]) {
                this.frames[rank] = []
            }
            this.frames[rank] = this.frames[rank].concat(stream[rank]) 
        }
    }

    getOutlierRanks(delta) {
        /**
         * Sorts delta values per rank 
         * Get top and bottom 5 ranks based on delta values
         */
        var ranks = Object.keys(delta)
        var deltaValues = Object.values(delta);
        var sortedRanks = deltaValues.map((d, i) => [ranks[i], d]) 
                        .sort(([r1, d1], [r2, d2]) => d2 - d1) 
                        .map(([r, d]) => r); 
        var top;
        var bottom;
        if( sortedRanks.length < (this.NUM_SELECTION_RANK*2) ) {
            var m = Math.floor((sortedRanks.length)/2) // adjust the number of ranks is under 10
            top = sortedRanks.slice(0, m)
            bottom = sortedRanks.slice(m)
        } else {
            top = sortedRanks.slice(0, this.NUM_SELECTION_RANK)
            bottom = sortedRanks.slice(sortedRanks.length-this.NUM_SELECTION_RANK)
        }
        return [top, bottom] 
    }

    hasReceived() {
        /**
         * Return true if data has received
         * If received, prepares rendering data
         * Gets the first element, the number of anomalies, from each list of rank
         * Considers only top and bottom selected ranks
         */
        var delta = this.updateDelta();
        this.selectedRanks = this.getOutlierRanks(delta)
        var res = false;
        for ( var rank in this.frames) {
            var rankData = this.frames[rank]
            if (rankData.length > 0) {
                var value = rankData.splice(0, 1)[0]
                if(this.selectedRanks[0].includes(rank)) {
                    res = true;
                    // if (Object.keys(this.renderingFrames).length == this.frameWindow) {
                    //     delete this.renderingFrames[this.frameID-this.frameWindow] 
                    // }
                    // if (Object.keys(this.renderingDelta).length == this.frameWindow) {
                    //     delete this.renderingDelta[this.frameID-this.frameWindow] 
                    // }
                    // if (!this.renderingFrames[this.frameID]) {
                    //     this.renderingFrames[this.frameID] = {}
                    // }
                    // if (!this.renderingDelta[this.frameID]) {
                    //     this.renderingDelta[this.frameID] = {}
                    // }
                    // this.renderingDelta[this.frameID][rank] = this.delta[rank]
                    // this.renderingFrames[this.frameID][rank] = value;
                    this.renderingDelta[rank] = delta[rank]
                } else if(this.selectedRanks[1].includes(rank)) {
                    res = true;
                    // if (Object.keys(this.renderingFramesBottom).length == this.frameWindow) {
                    //     delete this.renderingFramesBottom[this.frameID-this.frameWindow] 
                    // }
                    // if (Object.keys(this.renderingDeltaBottom).length == this.frameWindow) {
                    //     delete this.renderingDeltaBottom[this.frameID-this.frameWindow] 
                    // }
                    // if (!this.renderingFramesBottom[this.frameID]) {
                    //     this.renderingFramesBottom[this.frameID] = {}
                    // }
                    // if (!this.renderingDeltaBottom[this.frameID]) {
                    //     this.renderingDeltaBottom[this.frameID] = {}
                    // }
                    // this.renderingDeltaBottom[this.frameID][rank] = this.delta[rank]
                    // this.renderingFramesBottom[this.frameID][rank] = value;
                    this.renderingDeltaBottom[rank] = delta[rank]
                }
                if (!this.history[this.frameID]) {
                    this.history[this.frameID] = {} 
                }
                this.history[this.frameID][rank] = value;
            }
        }
        return res;
    }

    updateDelta() {
        /**
         * Calculate delta in the frontend side 
         * so that the delta can be calculated more frequently.
         */
        var curr_delta = {}
        for ( var rank in this.frames) {
            var rankData = this.frames[rank];
            if (rankData.length > 0) {
                var curr = rankData[0];
                if(this.delta[rank] === undefined) {
                    this.delta[rank] = 0
                    curr_delta[rank] = 0
                } else {
                    curr_delta[rank] = this.delta[rank]
                }
                if (this.prev[rank] === undefined){
                    this.prev[rank] = 0
                }
                var value = Math.abs(curr - this.prev[rank])
                curr_delta[rank] += value
                this.delta[rank] += value
                this.prev[rank] = curr
            } 
            // else {
            //     delete this.delta[rank]
            // }
        }
        return curr_delta
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

    _getTree(callback, execution) {
        var me = this;
        if (execution.tree) {
            callback(execution.tree, execution);
        } else {
            execution.callback = callback;
            me.fetchWithCallback({
                'type': 'tree',
                'tid': execution.tid,
                'eid': execution.eid
            }, me._saveTree.bind(me), execution);
        }
    }

    _saveTree(json, execution) {
        var callback = execution.callback;
        execution.tree = json;
        execution.tree.id = execution.eid;
        execution.tree.nodes[0].level = 0;
        execution.tree.edges.forEach(function(d){
            execution.tree.nodes[d.target].level = execution.tree.nodes[d.source].level + 1;
        });
        //add a subtree list        
        this.selected_execution = execution
        callback(execution.tree, execution);
    }

    setSelections(execution) {
        var me = this;
        this.selected_eid = execution.eid;// now use the first, will update to the center
        me._getTree(me.views.selected.bind(me), execution);
    }

    clearHight() {
        this.views.unselected();
    }

    getSelectedTree() {// now use the first, will update to the center
        return this.selected_execution.tree;
    }

    isSelected(index) {
        return this.selected_eid == index;
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